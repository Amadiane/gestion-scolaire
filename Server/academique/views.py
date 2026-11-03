import cloudinary.utils
from django.db.models import Count, Q
from rest_framework import viewsets
from rest_framework.decorators import action, api_view
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from eleves.models import Eleve, Inscription
from eleves.serializers import EleveSerializer
from tenants.mixins import TenantScopedQuerysetMixin
from tenants.permissions import IsDirecteur, IsStaffUser, IsSubscriptionActive

from decimal import Decimal
from django.db import transaction
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework.exceptions import ValidationError as DRFValidationError

from .models import AnneeScolaire, Niveau, Matiere, Classe, Note, Bulletin, Affectation
from .pdf import generer_pdf_bulletin
from .scoping import affectations_de, est_enseignant, filtre_notes, ids_classes
from .serializers import (
    AffectationSerializer, AnneeScolaireDetailSerializer, AnneeScolaireSerializer,
    BulletinSerializer, ClasseAvecEffectifSerializer, ClasseSerializer,
    MatiereSerializer, NiveauSerializer, NoteSerializer,
)


def _ecole_ou_erreur(request, objet):
    ecole = request.user.ecole
    if ecole is None:
        raise ValidationError(f"Impossible de créer {objet} : aucune école associée à ce compte.")
    return ecole


class AnneeScolaireViewSet(TenantScopedQuerysetMixin, viewsets.ModelViewSet):
    queryset = AnneeScolaire.objects.all()
    serializer_class = AnneeScolaireSerializer

    def queryset_enseignant(self, qs, user):
        return qs.filter(classes__id__in=ids_classes(user)).distinct()

    def perform_create(self, serializer):
        serializer.save(ecole=_ecole_ou_erreur(self.request, "une année scolaire"))

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        classe_serializer = AnneeScolaireSerializer if est_enseignant(request.user) else AnneeScolaireDetailSerializer
        return Response(classe_serializer(instance).data)

    def perform_destroy(self, instance):
        if instance.est_active:
            raise ValidationError(
                "Impossible de supprimer l'année scolaire active. "
                "Activez d'abord une autre année avant de supprimer celle-ci."
            )
        if instance.classes.exists():
            raise ValidationError("Impossible de supprimer cette année : des classes lui sont déjà rattachées.")
        instance.delete()


class NiveauViewSet(TenantScopedQuerysetMixin, viewsets.ModelViewSet):
    queryset = Niveau.objects.all()
    serializer_class = NiveauSerializer

    def queryset_enseignant(self, qs, user):
        return qs

    def perform_create(self, serializer):
        serializer.save(ecole=_ecole_ou_erreur(self.request, "un niveau"))


class MatiereViewSet(TenantScopedQuerysetMixin, viewsets.ModelViewSet):
    queryset = Matiere.objects.all()
    serializer_class = MatiereSerializer

    def queryset_enseignant(self, qs, user):
        return qs

    def perform_create(self, serializer):
        serializer.save(ecole=_ecole_ou_erreur(self.request, "une matière"))


class ClasseViewSet(TenantScopedQuerysetMixin, viewsets.ModelViewSet):
    queryset = Classe.objects.select_related("niveau")
    serializer_class = ClasseSerializer

    def queryset_enseignant(self, qs, user):
        return qs.filter(id__in=ids_classes(user))

    def perform_create(self, serializer):
        serializer.save(ecole=_ecole_ou_erreur(self.request, "une classe"))

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        return Response(ClasseAvecEffectifSerializer(queryset, many=True).data)

    @action(detail=True, methods=["get"])
    def eleves(self, request, pk=None):
        classe = self.get_object()
        ids = classe.inscriptions.filter(annee_scolaire=classe.annee_scolaire).values_list("eleve_id", flat=True)
        return Response(EleveSerializer(Eleve.objects.filter(id__in=ids), many=True).data)


def _premier_message(erreurs):
    premier = next(iter(erreurs.values()), "Données invalides.")
    if isinstance(premier, (list, tuple)) and premier:
        premier = premier[0]
    return str(premier)


class NoteViewSet(TenantScopedQuerysetMixin, viewsets.ModelViewSet):
    queryset = Note.objects.select_related("eleve", "matiere")
    serializer_class = NoteSerializer
    # Les enseignants peuvent écrire ici : le serializer vérifie leurs affectations.
    permission_classes = [IsSubscriptionActive, IsStaffUser]

    CHAMPS_SYNC = ("eleve", "matiere", "classe", "annee_scolaire", "trimestre", "valeur")

    def queryset_enseignant(self, qs, user):
        return qs.filter(filtre_notes(user))

    def perform_create(self, serializer):
        serializer.save(ecole=_ecole_ou_erreur(self.request, "une note"), saisi_par=self.request.user)

    def _synchroniser_une(self, request, ecole, op):
        """Crée ou met à jour une note. Idempotent : rejouer la même opération ne change rien."""
        donnees = {k: op.get(k) for k in self.CHAMPS_SYNC}
        existante = (
            self.get_queryset()
            .filter(
                eleve_id=donnees["eleve"], matiere_id=donnees["matiere"], classe_id=donnees["classe"],
                annee_scolaire_id=donnees["annee_scolaire"], trimestre=donnees["trimestre"],
            )
            .order_by("-date_saisie")
            .first()
        )
        serializer = self.get_serializer(existante, data=donnees, partial=existante is not None)
        if not serializer.is_valid():
            return {"statut": "erreur", "detail": _premier_message(serializer.errors)}

        if existante is None:
            note = serializer.save(ecole=ecole, saisi_par=request.user)
            return {"statut": "cree", "id": note.id}

        ancienne = existante.valeur
        if Decimal(str(ancienne)) == serializer.validated_data["valeur"]:
            return {"statut": "identique", "id": existante.id}
        note = serializer.save()
        return {
            "statut": "modifie", "id": note.id,
            "ancienne_valeur": str(ancienne), "valeur": str(note.valeur),
        }

    @action(detail=False, methods=["post"], url_path="synchroniser")
    def synchroniser(self, request):
        operations = request.data.get("operations")
        if not isinstance(operations, list) or len(operations) > 500:
            return Response({"detail": "Liste 'operations' requise (500 maximum)."}, status=400)
        try:
            ecole = _ecole_ou_erreur(request, "une note")
        except DRFValidationError as e:
            return Response({"detail": str(e.detail)}, status=400)

        resultats = []
        for op in operations:
            client_id = op.get("client_id") if isinstance(op, dict) else None
            try:
                with transaction.atomic():
                    resultat = self._synchroniser_une(request, ecole, op)
            except DjangoValidationError as e:
                resultat = {"statut": "erreur", "detail": e.messages[0] if e.messages else "Données invalides."}
            except DRFValidationError as e:
                resultat = {"statut": "erreur", "detail": str(e.detail)}
            except (ValueError, TypeError, KeyError, AttributeError):
                resultat = {"statut": "erreur", "detail": "Opération mal formée."}
            resultat["client_id"] = client_id
            resultats.append(resultat)
        return Response({"resultats": resultats})


class BulletinViewSet(TenantScopedQuerysetMixin, viewsets.ModelViewSet):
    queryset = Bulletin.objects.select_related("eleve", "classe__niveau")
    serializer_class = BulletinSerializer

    def queryset_enseignant(self, qs, user):
        return qs.filter(classe_id__in=ids_classes(user))

    def perform_create(self, serializer):
        serializer.save(ecole=_ecole_ou_erreur(self.request, "un bulletin"))

    @action(detail=True, methods=["post"], permission_classes=[IsSubscriptionActive, IsDirecteur])
    def valider(self, request, pk=None):
        bulletin = self.get_object()
        bulletin.valider(request.user)
        return Response(BulletinSerializer(bulletin).data)

    @action(detail=True, methods=["post"])
    def generer_pdf(self, request, pk=None):
        bulletin = self.get_object()
        public_id, _ = generer_pdf_bulletin(bulletin)
        bulletin.fichier_pdf = public_id
        bulletin.save(update_fields=["fichier_pdf"])
        return Response({"public_id": public_id})

    @action(detail=True, methods=["get"])
    def telecharger_pdf(self, request, pk=None):
        bulletin = self.get_object()
        public_id, _ = generer_pdf_bulletin(bulletin)
        bulletin.fichier_pdf = public_id
        bulletin.save(update_fields=["fichier_pdf"])
        url = cloudinary.utils.private_download_url(
            public_id, "pdf", resource_type="raw", type="authenticated", attachment=True
        )
        return Response({"url": url})

    @action(detail=False, methods=["get"])
    def rechercher(self, request):
        terme = request.query_params.get("q", "").strip()
        if not terme:
            return Response({"detail": "Paramètre 'q' requis."}, status=400)
        queryset = self.get_queryset().filter(
            Q(eleve__nom__icontains=terme)
            | Q(eleve__prenom__icontains=terme)
            | Q(eleve__matricule__icontains=terme)
            | Q(eleve__parents__nom__icontains=terme)
            | Q(eleve__parents__prenom__icontains=terme)
        ).distinct()
        return Response(self.get_serializer(queryset, many=True).data)


class AffectationViewSet(TenantScopedQuerysetMixin, viewsets.ModelViewSet):
    """Le directeur décide qui enseigne quoi, dans quelle classe."""
    queryset = Affectation.objects.select_related("enseignant", "classe", "matiere")
    serializer_class = AffectationSerializer
    permission_classes = [IsSubscriptionActive, IsDirecteur]

    def perform_create(self, serializer):
        serializer.save(ecole=_ecole_ou_erreur(self.request, "une affectation"))


@api_view(["GET"])
def mes_affectations(request):
    """Classes et matières de l'enseignant connecté."""
    user = request.user
    if not est_enseignant(user):
        return Response({"detail": "Réservé aux enseignants."}, status=403)

    affectations = (
        affectations_de(user)
        .select_related("classe__niveau", "matiere")
        .order_by("classe__niveau__ordre", "classe__nom", "matiere__nom")
    )
    effectifs = dict(
        Inscription.objects.filter(classe_id__in=ids_classes(user))
        .values_list("classe_id").annotate(n=Count("id"))
    )
    return Response([
        {
            "id": a.id,
            "classe_id": a.classe_id,
            "classe_nom": a.classe.nom,
            "niveau_nom": a.classe.niveau.nom,
            "bareme_note": a.classe.niveau.bareme_note,
            "annee_scolaire": a.classe.annee_scolaire_id,
            "matiere_id": a.matiere_id,
            "matiere_nom": a.matiere.nom,
            "effectif": effectifs.get(a.classe_id, 0),
        }
        for a in affectations
    ])
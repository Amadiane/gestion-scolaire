import base64
import uuid

from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from academique.scoping import est_enseignant, ids_classes
from tenants.mixins import TenantScopedQuerysetMixin

from .models import Eleve, Inscription, Parent, RelationParentEleve
from .serializers import (
    EleveSerializer, InscriptionSerializer, ParentDetailSerializer, ParentSerializer,
)


def _premier_message(erreurs):
    premier = next(iter(erreurs.values()), "Données invalides.")
    if isinstance(premier, (list, tuple)) and premier:
        premier = premier[0]
    return str(premier)


class ErreurOperation(Exception):
    """Fait échouer (et annuler) une opération de synchronisation avec un message lisible."""


def _photo_depuis_data_url(valeur):
    _, _, brut = valeur.partition(",")
    contenu = base64.b64decode(brut)
    if len(contenu) > 3 * 1024 * 1024:
        raise ErreurOperation("Photo trop volumineuse.")
    return SimpleUploadedFile("photo.jpg", contenu, content_type="image/jpeg")


class ParentViewSet(TenantScopedQuerysetMixin, viewsets.ModelViewSet):
    # Pas de queryset_enseignant : les enseignants n'accèdent pas aux
    # coordonnées des parents.
    queryset = Parent.objects.all()
    serializer_class = ParentSerializer

    def perform_create(self, serializer):
        ecole = self.request.user.ecole
        if ecole is None:
            raise ValidationError("Impossible de créer un parent : aucune école n'est associée à ce compte.")
        serializer.save(ecole=ecole)

    def retrieve(self, request, *args, **kwargs):
        return Response(ParentDetailSerializer(self.get_object()).data)


# class EleveViewSet(TenantScopedQuerysetMixin, viewsets.ModelViewSet):
#     queryset = Eleve.objects.all()
#     serializer_class = EleveSerializer
class EleveViewSet(TenantScopedQuerysetMixin, viewsets.ModelViewSet):
    queryset = Eleve.objects.order_by("matricule")   # avant : Eleve.objects.all()
    serializer_class = EleveSerializer

    def queryset_enseignant(self, qs, user):
        return qs.filter(inscriptions__classe_id__in=ids_classes(user)).distinct()

    def perform_create(self, serializer):
        ecole = self.request.user.ecole
        if ecole is None:
            raise ValidationError("Impossible de créer un élève : aucune école n'est associée à ce compte.")
        serializer.save(ecole=ecole)

    @action(detail=True, methods=["post"])
    def lier_parent(self, request, pk=None):
        eleve = self.get_object()
        parent_id = request.data.get("parent")
        if not parent_id:
            return Response({"detail": "Le champ 'parent' est requis."}, status=400)
        # Le parent doit appartenir à la même école que l'élève.
        parent = get_object_or_404(Parent, pk=parent_id, ecole=eleve.ecole)
        relation, created = RelationParentEleve.objects.get_or_create(
            eleve=eleve, parent=parent,
            defaults={
                "type_lien": request.data.get("type_lien", "autre"),
                "contact_principal": request.data.get("contact_principal", False),
            },
        )
        return Response({"id": relation.id, "created": created}, status=201 if created else 200)

    # ---------- Synchronisation des saisies faites hors ligne ----------

    def _synchroniser_une(self, request, ecole, op):
        """Crée l'élève, son inscription et ses liens parents en un seul bloc. Idempotent."""
        try:
            reference = uuid.UUID(str(op.get("reference")))
        except ValueError:
            raise ErreurOperation("Référence de l'opération invalide.")

        deja = Eleve.objects.filter(ecole=ecole, reference_client=reference).first()
        if deja:
            return {"statut": "identique", "id": deja.id, "matricule": deja.matricule}

        nom = (op.get("nom") or "").strip()
        prenom = (op.get("prenom") or "").strip()
        if Eleve.objects.filter(
            ecole=ecole, nom__iexact=nom, prenom__iexact=prenom, date_naissance=op.get("date_naissance")
        ).exists():
            raise ErreurOperation(
                f"Un élève « {prenom} {nom} » né le {op.get('date_naissance')} existe déjà : "
                "opération abandonnée pour éviter un doublon."
            )

        donnees = {
            "nom": nom, "prenom": prenom,
            "date_naissance": op.get("date_naissance"),
            "lieu_naissance": op.get("lieu_naissance") or "",
            "sexe": op.get("sexe"),
        }
        if op.get("photo"):
            donnees["photo"] = _photo_depuis_data_url(op["photo"])

        serializer = EleveSerializer(data=donnees, context={"request": request})
        if not serializer.is_valid():
            raise ErreurOperation(_premier_message(serializer.errors))
        eleve = serializer.save(ecole=ecole, reference_client=reference)

        if op.get("classe") and op.get("annee_scolaire"):
            inscription = InscriptionSerializer(
                data={"eleve": eleve.id, "classe": op["classe"], "annee_scolaire": op["annee_scolaire"]},
                context={"request": request},
            )
            if not inscription.is_valid():
                raise ErreurOperation(_premier_message(inscription.errors))
            inscription.save()

        for lien in op.get("parents") or []:
            if lien.get("mode") == "nouveau":
                nom_p = (lien.get("nouveauNom") or "").strip()
                tel = (lien.get("nouveauTelephone") or "").strip()
                if not nom_p or not tel:
                    continue
                parent = Parent.objects.filter(ecole=ecole, telephone=tel, nom__iexact=nom_p).first()
                if parent is None:
                    ps = ParentSerializer(
                        data={"nom": nom_p, "prenom": lien.get("nouveauPrenom") or "", "telephone": tel},
                        context={"request": request},
                    )
                    if not ps.is_valid():
                        raise ErreurOperation(_premier_message(ps.errors))
                    parent = ps.save(ecole=ecole)
            else:
                if not lien.get("parent"):
                    continue
                parent = Parent.objects.filter(pk=lien["parent"], ecole=ecole).first()
                if parent is None:
                    raise ErreurOperation("Un parent choisi n'existe plus.")

            RelationParentEleve.objects.get_or_create(
                eleve=eleve, parent=parent,
                defaults={
                    "type_lien": lien.get("type_lien") or "autre",
                    "contact_principal": bool(lien.get("contact_principal")),
                },
            )

        return {"statut": "cree", "id": eleve.id, "matricule": eleve.matricule}

    @action(detail=False, methods=["post"], url_path="synchroniser")
    def synchroniser(self, request):
        operations = request.data.get("operations")
        if not isinstance(operations, list) or len(operations) > 50:
            return Response({"detail": "Liste 'operations' requise (50 maximum)."}, status=400)
        ecole = request.user.ecole
        if ecole is None:
            return Response({"detail": "Aucune école n'est associée à ce compte."}, status=400)

        resultats = []
        for op in operations:
            client_id = op.get("client_id") if isinstance(op, dict) else None
            try:
                with transaction.atomic():
                    resultat = self._synchroniser_une(request, ecole, op)
            except ErreurOperation as e:
                resultat = {"statut": "erreur", "detail": str(e)}
            except DjangoValidationError as e:
                resultat = {"statut": "erreur", "detail": e.messages[0] if e.messages else "Données invalides."}
            except (ValueError, TypeError, KeyError, AttributeError):
                resultat = {"statut": "erreur", "detail": "Opération mal formée."}
            resultat["client_id"] = client_id
            resultats.append(resultat)
        return Response({"resultats": resultats})


class InscriptionViewSet(viewsets.ModelViewSet):
    queryset = Inscription.objects.all()
    serializer_class = InscriptionSerializer

    def get_queryset(self):
        user = self.request.user
        if user.is_superuser:
            return Inscription.objects.all()
        qs = Inscription.objects.filter(eleve__ecole=user.ecole)
        if est_enseignant(user):
            qs = qs.filter(classe_id__in=ids_classes(user))
        return qs
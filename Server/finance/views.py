import uuid
from decimal import Decimal, InvalidOperation

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.db.models import Sum
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from academique.models import AnneeScolaire
from eleves.models import Eleve
from tenants.mixins import TenantScopedQuerysetMixin

from .models import FraisScolarite, Paiement, RemiseEleve
from .pdf import generer_recu_pdf
from .permissions import PERMISSIONS_FINANCE
from .serializers import FraisScolariteSerializer, PaiementSerializer
from .services import calculer_situations


def _contexte(request):
    ecole = request.user.ecole
    if ecole is None:
        raise ValidationError("Aucune école n'est associée à ce compte.")
    annee = AnneeScolaire.objects.filter(ecole=ecole, est_active=True).first()
    if annee is None:
        raise ValidationError("Aucune année scolaire active : activez-en une avant d'utiliser la finance.")
    return ecole, annee


def _uuid_ou_none(valeur):
    try:
        return uuid.UUID(str(valeur)) if valeur else None
    except ValueError:
        return None


def _premier_message(erreurs):
    premier = next(iter(erreurs.values()), "Données invalides.")
    if isinstance(premier, (list, tuple)) and premier:
        premier = premier[0]
    return str(premier)


def _situation_detaillee(ecole, annee, eleve):
    situations = calculer_situations(ecole, annee, eleve_id=eleve.id)
    if not situations:
        return {"inscrit": False}
    sit = situations[0]
    sit["inscrit"] = True
    sit["frais"] = [
        {"libelle": f.libelle, "montant": int(f.montant)}
        for f in FraisScolarite.objects.filter(ecole=ecole, annee_scolaire=annee, niveau_id=sit["niveau_id"])
    ]
    remise = RemiseEleve.objects.filter(ecole=ecole, annee_scolaire=annee, eleve=eleve).first()
    sit["motif_remise"] = remise.motif if remise else ""
    return sit


class FraisScolariteViewSet(TenantScopedQuerysetMixin, viewsets.ModelViewSet):
    queryset = FraisScolarite.objects.select_related("niveau")
    serializer_class = FraisScolariteSerializer
    permission_classes = PERMISSIONS_FINANCE

    def perform_create(self, serializer):
        ecole, annee = _contexte(self.request)
        niveau = serializer.validated_data["niveau"]
        libelle = serializer.validated_data.get("libelle", "Scolarité")
        if FraisScolarite.objects.filter(
            ecole=ecole, annee_scolaire=annee, niveau=niveau, libelle=libelle
        ).exists():
            raise ValidationError(f"« {libelle} » existe déjà pour ce niveau.")
        serializer.save(ecole=ecole, annee_scolaire=annee)


class PaiementViewSet(TenantScopedQuerysetMixin, viewsets.ModelViewSet):
    queryset = Paiement.objects.select_related("eleve")
    serializer_class = PaiementSerializer
    permission_classes = PERMISSIONS_FINANCE

    CHAMPS_SYNC = ("eleve", "montant", "date_paiement", "mode", "reference", "note")

    def get_queryset(self):
        qs = super().get_queryset()
        eleve = self.request.query_params.get("eleve")
        if eleve:
            qs = qs.filter(eleve_id=eleve)
        if self.action == "list":
            # Par défaut : l'année active seulement.
            annee = AnneeScolaire.objects.filter(
                ecole=self.request.user.ecole, est_active=True
            ).first()
            if annee:
                qs = qs.filter(annee_scolaire=annee)
        return qs

    def create(self, request, *args, **kwargs):
        # Si le même encaissement (même référence d'appareil) a déjà été enregistré
        # — réponse perdue, nouvel essai — on renvoie l'existant au lieu d'en créer un second.
        ref = _uuid_ou_none(request.data.get("uuid_client"))
        if ref and request.user.ecole_id:
            deja = Paiement.objects.filter(ecole_id=request.user.ecole_id, reference_client=ref).first()
            if deja:
                return Response(self.get_serializer(deja).data, status=200)
        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        ecole, annee = _contexte(self.request)
        ref = _uuid_ou_none(self.request.data.get("uuid_client"))
        extra = {"reference_client": ref} if ref else {}
        serializer.save(ecole=ecole, annee_scolaire=annee, enregistre_par=self.request.user, **extra)

    @action(detail=True, methods=["get"])
    def recu(self, request, pk=None):
        paiement = self.get_object()
        reponse = HttpResponse(generer_recu_pdf(paiement), content_type="application/pdf")
        reponse["Content-Disposition"] = f'attachment; filename="{paiement.numero_recu}.pdf"'
        return reponse

    # ---------- Synchronisation des encaissements faits hors ligne ----------

    def _synchroniser_un(self, request, ecole, annee, op):
        ref = _uuid_ou_none(op.get("uuid_client"))
        if ref is None:
            return {"statut": "erreur", "detail": "Référence de l'opération invalide."}

        deja = Paiement.objects.filter(ecole=ecole, reference_client=ref).first()
        if deja:
            return {"statut": "identique", "id": deja.id, "numero_recu": deja.numero_recu}

        donnees = {k: op.get(k) for k in self.CHAMPS_SYNC}
        donnees["reference"] = donnees["reference"] or ""
        donnees["note"] = donnees["note"] or ""
        serializer = self.get_serializer(data=donnees)
        if not serializer.is_valid():
            return {"statut": "erreur", "detail": _premier_message(serializer.errors)}

        paiement = serializer.save(
            ecole=ecole, annee_scolaire=annee, enregistre_par=request.user, reference_client=ref
        )
        return {"statut": "cree", "id": paiement.id, "numero_recu": paiement.numero_recu}

    @action(detail=False, methods=["post"], url_path="synchroniser")
    def synchroniser(self, request):
        operations = request.data.get("operations")
        if not isinstance(operations, list) or len(operations) > 200:
            return Response({"detail": "Liste 'operations' requise (200 maximum)."}, status=400)
        ecole, annee = _contexte(request)

        resultats = []
        for op in operations:
            client_id = op.get("client_id") if isinstance(op, dict) else None
            try:
                with transaction.atomic():
                    resultat = self._synchroniser_un(request, ecole, annee, op)
            except DjangoValidationError as e:
                resultat = {"statut": "erreur", "detail": e.messages[0] if e.messages else "Données invalides."}
            except (ValueError, TypeError, KeyError, AttributeError):
                resultat = {"statut": "erreur", "detail": "Opération mal formée."}
            resultat["client_id"] = client_id
            resultats.append(resultat)
        return Response({"resultats": resultats})


@api_view(["GET"])
@permission_classes(PERMISSIONS_FINANCE)
def situation(request):
    ecole, annee = _contexte(request)
    eleve = get_object_or_404(Eleve, pk=request.query_params.get("eleve"), ecole=ecole)
    return Response(_situation_detaillee(ecole, annee, eleve))


@api_view(["GET"])
@permission_classes(PERMISSIONS_FINANCE)
def arrieres(request):
    ecole, annee = _contexte(request)
    toutes = calculer_situations(ecole, annee)
    en_retard = sorted((s for s in toutes if s["reste"] > 0), key=lambda s: -s["reste"])
    return Response({
        "nb_eleves": len(en_retard),
        "total_reste": sum(s["reste"] for s in en_retard),
        "total_a_payer": sum(s["a_payer"] for s in toutes),
        "total_paye": sum(s["paye"] for s in toutes),
        "eleves": en_retard,
    })


@api_view(["POST"])
@permission_classes(PERMISSIONS_FINANCE)
def remise(request):
    ecole, annee = _contexte(request)
    eleve = get_object_or_404(Eleve, pk=request.data.get("eleve"), ecole=ecole)
    try:
        montant = Decimal(str(request.data.get("montant") or 0))
    except InvalidOperation:
        raise ValidationError("Montant invalide.")
    if montant < 0:
        raise ValidationError("La remise ne peut pas être négative.")
    RemiseEleve.objects.update_or_create(
        ecole=ecole, eleve=eleve, annee_scolaire=annee,
        defaults={"montant": montant, "motif": request.data.get("motif", "")[:200]},
    )
    return Response(_situation_detaillee(ecole, annee, eleve))
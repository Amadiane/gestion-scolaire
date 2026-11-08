from datetime import date as _date

from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import BasePermission, IsAuthenticated
from rest_framework.response import Response

from eleves.models import Eleve, RelationParentEleve
from tenants.permissions import IsSubscriptionActive

from .alertes_models import AlerteParent
from .models import PresenceEleve

ROLES_ALERTES = {"directeur", "secretaire", "surveillant"}


class PeutAlerterParents(BasePermission):
    def has_permission(self, request, view):
        u = request.user
        return bool(u and u.is_authenticated and getattr(u, "role", None) in ROLES_ALERTES and u.ecole_id)


def _lire_date(valeur):
    if not valeur:
        return timezone.localdate()
    try:
        d = _date.fromisoformat(str(valeur)[:10])
    except ValueError:
        return None
    return d if d <= timezone.localdate() else None


@api_view(["GET"])
@permission_classes([IsAuthenticated, IsSubscriptionActive, PeutAlerterParents])
def alertes_du_jour(request):
    """Élèves absents / en retard à une date, avec le parent à contacter."""
    ecole = request.user.ecole
    jour = _lire_date(request.query_params.get("date"))
    if jour is None:
        return Response({"detail": "Date invalide ou dans le futur."}, status=status.HTTP_400_BAD_REQUEST)

    lignes = list(
        PresenceEleve.objects
        .filter(ecole=ecole, date=jour, statut__in=["absent", "retard"])
        .select_related("eleve", "classe")
        .order_by("classe__id", "eleve__nom", "eleve__prenom")
    )
    eleve_ids = [l.eleve_id for l in lignes]

    # Parent à contacter : contact principal d'abord, sinon le premier lien.
    contacts = {}
    relations = (
        RelationParentEleve.objects
        .filter(eleve_id__in=eleve_ids, parent__ecole=ecole)
        .select_related("parent")
        .order_by("-contact_principal", "id")
    )
    for r in relations:
        contacts.setdefault(r.eleve_id, r)

    prevenus = {
        a.eleve_id: a
        for a in AlerteParent.objects.filter(ecole=ecole, date=jour, eleve_id__in=eleve_ids)
    }

    resultats = []
    for l in lignes:
        rel = contacts.get(l.eleve_id)
        alerte = prevenus.get(l.eleve_id)
        resultats.append({
            "eleve_id": l.eleve_id,
            "nom": l.eleve.nom,
            "prenom": l.eleve.prenom,
            "sexe": l.eleve.sexe,
            "classe_id": l.classe_id,
            "classe": str(l.classe),
            "statut": l.statut,
            "remarque": l.remarque,
            "parent": None if not rel else {
                "nom": rel.parent.nom,
                "prenom": rel.parent.prenom,
                "telephone": rel.parent.telephone,
                "lien": rel.get_type_lien_display(),
            },
            "prevenu": alerte is not None,
            "prevenu_le": alerte.envoye_le if alerte else None,
        })

    return Response({"ecole": ecole.nom, "date": jour.isoformat(), "alertes": resultats})


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsSubscriptionActive, PeutAlerterParents])
def marquer_alerte(request):
    """Marque (ou démarque) un élève comme « parent prévenu » pour un jour."""
    ecole = request.user.ecole
    jour = _lire_date(request.data.get("date"))
    if jour is None:
        return Response({"detail": "Date invalide."}, status=status.HTTP_400_BAD_REQUEST)

    try:
        eleve = Eleve.objects.get(pk=request.data.get("eleve_id"), ecole=ecole)
    except (Eleve.DoesNotExist, ValueError, TypeError):
        return Response({"detail": "Élève introuvable."}, status=status.HTTP_404_NOT_FOUND)

    if request.data.get("prevenu", True):
        presence = PresenceEleve.objects.filter(ecole=ecole, eleve=eleve, date=jour).first()
        AlerteParent.objects.update_or_create(
            eleve=eleve, date=jour,
            defaults={
                "ecole": ecole,
                "motif": presence.statut if presence else "absent",
                "envoye_par": request.user,
            },
        )
        return Response({"prevenu": True})

    AlerteParent.objects.filter(ecole=ecole, eleve=eleve, date=jour).delete()
    return Response({"prevenu": False})
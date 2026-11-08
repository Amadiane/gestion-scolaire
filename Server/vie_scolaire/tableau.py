from collections import defaultdict
from datetime import timedelta

from django.db.models import Count
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import BasePermission
from rest_framework.response import Response

from academique.scoping import est_enseignant, ids_classes
from tenants.permissions import IsSubscriptionActive

from .models import PresenceEleve, PresencePersonnel
from .presences import (
    LIBELLES, ErreurOperation, PeutFaireAppel, _classe_pour, _periode, _rapport_classes, _taux,
)


def _vide():
    return {s: 0 for s in LIBELLES}


def _cle(jour, granularite):
    return jour.isoformat() if granularite == "jour" else f"{jour.year}-{jour.month:02d}"


def _granularite(du, au):
    # Au-delà d'un trimestre, on regroupe par mois pour garder un graphique lisible.
    return "mois" if (au - du).days > 92 else "jour"


def _eleves_qs(user, classe):
    qs = PresenceEleve.objects.filter(ecole_id=user.ecole_id)
    if classe is not None:
        return qs.filter(classe=classe)
    if est_enseignant(user):
        return qs.filter(classe_id__in=ids_classes(user))
    return qs


@api_view(["GET"])
@permission_classes([IsSubscriptionActive, PeutFaireAppel])
def tableau_presences(request):
    """Données des diagrammes de présence pour une période (?du=&au=&classe=)."""
    user = request.user
    try:
        du, au = _periode(request)
        classe_id = request.query_params.get("classe")
        classe = _classe_pour(user, classe_id) if classe_id else None
    except ErreurOperation as e:
        return Response({"detail": str(e)}, status=400)

    gran = _granularite(du, au)
    base = _eleves_qs(user, classe)
    courant = base.filter(date__range=(du, au))

    quotidien = defaultdict(_vide)
    for r in courant.values("date", "statut").annotate(n=Count("id")):
        quotidien[r["date"]][r["statut"]] += r["n"]

    comptes = _vide()
    groupes = defaultdict(_vide)
    semaine = [{"absent": 0, "total": 0} for _ in range(7)]
    for jour, v in quotidien.items():
        g = groupes[_cle(jour, gran)]
        for s, n in v.items():
            comptes[s] += n
            g[s] += n
        semaine[jour.weekday()]["absent"] += v["absent"]
        semaine[jour.weekday()]["total"] += sum(v.values())
    serie = [{"cle": k, **v, "taux": _taux(v)} for k, v in sorted(groupes.items())]

    # Période précédente de même durée, pour mesurer l'évolution.
    duree = (au - du).days + 1
    prec_au = du - timedelta(days=1)
    prec_du = prec_au - timedelta(days=duree - 1)
    precedent = _vide()
    for r in base.filter(date__range=(prec_du, prec_au)).values("statut").annotate(n=Count("id")):
        precedent[r["statut"]] = r["n"]

    top = (
        courant.filter(statut="absent")
        .values("eleve_id", "eleve__nom", "eleve__prenom", "eleve__matricule", "classe__nom")
        .annotate(n=Count("id")).order_by("-n", "eleve__nom")[:5]
    )
    top_absents = [
        {
            "eleve_id": t["eleve_id"], "nom": t["eleve__nom"], "prenom": t["eleve__prenom"],
            "matricule": t["eleve__matricule"], "classe": t["classe__nom"], "n": t["n"],
        }
        for t in top
    ]

    personnel = None
    if getattr(user, "role", None) == "directeur":
        pc = _vide()
        lignes = PresencePersonnel.objects.filter(ecole_id=user.ecole_id, date__range=(du, au))
        for r in lignes.values("statut").annotate(n=Count("id")):
            pc[r["statut"]] = r["n"]
        personnel = {"comptes": pc, "taux": _taux(pc)}

    return Response({
        "du": du, "au": au, "granularite": gran,
        "jours_appel": len(quotidien), "comptes": comptes, "taux": _taux(comptes),
        "taux_precedent": _taux(precedent), "serie": serie,
        "par_jour_semaine": semaine, "classes": _rapport_classes(user, du, au),
        "top_absents": top_absents, "personnel": personnel,
    })


class PeutVoirFinance(BasePermission):
    def has_permission(self, request, view):
        u = request.user
        return bool(
            u and u.is_authenticated and getattr(u, "ecole_id", None)
            and getattr(u, "role", None) in {"directeur", "comptable"}
        )


@api_view(["GET"])
@permission_classes([IsSubscriptionActive, PeutVoirFinance])
def tableau_finance(request):
    """Encaissements d'une période, par jour ou par mois, et par mode de paiement."""
    user = request.user
    try:
        du, au = _periode(request)
    except ErreurOperation as e:
        return Response({"detail": str(e)}, status=400)

    try:
        from finance.models import Paiement
        lignes = list(
            Paiement.objects.filter(ecole_id=user.ecole_id, date_paiement__range=(du, au))
            .values_list("date_paiement", "montant", "mode")
        )
    except Exception:  # module ou champ différent : le bloc est simplement masqué côté écran
        return Response({"disponible": False})

    gran = _granularite(du, au)
    par_periode = defaultdict(int)
    par_mode = defaultdict(int)
    total = 0
    for jour, montant, mode in lignes:
        if hasattr(jour, "date"):  # datetime → date
            jour = jour.date()
        m = int(montant)
        par_periode[_cle(jour, gran)] += m
        par_mode[mode] += m
        total += m

    return Response({
        "disponible": True, "granularite": gran, "total": total, "nb": len(lignes),
        "serie": [{"cle": k, "montant": v} for k, v in sorted(par_periode.items())],
        "par_mode": [{"mode": k, "montant": v} for k, v in sorted(par_mode.items(), key=lambda x: -x[1])],
    })
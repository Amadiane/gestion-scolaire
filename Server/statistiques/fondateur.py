from django.db.models import Count, Q, Sum
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from academique.models import AnneeScolaire, Bulletin, Classe
from eleves.models import Eleve
from finance.models import Paiement
from finance.services import calculer_situations
from tenants.permissions import IsFondateurOuDirecteur, IsSubscriptionActive

# On présente les résultats du dernier trimestre pour lequel des bulletins validés existent.
ORDRE_TRIMESTRES = ("t3", "t2", "t1")


def _resultats(ecole, annee):
    bulletins = list(
        Bulletin.objects.filter(
            ecole=ecole, annee_scolaire=annee,
            statut__in=("valide", "publie"), moyenne_generale__isnull=False,
        ).select_related("classe__niveau")
    )
    trimestre = next((t for t in ORDRE_TRIMESTRES if any(b.trimestre == t for b in bulletins)), None)
    if trimestre is None:
        return None

    par_classe = {}
    toutes = []
    for b in bulletins:
        bareme = b.classe.niveau.bareme_note
        if b.trimestre != trimestre or not bareme:
            continue
        sur_20 = float(b.moyenne_generale) * 20 / bareme
        toutes.append(sur_20)
        ligne = par_classe.setdefault(
            b.classe_id, {"classe": b.classe.nom, "ordre": b.classe.niveau.ordre, "valeurs": []}
        )
        ligne["valeurs"].append(sur_20)
    if not toutes:
        return None

    lignes = sorted(par_classe.values(), key=lambda l: (l["ordre"], l["classe"]))
    return {
        "trimestre": trimestre,
        "moyenne_ecole": round(sum(toutes) / len(toutes), 2),
        "taux_reussite": round(100 * sum(1 for v in toutes if v >= 10) / len(toutes)),
        "bulletins": len(toutes),
        "par_classe": [
            {"classe": l["classe"], "moyenne": round(sum(l["valeurs"]) / len(l["valeurs"]), 2), "bulletins": len(l["valeurs"])}
            for l in lignes
        ],
    }


@api_view(["GET"])
@permission_classes([IsSubscriptionActive, IsFondateurOuDirecteur])
def tableau_fondateur(request):
    """Vue d'ensemble en lecture seule : effectifs, encaissements, impayés, résultats."""
    ecole = request.user.ecole
    annee = AnneeScolaire.objects.filter(ecole=ecole, est_active=True).first()

    eleves = Eleve.objects.filter(ecole=ecole, statut="actif")
    sexes = {r["sexe"]: r["n"] for r in eleves.values("sexe").annotate(n=Count("id"))}

    classes, finance, resultats = [], None, None
    if annee:
        classes_qs = (
            Classe.objects.filter(ecole=ecole, annee_scolaire=annee)
            .annotate(effectif=Count("inscriptions", filter=Q(inscriptions__annee_scolaire=annee)))
            .order_by("niveau__ordre", "nom")
        )
        classes = [{"id": c.id, "nom": c.nom, "effectif": c.effectif} for c in classes_qs]

        paiements = Paiement.objects.filter(ecole=ecole, annee_scolaire=annee)
        debut_mois = timezone.localdate().replace(day=1)
        finance = {
            "encaisse_mois": int(paiements.filter(date_paiement__gte=debut_mois).aggregate(t=Sum("montant"))["t"] or 0),
            "encaisse_annee": int(paiements.aggregate(t=Sum("montant"))["t"] or 0),
            "reste_a_recouvrer": int(sum(s["reste"] for s in calculer_situations(ecole, annee))),
        }
        resultats = _resultats(ecole, annee)

    return Response({
        "ecole": ecole.nom,
        "annee_active": annee.nom if annee else None,
        "total_eleves": eleves.count(),
        "garcons": sexes.get("M", 0),
        "filles": sexes.get("F", 0),
        "classes": classes,
        "finance": finance,
        "resultats": resultats,
    })
from django.db.models import Count, Max
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from eleves.contacts import contacts_par_eleve
from eleves.models import Eleve, Inscription

from .models import RelancePaiement
from .permissions import PERMISSIONS_FINANCE
from .services import calculer_situations
from .views import _contexte


def _id_eleve(situation):
    for cle in ("eleve_id", "eleve", "id"):
        v = situation.get(cle)
        if isinstance(v, int):
            return v
    return None


@api_view(["GET"])
@permission_classes(PERMISSIONS_FINANCE)
def relances(request):
    """Élèves avec un reste à payer, tous leurs contacts et l'historique des relances."""
    ecole, annee = _contexte(request)
    situations = [s for s in calculer_situations(ecole, annee) if s["reste"] > 0]

    ids = [_id_eleve(s) for s in situations]
    if situations and None in ids:
        return Response(
            {"detail": "Identifiant élève introuvable dans calculer_situations : envoyez-moi services.py."},
            status=500,
        )

    eleves = Eleve.objects.filter(ecole=ecole, id__in=ids).in_bulk()
    classes = {
        i.eleve_id: i.classe
        for i in Inscription.objects.filter(eleve_id__in=ids, annee_scolaire=annee).select_related("classe")
    }
    contacts = contacts_par_eleve(ecole, ids)
    historique = {
        h["eleve_id"]: h
        for h in RelancePaiement.objects
        .filter(ecole=ecole, annee_scolaire=annee, eleve_id__in=ids)
        .values("eleve_id")
        .annotate(nb=Count("id"), derniere=Max("envoye_le"))
    }

    resultats = []
    for s, eid in zip(situations, ids):
        eleve = eleves.get(eid)
        if eleve is None:
            continue
        classe = classes.get(eid)
        h = historique.get(eid)
        resultats.append({
            "eleve_id": eid,
            "nom": eleve.nom,
            "prenom": eleve.prenom,
            "classe_id": classe.id if classe else None,
            "classe": classe.nom if classe else "Sans classe",
            "a_payer": int(s["a_payer"]),
            "paye": int(s["paye"]),
            "reste": int(s["reste"]),
            "contacts": contacts.get(eid, []),
            "nb_relances": h["nb"] if h else 0,
            "derniere_relance": h["derniere"] if h else None,
        })

    resultats.sort(key=lambda r: -r["reste"])
    return Response({
        "ecole": ecole.nom,
        "total_reste": sum(r["reste"] for r in resultats),
        "eleves": resultats,
    })


@api_view(["POST"])
@permission_classes(PERMISSIONS_FINANCE)
def marquer_relance(request):
    """Enregistre qu'une relance a été envoyée (ou annule la dernière)."""
    ecole, annee = _contexte(request)
    try:
        eleve = Eleve.objects.filter(pk=int(request.data.get("eleve_id")), ecole=ecole).first()
    except (TypeError, ValueError):
        eleve = None
    if eleve is None:
        return Response({"detail": "Élève introuvable."}, status=404)

    if request.data.get("annuler"):
        derniere = RelancePaiement.objects.filter(ecole=ecole, annee_scolaire=annee, eleve=eleve).first()
        if derniere:
            derniere.delete()
    else:
        situ = calculer_situations(ecole, annee, eleve_id=eleve.id)
        RelancePaiement.objects.create(
            ecole=ecole, annee_scolaire=annee, eleve=eleve,
            reste=int(situ[0]["reste"]) if situ else 0,
            envoye_par=request.user,
        )

    qs = RelancePaiement.objects.filter(ecole=ecole, annee_scolaire=annee, eleve=eleve)
    derniere = qs.first()
    return Response({"nb_relances": qs.count(), "derniere_relance": derniere.envoye_le if derniere else None})
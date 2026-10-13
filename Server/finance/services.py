from decimal import Decimal

from django.db.models import Sum

from eleves.models import Inscription
from .models import FraisScolarite, Paiement, RemiseEleve

ZERO = Decimal("0")


def calculer_situations(ecole, annee, eleve_id=None):
    """
    Situation financière de chaque élève inscrit pour l'année :
    total dû, remise, payé, reste. Trois requêtes agrégées au total,
    quel que soit le nombre d'élèves.
    """
    frais = {
        r["niveau_id"]: r["t"]
        for r in FraisScolarite.objects.filter(ecole=ecole, annee_scolaire=annee)
        .values("niveau_id").annotate(t=Sum("montant"))
    }
    remises = {
        r.eleve_id: r.montant
        for r in RemiseEleve.objects.filter(ecole=ecole, annee_scolaire=annee)
    }
    payes = {
        r["eleve_id"]: r["t"]
        for r in Paiement.objects.filter(ecole=ecole, annee_scolaire=annee)
        .values("eleve_id").annotate(t=Sum("montant"))
    }

    inscriptions = (
        Inscription.objects.filter(annee_scolaire=annee, eleve__ecole=ecole)
        .select_related("eleve", "classe__niveau")
        .order_by("eleve__nom", "eleve__prenom")
    )
    if eleve_id:
        inscriptions = inscriptions.filter(eleve_id=eleve_id)

    resultat = []
    for i in inscriptions:
        total_du = frais.get(i.classe.niveau_id, ZERO)
        remise = remises.get(i.eleve_id, ZERO)
        paye = payes.get(i.eleve_id, ZERO)
        a_payer = max(total_du - remise, ZERO)
        reste = max(a_payer - paye, ZERO)
        resultat.append({
            "eleve_id": i.eleve_id,
            "eleve_nom": f"{i.eleve.prenom} {i.eleve.nom}",
            "matricule": i.eleve.matricule,
            "classe_nom": i.classe.nom,
            "niveau_id": i.classe.niveau_id,
            "niveau_nom": i.classe.niveau.nom,
            "total_du": int(total_du),
            "remise": int(remise),
            "a_payer": int(a_payer),
            "paye": int(paye),
            "reste": int(reste),
        })
    return resultat
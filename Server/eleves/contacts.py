from .models import RelationParentEleve


def contacts_par_eleve(ecole, eleve_ids):
    """{eleve_id: [contacts]} — contact principal en premier, puis par ordre de saisie."""
    liens = (
        RelationParentEleve.objects
        .filter(eleve_id__in=eleve_ids, parent__ecole=ecole)
        .select_related("parent")
        .order_by("-contact_principal", "id")
    )
    resultat = {}
    for r in liens:
        p = r.parent
        telephones = []
        for t in (p.telephone, p.telephone_secondaire):
            t = (t or "").strip()
            if t and t not in telephones:
                telephones.append(t)
        resultat.setdefault(r.eleve_id, []).append({
            "parent_id": p.id,
            "nom": p.nom,
            "prenom": p.prenom,
            "lien": r.get_type_lien_display(),
            "principal": r.contact_principal,
            "telephones": telephones,
        })
    return resultat
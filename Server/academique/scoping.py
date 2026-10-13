from django.db.models import Q

from .models import Affectation


def est_enseignant(user):
    return (
        user.is_authenticated
        and not user.is_superuser
        and getattr(user, "role", None) == "enseignant"
    )


def affectations_de(user):
    return Affectation.objects.filter(enseignant=user, ecole_id=user.ecole_id)


def ids_classes(user):
    return list(affectations_de(user).values_list("classe_id", flat=True).distinct())


def filtre_notes(user):
    """Q limitant les notes aux couples (classe, matière) de l'enseignant."""
    q = Q(pk__in=[])
    for classe_id, matiere_id in affectations_de(user).values_list("classe_id", "matiere_id"):
        q |= Q(classe_id=classe_id, matiere_id=matiere_id)
    return q


def peut_noter(user, classe, matiere):
    return affectations_de(user).filter(classe=classe, matiere=matiere).exists()
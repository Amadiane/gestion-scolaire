from rest_framework import permissions

ROLES_EXTERNES = ("parent", "eleve")


class IsSubscriptionActive(permissions.BasePermission):
    """Abonnement valide et compte actif (s'exécute après le décodage du JWT)."""
    message = "Accès bloqué : abonnement expiré ou compte désactivé."

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if user.is_superuser:
            return True
        ecole = getattr(user, "ecole", None)
        return ecole is not None and ecole.acces_autorise


class IsStaffUser(permissions.BasePermission):
    """Les parents et élèves n'ont pas accès à l'API du personnel."""
    message = "Cet espace est réservé au personnel de l'établissement."

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        return user.is_superuser or getattr(user, "role", "") not in ROLES_EXTERNES


class EnseignantLectureSeule(permissions.BasePermission):
    """Par défaut, un enseignant ne peut que lire. Les vues où il peut
    écrire (les notes) déclarent leurs propres permissions."""
    message = "Les enseignants ont un accès en lecture seule sur cette ressource."

    def has_permission(self, request, view):
        user = request.user
        if getattr(user, "role", None) == "enseignant" and not user.is_superuser:
            return request.method in permissions.SAFE_METHODS
        return True


class IsDirecteur(permissions.BasePermission):
    message = "Seul un directeur peut effectuer cette action."

    def has_permission(self, request, view):
        user = request.user
        return bool(
            user and user.is_authenticated
            and (user.is_superuser or getattr(user, "role", None) == "directeur")
        )
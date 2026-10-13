from rest_framework import permissions

from tenants.permissions import IsSubscriptionActive

ROLES_FINANCE = ("directeur", "comptable")


class IsFinanceRole(permissions.BasePermission):
    message = "Accès réservé au directeur et au comptable."

    def has_permission(self, request, view):
        user = request.user
        return bool(
            user and user.is_authenticated
            and (user.is_superuser or getattr(user, "role", None) in ROLES_FINANCE)
        )


# Les deux ensemble : abonnement valide ET rôle autorisé.
PERMISSIONS_FINANCE = [IsSubscriptionActive, IsFinanceRole]
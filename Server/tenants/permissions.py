# from rest_framework import permissions


# class IsSameSchool(permissions.BasePermission):
#     """
#     Vérifie que l'objet demandé appartient bien à l'école de l'utilisateur
#     connecté. Complète (ne remplace pas) le filtrage au niveau du queryset
#     ci-dessous — une deuxième barrière, au cas où.
#     """
#     def has_object_permission(self, request, view, obj):
#         if request.user.is_superuser:
#             return True
#         return getattr(obj, "ecole_id", None) == request.user.ecole_id


from rest_framework import permissions


class IsSubscriptionActive(permissions.BasePermission):
    """
    Contrôle réel de l'abonnement pour les requêtes API authentifiées par JWT.
    S'exécute APRÈS que DRF ait identifié l'utilisateur via son token —
    contrairement au middleware, qui ne peut pas voir cet utilisateur à temps.
    """
    message = "Accès bloqué : abonnement expiré ou compte désactivé."

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if user.is_superuser:
            return True
        ecole = getattr(user, "ecole", None)
        return ecole is not None and ecole.acces_autorise
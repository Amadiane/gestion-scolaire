from rest_framework import permissions


class IsSameSchool(permissions.BasePermission):
    """
    Vérifie que l'objet demandé appartient bien à l'école de l'utilisateur
    connecté. Complète (ne remplace pas) le filtrage au niveau du queryset
    ci-dessous — une deuxième barrière, au cas où.
    """
    def has_object_permission(self, request, view, obj):
        if request.user.is_superuser:
            return True
        return getattr(obj, "ecole_id", None) == request.user.ecole_id
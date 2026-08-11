from rest_framework import serializers
from .models import Utilisateur


class UtilisateurSerializer(serializers.ModelSerializer):
    """
    Convertit un objet Utilisateur Django <-> JSON.
    C'est l'équivalent, côté API, de ce qu'un template HTML fait pour l'affichage.
    """
    class Meta:
        model = Utilisateur
        fields = ["id", "username", "first_name", "last_name", "role", "ecole", "telephone"]
        # Jamais le mot de passe ici, même haché — un serializer expose
        # exactement ce qu'on lui autorise, rien de plus.
from rest_framework import serializers
from .models import Utilisateur


class UtilisateurSerializer(serializers.ModelSerializer):
    class Meta:
        model = Utilisateur
        fields = [
            "id", "username", "first_name", "last_name", "email",
            "role", "telephone", "ecole", "is_active", "date_joined",
        ]
        read_only_fields = ["ecole", "date_joined"]


class UtilisateurCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=6)

    class Meta:
        model = Utilisateur
        fields = [
            "id", "username", "first_name", "last_name", "email",
            "role", "telephone", "password",
        ]

    def create(self, validated_data):
        password = validated_data.pop("password")
        user = Utilisateur(**validated_data)
        # set_password hache correctement le mot de passe (jamais stocké
        # en clair) — un simple user.password = "..." l'enregistrerait
        # tel quel, faille de sécurité majeure.
        user.set_password(password)
        user.save()
        return user
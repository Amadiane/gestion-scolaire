from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from .models import Utilisateur


class UtilisateurSerializer(serializers.ModelSerializer):
    ecole_nom = serializers.CharField(source="ecole.nom", read_only=True, default=None)

    class Meta:
        model = Utilisateur
        fields = [
            "id", "username", "first_name", "last_name", "email",
            "role", "telephone", "ecole", "ecole_nom", "is_active", "date_joined", "is_superuser",
            "doit_changer_mdp",
        ]
        read_only_fields = ["ecole", "ecole_nom", "date_joined", "is_superuser", "doit_changer_mdp"]


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
        # set_password hache correctement le mot de passe (jamais stocké en clair).
        user.set_password(password)
        # Le mot de passe saisi par le directeur est temporaire.
        user.doit_changer_mdp = True
        user.save()
        return user


class ChangerMotDePasseSerializer(serializers.Serializer):
    ancien_mot_de_passe = serializers.CharField(write_only=True)
    nouveau_mot_de_passe = serializers.CharField(write_only=True)

    def validate(self, attrs):
        user = self.context["request"].user
        ancien = attrs["ancien_mot_de_passe"]
        nouveau = attrs["nouveau_mot_de_passe"]

        if not user.check_password(ancien):
            raise serializers.ValidationError(
                {"ancien_mot_de_passe": "Le mot de passe actuel est incorrect."}
            )
        if ancien == nouveau:
            raise serializers.ValidationError(
                {"nouveau_mot_de_passe": "Le nouveau mot de passe doit être différent de l'ancien."}
            )
        try:
            validate_password(nouveau, user)
        except DjangoValidationError as e:
            raise serializers.ValidationError({"nouveau_mot_de_passe": list(e.messages)})
        return attrs
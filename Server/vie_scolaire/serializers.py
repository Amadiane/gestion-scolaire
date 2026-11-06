from rest_framework import serializers

from .models import MembrePersonnel


class PersonnelSerializer(serializers.ModelSerializer):
    # CloudinaryField n'est pas reconnu par DRF : même solution que pour les élèves.
    photo = serializers.FileField(required=False, allow_null=True)
    poste_label = serializers.CharField(source="get_poste_display", read_only=True)
    utilisateur_username = serializers.CharField(
        source="utilisateur.username", read_only=True, default=None
    )

    class Meta:
        model = MembrePersonnel
        fields = [
            "id", "ecole", "matricule", "nom", "prenom", "sexe", "date_naissance",
            "telephone", "email", "adresse", "poste", "poste_label", "fonction",
            "date_embauche", "statut", "photo", "utilisateur", "utilisateur_username",
            "date_creation",
        ]
        read_only_fields = ["ecole", "matricule", "date_creation"]

    def validate_utilisateur(self, utilisateur):
        if utilisateur is None:
            return utilisateur
        ecole = getattr(self.context["request"].user, "ecole", None)
        if ecole is None or utilisateur.ecole_id != ecole.id:
            raise serializers.ValidationError("Ce compte n'appartient pas à votre école.")
        return utilisateur
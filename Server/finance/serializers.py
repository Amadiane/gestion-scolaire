from rest_framework import serializers

from .models import FraisScolarite, Paiement


class FraisScolariteSerializer(serializers.ModelSerializer):
    niveau_nom = serializers.CharField(source="niveau.nom", read_only=True)

    class Meta:
        model = FraisScolarite
        fields = ["id", "niveau", "niveau_nom", "annee_scolaire", "libelle", "montant"]
        read_only_fields = ["annee_scolaire"]

    def validate_niveau(self, niveau):
        if niveau.ecole_id != self.context["request"].user.ecole_id:
            raise serializers.ValidationError("Niveau invalide.")
        return niveau


class PaiementSerializer(serializers.ModelSerializer):
    eleve_nom = serializers.SerializerMethodField()
    mode_label = serializers.CharField(source="get_mode_display", read_only=True)

    class Meta:
        model = Paiement
        fields = [
            "id", "eleve", "eleve_nom", "montant", "date_paiement", "mode", "mode_label",
            "reference", "note", "numero_recu", "enregistre_par", "date_creation",
        ]
        read_only_fields = ["numero_recu", "enregistre_par", "date_creation"]

    def get_eleve_nom(self, obj):
        return f"{obj.eleve.prenom} {obj.eleve.nom}"

    def validate_eleve(self, eleve):
        # Sécurité : on ne peut encaisser que pour un élève de SON école.
        if eleve.ecole_id != self.context["request"].user.ecole_id:
            raise serializers.ValidationError("Élève invalide.")
        return eleve

    def validate_montant(self, montant):
        if montant <= 0:
            raise serializers.ValidationError("Le montant doit être supérieur à zéro.")
        return montant
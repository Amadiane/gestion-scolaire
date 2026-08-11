from rest_framework import serializers
from .models import AnneeScolaire


class AnneeScolaireSerializer(serializers.ModelSerializer):
    class Meta:
        model = AnneeScolaire
        fields = ["id", "ecole", "nom", "date_debut", "date_fin", "est_active"]
        read_only_fields = ["ecole"]



from .models import Niveau, Matiere, Classe


class NiveauSerializer(serializers.ModelSerializer):
    class Meta:
        model = Niveau
        fields = ["id", "ecole", "nom", "ordre"]
        read_only_fields = ["ecole"]


class MatiereSerializer(serializers.ModelSerializer):
    class Meta:
        model = Matiere
        fields = ["id", "ecole", "nom", "coefficient"]
        read_only_fields = ["ecole"]


class ClasseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Classe
        fields = ["id", "ecole", "annee_scolaire", "niveau", "nom", "effectif_max", "matieres"]
        read_only_fields = ["ecole"]



from .models import Note, Bulletin


class NoteSerializer(serializers.ModelSerializer):
    moyenne_ponderee = serializers.ReadOnlyField()

    class Meta:
        model = Note
        fields = [
            "id", "ecole", "eleve", "matiere", "classe", "annee_scolaire",
            "trimestre", "valeur", "valeur_max", "date_saisie", "saisi_par",
            "moyenne_ponderee",
        ]
        read_only_fields = ["ecole", "date_saisie", "saisi_par"]


class BulletinSerializer(serializers.ModelSerializer):
    class Meta:
        model = Bulletin
        fields = [
            "id", "ecole", "eleve", "classe", "annee_scolaire", "trimestre",
            "moyenne_generale", "rang", "statut", "fichier_pdf",
            "date_generation", "valide_par",
        ]
        read_only_fields = ["ecole", "moyenne_generale", "date_generation", "valide_par"]
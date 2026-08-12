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

class ClasseAvecEffectifSerializer(serializers.ModelSerializer):
    effectif = serializers.SerializerMethodField()
    niveau_nom = serializers.CharField(source='niveau.nom', read_only=True)
    bareme_note = serializers.IntegerField(source='niveau.bareme_note', read_only=True)

    class Meta:
        model = Classe
        fields = ["id", "nom", "niveau_nom", "bareme_note", "annee_scolaire", "effectif_max", "effectif"]

    def get_effectif(self, obj):
        return obj.inscriptions.filter(annee_scolaire=obj.annee_scolaire).count()

class BulletinSerializer(serializers.ModelSerializer):
    eleve_nom = serializers.SerializerMethodField()
    classe_nom = serializers.CharField(source='classe.nom', read_only=True)

    class Meta:
        model = Bulletin
        fields = [
            "id", "ecole", "eleve", "eleve_nom", "classe", "classe_nom",
            "annee_scolaire", "trimestre", "moyenne_generale", "rang",
            "statut", "fichier_pdf", "date_generation", "valide_par",
        ]
        read_only_fields = ["ecole", "moyenne_generale", "date_generation", "valide_par"]

    def get_eleve_nom(self, obj):
        return f"{obj.eleve.prenom} {obj.eleve.nom}"
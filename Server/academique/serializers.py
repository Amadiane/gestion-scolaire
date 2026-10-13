from rest_framework import serializers

from eleves.models import Inscription
from tenants.serializers import MemeEcoleMixin

from .models import Affectation, AnneeScolaire, Bulletin, Classe, Matiere, Niveau, Note
from .scoping import est_enseignant, peut_noter


class AnneeScolaireSerializer(serializers.ModelSerializer):
    class Meta:
        model = AnneeScolaire
        fields = ["id", "ecole", "nom", "date_debut", "date_fin", "est_active"]
        read_only_fields = ["ecole"]


class AnneeScolaireDetailSerializer(serializers.ModelSerializer):
    classes = serializers.SerializerMethodField()
    nb_eleves_total = serializers.SerializerMethodField()
    nb_notes = serializers.SerializerMethodField()
    nb_bulletins = serializers.SerializerMethodField()

    class Meta:
        model = AnneeScolaire
        fields = [
            "id", "ecole", "nom", "date_debut", "date_fin", "est_active",
            "classes", "nb_eleves_total", "nb_notes", "nb_bulletins",
        ]

    def get_classes(self, obj):
        return [
            {
                "id": c.id,
                "nom": c.nom,
                "niveau_nom": c.niveau.nom,
                "effectif": c.inscriptions.filter(annee_scolaire=obj).count(),
            }
            for c in obj.classes.select_related("niveau")
        ]

    def get_nb_eleves_total(self, obj):
        return obj.inscriptions.count()

    def get_nb_notes(self, obj):
        return obj.notes.count()

    def get_nb_bulletins(self, obj):
        return obj.bulletins.count()


class NiveauSerializer(serializers.ModelSerializer):
    class Meta:
        model = Niveau
        fields = ["id", "ecole", "nom", "ordre", "cycle", "bareme_note"]
        read_only_fields = ["ecole"]


class MatiereSerializer(serializers.ModelSerializer):
    class Meta:
        model = Matiere
        fields = ["id", "ecole", "nom", "coefficient"]
        read_only_fields = ["ecole"]


class ClasseSerializer(MemeEcoleMixin, serializers.ModelSerializer):
    class Meta:
        model = Classe
        fields = ["id", "ecole", "annee_scolaire", "niveau", "nom", "effectif_max", "matieres"]
        read_only_fields = ["ecole"]


class ClasseAvecEffectifSerializer(serializers.ModelSerializer):
    effectif = serializers.SerializerMethodField()
    niveau_nom = serializers.CharField(source="niveau.nom", read_only=True)
    bareme_note = serializers.IntegerField(source="niveau.bareme_note", read_only=True)

    class Meta:
        model = Classe
        fields = [
            "id", "nom", "niveau_nom", "bareme_note",
            "annee_scolaire", "effectif_max", "effectif",
        ]

    def get_effectif(self, obj):
        return obj.inscriptions.filter(annee_scolaire=obj.annee_scolaire).count()


class NoteSerializer(MemeEcoleMixin, serializers.ModelSerializer):
    moyenne_ponderee = serializers.ReadOnlyField()
    eleve_nom = serializers.SerializerMethodField()
    matiere_nom = serializers.CharField(source="matiere.nom", read_only=True)

    class Meta:
        model = Note
        fields = [
            "id", "ecole", "eleve", "eleve_nom", "matiere", "matiere_nom",
            "classe", "annee_scolaire", "trimestre", "valeur", "valeur_max",
            "date_saisie", "saisi_par", "moyenne_ponderee",
        ]
        read_only_fields = ["ecole", "valeur_max", "date_saisie", "saisi_par"]

    def get_eleve_nom(self, obj):
        return f"{obj.eleve.prenom} {obj.eleve.nom}"

    def validate(self, attrs):
        attrs = super().validate(attrs)  # toutes les références doivent être de la même école
        user = self.context["request"].user
        inst = self.instance

        def val(cle):
            return attrs.get(cle, getattr(inst, cle, None) if inst else None)

        eleve, matiere, classe, annee = val("eleve"), val("matiere"), val("classe"), val("annee_scolaire")

        if classe and annee and classe.annee_scolaire_id != annee.id:
            raise serializers.ValidationError("Cette classe n'appartient pas à l'année scolaire indiquée.")
        if eleve and classe and not Inscription.objects.filter(eleve=eleve, classe=classe).exists():
            raise serializers.ValidationError("Cet élève n'est pas inscrit dans cette classe.")
        if est_enseignant(user) and not peut_noter(user, classe, matiere):
            raise serializers.ValidationError("Vous n'enseignez pas cette matière dans cette classe.")
        return attrs


class BulletinSerializer(MemeEcoleMixin, serializers.ModelSerializer):
    eleve_nom = serializers.SerializerMethodField()
    classe_nom = serializers.CharField(source="classe.nom", read_only=True)

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


class AffectationSerializer(MemeEcoleMixin, serializers.ModelSerializer):
    enseignant_nom = serializers.SerializerMethodField()
    classe_nom = serializers.CharField(source="classe.nom", read_only=True)
    matiere_nom = serializers.CharField(source="matiere.nom", read_only=True)

    class Meta:
        model = Affectation
        fields = ["id", "enseignant", "enseignant_nom", "classe", "classe_nom", "matiere", "matiere_nom"]

    def get_enseignant_nom(self, obj):
        return obj.enseignant.get_full_name() or obj.enseignant.username

    def validate(self, attrs):
        attrs = super().validate(attrs)
        enseignant = attrs.get("enseignant")
        if enseignant and enseignant.role != "enseignant":
            raise serializers.ValidationError({"enseignant": "Ce compte n'est pas un enseignant."})
        doublon = Affectation.objects.filter(
            enseignant=enseignant, classe=attrs.get("classe"), matiere=attrs.get("matiere")
        )
        if self.instance:
            doublon = doublon.exclude(pk=self.instance.pk)
        if doublon.exists():
            raise serializers.ValidationError("Cette affectation existe déjà.")
        return attrs
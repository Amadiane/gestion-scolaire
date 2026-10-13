from rest_framework import serializers

from tenants.serializers import MemeEcoleMixin

from .models import Eleve, Inscription, Parent, RelationParentEleve


class ParentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Parent
        fields = ["id", "ecole", "nom", "prenom", "telephone", "email", "adresse", "date_creation"]
        read_only_fields = ["ecole", "date_creation"]


class ParentChoixSerializer(serializers.ModelSerializer):
    class Meta:
        model = Parent
        fields = ["id", "nom", "prenom", "telephone"]


class RelationParentEleveSerializer(MemeEcoleMixin, serializers.ModelSerializer):
    class Meta:
        model = RelationParentEleve
        fields = ["id", "parent", "eleve", "type_lien", "contact_principal"]


class EleveSerializer(serializers.ModelSerializer):
    # CloudinaryField n'est pas reconnu par DRF : on le déclare explicitement.
    # FileField gère la lecture (URL Cloudinary) et l'écriture (upload).
    photo = serializers.FileField(required=False, allow_null=True)
    classe_actuelle_nom = serializers.SerializerMethodField()

    class Meta:
        model = Eleve
        fields = [
            "id", "ecole", "matricule", "nom", "prenom", "date_naissance",
            "lieu_naissance", "sexe", "photo", "statut", "date_inscription",
            "classe_actuelle_nom",
        ]
        read_only_fields = ["ecole", "matricule", "date_inscription"]

    def get_classe_actuelle_nom(self, obj):
        classe = obj.classe_actuelle()
        return classe.nom if classe else None


class EleveResumeSerializer(serializers.ModelSerializer):
    photo = serializers.FileField(required=False, allow_null=True)

    class Meta:
        model = Eleve
        fields = ["id", "nom", "prenom", "matricule", "photo"]


class ParentDetailSerializer(serializers.ModelSerializer):
    enfants = serializers.SerializerMethodField()

    class Meta:
        model = Parent
        fields = [
            "id", "ecole", "nom", "prenom", "telephone", "email",
            "adresse", "date_creation", "enfants",
        ]

    def get_enfants(self, obj):
        # Passe par la table de liaison pour récupérer le type de lien
        # (père, mère, tuteur) en même temps que chaque élève.
        relations = obj.relationparenteleve_set.select_related("eleve")
        return [
            {
                **EleveResumeSerializer(rel.eleve).data,
                "type_lien": rel.type_lien,
                "contact_principal": rel.contact_principal,
            }
            for rel in relations
        ]


class InscriptionSerializer(MemeEcoleMixin, serializers.ModelSerializer):
    class Meta:
        model = Inscription
        fields = ["id", "eleve", "classe", "annee_scolaire", "date_inscription", "statut"]
import secrets
import string
from datetime import date, timedelta

from django.db import transaction
from django.db.models import Count, ProtectedError
from django.shortcuts import get_object_or_404
from django.utils.text import slugify
from rest_framework import permissions, serializers, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from academique.models import AnneeScolaire, Matiere, Niveau
from accounts.models import Utilisateur

from .models import Abonnement, PlanAbonnement, School

DUREES = [30, 90, 365]

NIVEAUX_TYPES = [
    ("1ère année", 1, "primaire", 10), ("2ème année", 2, "primaire", 10),
    ("3ème année", 3, "primaire", 10), ("4ème année", 4, "primaire", 10),
    ("5ème année", 5, "primaire", 10), ("6ème année", 6, "primaire", 10),
    ("7ème année", 7, "college", 20), ("8ème année", 8, "college", 20),
    ("9ème année", 9, "college", 20), ("10ème année", 10, "college", 20),
    ("11ème année", 11, "lycee", 20), ("12ème année", 12, "lycee", 20),
    ("Terminale", 13, "lycee", 20),
]

MATIERES_TYPES = [
    ("Mathématiques", 3), ("Français", 3), ("Sciences", 2),
    ("Histoire-Géographie", 2), ("Anglais", 1), ("Éducation civique", 1),
]


class IsSuperUser(permissions.BasePermission):
    message = "Réservé à l'administration Sylium."

    def has_permission(self, request, view):
        u = request.user
        return bool(u and u.is_authenticated and u.is_superuser)


class PlanSerializer(serializers.ModelSerializer):
    class Meta:
        model = PlanAbonnement
        fields = ["id", "nom", "prix_mensuel", "prix_annuel", "effectif_max", "modules_inclus"]


class EcoleCreationSerializer(serializers.Serializer):
    nom = serializers.CharField(max_length=255)
    email_contact = serializers.EmailField()
    telephone = serializers.CharField(max_length=20, required=False, allow_blank=True)
    effectif_declare = serializers.IntegerField(min_value=0, default=0)
    prefixe_matricule = serializers.CharField(max_length=10, required=False, allow_blank=True)
    plan = serializers.PrimaryKeyRelatedField(queryset=PlanAbonnement.objects.all())
    duree_jours = serializers.ChoiceField(choices=DUREES, default=365)
    directeur_username = serializers.CharField(max_length=150)
    directeur_prenom = serializers.CharField(max_length=150)
    directeur_nom = serializers.CharField(max_length=150)
    directeur_telephone = serializers.CharField(max_length=20, required=False, allow_blank=True)
    annee_nom = serializers.CharField(max_length=20)
    annee_debut = serializers.DateField()
    annee_fin = serializers.DateField()
    creer_niveaux = serializers.BooleanField(default=True)
    creer_matieres = serializers.BooleanField(default=True)

    def validate_directeur_username(self, valeur):
        if Utilisateur.objects.filter(username__iexact=valeur).exists():
            raise serializers.ValidationError("Cet identifiant est déjà utilisé.")
        return valeur

    def validate(self, attrs):
        if attrs["annee_fin"] <= attrs["annee_debut"]:
            raise serializers.ValidationError("La fin de l'année doit suivre son début.")
        return attrs


def _directeurs():
    out = {}
    for u in Utilisateur.objects.filter(role="directeur", ecole__isnull=False):
        out.setdefault(u.ecole_id, []).append(u.username)
    return out


def _resume(ecole, directeurs):
    ab = getattr(ecole, "abonnement", None)
    if not ecole.est_actif:
        statut = "desactivee"
    elif ab is None:
        statut = "aucun"
    elif ab.est_valide:
        statut = "actif"
    elif ab.statut == Abonnement.Statut.ACTIF:
        statut = "expire"  # statut encore « actif » mais la date de fin est passée
    else:
        statut = ab.statut

    nb_eleves = getattr(ecole, "nb_eleves", None)
    if nb_eleves is None:
        nb_eleves = ecole.eleves.count()

    return {
        "id": ecole.id,
        "nom": ecole.nom,
        "slug": ecole.slug,
        "email_contact": ecole.email_contact,
        "telephone": ecole.telephone,
        "nb_eleves": nb_eleves,
        "statut": statut,
        "plan": ab.plan.nom if ab else None,
        "date_fin": ab.date_fin if ab else None,
        "jours_restants": ab.jours_restants if ab else 0,
        "directeurs": directeurs.get(ecole.id, []),
    }


def _slug_unique(nom):
    base = (slugify(nom) or "ecole")[:40]
    slug, i = base, 2
    while School.objects.filter(slug=slug).exists():
        slug = f"{base}-{i}"
        i += 1
    return slug


class EcoleViewSet(viewsets.ViewSet):
    permission_classes = [IsSuperUser]

    def list(self, request):
        ecoles = (
            School.objects.select_related("abonnement__plan")
            .annotate(nb_eleves=Count("eleves", distinct=True))
            .order_by("nom")
        )
        directeurs = _directeurs()
        return Response([_resume(e, directeurs) for e in ecoles])

    @transaction.atomic
    def create(self, request):
        s = EcoleCreationSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        d = s.validated_data
        today = date.today()

        prefixe = (d.get("prefixe_matricule") or slugify(d["nom"]).replace("-", "")[:3] or "ECO").upper()
        ecole = School.objects.create(
            nom=d["nom"], slug=_slug_unique(d["nom"]),
            email_contact=d["email_contact"], telephone=d.get("telephone", ""),
            effectif_declare=d["effectif_declare"], prefixe_matricule=prefixe,
        )
        Abonnement.objects.create(
            ecole=ecole, plan=d["plan"], date_debut=today,
            date_fin=today + timedelta(days=d["duree_jours"]), statut=Abonnement.Statut.ACTIF,
        )
        AnneeScolaire.objects.create(
            ecole=ecole, nom=d["annee_nom"], date_debut=d["annee_debut"],
            date_fin=d["annee_fin"], est_active=True,
        )
        if d["creer_niveaux"]:
            for nom, ordre, cycle, bareme in NIVEAUX_TYPES:
                Niveau.objects.create(ecole=ecole, nom=nom, ordre=ordre, cycle=cycle, bareme_note=bareme)
        if d["creer_matieres"]:
            for nom, coef in MATIERES_TYPES:
                Matiere.objects.create(ecole=ecole, nom=nom, coefficient=coef)

        mot_de_passe = "".join(secrets.choice(string.ascii_letters + string.digits) for _ in range(10))
        Utilisateur.objects.create_user(
            username=d["directeur_username"], password=mot_de_passe,
            first_name=d["directeur_prenom"], last_name=d["directeur_nom"],
            telephone=d.get("directeur_telephone", ""), role="directeur", ecole=ecole,
        )

        ecole = School.objects.select_related("abonnement__plan").get(pk=ecole.pk)
        return Response(
            {
                "ecole": _resume(ecole, _directeurs()),
                "directeur": {"username": d["directeur_username"], "mot_de_passe": mot_de_passe},
            },
            status=201,
        )

    def _ecole_et_abo(self, pk):
        ecole = get_object_or_404(School.objects.select_related("abonnement__plan"), pk=pk)
        ab = getattr(ecole, "abonnement", None)
        if ab is None:
            raise ValidationError("Cette école n'a pas d'abonnement.")
        return ecole, ab

    @action(detail=True, methods=["post"])
    def suspendre(self, request, pk=None):
        ecole, ab = self._ecole_et_abo(pk)
        ab.bloquer()
        return Response(_resume(ecole, _directeurs()))

    @action(detail=True, methods=["post"])
    def reactiver(self, request, pk=None):
        ecole, ab = self._ecole_et_abo(pk)
        ab.reactiver()
        return Response(_resume(ecole, _directeurs()))

    @action(detail=True, methods=["post"])
    def renouveler(self, request, pk=None):
        ecole, ab = self._ecole_et_abo(pk)
        try:
            duree = int(request.data.get("duree_jours", 365))
        except (TypeError, ValueError):
            duree = 0
        if duree not in DUREES:
            raise ValidationError("Durée invalide.")
        ab.renouveler(duree_jours=duree)
        return Response(_resume(ecole, _directeurs()))


class PlanViewSet(viewsets.ModelViewSet):
    queryset = PlanAbonnement.objects.all().order_by("prix_mensuel")
    serializer_class = PlanSerializer
    permission_classes = [IsSuperUser]

    def perform_destroy(self, instance):
        try:
            instance.delete()
        except ProtectedError:
            raise ValidationError("Ce plan est utilisé par au moins une école : impossible de le supprimer.")
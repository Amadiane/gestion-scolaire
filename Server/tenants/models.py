from django.db import models

# Create your models here.
from django.db import models
from django.utils import timezone
from django.core.exceptions import ValidationError


class School(models.Model):
    nom = models.CharField(max_length=255)
    slug = models.SlugField(unique=True)
    email_contact = models.EmailField()
    telephone = models.CharField(max_length=20, blank=True)
    effectif_declare = models.PositiveIntegerField(default=0)
    date_creation = models.DateTimeField(auto_now_add=True)
    est_actif = models.BooleanField(default=True)

    class Meta:
        verbose_name = "École"
        verbose_name_plural = "Écoles"
        ordering = ["nom"]

    def __str__(self):
        return self.nom

    @property
    def acces_autorise(self) -> bool:
        if not self.est_actif:
            return False
        abonnement = getattr(self, "abonnement", None)
        if abonnement is None:
            return False
        return abonnement.est_valide

    prefixe_matricule = models.CharField(
        max_length=10, blank=True,
        help_text="Ex: EMA pour 'Emmanuel'. Utilisé pour générer les matricules élèves automatiquement."
    )


class PlanAbonnement(models.Model):
    nom = models.CharField(max_length=100)
    prix_mensuel = models.DecimalField(max_digits=12, decimal_places=0)
    prix_annuel = models.DecimalField(max_digits=12, decimal_places=0)
    effectif_max = models.PositiveIntegerField(null=True, blank=True)
    modules_inclus = models.TextField(blank=True)

    class Meta:
        verbose_name = "Plan d'abonnement"
        verbose_name_plural = "Plans d'abonnement"

    def __str__(self):
        return self.nom


class Abonnement(models.Model):
    class Statut(models.TextChoices):
        ACTIF = "actif", "Actif"
        EXPIRE = "expire", "Expiré"
        SUSPENDU = "suspendu", "Suspendu (blocage manuel)"
        ANNULE = "annule", "Annulé"

    ecole = models.OneToOneField(School, on_delete=models.CASCADE, related_name="abonnement")
    plan = models.ForeignKey(PlanAbonnement, on_delete=models.PROTECT)
    date_debut = models.DateField()
    date_fin = models.DateField()
    statut = models.CharField(max_length=20, choices=Statut.choices, default=Statut.ACTIF)
    renouvellement_auto = models.BooleanField(default=False)
    date_maj = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Abonnement"
        verbose_name_plural = "Abonnements"

    def __str__(self):
        return f"{self.ecole.nom} — {self.plan.nom} ({self.get_statut_display()})"

    def clean(self):
        if self.date_fin <= self.date_debut:
            raise ValidationError("La date de fin doit être postérieure à la date de début.")

    @property
    def est_valide(self) -> bool:
        today = timezone.now().date()
        return self.statut == self.Statut.ACTIF and self.date_debut <= today <= self.date_fin

    @property
    def jours_restants(self) -> int:
        delta = self.date_fin - timezone.now().date()
        return max(delta.days, 0)

    def bloquer(self):
        self.statut = self.Statut.SUSPENDU
        self.save(update_fields=["statut", "date_maj"])

    def reactiver(self, nouvelle_date_fin=None):
        self.statut = self.Statut.ACTIF
        if nouvelle_date_fin:
            self.date_fin = nouvelle_date_fin
        self.save()

    def annuler(self):
        self.statut = self.Statut.ANNULE
        self.save(update_fields=["statut", "date_maj"])

    def renouveler(self, duree_jours: int = 365):
        from datetime import timedelta
        today = timezone.now().date()
        depart = self.date_fin if self.date_fin > today else today
        self.date_fin = depart + timedelta(days=duree_jours)
        self.statut = self.Statut.ACTIF
        self.save()
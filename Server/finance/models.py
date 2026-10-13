from django.core.validators import MinValueValidator
from django.db import models
from django.utils import timezone

from academique.models import AnneeScolaire, Niveau
from tenants.models import School


class FraisScolarite(models.Model):
    """Un poste de frais (inscription, scolarité...) pour un niveau et une année."""
    ecole = models.ForeignKey(School, on_delete=models.CASCADE, related_name="frais")
    annee_scolaire = models.ForeignKey(AnneeScolaire, on_delete=models.CASCADE, related_name="frais")
    niveau = models.ForeignKey(Niveau, on_delete=models.CASCADE, related_name="frais")
    libelle = models.CharField(max_length=100, default="Scolarité")
    montant = models.DecimalField(max_digits=12, decimal_places=0, validators=[MinValueValidator(0)])

    class Meta:
        verbose_name = "Frais de scolarité"
        verbose_name_plural = "Frais de scolarité"
        ordering = ["niveau__ordre", "libelle"]
        constraints = [
            models.UniqueConstraint(
                fields=["ecole", "annee_scolaire", "niveau", "libelle"], name="frais_unique"
            )
        ]

    def __str__(self):
        return f"{self.niveau} — {self.libelle} : {self.montant}"


class RemiseEleve(models.Model):
    """Remise accordée à un élève pour une année (fratrie, boursier...)."""
    ecole = models.ForeignKey(School, on_delete=models.CASCADE, related_name="remises")
    eleve = models.ForeignKey("eleves.Eleve", on_delete=models.CASCADE, related_name="remises")
    annee_scolaire = models.ForeignKey(AnneeScolaire, on_delete=models.CASCADE, related_name="remises")
    montant = models.DecimalField(max_digits=12, decimal_places=0, default=0, validators=[MinValueValidator(0)])
    motif = models.CharField(max_length=200, blank=True)

    class Meta:
        verbose_name = "Remise"
        verbose_name_plural = "Remises"
        constraints = [
            models.UniqueConstraint(fields=["eleve", "annee_scolaire"], name="remise_unique_par_annee")
        ]

    def __str__(self):
        return f"Remise {self.montant} — {self.eleve}"


class Paiement(models.Model):
    class Mode(models.TextChoices):
        ESPECES = "especes", "Espèces"
        ORANGE_MONEY = "orange_money", "Orange Money"
        MTN_MOMO = "mtn_momo", "MTN MoMo"
        VIREMENT = "virement", "Virement"

    ecole = models.ForeignKey(School, on_delete=models.CASCADE, related_name="paiements")
    # PROTECT : on ne supprime jamais l'historique financier par effet de bord.
    eleve = models.ForeignKey("eleves.Eleve", on_delete=models.PROTECT, related_name="paiements")
    annee_scolaire = models.ForeignKey(AnneeScolaire, on_delete=models.PROTECT, related_name="paiements")
    montant = models.DecimalField(max_digits=12, decimal_places=0, validators=[MinValueValidator(1)])
    date_paiement = models.DateField(default=timezone.localdate)
    mode = models.CharField(max_length=20, choices=Mode.choices, default=Mode.ESPECES)
    reference = models.CharField(max_length=100, blank=True, help_text="N° de transaction, bordereau...")
    note = models.CharField(max_length=200, blank=True)
    numero_recu = models.CharField(max_length=40, editable=False)
    enregistre_par = models.ForeignKey(
        "accounts.Utilisateur", on_delete=models.SET_NULL, null=True, related_name="paiements_enregistres"
    )
    date_creation = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Paiement"
        verbose_name_plural = "Paiements"
        ordering = ["-date_paiement", "-id"]
        constraints = [
            models.UniqueConstraint(fields=["ecole", "numero_recu"], name="recu_unique_par_ecole")
        ]

    def __str__(self):
        return f"{self.numero_recu} — {self.eleve} : {self.montant}"

    def _generer_numero(self):
        prefixe = self.ecole.prefixe_matricule or self.ecole.nom[:3].upper()
        base = f"REC-{prefixe}-{timezone.now().year}-"
        dernier = (
            Paiement.objects.filter(ecole=self.ecole, numero_recu__startswith=base)
            .order_by("-numero_recu").first()
        )
        n = int(dernier.numero_recu.split("-")[-1]) + 1 if dernier else 1
        return f"{base}{n:04d}"

    def save(self, *args, **kwargs):
        if not self.numero_recu:
            self.numero_recu = self._generer_numero()
        super().save(*args, **kwargs)
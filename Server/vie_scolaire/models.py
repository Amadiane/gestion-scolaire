from cloudinary.models import CloudinaryField
from django.conf import settings
from django.db import models, transaction

from tenants.models import School


class MembrePersonnel(models.Model):
    """Fiche d'un membre du personnel. Peut être liée à un compte (enseignant, comptable...)
    ou exister seule (gardien, cuisinière...)."""

    class Sexe(models.TextChoices):
        MASCULIN = "M", "Masculin"
        FEMININ = "F", "Féminin"

    class Poste(models.TextChoices):
        DIRECTION = "direction", "Direction"
        ENSEIGNANT = "enseignant", "Enseignant"
        ADMINISTRATIF = "administratif", "Administratif"
        COMPTABLE = "comptable", "Comptable"
        SURVEILLANT = "surveillant", "Surveillant"
        ENTRETIEN = "entretien", "Entretien"
        SECURITE = "securite", "Sécurité"
        AUTRE = "autre", "Autre"

    class Statut(models.TextChoices):
        ACTIF = "actif", "Actif"
        CONGE = "conge", "En congé"
        PARTI = "parti", "Parti"

    ecole = models.ForeignKey(School, on_delete=models.CASCADE, related_name="personnel")
    utilisateur = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name="fiche_personnel",
        help_text="Compte de connexion de cette personne, s'il existe.",
    )
    matricule = models.CharField(max_length=40, editable=False)
    nom = models.CharField(max_length=100)
    prenom = models.CharField(max_length=100)
    sexe = models.CharField(max_length=1, choices=Sexe.choices)
    date_naissance = models.DateField(null=True, blank=True)
    telephone = models.CharField(max_length=20, blank=True)
    email = models.EmailField(blank=True)
    adresse = models.CharField(max_length=255, blank=True)
    poste = models.CharField(max_length=20, choices=Poste.choices, default=Poste.AUTRE)
    fonction = models.CharField(
        max_length=120, blank=True,
        help_text="Intitulé libre, ex : Professeur de mathématiques.",
    )
    date_embauche = models.DateField(null=True, blank=True)
    statut = models.CharField(max_length=10, choices=Statut.choices, default=Statut.ACTIF)
    photo = CloudinaryField("Photo", folder="personnel/photos", blank=True, null=True)
    date_creation = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Membre du personnel"
        verbose_name_plural = "Personnel"
        ordering = ["matricule"]
        unique_together = [("ecole", "matricule")]

    def __str__(self):
        return f"{self.prenom} {self.nom} ({self.matricule})"

    def _generer_matricule(self):
        # Verrou sur l'école : deux créations simultanées ne reçoivent jamais le même numéro.
        ecole = School.objects.select_for_update().get(pk=self.ecole_id)
        prefixe = (ecole.prefixe_matricule or "ECO").upper()
        base = f"{prefixe}-PERS-"
        dernier = (
            MembrePersonnel.objects.filter(ecole=ecole, matricule__startswith=base)
            .order_by("-matricule").values_list("matricule", flat=True).first()
        )
        numero = int(dernier.rsplit("-", 1)[1]) + 1 if dernier else 1
        return f"{base}{numero:04d}"

    def save(self, *args, **kwargs):
        if not self.matricule:
            with transaction.atomic():
                self.matricule = self._generer_matricule()
                super().save(*args, **kwargs)
            return
        super().save(*args, **kwargs)


class StatutPresence(models.TextChoices):
    PRESENT = "present", "Présent"
    ABSENT = "absent", "Absent"
    RETARD = "retard", "En retard"
    EXCUSE = "excuse", "Excusé"


class PresenceEleve(models.Model):
    """Appel du jour : une seule ligne par élève et par date."""

    ecole = models.ForeignKey(School, on_delete=models.CASCADE, related_name="presences_eleves")
    eleve = models.ForeignKey("eleves.Eleve", on_delete=models.CASCADE, related_name="presences")
    classe = models.ForeignKey("academique.Classe", on_delete=models.CASCADE, related_name="presences")
    annee_scolaire = models.ForeignKey(
        "academique.AnneeScolaire", on_delete=models.CASCADE, related_name="presences"
    )
    date = models.DateField()
    statut = models.CharField(max_length=10, choices=StatutPresence.choices)
    remarque = models.CharField(max_length=200, blank=True)
    enregistre_par = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="presences_enregistrees",
    )
    modifie_le = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Présence élève"
        verbose_name_plural = "Présences élèves"
        ordering = ["-date", "eleve__nom"]
        constraints = [
            models.UniqueConstraint(fields=["eleve", "date"], name="presence_unique_eleve_jour")
        ]
        indexes = [models.Index(fields=["ecole", "classe", "date"])]

    def __str__(self):
        return f"{self.eleve} — {self.date} : {self.get_statut_display()}"


class PresencePersonnel(models.Model):
    ecole = models.ForeignKey(School, on_delete=models.CASCADE, related_name="presences_personnel")
    membre = models.ForeignKey(MembrePersonnel, on_delete=models.CASCADE, related_name="presences")
    date = models.DateField()
    statut = models.CharField(max_length=10, choices=StatutPresence.choices)
    remarque = models.CharField(max_length=200, blank=True)
    enregistre_par = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="presences_personnel_enregistrees",
    )
    modifie_le = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Présence personnel"
        verbose_name_plural = "Présences personnel"
        ordering = ["-date", "membre__nom"]
        constraints = [
            models.UniqueConstraint(fields=["membre", "date"], name="presence_unique_membre_jour")
        ]

    def __str__(self):
        return f"{self.membre} — {self.date} : {self.get_statut_display()}"
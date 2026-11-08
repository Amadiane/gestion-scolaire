from django.conf import settings
from django.db import models


class CreneauEmploi(models.Model):
    """Un créneau de l'emploi du temps d'une classe (horaires libres, propres à chaque école)."""

    class Jour(models.IntegerChoices):
        LUNDI = 0, "Lundi"
        MARDI = 1, "Mardi"
        MERCREDI = 2, "Mercredi"
        JEUDI = 3, "Jeudi"
        VENDREDI = 4, "Vendredi"
        SAMEDI = 5, "Samedi"
        DIMANCHE = 6, "Dimanche"

    ecole = models.ForeignKey("tenants.School", on_delete=models.CASCADE, related_name="creneaux")
    classe = models.ForeignKey("academique.Classe", on_delete=models.CASCADE, related_name="creneaux")
    jour = models.PositiveSmallIntegerField(choices=Jour.choices)
    debut = models.TimeField()
    fin = models.TimeField()
    matiere = models.ForeignKey(
        "academique.Matiere", on_delete=models.SET_NULL, null=True, blank=True, related_name="creneaux"
    )
    # Pour les activités qui ne sont pas une matière (récréation, étude, sport...).
    libelle = models.CharField(max_length=60, blank=True)
    enseignant = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="creneaux_enseignes",
    )
    salle = models.CharField(max_length=40, blank=True)
    cree_par = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    modifie_le = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Créneau d'emploi du temps"
        verbose_name_plural = "Créneaux d'emploi du temps"
        ordering = ["jour", "debut"]
        indexes = [
            models.Index(fields=["ecole", "classe"]),
            models.Index(fields=["ecole", "enseignant", "jour"]),
        ]

    def __str__(self):
        return f"{self.classe_id} — {self.get_jour_display()} {self.debut:%H:%M}-{self.fin:%H:%M}"
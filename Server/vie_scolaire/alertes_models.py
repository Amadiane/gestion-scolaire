from django.conf import settings
from django.db import models


class AlerteParent(models.Model):
    """Trace « parent prévenu » pour un élève et un jour (évite les doublons)."""

    ecole = models.ForeignKey("tenants.School", on_delete=models.CASCADE, related_name="alertes_parents")
    eleve = models.ForeignKey("eleves.Eleve", on_delete=models.CASCADE, related_name="alertes_parents")
    date = models.DateField()
    motif = models.CharField(max_length=10)            # absent / retard
    canal = models.CharField(max_length=20, default="whatsapp")
    envoye_par = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="+",
    )
    envoye_le = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["eleve", "date"], name="alerte_unique_eleve_jour"),
        ]
        indexes = [models.Index(fields=["ecole", "date"])]

    def __str__(self):
        return f"{self.eleve_id} — {self.date} ({self.motif})"




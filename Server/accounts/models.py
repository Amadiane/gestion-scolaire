from django.db import models

# Create your models here.
from django.contrib.auth.models import AbstractUser
from django.db import models
from tenants.models import School


class Utilisateur(AbstractUser):
    """
    Remplace le modèle User par défaut de Django.
    Hérite de tous les champs standards (username, password, email, is_staff...)
    et y ajoute ce qui est spécifique à votre projet : l'école et le rôle.
    """

    class Role(models.TextChoices):
        DIRECTEUR = "directeur", "Directeur"
        SURVEILLANT = "surveillant", "Surveillant général"
        COMPTABLE = "comptable", "Comptable"
        SECRETAIRE = "secretaire", "Secrétaire"
        ENSEIGNANT = "enseignant", "Enseignant"
        PARENT = "parent", "Parent"
        ELEVE = "eleve", "Élève"

    ecole = models.ForeignKey(
        School,
        on_delete=models.CASCADE,
        related_name="utilisateurs",
        null=True, blank=True,
        help_text="Vide uniquement pour votre compte superutilisateur (Sylium)."
    )
    role = models.CharField(
        max_length=20, choices=Role.choices, blank=True,
        help_text="Détermine ce que cet utilisateur peut voir/faire une fois connecté."
    )
    telephone = models.CharField(max_length=20, blank=True)

    def __str__(self):
        if self.ecole:
            return f"{self.get_full_name() or self.username} ({self.get_role_display()} — {self.ecole.nom})"
        return self.username
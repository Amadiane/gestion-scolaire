from datetime import timedelta

from django.contrib.auth.models import AbstractUser
from django.db import models
from django.db.models import F
from django.utils import timezone

from tenants.models import School

# Politique de blocage après échecs de connexion
SEUIL_BLOCAGE_TEMPORAIRE = 5      # 5 échecs  -> bloqué 15 minutes
SEUIL_BLOCAGE_DEFINITIF = 10      # 10 échecs -> bloqué jusqu'au déblocage manuel
DUREE_BLOCAGE_TEMPORAIRE = timedelta(minutes=15)


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
        CENSEUR = "censeur", "Proviseur / Censeur"
        ENSEIGNANT = "enseignant", "Enseignant"
        FONDATEUR = "fondateur", "Fondateur"
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
    doit_changer_mdp = models.BooleanField(
        default=False,
        help_text="Vrai après création ou réinitialisation : l'utilisateur doit choisir "
                  "son propre mot de passe à la prochaine connexion.",
    )

    # --- Sécurité : blocage après échecs de connexion ---
    echecs_connexion = models.PositiveIntegerField(default=0)
    bloque_jusqua = models.DateTimeField(null=True, blank=True)
    bloque_definitivement = models.BooleanField(
        default=False,
        help_text="Compte bloqué après trop d'échecs : seul un déblocage manuel le réactive "
                  "(directeur pour le personnel, Sylium pour un directeur).",
    )

    def __str__(self):
        if self.ecole:
            return f"{self.get_full_name() or self.username} ({self.get_role_display()} — {self.ecole.nom})"
        return self.username

    # ----- Blocage -----
    @property
    def est_bloque(self):
        if self.bloque_definitivement:
            return True
        return bool(self.bloque_jusqua and self.bloque_jusqua > timezone.now())

    def minutes_restantes(self):
        if not self.bloque_jusqua:
            return 0
        reste = (self.bloque_jusqua - timezone.now()).total_seconds()
        return max(int(reste // 60) + 1, 1) if reste > 0 else 0

    def enregistrer_echec(self):
        """
        Compte un échec de connexion. Retourne "definitif", "temporaire" ou None.
        Le compteur est incrémenté côté base (F) pour rester exact même si plusieurs
        tentatives arrivent en même temps.
        Un superutilisateur n'est jamais bloqué définitivement (on ne s'enferme pas dehors).
        """
        Utilisateur.objects.filter(pk=self.pk).update(echecs_connexion=F("echecs_connexion") + 1)
        self.refresh_from_db(fields=["echecs_connexion"])
        n = self.echecs_connexion

        if n >= SEUIL_BLOCAGE_DEFINITIF and not self.is_superuser:
            self.bloque_definitivement = True
            Utilisateur.objects.filter(pk=self.pk).update(bloque_definitivement=True)
            EvenementSecurite.enregistrer(self, EvenementSecurite.Type.BLOCAGE_DEFINITIF,
                                          detail=f"{n} échecs de connexion")
            return "definitif"

        if n >= SEUIL_BLOCAGE_TEMPORAIRE:
            self.bloque_jusqua = timezone.now() + DUREE_BLOCAGE_TEMPORAIRE
            Utilisateur.objects.filter(pk=self.pk).update(bloque_jusqua=self.bloque_jusqua)
            EvenementSecurite.enregistrer(self, EvenementSecurite.Type.BLOCAGE_TEMPORAIRE,
                                          detail=f"{n} échecs de connexion")
            return "temporaire"
        return None

    def reinitialiser_echecs(self):
        """Appelé après une connexion réussie."""
        if self.echecs_connexion or self.bloque_jusqua:
            Utilisateur.objects.filter(pk=self.pk).update(echecs_connexion=0, bloque_jusqua=None)
            self.echecs_connexion = 0
            self.bloque_jusqua = None

    def debloquer(self, auteur):
        Utilisateur.objects.filter(pk=self.pk).update(
            echecs_connexion=0, bloque_jusqua=None, bloque_definitivement=False
        )
        self.echecs_connexion = 0
        self.bloque_jusqua = None
        self.bloque_definitivement = False
        EvenementSecurite.enregistrer(self, EvenementSecurite.Type.DEBLOCAGE, auteur=auteur)


class EvenementSecurite(models.Model):
    """Journal des blocages et déblocages de comptes (qui, quand, par qui)."""

    class Type(models.TextChoices):
        BLOCAGE_TEMPORAIRE = "blocage_temporaire", "Blocage temporaire"
        BLOCAGE_DEFINITIF = "blocage_definitif", "Blocage définitif"
        DEBLOCAGE = "deblocage", "Déblocage"

    utilisateur = models.ForeignKey(Utilisateur, on_delete=models.CASCADE, related_name="evenements_securite")
    ecole = models.ForeignKey(School, on_delete=models.CASCADE, null=True, blank=True, related_name="+")
    type = models.CharField(max_length=30, choices=Type.choices)
    auteur = models.ForeignKey(Utilisateur, on_delete=models.SET_NULL, null=True, blank=True, related_name="+")
    detail = models.CharField(max_length=200, blank=True)
    date = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Événement de sécurité"
        verbose_name_plural = "Événements de sécurité"
        ordering = ["-date"]

    def __str__(self):
        return f"{self.get_type_display()} — {self.utilisateur.username} ({self.date:%d/%m/%Y %H:%M})"

    @classmethod
    def enregistrer(cls, utilisateur, type_, auteur=None, detail=""):
        return cls.objects.create(
            utilisateur=utilisateur, ecole=utilisateur.ecole, type=type_, auteur=auteur, detail=detail
        )
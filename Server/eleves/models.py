from django.db import models
from cloudinary.models import CloudinaryField
from tenants.models import School
from django.utils import timezone


class Parent(models.Model):
    # ... (déjà fait à l'étape précédente, inchangé)
    ecole = models.ForeignKey(School, on_delete=models.CASCADE, related_name="parents")
    nom = models.CharField(max_length=100)
    prenom = models.CharField(max_length=100)
    telephone = models.CharField(max_length=20)
    email = models.EmailField(blank=True, null=True)
    adresse = models.CharField(max_length=255, blank=True)
    date_creation = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Parent"
        verbose_name_plural = "Parents"
        ordering = ["nom", "prenom"]

    def __str__(self):
        return f"{self.prenom} {self.nom}"


class Eleve(models.Model):
    class Sexe(models.TextChoices):
        MASCULIN = "M", "Masculin"
        FEMININ = "F", "Féminin"

    class Statut(models.TextChoices):
        ACTIF = "actif", "Actif"
        TRANSFERE = "transfere", "Transféré"
        EXCLU = "exclu", "Exclu"
        DIPLOME = "diplome", "Diplômé / Sorti"

    ecole = models.ForeignKey(School, on_delete=models.CASCADE, related_name="eleves")
    matricule = models.CharField(max_length=30, editable=False)
    nom = models.CharField(max_length=100)
    prenom = models.CharField(max_length=100)
    date_naissance = models.DateField()
    lieu_naissance = models.CharField(max_length=150, blank=True)
    sexe = models.CharField(max_length=1, choices=Sexe.choices)
    photo = CloudinaryField("Photo", folder="eleves/photos", blank=True, null=True)
    parents = models.ManyToManyField(Parent, through="RelationParentEleve", related_name="enfants")
    statut = models.CharField(max_length=20, choices=Statut.choices, default=Statut.ACTIF)
    date_inscription = models.DateField(auto_now_add=True)

    class Meta:
        verbose_name = "Élève"
        verbose_name_plural = "Élèves"
        ordering = ["nom", "prenom"]
        constraints = [
            models.UniqueConstraint(fields=["ecole", "matricule"], name="matricule_unique_par_ecole")
        ]

    def __str__(self):
        return f"{self.prenom} {self.nom} ({self.matricule})"

    def generer_matricule(self):
        annee = timezone.now().year
        prefixe = self.ecole.prefixe_matricule or self.ecole.nom[:3].upper()
        dernier = Eleve.objects.filter(
            ecole=self.ecole, matricule__startswith=f"{prefixe}-{annee}-"
        ).order_by("-matricule").first()

        if dernier:
            dernier_numero = int(dernier.matricule.split("-")[-1])
            nouveau_numero = dernier_numero + 1
        else:
            nouveau_numero = 1

        return f"{prefixe}-{annee}-{nouveau_numero:04d}"

    def save(self, *args, **kwargs):
        if not self.matricule:
            self.matricule = self.generer_matricule()
        super().save(*args, **kwargs)
    def classe_actuelle(self, annee_scolaire=None):
        """Retourne la classe de cet élève pour l'année donnée
        (ou l'année active de l'école si non précisée)."""
        if annee_scolaire is None:
            annee_scolaire = self.ecole.annees_scolaires.filter(est_active=True).first()
        inscription = self.inscriptions.filter(annee_scolaire=annee_scolaire).first()
        return inscription.classe if inscription else None



class RelationParentEleve(models.Model):
    """Table intermédiaire : précise la nature du lien parent ↔ élève."""

    class TypeLien(models.TextChoices):
        PERE = "pere", "Père"
        MERE = "mere", "Mère"
        TUTEUR = "tuteur", "Tuteur légal"
        AUTRE = "autre", "Autre"

    parent = models.ForeignKey(Parent, on_delete=models.CASCADE)
    eleve = models.ForeignKey(Eleve, on_delete=models.CASCADE)
    type_lien = models.CharField(max_length=10, choices=TypeLien.choices)
    contact_principal = models.BooleanField(
        default=False,
        help_text="Coché = ce parent reçoit les SMS/emails en priorité pour cet élève"
    )

    class Meta:
        verbose_name = "Relation parent-élève"
        verbose_name_plural = "Relations parent-élève"
        # Empêche d'enregistrer deux fois le même lien (même parent,
        # même élève) par erreur de saisie.
        constraints = [
            models.UniqueConstraint(
                fields=["parent", "eleve"], name="lien_parent_eleve_unique"
            )
        ]

    def __str__(self):
        return f"{self.parent} — {self.get_type_lien_display()} de {self.eleve}"




from academique.models import Classe, AnneeScolaire


class Inscription(models.Model):
    eleve = models.ForeignKey(Eleve, on_delete=models.CASCADE, related_name="inscriptions")
    classe = models.ForeignKey(Classe, on_delete=models.PROTECT, related_name="inscriptions")
    annee_scolaire = models.ForeignKey(AnneeScolaire, on_delete=models.CASCADE, related_name="inscriptions")
    date_inscription = models.DateField(auto_now_add=True)

    class Statut(models.TextChoices):
        EN_COURS = "en_cours", "En cours"
        REDOUBLANT = "redoublant", "Redoublant"
        TRANSFERE = "transfere", "Transféré en cours d'année"

    statut = models.CharField(max_length=20, choices=Statut.choices, default=Statut.EN_COURS)

    class Meta:
        verbose_name = "Inscription"
        verbose_name_plural = "Inscriptions"
        constraints = [
            models.UniqueConstraint(
                fields=["eleve", "annee_scolaire"], name="une_seule_classe_par_eleve_par_annee"
            )
        ]

    def __str__(self):
        return f"{self.eleve} — {self.classe} ({self.annee_scolaire.nom})"
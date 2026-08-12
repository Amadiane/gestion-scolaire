from django.db import models

# Create your models here.
from django.db import models
from tenants.models import School


class AnneeScolaire(models.Model):
    """Une année scolaire (ex: '2025-2026') pour une école donnée.
    Sert de référence temporelle pour Classe, Note, Paiement, etc."""

    ecole = models.ForeignKey(
        School, on_delete=models.CASCADE, related_name="annees_scolaires"
    )
    nom = models.CharField(max_length=20, help_text="Ex: 2025-2026")
    date_debut = models.DateField()
    date_fin = models.DateField()
    est_active = models.BooleanField(
        default=False,
        help_text="Une seule année active à la fois par école."
    )

    class Meta:
        verbose_name = "Année scolaire"
        verbose_name_plural = "Années scolaires"
        ordering = ["-date_debut"]
        constraints = [
            models.UniqueConstraint(
                fields=["ecole", "nom"], name="annee_unique_par_ecole"
            )
        ]

    def __str__(self):
        return f"{self.nom} ({self.ecole.nom})"

    def save(self, *args, **kwargs):
        # Si CETTE année est marquée active, désactive automatiquement
        # toutes les AUTRES années de la même école — garantit qu'il n'y
        # en a jamais deux actives en même temps, sans y penser à chaque fois.
        if self.est_active:
            AnneeScolaire.objects.filter(
                ecole=self.ecole, est_active=True
            ).exclude(pk=self.pk).update(est_active=False)
        super().save(*args, **kwargs)




class Niveau(models.Model):
    class Cycle(models.TextChoices):
        PRIMAIRE = "primaire", "Primaire"
        COLLEGE = "college", "Collège"
        LYCEE = "lycee", "Lycée"

    ecole = models.ForeignKey(School, on_delete=models.CASCADE, related_name="niveaux")
    nom = models.CharField(max_length=50, help_text="Ex: 6ème, Terminale")
    ordre = models.PositiveSmallIntegerField(default=0)
    cycle = models.CharField(max_length=10, choices=Cycle.choices)
    bareme_note = models.PositiveSmallIntegerField(
        default=20, help_text="Note maximale utilisée pour ce niveau (10 ou 20 généralement)"
    )

    class Meta:
        verbose_name = "Niveau"
        verbose_name_plural = "Niveaux"
        ordering = ["ordre"]
        constraints = [
            models.UniqueConstraint(fields=["ecole", "nom"], name="niveau_unique_par_ecole")
        ]

    def save(self, *args, **kwargs):
        if not self.pk or self._state.adding:
            if self.cycle == self.Cycle.PRIMAIRE and not self.bareme_note:
                self.bareme_note = 10
            elif self.cycle in (self.Cycle.COLLEGE, self.Cycle.LYCEE) and not self.bareme_note:
                self.bareme_note = 20
        super().save(*args, **kwargs)

    def __str__(self):
        return self.nom


class Matiere(models.Model):
    ecole = models.ForeignKey(School, on_delete=models.CASCADE, related_name="matieres")
    nom = models.CharField(max_length=100)
    coefficient = models.PositiveSmallIntegerField(default=1)

    class Meta:
        verbose_name = "Matière"
        verbose_name_plural = "Matières"
        ordering = ["nom"]
        constraints = [
            models.UniqueConstraint(fields=["ecole", "nom"], name="matiere_unique_par_ecole")
        ]

    def __str__(self):
        return f"{self.nom} (coef. {self.coefficient})"


class Classe(models.Model):
    ecole = models.ForeignKey(School, on_delete=models.CASCADE, related_name="classes")
    annee_scolaire = models.ForeignKey(AnneeScolaire, on_delete=models.CASCADE, related_name="classes")
    niveau = models.ForeignKey(Niveau, on_delete=models.PROTECT, related_name="classes")
    nom = models.CharField(max_length=50, help_text="Ex: 6ème A")
    effectif_max = models.PositiveSmallIntegerField(default=50)
    matieres = models.ManyToManyField(Matiere, related_name="classes", blank=True)

    class Meta:
        verbose_name = "Classe"
        verbose_name_plural = "Classes"
        ordering = ["niveau__ordre", "nom"]
        constraints = [
            models.UniqueConstraint(
                fields=["ecole", "annee_scolaire", "nom"], name="classe_unique_par_annee"
            )
        ]

    def __str__(self):
        return f"{self.nom} — {self.annee_scolaire.nom}"



from django.core.exceptions import ValidationError

class Note(models.Model):
    ecole = models.ForeignKey(School, on_delete=models.CASCADE, related_name="notes")
    eleve = models.ForeignKey("eleves.Eleve", on_delete=models.CASCADE, related_name="notes")
    matiere = models.ForeignKey(Matiere, on_delete=models.CASCADE, related_name="notes")
    classe = models.ForeignKey(Classe, on_delete=models.CASCADE, related_name="notes")
    annee_scolaire = models.ForeignKey(AnneeScolaire, on_delete=models.CASCADE, related_name="notes")

    class Trimestre(models.TextChoices):
        T1 = "t1", "1er trimestre"
        T2 = "t2", "2ème trimestre"
        T3 = "t3", "3ème trimestre"

    trimestre = models.CharField(max_length=2, choices=Trimestre.choices)
    valeur = models.DecimalField(max_digits=5, decimal_places=2)
    valeur_max = models.DecimalField(max_digits=5, decimal_places=2, editable=False)
    date_saisie = models.DateTimeField(auto_now_add=True)
    saisi_par = models.ForeignKey(
        "accounts.Utilisateur", on_delete=models.SET_NULL, null=True, related_name="notes_saisies"
    )

    class Meta:
        verbose_name = "Note"
        verbose_name_plural = "Notes"
        ordering = ["-date_saisie"]

    def __str__(self):
        return f"{self.eleve} — {self.matiere} : {self.valeur}/{self.valeur_max}"

    def clean(self):
        if self.valeur is not None and self.valeur_max and self.valeur > self.valeur_max:
            raise ValidationError(f"La note ne peut pas dépasser le barème ({self.valeur_max}).")

    def save(self, *args, **kwargs):
        # Le barème n'est jamais choisi manuellement : il vient toujours du niveau de la classe.
        self.valeur_max = self.classe.niveau.bareme_note
        self.full_clean(exclude=[f.name for f in self._meta.fields if f.name != "valeur"])
        super().save(*args, **kwargs)

    @property
    def moyenne_ponderee(self):
        return round((self.valeur / self.valeur_max) * 20, 2)

class Bulletin(models.Model):
    ecole = models.ForeignKey(School, on_delete=models.CASCADE, related_name="bulletins")
    eleve = models.ForeignKey("eleves.Eleve", on_delete=models.CASCADE, related_name="bulletins")
    classe = models.ForeignKey(Classe, on_delete=models.CASCADE, related_name="bulletins")
    annee_scolaire = models.ForeignKey(AnneeScolaire, on_delete=models.CASCADE, related_name="bulletins")
    trimestre = models.CharField(max_length=2, choices=Note.Trimestre.choices)

    moyenne_generale = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True, editable=False)
    rang = models.PositiveSmallIntegerField(null=True, blank=True, editable=False)

    class Statut(models.TextChoices):
        BROUILLON = "brouillon", "Brouillon"
        VALIDE = "valide", "Validé"
        PUBLIE = "publie", "Publié aux parents"

    statut = models.CharField(max_length=20, choices=Statut.choices, default=Statut.BROUILLON)
    fichier_pdf = models.URLField(blank=True, null=True, editable=False)
    date_generation = models.DateTimeField(auto_now_add=True)
    valide_par = models.ForeignKey(
        "accounts.Utilisateur", on_delete=models.SET_NULL, null=True, blank=True, related_name="bulletins_valides"
    )

    class Meta:
        verbose_name = "Bulletin"
        verbose_name_plural = "Bulletins"
        constraints = [
            models.UniqueConstraint(
                fields=["eleve", "annee_scolaire", "trimestre"], name="bulletin_unique_par_periode"
            )
        ]

    def __str__(self):
        return f"Bulletin {self.eleve} — {self.get_trimestre_display()}"

    def calculer_moyenne(self):
        """
        Moyenne pondérée par coefficient, sur le barème réel du niveau
        (10 pour le primaire, 20 pour collège/lycée) — plus de
        normalisation forcée à 20, puisque toutes les notes d'un même
        bulletin partagent le même barème (celui de la classe/niveau).
        """
        notes = Note.objects.filter(
            eleve=self.eleve, annee_scolaire=self.annee_scolaire, trimestre=self.trimestre
        )
        if not notes.exists():
            return None
        total_pondere = sum(n.valeur * n.matiere.coefficient for n in notes)
        total_coefficients = sum(n.matiere.coefficient for n in notes)
        return round(total_pondere / total_coefficients, 2) if total_coefficients else None

    @staticmethod
    def recalculer_classement(classe, annee_scolaire, trimestre):
        """
        Recalcule moyenne ET rang de TOUS les bulletins d'une même classe,
        pour un trimestre donné — le rang d'un élève dépend forcément des
        autres élèves de sa classe, donc on ne peut jamais le calculer
        élève par élève isolément.
        """
        bulletins = Bulletin.objects.filter(
            classe=classe, annee_scolaire=annee_scolaire, trimestre=trimestre
        )
        resultats = []
        for bulletin in bulletins:
            moyenne = bulletin.calculer_moyenne()
            resultats.append((bulletin, moyenne))

        # Trie du meilleur au moins bon ; les bulletins sans moyenne
        # (aucune note saisie) sont mis à la fin, sans rang.
        resultats.sort(key=lambda x: (x[1] is None, -(x[1] or 0)))

        rang_actuel = 0
        for i, (bulletin, moyenne) in enumerate(resultats):
            bulletin.moyenne_generale = moyenne
            if moyenne is not None:
                rang_actuel += 1
                bulletin.rang = rang_actuel
            else:
                bulletin.rang = None
            bulletin.save(update_fields=["moyenne_generale", "rang"])

    def valider(self, utilisateur):
        self.statut = self.Statut.VALIDE
        self.valide_par = utilisateur
        self.save(update_fields=["statut", "valide_par"])
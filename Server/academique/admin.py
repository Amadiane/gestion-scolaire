from django.contrib import admin
from .models import AnneeScolaire, Niveau, Matiere, Classe, Note, Bulletin


@admin.register(AnneeScolaire)
class AnneeScolaireAdmin(admin.ModelAdmin):
    list_display = ("nom", "ecole", "date_debut", "date_fin", "est_active")
    list_filter = ("ecole", "est_active")


@admin.register(Niveau)
class NiveauAdmin(admin.ModelAdmin):
    list_display = ("nom", "ecole", "ordre")
    list_filter = ("ecole",)


@admin.register(Matiere)
class MatiereAdmin(admin.ModelAdmin):
    list_display = ("nom", "coefficient", "ecole")
    list_filter = ("ecole",)


@admin.register(Classe)
class ClasseAdmin(admin.ModelAdmin):
    list_display = ("nom", "niveau", "annee_scolaire", "ecole", "effectif_max")
    list_filter = ("ecole", "annee_scolaire", "niveau")
    filter_horizontal = ("matieres",)


@admin.register(Note)
class NoteAdmin(admin.ModelAdmin):
    list_display = ("eleve", "matiere", "trimestre", "valeur", "valeur_max", "ecole")
    list_filter = ("ecole", "trimestre", "matiere")
    search_fields = ("eleve__nom", "eleve__prenom")


@admin.register(Bulletin)
class BulletinAdmin(admin.ModelAdmin):
    list_display = ("eleve", "trimestre", "moyenne_generale", "rang", "statut", "ecole")
    list_filter = ("ecole", "trimestre", "statut", "classe")
    search_fields = ("eleve__nom", "eleve__prenom")
    readonly_fields = ("moyenne_generale", "rang", "fichier_pdf", "date_generation")
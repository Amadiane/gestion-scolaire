from django.contrib import admin
from .models import Parent, Eleve, RelationParentEleve, Inscription


class RelationParentEleveInline(admin.TabularInline):
    model = RelationParentEleve
    extra = 1


class InscriptionInline(admin.TabularInline):
    model = Inscription
    extra = 1


@admin.register(Eleve)
class EleveAdmin(admin.ModelAdmin):
    list_display = ("matricule", "nom", "prenom", "ecole", "statut")
    list_filter = ("ecole", "statut", "sexe")
    search_fields = ("matricule", "nom", "prenom")
    readonly_fields = ("matricule",)
    inlines = [RelationParentEleveInline, InscriptionInline]


@admin.register(Parent)
class ParentAdmin(admin.ModelAdmin):
    list_display = ("nom", "prenom", "telephone", "ecole")
    list_filter = ("ecole",)
    search_fields = ("nom", "prenom", "telephone")


@admin.register(Inscription)
class InscriptionAdmin(admin.ModelAdmin):
    list_display = ("eleve", "classe", "annee_scolaire", "statut")
    list_filter = ("annee_scolaire", "classe", "statut")
    search_fields = ("eleve__nom", "eleve__prenom")
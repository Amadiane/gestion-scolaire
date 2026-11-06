from django.contrib import admin

from .models import MembrePersonnel


@admin.register(MembrePersonnel)
class MembrePersonnelAdmin(admin.ModelAdmin):
    list_display = ("matricule", "nom", "prenom", "poste", "statut", "ecole")
    list_filter = ("ecole", "poste", "statut")
    search_fields = ("nom", "prenom", "matricule")
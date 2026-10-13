from django.contrib import admin
from .models import FraisScolarite, Paiement, RemiseEleve


@admin.register(FraisScolarite)
class FraisAdmin(admin.ModelAdmin):
    list_display = ("niveau", "libelle", "montant", "annee_scolaire", "ecole")
    list_filter = ("ecole", "annee_scolaire")


@admin.register(Paiement)
class PaiementAdmin(admin.ModelAdmin):
    list_display = ("numero_recu", "eleve", "montant", "mode", "date_paiement", "ecole")
    list_filter = ("ecole", "mode")
    search_fields = ("numero_recu", "eleve__nom", "eleve__prenom")
    readonly_fields = ("numero_recu",)


@admin.register(RemiseEleve)
class RemiseAdmin(admin.ModelAdmin):
    list_display = ("eleve", "montant", "motif", "annee_scolaire", "ecole")
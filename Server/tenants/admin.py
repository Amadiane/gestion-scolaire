from django.contrib import admin

# Register your models here.
from django.contrib import admin
from django.utils.html import format_html
from .models import School, PlanAbonnement, Abonnement


@admin.action(description="Bloquer l'accès (suspendre l'abonnement)")
def action_bloquer(modeladmin, request, queryset):
    for abonnement in queryset:
        abonnement.bloquer()


@admin.action(description="Réactiver l'accès")
def action_reactiver(modeladmin, request, queryset):
    for abonnement in queryset:
        abonnement.reactiver()


@admin.register(Abonnement)
class AbonnementAdmin(admin.ModelAdmin):
    list_display = ("ecole", "plan", "date_debut", "date_fin", "statut", "jours_restants")
    list_filter = ("statut", "plan")
    search_fields = ("ecole__nom",)
    actions = [action_bloquer, action_reactiver]


@admin.register(School)
class SchoolAdmin(admin.ModelAdmin):
    list_display = ("nom", "slug", "effectif_declare", "est_actif")
    list_filter = ("est_actif",)
    search_fields = ("nom", "slug")
    prepopulated_fields = {"slug": ("nom",)}


admin.site.register(PlanAbonnement)
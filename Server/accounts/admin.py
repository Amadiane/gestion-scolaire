from django.contrib import admin

# Register your models here.
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import Utilisateur


@admin.register(Utilisateur)
class UtilisateurAdmin(UserAdmin):
    """
    Hérite de UserAdmin (l'interface standard de Django pour gérer les
    utilisateurs) plutôt que ModelAdmin classique, pour garder la gestion
    de mot de passe sécurisée telle quelle (champ masqué, hashé...).
    """
    list_display = ("username", "get_full_name", "role", "ecole", "is_active")
    list_filter = ("role", "ecole", "is_active")

    # Ajoute nos champs personnalisés aux sections déjà existantes de UserAdmin
    fieldsets = UserAdmin.fieldsets + (
        ("Informations Sylium", {"fields": ("ecole", "role", "telephone")}),
    )
    add_fieldsets = UserAdmin.add_fieldsets + (
        ("Informations Sylium", {"fields": ("ecole", "role", "telephone")}),
    )
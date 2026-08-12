from django.shortcuts import render

# Create your views here.
from django.contrib.auth.views import LoginView
from django.contrib.auth.decorators import login_required
from django.shortcuts import render


class ConnexionView(LoginView):
    template_name = "accounts/connexion.html"


@login_required
def tableau_bord(request):
    """Page de test : n'importe quel utilisateur connecté atterrit ici.
    C'est LA page qui doit être bloquée si l'abonnement de son école
    n'est pas valide — contrairement à /admin/, elle n'est pas exemptée."""
    return render(request, "accounts/tableau_bord.html", {"user": request.user})



from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .serializers import UtilisateurSerializer

# ... (gardez ConnexionView et tableau_bord existants pour l'instant)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def api_utilisateur_courant(request):
    """
    Endpoint que React appellera juste après connexion pour savoir
    qui est connecté, avec quel rôle, dans quelle école.
    """
    serializer = UtilisateurSerializer(request.user)
    return Response(serializer.data)

from rest_framework import viewsets, permissions
from rest_framework.response import Response
from tenants.mixins import TenantScopedQuerysetMixin
from .models import Utilisateur
from .serializers import UtilisateurSerializer, UtilisateurCreateSerializer


class IsDirecteur(permissions.BasePermission):
    """Seul un compte role=directeur (ou le superutilisateur Sylium)
    peut gérer les comptes du personnel de son école."""
    message = "Seul un directeur peut gérer les comptes utilisateurs."

    def has_permission(self, request, view):
        user = request.user
        return user.is_superuser or getattr(user, "role", None) == "directeur"


class UtilisateurViewSet(TenantScopedQuerysetMixin, viewsets.ModelViewSet):
    queryset = Utilisateur.objects.all()
    permission_classes = [IsDirecteur]

    def get_serializer_class(self):
        if self.action == "create":
            return UtilisateurCreateSerializer
        return UtilisateurSerializer

    def get_queryset(self):
        # Exclut le compte du directeur connecté lui-même de sa propre
        # liste de gestion — il se gère via "Modifier le mot de passe"
        # dans l'admin ou une future page "Mon profil", pas ici.
        return super().get_queryset().exclude(pk=self.request.user.pk)

    def perform_create(self, serializer):
        ecole = self.request.user.ecole
        if ecole is None:
            from rest_framework.exceptions import ValidationError
            raise ValidationError("Impossible de créer un utilisateur : aucune école associée à ce compte.")
        serializer.save(ecole=ecole)
import secrets
import string

from django.contrib.auth.decorators import login_required
from django.contrib.auth.views import LoginView
from django.shortcuts import render
from rest_framework import viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from tenants.mixins import TenantScopedQuerysetMixin
from tenants.permissions import IsDirecteur, IsSubscriptionActive

from .models import Utilisateur
from .serializers import UtilisateurCreateSerializer, UtilisateurSerializer


# --- Vues HTML (tests via navigateur) ---

class ConnexionView(LoginView):
    template_name = "accounts/connexion.html"


@login_required
def tableau_bord(request):
    return render(request, "accounts/tableau_bord.html", {"user": request.user})


# --- API ---

@api_view(["GET"])
@permission_classes([IsSubscriptionActive])
def api_utilisateur_courant(request):
    """
    Appelé par React juste après la connexion. Exige un abonnement valide :
    une école expirée ou suspendue est donc refusée dès l'ouverture de session.
    """
    return Response(UtilisateurSerializer(request.user).data)


class UtilisateurViewSet(TenantScopedQuerysetMixin, viewsets.ModelViewSet):
    """Gestion des comptes du personnel par le directeur de l'école."""
    queryset = Utilisateur.objects.all()
    permission_classes = [IsSubscriptionActive, IsDirecteur]

    def get_serializer_class(self):
        if self.action == "create":
            return UtilisateurCreateSerializer
        return UtilisateurSerializer

    def get_queryset(self):
        user = self.request.user
        qs = super().get_queryset().exclude(pk=user.pk)
        if not user.is_superuser:
            # Un directeur ne touche jamais aux comptes Sylium.
            qs = qs.exclude(is_superuser=True)
        return qs

    def perform_create(self, serializer):
        ecole = self.request.user.ecole
        if ecole is None:
            raise ValidationError("Impossible de créer un utilisateur : aucune école associée à ce compte.")
        serializer.save(ecole=ecole)

    @action(detail=True, methods=["post"])
    def reinitialiser_mot_de_passe(self, request, pk=None):
        utilisateur = self.get_object()
        alphabet = string.ascii_letters + string.digits
        nouveau = "".join(secrets.choice(alphabet) for _ in range(10))
        utilisateur.set_password(nouveau)
        utilisateur.save()
        return Response({"nouveau_mot_de_passe": nouveau})
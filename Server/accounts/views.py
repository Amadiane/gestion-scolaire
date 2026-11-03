import secrets

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
from .serializers import (
    ChangerMotDePasseSerializer,
    UtilisateurCreateSerializer,
    UtilisateurSerializer,
)

# Sans caractères ambigus (0/O, 1/l/I) : le mot de passe est lu et recopié à la main.
ALPHABET_LISIBLE = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789"


def generer_mot_de_passe(longueur=10):
    return "".join(secrets.choice(ALPHABET_LISIBLE) for _ in range(longueur))


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


@api_view(["POST"])
@permission_classes([IsSubscriptionActive])
def api_changer_mot_de_passe(request):
    """
    L'utilisateur connecté choisit son propre mot de passe.
    Exige l'ancien (le temporaire donné par le directeur) et lève l'obligation de changement.
    """
    serializer = ChangerMotDePasseSerializer(data=request.data, context={"request": request})
    serializer.is_valid(raise_exception=True)

    user = request.user
    user.set_password(serializer.validated_data["nouveau_mot_de_passe"])
    user.doit_changer_mdp = False
    user.save(update_fields=["password", "doit_changer_mdp"])
    return Response(UtilisateurSerializer(user).data)


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
        return qs.order_by("last_name", "first_name", "username")

    def perform_create(self, serializer):
        ecole = self.request.user.ecole
        if ecole is None:
            raise ValidationError("Impossible de créer un utilisateur : aucune école associée à ce compte.")
        serializer.save(ecole=ecole)

    @action(detail=True, methods=["post"])
    def reinitialiser_mot_de_passe(self, request, pk=None):
        utilisateur = self.get_object()
        nouveau = generer_mot_de_passe()
        utilisateur.set_password(nouveau)
        utilisateur.doit_changer_mdp = True
        utilisateur.save(update_fields=["password", "doit_changer_mdp"])
        return Response({"username": utilisateur.username, "nouveau_mot_de_passe": nouveau})
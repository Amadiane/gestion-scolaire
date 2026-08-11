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
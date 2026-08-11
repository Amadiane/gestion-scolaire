from django.urls import path
from django.contrib.auth.views import LogoutView
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from . import views

urlpatterns = [
    # Vues HTML existantes (gardées pour tester via navigateur/admin)
    path("connexion/", views.ConnexionView.as_view(), name="connexion"),
    path("deconnexion/", LogoutView.as_view(next_page="connexion"), name="deconnexion"),
    path("tableau-bord/", views.tableau_bord, name="tableau_bord"),

    # API pour React
    path("api/token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("api/utilisateur/moi/", views.api_utilisateur_courant, name="api_utilisateur_courant"),
]
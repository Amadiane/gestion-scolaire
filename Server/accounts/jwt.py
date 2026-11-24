from rest_framework.exceptions import AuthenticationFailed, PermissionDenied
from rest_framework.throttling import ScopedRateThrottle
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView

from tenants.middleware import SubscriptionMiddleware

from .models import Utilisateur
from .serializers import UtilisateurSerializer


def _detail_blocage(user):
    """Corps de la réponse 403 quand un compte est bloqué."""
    if user.bloque_definitivement:
        qui = "Sylium" if user.role == Utilisateur.Role.DIRECTEUR else "votre directeur"
        return {
            "erreur": "compte_bloque",
            "definitif": True,
            "message": f"Compte bloqué après trop de tentatives. Contactez {qui} pour le débloquer.",
        }
    minutes = user.minutes_restantes()
    return {
        "erreur": "compte_bloque",
        "definitif": False,
        "minutes": minutes,
        "message": f"Trop de tentatives. Réessayez dans {minutes} minute(s).",
    }


class LoginSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        identifiant = attrs.get(self.username_field)
        user = None
        if identifiant:
            user = Utilisateur.objects.filter(**{self.username_field: identifiant}).first()

        # Compte déjà bloqué : on refuse sans même regarder le mot de passe.
        if user is not None and user.est_bloque:
            raise PermissionDenied(_detail_blocage(user))

        try:
            data = super().validate(attrs)   # refuse déjà un mauvais mot de passe
        except AuthenticationFailed:
            if user is not None and user.is_active and user.enregistrer_echec():
                raise PermissionDenied(_detail_blocage(user))
            raise

        user = self.user
        user.reinitialiser_echecs()

        if not user.is_superuser:
            ecole = user.ecole
            if ecole is None:
                raise PermissionDenied({"erreur": "acces_bloque", "raison": "aucun_abonnement"})
            if not ecole.acces_autorise:
                raison = SubscriptionMiddleware._raison_blocage(ecole, getattr(ecole, "abonnement", None))
                raise PermissionDenied({"erreur": "acces_bloque", "raison": raison})

        data["user"] = UtilisateurSerializer(user).data
        return data


class LoginView(TokenObtainPairView):
    serializer_class = LoginSerializer
    # Freine les essais répétés de mots de passe sur cette adresse publique.
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "login"
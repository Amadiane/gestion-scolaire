from rest_framework.exceptions import PermissionDenied
from rest_framework.throttling import ScopedRateThrottle
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView

from tenants.middleware import SubscriptionMiddleware

from .serializers import UtilisateurSerializer


class LoginSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        data = super().validate(attrs)   # refuse déjà un mauvais mot de passe
        user = self.user

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
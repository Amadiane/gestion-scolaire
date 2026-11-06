from rest_framework.decorators import (
    api_view, authentication_classes, permission_classes, throttle_classes,
)
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle

from tenants.models import School


class CartePubliqueThrottle(AnonRateThrottle):
    """30 requêtes par minute et par adresse IP : empêche de tester des matricules en masse."""
    scope = "carte_publique"

    def get_rate(self):
        return "30/min"


@api_view(["GET"])
@authentication_classes([])      # un vieux jeton expiré ne doit pas provoquer d'erreur 401
@permission_classes([AllowAny])
@throttle_classes([CartePubliqueThrottle])
def carte_publique(request, matricule):
    """
    Page « carte perdue ». Renvoie uniquement le nom et le téléphone de l'école,
    déduits du préfixe du matricule (ex. DEM de DEM-PERS-0001).

    Aucune donnée sur la personne n'est lue. La réponse a toujours la même forme et le
    même code HTTP, que le matricule existe ou non.
    """
    vide = {"ecole": None, "telephone": ""}

    prefixe = (matricule or "").split("-")[0].strip()
    if not prefixe or len(prefixe) > 10:
        return Response(vide)

    ecoles = list(School.objects.filter(prefixe_matricule__iexact=prefixe, est_actif=True)[:2])
    # Préfixe absent ou partagé par deux écoles : on n'affirme rien.
    if len(ecoles) != 1:
        return Response(vide)

    ecole = ecoles[0]
    return Response({"ecole": ecole.nom, "telephone": ecole.telephone or ""})
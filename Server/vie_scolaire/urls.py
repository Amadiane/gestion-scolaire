from django.urls import path
from rest_framework.routers import DefaultRouter

from .ecole import mon_ecole
from .presences import (
    assiduite_eleve, presences_du_jour, presences_personnel_du_jour,
    synchroniser_presences, synchroniser_presences_personnel,rapport_presences, 
)
from .public import carte_publique
from .views import PersonnelViewSet
from .tableau import tableau_finance, tableau_presences

router = DefaultRouter()
router.register(r"personnel", PersonnelViewSet, basename="personnel")

# Les routes à part passent AVANT celles du routeur, et on ajoute (+) au lieu d'écraser.
urlpatterns = [
    path("mon-ecole/", mon_ecole),
    path("carte-publique/<str:matricule>/", carte_publique),
    path("presences/", presences_du_jour),
    path("presences/synchroniser/", synchroniser_presences),
    path("presences/eleve/<int:eleve_id>/", assiduite_eleve),
    path("presences-personnel/", presences_personnel_du_jour),
    path("presences-personnel/synchroniser/", synchroniser_presences_personnel),
    path("presences/rapport/", rapport_presences),
    path("tableau/presences/", tableau_presences),
    path("tableau/finance/", tableau_finance),
] + router.urls
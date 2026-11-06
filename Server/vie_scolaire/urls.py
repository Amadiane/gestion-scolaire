from django.urls import path
from rest_framework.routers import DefaultRouter

from .ecole import mon_ecole
from .public import carte_publique
from .views import PersonnelViewSet

router = DefaultRouter()
router.register(r"personnel", PersonnelViewSet, basename="personnel")

# Les routes à part passent AVANT celles du routeur, et on ajoute (+) au lieu d'écraser.
urlpatterns = [
    path("mon-ecole/", mon_ecole),
    path("carte-publique/<str:matricule>/", carte_publique),
] + router.urls
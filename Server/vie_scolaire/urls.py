from rest_framework.routers import DefaultRouter

from .views import PersonnelViewSet
from .public import carte_publique
from django.urls import path, include



router = DefaultRouter()
router.register("personnel", PersonnelViewSet, basename="personnel")


urlpatterns = [
    path("carte-publique/<str:matricule>/", carte_publique),
]

urlpatterns = router.urls
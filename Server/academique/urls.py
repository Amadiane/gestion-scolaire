from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    AffectationViewSet, AnneeScolaireViewSet, BulletinViewSet, ClasseViewSet,
    MatiereViewSet, NiveauViewSet, NoteViewSet, mes_affectations,
)

router = DefaultRouter()
router.register("annees-scolaires", AnneeScolaireViewSet, basename="annee-scolaire")
router.register("niveaux", NiveauViewSet, basename="niveau")
router.register("matieres", MatiereViewSet, basename="matiere")
router.register("classes", ClasseViewSet, basename="classe")
router.register("notes", NoteViewSet, basename="note")
router.register("bulletins", BulletinViewSet, basename="bulletin")
router.register("affectations", AffectationViewSet, basename="affectation")

urlpatterns = router.urls + [
    path("mes-affectations/", mes_affectations, name="mes_affectations"),
]
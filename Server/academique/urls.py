from rest_framework.routers import DefaultRouter
from .views import (
    AnneeScolaireViewSet, NiveauViewSet, MatiereViewSet, ClasseViewSet,
    NoteViewSet, BulletinViewSet,
)

router = DefaultRouter()
router.register("annees-scolaires", AnneeScolaireViewSet, basename="annee-scolaire")
router.register("niveaux", NiveauViewSet, basename="niveau")
router.register("matieres", MatiereViewSet, basename="matiere")
router.register("classes", ClasseViewSet, basename="classe")
router.register("notes", NoteViewSet, basename="note")
router.register("bulletins", BulletinViewSet, basename="bulletin")

urlpatterns = router.urls
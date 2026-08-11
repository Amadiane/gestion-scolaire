from rest_framework.routers import DefaultRouter
from .views import ParentViewSet, EleveViewSet, InscriptionViewSet

router = DefaultRouter()
router.register("parents", ParentViewSet, basename="parent")
router.register("eleves", EleveViewSet, basename="eleve")
router.register("inscriptions", InscriptionViewSet, basename="inscription")

urlpatterns = router.urls
from rest_framework.routers import DefaultRouter

from .sylium import EcoleViewSet, PlanViewSet

router = DefaultRouter()
router.register("sylium/ecoles", EcoleViewSet, basename="sylium-ecole")
router.register("sylium/plans", PlanViewSet, basename="sylium-plan")

urlpatterns = router.urls
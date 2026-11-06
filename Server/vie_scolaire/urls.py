from rest_framework.routers import DefaultRouter

from .views import PersonnelViewSet

router = DefaultRouter()
router.register("personnel", PersonnelViewSet, basename="personnel")

urlpatterns = router.urls
from django.urls import path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("frais", views.FraisScolariteViewSet, basename="frais")
router.register("paiements", views.PaiementViewSet, basename="paiement")

urlpatterns = router.urls + [
    path("finance/situation/", views.situation, name="finance_situation"),
    path("finance/arrieres/", views.arrieres, name="finance_arrieres"),
    path("finance/remise/", views.remise, name="finance_remise"),
]
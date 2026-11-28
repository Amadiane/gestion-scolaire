from django.urls import path

from .fondateur import tableau_fondateur
from .views import dashboard

urlpatterns = [
    path("statistiques/dashboard/", dashboard, name="statistiques_dashboard"),
    path("statistiques/fondateur/", tableau_fondateur, name="statistiques_fondateur"),
]
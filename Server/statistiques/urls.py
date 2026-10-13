from django.urls import path
from .views import dashboard

urlpatterns = [
    path("statistiques/dashboard/", dashboard, name="statistiques_dashboard"),
]
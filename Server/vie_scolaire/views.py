from rest_framework import viewsets
from rest_framework.exceptions import ValidationError

from tenants.mixins import TenantScopedQuerysetMixin
from tenants.permissions import IsDirecteur, IsSubscriptionActive

from .models import MembrePersonnel
from .serializers import PersonnelSerializer


class PersonnelViewSet(TenantScopedQuerysetMixin, viewsets.ModelViewSet):
    """Gestion du personnel : réservée au directeur de l'école."""
    queryset = MembrePersonnel.objects.select_related("utilisateur").order_by("matricule")
    serializer_class = PersonnelSerializer
    permission_classes = [IsSubscriptionActive, IsDirecteur]

    def perform_create(self, serializer):
        ecole = self.request.user.ecole
        if ecole is None:
            raise ValidationError("Impossible de créer une fiche : aucune école associée à ce compte.")
        serializer.save(ecole=ecole)
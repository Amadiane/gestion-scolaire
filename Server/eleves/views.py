from django.shortcuts import render

# Create your views here.
from rest_framework import viewsets
from tenants.mixins import TenantScopedQuerysetMixin
from .models import Parent, Eleve, Inscription
from .serializers import ParentSerializer, EleveSerializer, InscriptionSerializer


class ParentViewSet(TenantScopedQuerysetMixin, viewsets.ModelViewSet):
    queryset = Parent.objects.all()
    serializer_class = ParentSerializer

    def perform_create(self, serializer):
        serializer.save(ecole=self.request.user.ecole)


class EleveViewSet(TenantScopedQuerysetMixin, viewsets.ModelViewSet):
    queryset = Eleve.objects.all()
    serializer_class = EleveSerializer

    def perform_create(self, serializer):
        serializer.save(ecole=self.request.user.ecole)


class InscriptionViewSet(viewsets.ModelViewSet):
    queryset = Inscription.objects.all()
    serializer_class = InscriptionSerializer

    def get_queryset(self):
        user = self.request.user
        if user.is_superuser:
            return Inscription.objects.all()
        return Inscription.objects.filter(eleve__ecole=user.ecole)
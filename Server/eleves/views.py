from django.shortcuts import get_object_or_404
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from academique.scoping import est_enseignant, ids_classes
from tenants.mixins import TenantScopedQuerysetMixin

from .models import Eleve, Inscription, Parent, RelationParentEleve
from .serializers import (
    EleveSerializer, InscriptionSerializer, ParentDetailSerializer, ParentSerializer,
)


class ParentViewSet(TenantScopedQuerysetMixin, viewsets.ModelViewSet):
    # Pas de queryset_enseignant : les enseignants n'accèdent pas aux
    # coordonnées des parents.
    queryset = Parent.objects.all()
    serializer_class = ParentSerializer

    def perform_create(self, serializer):
        ecole = self.request.user.ecole
        if ecole is None:
            raise ValidationError("Impossible de créer un parent : aucune école n'est associée à ce compte.")
        serializer.save(ecole=ecole)

    def retrieve(self, request, *args, **kwargs):
        return Response(ParentDetailSerializer(self.get_object()).data)


class EleveViewSet(TenantScopedQuerysetMixin, viewsets.ModelViewSet):
    queryset = Eleve.objects.all()
    serializer_class = EleveSerializer

    def queryset_enseignant(self, qs, user):
        return qs.filter(inscriptions__classe_id__in=ids_classes(user)).distinct()

    def perform_create(self, serializer):
        ecole = self.request.user.ecole
        if ecole is None:
            raise ValidationError("Impossible de créer un élève : aucune école n'est associée à ce compte.")
        serializer.save(ecole=ecole)

    @action(detail=True, methods=["post"])
    def lier_parent(self, request, pk=None):
        eleve = self.get_object()
        parent_id = request.data.get("parent")
        if not parent_id:
            return Response({"detail": "Le champ 'parent' est requis."}, status=400)
        # Le parent doit appartenir à la même école que l'élève.
        parent = get_object_or_404(Parent, pk=parent_id, ecole=eleve.ecole)
        relation, created = RelationParentEleve.objects.get_or_create(
            eleve=eleve, parent=parent,
            defaults={
                "type_lien": request.data.get("type_lien", "autre"),
                "contact_principal": request.data.get("contact_principal", False),
            },
        )
        return Response({"id": relation.id, "created": created}, status=201 if created else 200)


class InscriptionViewSet(viewsets.ModelViewSet):
    queryset = Inscription.objects.all()
    serializer_class = InscriptionSerializer

    def get_queryset(self):
        user = self.request.user
        if user.is_superuser:
            return Inscription.objects.all()
        qs = Inscription.objects.filter(eleve__ecole=user.ecole)
        if est_enseignant(user):
            qs = qs.filter(classe_id__in=ids_classes(user))
        return qs
from django.shortcuts import render

# Create your views here.
from rest_framework import viewsets
from tenants.mixins import TenantScopedQuerysetMixin
from .models import Parent, Eleve, Inscription
from .serializers import ParentSerializer, EleveSerializer, InscriptionSerializer


from .serializers import ParentDetailSerializer

class ParentViewSet(TenantScopedQuerysetMixin, viewsets.ModelViewSet):
    queryset = Parent.objects.all()
    serializer_class = ParentSerializer

    def perform_create(self, serializer):
        ecole = self.request.user.ecole
        if ecole is None:
            raise ValidationError(
                "Impossible de créer un parent : aucune école n'est associée à ce compte."
            )
        serializer.save(ecole=ecole)

    def retrieve(self, request, *args, **kwargs):
        # Le détail d'un parent (GET /api/parents/{id}/) utilise un
        # serializer enrichi avec ses enfants — la liste globale, elle,
        # continue d'utiliser le serializer léger (perf : pas besoin de
        # charger tous les enfants de tous les parents pour une simple liste).
        instance = self.get_object()
        serializer = ParentDetailSerializer(instance)
        return Response(serializer.data)

from rest_framework.exceptions import ValidationError

from rest_framework.decorators import action
from rest_framework.response import Response
from .models import RelationParentEleve

class EleveViewSet(TenantScopedQuerysetMixin, viewsets.ModelViewSet):
    queryset = Eleve.objects.all()
    serializer_class = EleveSerializer

    def perform_create(self, serializer):
        ecole = self.request.user.ecole
        if ecole is None:
            raise ValidationError(
                "Impossible de créer un élève : aucune école n'est associée à ce compte."
            )
        serializer.save(ecole=ecole)

    @action(detail=True, methods=["post"])
    def lier_parent(self, request, pk=None):
        """
        Crée le lien Parent <-> Élève. Appelé séparément après la
        création de l'élève, une fois qu'on connaît son ID.
        """
        eleve = self.get_object()
        parent_id = request.data.get("parent")
        type_lien = request.data.get("type_lien", "autre")
        contact_principal = request.data.get("contact_principal", False)

        if not parent_id:
            return Response({"detail": "Le champ 'parent' est requis."}, status=400)

        relation, created = RelationParentEleve.objects.get_or_create(
            eleve=eleve,
            parent_id=parent_id,
            defaults={"type_lien": type_lien, "contact_principal": contact_principal},
        )
        return Response({"id": relation.id, "created": created}, status=201 if created else 200)




class InscriptionViewSet(viewsets.ModelViewSet):
    queryset = Inscription.objects.all()
    serializer_class = InscriptionSerializer

    def get_queryset(self):
        user = self.request.user
        if user.is_superuser:
            return Inscription.objects.all()
        return Inscription.objects.filter(eleve__ecole=user.ecole)
from django.shortcuts import render

import time
import cloudinary.utils
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from tenants.mixins import TenantScopedQuerysetMixin
from .models import AnneeScolaire, Niveau, Matiere, Classe, Note, Bulletin
from .serializers import (
    AnneeScolaireSerializer, NiveauSerializer, MatiereSerializer,
    ClasseSerializer, NoteSerializer, BulletinSerializer,
)
from .pdf import generer_pdf_bulletin



class AnneeScolaireViewSet(TenantScopedQuerysetMixin, viewsets.ModelViewSet):
    queryset = AnneeScolaire.objects.all()
    serializer_class = AnneeScolaireSerializer

    def perform_create(self, serializer):
        # Fixe l'école automatiquement depuis l'utilisateur connecté —
        # cohérent avec `ecole` en read_only dans le serializer ci-dessus.
        serializer.save(ecole=self.request.user.ecole)


from .models import Niveau, Matiere, Classe
from .serializers import NiveauSerializer, MatiereSerializer, ClasseSerializer


class NiveauViewSet(TenantScopedQuerysetMixin, viewsets.ModelViewSet):
    queryset = Niveau.objects.all()
    serializer_class = NiveauSerializer

    def perform_create(self, serializer):
        serializer.save(ecole=self.request.user.ecole)


class MatiereViewSet(TenantScopedQuerysetMixin, viewsets.ModelViewSet):
    queryset = Matiere.objects.all()
    serializer_class = MatiereSerializer

    def perform_create(self, serializer):
        serializer.save(ecole=self.request.user.ecole)


class ClasseViewSet(TenantScopedQuerysetMixin, viewsets.ModelViewSet):
    queryset = Classe.objects.all()
    serializer_class = ClasseSerializer

    def perform_create(self, serializer):
        serializer.save(ecole=self.request.user.ecole)



class NoteViewSet(TenantScopedQuerysetMixin, viewsets.ModelViewSet):
    queryset = Note.objects.all()
    serializer_class = NoteSerializer

    def perform_create(self, serializer):
        serializer.save(ecole=self.request.user.ecole, saisi_par=self.request.user)


class BulletinViewSet(TenantScopedQuerysetMixin, viewsets.ModelViewSet):
    queryset = Bulletin.objects.all()
    serializer_class = BulletinSerializer

    def perform_create(self, serializer):
        serializer.save(ecole=self.request.user.ecole)

    @action(detail=True, methods=["post"])
    def valider(self, request, pk=None):
        bulletin = self.get_object()
        bulletin.valider(request.user)
        return Response(BulletinSerializer(bulletin).data)



from .pdf import generer_pdf_bulletin

from django.db.models import Q

class BulletinViewSet(TenantScopedQuerysetMixin, viewsets.ModelViewSet):
    queryset = Bulletin.objects.all()
    serializer_class = BulletinSerializer

    def perform_create(self, serializer):
        serializer.save(ecole=self.request.user.ecole)

    @action(detail=True, methods=["post"])
    def valider(self, request, pk=None):
        bulletin = self.get_object()
        bulletin.valider(request.user)
        return Response(BulletinSerializer(bulletin).data)

    @action(detail=True, methods=["post"])
    def generer_pdf(self, request, pk=None):
        bulletin = self.get_object()
        public_id = generer_pdf_bulletin(bulletin)
        bulletin.fichier_pdf = public_id
        bulletin.save(update_fields=["fichier_pdf"])
        return Response({"public_id": public_id})

    @action(detail=True, methods=["get"])
    def telecharger_pdf(self, request, pk=None):
        bulletin = self.get_object()

        public_id, _ = generer_pdf_bulletin(bulletin)
        bulletin.fichier_pdf = public_id
        bulletin.save(update_fields=["fichier_pdf"])

        # private_download_url passe par la vraie API de téléchargement
        # sécurisé de Cloudinary (api.cloudinary.com/.../download), pas par
        # une URL de livraison — c'est la fonction faite spécifiquement
        # pour les ressources type="authenticated".
        url_signee = cloudinary.utils.private_download_url(
            public_id,
            "pdf",
            resource_type="raw",
            type="authenticated",
            attachment=True,
        )
        return Response({"url": url_signee})
    @action(detail=False, methods=["get"])
    def rechercher(self, request):
        """
        Recherche un bulletin par nom/prénom d'élève, matricule, OU
        nom/prénom d'un de ses parents — un seul champ de recherche
        suffit côté React, peu importe ce que l'utilisateur y tape.
        """
        terme = request.query_params.get("q", "").strip()
        if not terme:
            return Response({"detail": "Paramètre 'q' requis."}, status=400)

        queryset = self.get_queryset().filter(
            Q(eleve__nom__icontains=terme)
            | Q(eleve__prenom__icontains=terme)
            | Q(eleve__matricule__icontains=terme)
            | Q(eleve__parents__nom__icontains=terme)
            | Q(eleve__parents__prenom__icontains=terme)
        ).distinct()

        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)
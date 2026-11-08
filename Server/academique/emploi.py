from django.db import transaction
from django.db.models import Q
from rest_framework import serializers, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from tenants.permissions import IsSubscriptionActive

from .emploi_models import CreneauEmploi
from .models import Affectation, Classe
from .scoping import est_enseignant, ids_classes

# Rôles qui gèrent l'emploi du temps de toutes les classes.
ROLES_GESTION = {"directeur", "secretaire"}


def _hhmm(t):
    return t.strftime("%H:%M")


def _nom(u):
    return f"{u.first_name} {u.last_name}".strip() or u.username


def _titre(c):
    return c.matiere.nom if c.matiere_id else (c.libelle or "Créneau")


def verifier_conflits(ecole_id, classe, jour, debut, fin, enseignant, salle, exclure_pk=None):
    """Refuse les chevauchements : même classe, même enseignant ou même salle."""
    base = CreneauEmploi.objects.filter(
        ecole_id=ecole_id, jour=jour, debut__lt=fin, fin__gt=debut
    ).select_related("classe", "matiere")
    if exclure_pk:
        base = base.exclude(pk=exclure_pk)

    autre = base.filter(classe=classe).first()
    if autre:
        raise ValidationError(
            f"{classe.nom} a déjà « {_titre(autre)} » de {_hhmm(autre.debut)} à {_hhmm(autre.fin)} ce jour-là."
        )
    if enseignant is not None:
        autre = base.filter(enseignant=enseignant).first()
        if autre:
            raise ValidationError(
                f"{_nom(enseignant)} est déjà occupé(e) en {autre.classe.nom} "
                f"de {_hhmm(autre.debut)} à {_hhmm(autre.fin)} ce jour-là."
            )
    if salle:
        autre = base.filter(salle__iexact=salle).first()
        if autre:
            raise ValidationError(
                f"La salle « {salle} » est déjà utilisée par {autre.classe.nom} "
                f"de {_hhmm(autre.debut)} à {_hhmm(autre.fin)}."
            )


class CreneauSerializer(serializers.ModelSerializer):
    classe_nom = serializers.CharField(source="classe.nom", read_only=True)
    matiere_nom = serializers.SerializerMethodField()
    enseignant_nom = serializers.SerializerMethodField()
    modifiable = serializers.SerializerMethodField()
    mien = serializers.SerializerMethodField()

    class Meta:
        model = CreneauEmploi
        fields = [
            "id", "classe", "classe_nom", "jour", "debut", "fin",
            "matiere", "matiere_nom", "libelle", "enseignant", "enseignant_nom",
            "salle", "modifiable", "mien",
        ]

    def get_matiere_nom(self, obj):
        return obj.matiere.nom if obj.matiere_id else None

    def get_enseignant_nom(self, obj):
        return _nom(obj.enseignant) if obj.enseignant_id else None

    def get_modifiable(self, obj):
        user = self.context["request"].user
        if user.role in ROLES_GESTION:
            return True
        return est_enseignant(user) and obj.cree_par_id == user.id

    def get_mien(self, obj):
        return obj.enseignant_id == self.context["request"].user.id

    def validate(self, attrs):
        user = self.context["request"].user
        inst = self.instance

        def val(cle):
            if cle in attrs:
                return attrs[cle]
            return getattr(inst, cle, None) if inst is not None else None

        classe, jour, debut, fin = val("classe"), val("jour"), val("debut"), val("fin")
        matiere, enseignant = val("matiere"), val("enseignant")
        libelle = (val("libelle") or "").strip()
        salle = (val("salle") or "").strip()

        if classe is None or classe.ecole_id != user.ecole_id:
            raise ValidationError("Classe inconnue.")
        if matiere is not None and matiere.ecole_id != user.ecole_id:
            raise ValidationError("Matière inconnue.")
        if fin <= debut:
            raise ValidationError("L'heure de fin doit être après l'heure de début.")
        if matiere is None and not libelle:
            raise ValidationError("Choisissez une matière ou saisissez un libellé (ex. Récréation).")

        if est_enseignant(user):
            # Un enseignant ne planifie que ce qui lui est affecté, et uniquement pour lui-même.
            if matiere is None or not Affectation.objects.filter(
                enseignant=user, classe=classe, matiere=matiere
            ).exists():
                raise ValidationError("Vous ne pouvez planifier que les matières et classes qui vous sont affectées.")
            enseignant = user
        elif enseignant is not None:
            if enseignant.ecole_id != user.ecole_id or enseignant.role != "enseignant":
                raise ValidationError("Enseignant inconnu.")

        verifier_conflits(
            user.ecole_id, classe, jour, debut, fin, enseignant, salle,
            exclure_pk=inst.pk if inst is not None else None,
        )
        attrs.update(libelle=libelle, salle=salle, enseignant=enseignant)
        return attrs


class CreneauViewSet(viewsets.ModelViewSet):
    serializer_class = CreneauSerializer
    permission_classes = [IsAuthenticated, IsSubscriptionActive]
    pagination_class = None

    def get_queryset(self):
        user = self.request.user
        if not user.ecole_id:
            return CreneauEmploi.objects.none()
        qs = CreneauEmploi.objects.filter(ecole_id=user.ecole_id).select_related(
            "classe", "matiere", "enseignant"
        )
        if est_enseignant(user):
            # Ses classes (lecture) + ses propres créneaux.
            qs = qs.filter(Q(classe_id__in=list(ids_classes(user))) | Q(enseignant=user))
        p = self.request.query_params
        if str(p.get("classe", "")).isdigit():
            qs = qs.filter(classe_id=p["classe"])
        if str(p.get("enseignant", "")).isdigit():
            qs = qs.filter(enseignant_id=p["enseignant"])
        if p.get("mon") == "1":
            qs = qs.filter(enseignant=user)
        return qs

    def _verifier_ecriture(self, obj=None):
        user = self.request.user
        if user.role in ROLES_GESTION:
            return
        if est_enseignant(user):
            if obj is not None and obj.cree_par_id != user.id:
                raise PermissionDenied("Vous ne pouvez modifier que les créneaux que vous avez créés.")
            return
        raise PermissionDenied("Vous n'avez pas le droit de modifier les emplois du temps.")

    def perform_create(self, serializer):
        self._verifier_ecriture()
        serializer.save(ecole=self.request.user.ecole, cree_par=self.request.user)

    def perform_update(self, serializer):
        self._verifier_ecriture(serializer.instance)
        serializer.save()

    def perform_destroy(self, instance):
        self._verifier_ecriture(instance)
        instance.delete()

    @action(detail=False, methods=["post"])
    def dupliquer(self, request):
        """Copie l'emploi d'une classe vers une autre (sans enseignant ni salle, qui entreraient en conflit)."""
        if request.user.role not in ROLES_GESTION:
            raise PermissionDenied("Seule la direction peut dupliquer un emploi du temps.")
        ecole_id = request.user.ecole_id
        source = Classe.objects.filter(pk=request.data.get("source"), ecole_id=ecole_id).first()
        cible = Classe.objects.filter(pk=request.data.get("cible"), ecole_id=ecole_id).first()
        if not source or not cible or source.pk == cible.pk:
            raise ValidationError("Choisissez deux classes différentes.")

        ecraser = str(request.data.get("ecraser")).lower() in ("true", "1")
        existants = CreneauEmploi.objects.filter(ecole_id=ecole_id, classe=cible)
        if existants.exists() and not ecraser:
            raise ValidationError(f"{cible.nom} a déjà un emploi du temps : cochez « Remplacer » pour l'écraser.")

        with transaction.atomic():
            existants.delete()
            nouveaux = [
                CreneauEmploi(
                    ecole_id=ecole_id, classe=cible, jour=c.jour, debut=c.debut, fin=c.fin,
                    matiere=c.matiere, libelle=c.libelle, cree_par=request.user,
                )
                for c in CreneauEmploi.objects.filter(ecole_id=ecole_id, classe=source)
            ]
            CreneauEmploi.objects.bulk_create(nouveaux)
        return Response({"copies": len(nouveaux)})
import re

from rest_framework import serializers
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from tenants.models import School
# Même import que celui utilisé dans vie_scolaire/views.py pour ces deux permissions.
from tenants.permissions import IsSubscriptionActive, IsDirecteur


class MonEcoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = School
        fields = ["nom", "telephone", "email_contact", "prefixe_matricule"]
        # Le nom et le préfixe sont gérés par Sylium (ils conditionnent les matricules).
        read_only_fields = ["nom", "prefixe_matricule"]

    def validate_telephone(self, valeur):
        valeur = (valeur or "").strip()
        if valeur and not re.fullmatch(r"[0-9+()\-\s.]{6,20}", valeur):
            raise serializers.ValidationError("Numéro de téléphone invalide.")
        return valeur


@api_view(["GET", "PATCH"])
@permission_classes([IsSubscriptionActive, IsDirecteur])
def mon_ecole(request):
    """Fiche de l'école du directeur connecté : uniquement la sienne, jamais une autre."""
    ecole = getattr(request.user, "ecole", None)
    if ecole is None:
        return Response({"detail": "Aucune école associée à ce compte."}, status=404)

    if request.method == "GET":
        return Response(MonEcoleSerializer(ecole).data)

    serializer = MonEcoleSerializer(ecole, data=request.data, partial=True)
    serializer.is_valid(raise_exception=True)
    serializer.save()
    return Response(serializer.data)
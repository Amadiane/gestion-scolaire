from rest_framework import serializers


class MemeEcoleMixin:
    """Refuse toute référence (classe, élève, matière...) appartenant à une
    autre école que celle de l'utilisateur. À placer en premier parent."""

    def validate(self, attrs):
        user = self.context["request"].user
        if not user.is_superuser:
            for nom, valeur in attrs.items():
                objets = valeur if isinstance(valeur, (list, tuple)) else [valeur]
                for obj in objets:
                    ecole_id = getattr(obj, "ecole_id", None)
                    if ecole_id is not None and ecole_id != user.ecole_id:
                        raise serializers.ValidationError({nom: "Référence invalide."})
        return super().validate(attrs)
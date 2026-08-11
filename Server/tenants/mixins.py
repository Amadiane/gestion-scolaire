class TenantScopedQuerysetMixin:
    """
    À utiliser dans TOUS les futurs ViewSet DRF exposant un modèle qui a
    un champ `ecole` (Eleve, Parent, Note, Paiement...).

    Sans ce mixin, un ViewSet DRF standard renvoie TOUTES les lignes de
    la table à n'importe quel utilisateur authentifié, peu importe son
    école — c'est le piège à éviter.
    """
    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user
        if user.is_superuser:
            return queryset  # vous, chez Sylium, voyez tout
        return queryset.filter(ecole=user.ecole)
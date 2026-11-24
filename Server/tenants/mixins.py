class TenantScopedQuerysetMixin:
    """
    À utiliser dans TOUS les ViewSet DRF exposant un modèle qui a un champ `ecole`
    (Eleve, Parent, Note, Paiement...).

    Sans ce mixin, un ViewSet DRF standard renvoie TOUTES les lignes de la table à
    n'importe quel utilisateur authentifié, peu importe son école : c'est le piège à éviter.

    Règles :
    - superutilisateur Sylium : voit tout ;
    - utilisateur sans école : ne voit RIEN (jamais les lignes dont `ecole` est vide) ;
    - utilisateur d'une école : ne voit que les lignes de son école ;
    - enseignant : en plus, le ViewSet peut restreindre via `queryset_enseignant(qs, user)`.
    """

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user
        if user.is_superuser:
            return queryset  # vous, chez Sylium, voyez tout

        ecole = getattr(user, "ecole", None)
        if ecole is None:
            # filter(ecole=None) renverrait les lignes orphelines : on refuse plutôt.
            return queryset.none()

        queryset = queryset.filter(ecole=ecole)

        if getattr(user, "role", None) == "enseignant" and hasattr(self, "queryset_enseignant"):
            queryset = self.queryset_enseignant(queryset, user)
        return queryset
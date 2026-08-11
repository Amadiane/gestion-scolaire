from django.shortcuts import render

CHEMINS_EXEMPTES = (
    "/admin/",
    "/static/",
    "/media/",
    "/abonnement-expire/",
    "/connexion/",
    "/deconnexion/",
)


class SubscriptionMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if self._chemin_exempte(request.path):
            return self.get_response(request)

        ecole = self._resoudre_ecole(request)

        if ecole is not None and not ecole.acces_autorise:
            return self._page_bloquee(request, ecole)

        return self.get_response(request)

    @staticmethod
    def _chemin_exempte(path: str) -> bool:
        return any(path.startswith(p) for p in CHEMINS_EXEMPTES)

    @staticmethod
    def _resoudre_ecole(request):
        user = getattr(request, "user", None)
        if user is None or not user.is_authenticated:
            return None
        if user.is_superuser:
            return None
        return getattr(user, "ecole", None)

    @staticmethod
    def _page_bloquee(request, ecole):
        abonnement = getattr(ecole, "abonnement", None)
        raison = SubscriptionMiddleware._raison_blocage(ecole, abonnement)

        if request.path.startswith("/api/"):
            return JsonResponse(
                {"erreur": "acces_bloque", "raison": raison},
                status=403,
            )

        contexte = {"ecole": ecole, "abonnement": abonnement, "raison": raison}
        return render(request, "tenants/abonnement_expire.html", contexte, status=403)
    @staticmethod
    def _raison_blocage(ecole, abonnement) -> str:
        if not ecole.est_actif:
            return "compte_desactive"
        if abonnement is None:
            return "aucun_abonnement"
        if abonnement.statut == abonnement.Statut.SUSPENDU:
            return "suspendu"
        return "expire"
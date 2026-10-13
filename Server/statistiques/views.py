from django.db.models import Count, Q, Sum
from django.utils import timezone
from rest_framework.decorators import api_view
from rest_framework.response import Response

from academique.models import AnneeScolaire, Bulletin, Classe, Note
from eleves.models import Eleve, Parent
from finance.models import Paiement
from finance.permissions import ROLES_FINANCE
from finance.services import calculer_situations


@api_view(["GET"])
def dashboard(request):
    user = request.user
    ecole = user.ecole
    if ecole is None:
        return Response({"detail": "Aucune école associée à ce compte."}, status=400)

    annee = AnneeScolaire.objects.filter(ecole=ecole, est_active=True).first()

    eleves = Eleve.objects.filter(ecole=ecole, statut="actif")
    sexes = {r["sexe"]: r["n"] for r in eleves.values("sexe").annotate(n=Count("id"))}

    classes = []
    notes_count = 0
    if annee:
        classes_qs = (
            Classe.objects.filter(ecole=ecole, annee_scolaire=annee)
            .select_related("niveau")
            .annotate(effectif=Count("inscriptions", filter=Q(inscriptions__annee_scolaire=annee)))
            .order_by("niveau__ordre", "nom")
        )
        classes = [
            {"id": c.id, "nom": c.nom, "effectif": c.effectif, "effectif_max": c.effectif_max}
            for c in classes_qs
        ]
        notes_count = Note.objects.filter(ecole=ecole, annee_scolaire=annee).count()

    derniers = (
        Bulletin.objects.filter(ecole=ecole)
        .select_related("eleve", "classe__niveau")
        .order_by("-date_generation")[:6]
    )

    # Les chiffres financiers ne sont calculés que pour les rôles autorisés.
    finance = None
    if annee and (user.is_superuser or getattr(user, "role", None) in ROLES_FINANCE):
        debut_mois = timezone.localdate().replace(day=1)
        encaisse = (
            Paiement.objects.filter(
                ecole=ecole, annee_scolaire=annee, date_paiement__gte=debut_mois
            ).aggregate(t=Sum("montant"))["t"]
            or 0
        )
        finance = {
            "encaisse_mois": int(encaisse),
            "reste_a_recouvrer": sum(s["reste"] for s in calculer_situations(ecole, annee)),
        }

    return Response({
        "annee_active": annee.nom if annee else None,
        "total_eleves": eleves.count(),
        "total_classes": len(classes),
        "total_parents": Parent.objects.filter(ecole=ecole).count(),
        "total_notes": notes_count,
        "garcons": sexes.get("M", 0),
        "filles": sexes.get("F", 0),
        "classes": classes,
        "finance": finance,
        "derniers_bulletins": [
            {
                "id": b.id,
                "eleve_id": b.eleve_id,
                "eleve_nom": f"{b.eleve.prenom} {b.eleve.nom}",
                "classe_nom": b.classe.nom,
                "trimestre": b.trimestre,
                "moyenne": b.moyenne_generale,
                "bareme": b.classe.niveau.bareme_note,
                "rang": b.rang,
                "statut": b.statut,
            }
            for b in derniers
        ],
    })
from datetime import date as _date, timedelta

from django.db import IntegrityError, transaction
from django.db.models import Count
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import BasePermission
from rest_framework.response import Response

from academique.models import AnneeScolaire, Classe
from academique.scoping import est_enseignant, ids_classes
from eleves.models import Eleve, Inscription
from tenants.permissions import IsDirecteur, IsSubscriptionActive

from django.db.models import Count, F

from .models import MembrePersonnel, PresenceEleve, PresencePersonnel, StatutPresence

ROLES_APPEL = {"directeur", "secretaire", "surveillant", "enseignant"}
LIBELLES = dict(StatutPresence.choices)


class PeutFaireAppel(BasePermission):
    """Direction, secrétariat, surveillance et enseignants. Pas le comptable."""

    def has_permission(self, request, view):
        u = request.user
        return bool(
            u and u.is_authenticated and getattr(u, "ecole_id", None)
            and getattr(u, "role", None) in ROLES_APPEL
        )


class ErreurOperation(Exception):
    pass


def _lire_date(valeur):
    try:
        jour = _date.fromisoformat(str(valeur))
    except ValueError:
        raise ErreurOperation("Date invalide.")
    # Un jour de marge : l'horloge d'un téléphone peut avoir un peu d'avance.
    if jour > timezone.localdate() + timedelta(days=1):
        raise ErreurOperation("Impossible de faire l'appel pour une date future.")
    return jour


def _lire_statut(valeur):
    if valeur not in LIBELLES:
        raise ErreurOperation("Statut de présence invalide.")
    return valeur


def _lire_remarque(op):
    return str(op.get("remarque") or "").strip()[:200]


def _classe_pour(user, classe_id):
    """Classe de l'école de l'utilisateur ; un enseignant n'accède qu'à ses classes."""
    try:
        classe = Classe.objects.select_related("annee_scolaire").get(pk=classe_id, ecole_id=user.ecole_id)
    except (Classe.DoesNotExist, ValueError, TypeError):
        raise ErreurOperation("Classe introuvable.")
    if est_enseignant(user) and not Classe.objects.filter(
        pk=classe.pk, id__in=ids_classes(user)
    ).exists():
        raise ErreurOperation("Cette classe ne vous est pas affectée.")
    return classe


def _synchroniser(request, traiter):
    """Boucle commune : chaque opération est isolée, rejouable, et ne fait jamais échouer les autres."""
    operations = request.data.get("operations")
    if not isinstance(operations, list) or len(operations) > 500:
        return Response({"detail": "Liste 'operations' requise (500 maximum)."}, status=400)

    resultats = []
    for op in operations:
        client_id = op.get("client_id") if isinstance(op, dict) else None
        try:
            if not isinstance(op, dict):
                raise ErreurOperation("Opération mal formée.")
            with transaction.atomic():
                resultat = traiter(request, op)
        except ErreurOperation as e:
            resultat = {"statut": "erreur", "detail": str(e)}
        except IntegrityError:
            resultat = {"statut": "erreur", "detail": "Conflit d'enregistrement, réessayez."}
        except (ValueError, TypeError, KeyError, AttributeError):
            resultat = {"statut": "erreur", "detail": "Opération mal formée."}
        resultat["client_id"] = client_id
        resultats.append(resultat)
    return Response({"resultats": resultats})


# ---------------------------------------------------------------- élèves

def _enregistrer_eleve(request, op):
    user = request.user
    jour = _lire_date(op.get("date"))
    statut = _lire_statut(op.get("statut"))
    remarque = _lire_remarque(op)
    classe = _classe_pour(user, op.get("classe"))
    annee = classe.annee_scolaire

    if not (annee.date_debut <= jour <= annee.date_fin):
        raise ErreurOperation("Cette date est hors de l'année scolaire de la classe.")

    eleve_id = op.get("eleve")
    if not Inscription.objects.filter(
        eleve_id=eleve_id, classe=classe, annee_scolaire=annee, eleve__ecole_id=user.ecole_id
    ).exists():
        raise ErreurOperation("Cet élève n'est pas inscrit dans cette classe.")

    existante = PresenceEleve.objects.select_for_update().filter(eleve_id=eleve_id, date=jour).first()
    if existante is None:
        p = PresenceEleve.objects.create(
            ecole_id=user.ecole_id, eleve_id=eleve_id, classe=classe, annee_scolaire=annee,
            date=jour, statut=statut, remarque=remarque, enregistre_par=user,
        )
        return {"statut": "cree", "id": p.id}

    if existante.statut == statut and existante.remarque == remarque and existante.classe_id == classe.id:
        return {"statut": "identique", "id": existante.id}

    existante.statut = statut
    existante.remarque = remarque
    existante.classe = classe
    existante.annee_scolaire = annee
    existante.enregistre_par = user
    existante.save()
    return {"statut": "mis_a_jour", "id": existante.id}


@api_view(["GET"])
@permission_classes([IsSubscriptionActive, PeutFaireAppel])
def presences_du_jour(request):
    """Appel déjà enregistré pour une classe et un jour."""
    try:
        jour = _lire_date(request.query_params.get("date"))
        classe = _classe_pour(request.user, request.query_params.get("classe"))
    except ErreurOperation as e:
        return Response({"detail": str(e)}, status=400)
    lignes = PresenceEleve.objects.filter(classe=classe, date=jour).values("eleve", "statut", "remarque")
    return Response(list(lignes))


@api_view(["POST"])
@permission_classes([IsSubscriptionActive, PeutFaireAppel])
def synchroniser_presences(request):
    return _synchroniser(request, _enregistrer_eleve)


@api_view(["GET"])
@permission_classes([IsSubscriptionActive, PeutFaireAppel])
def assiduite_eleve(request, eleve_id):
    """Résumé d'assiduité d'un élève pour l'année active. ?tout=1 : historique complet."""
    user = request.user
    eleve = Eleve.objects.filter(pk=eleve_id, ecole_id=user.ecole_id).first()
    if eleve is None:
        return Response({"detail": "Élève introuvable."}, status=404)
    if est_enseignant(user) and not Inscription.objects.filter(
        eleve=eleve, classe_id__in=ids_classes(user)
    ).exists():
        return Response({"detail": "Cet élève n'est pas dans vos classes."}, status=403)

    identite = {
        "nom": eleve.nom, "prenom": eleve.prenom, "matricule": eleve.matricule,
        "ecole": user.ecole.nom if user.ecole else "",
    }
    annee = AnneeScolaire.objects.filter(ecole_id=user.ecole_id, est_active=True).first()
    vide = {s: 0 for s in LIBELLES}
    if annee is None:
        return Response({
            "annee": None, "eleve": identite, "jours": 0, "taux": None, "comptes": vide, "recentes": [],
        })

    qs = PresenceEleve.objects.filter(eleve=eleve, annee_scolaire=annee)
    comptes = {**vide, **{r["statut"]: r["n"] for r in qs.values("statut").annotate(n=Count("id"))}}
    jours = sum(comptes.values())
    taux = round(100 * (comptes["present"] + comptes["retard"]) / jours) if jours else None

    lignes = qs.select_related("classe").order_by("-date")
    if request.query_params.get("tout") != "1":
        lignes = lignes[:15]
    recentes = [
        {
            "date": p.date, "statut": p.statut, "libelle": LIBELLES[p.statut],
            "remarque": p.remarque, "classe": p.classe.nom,
        }
        for p in lignes
    ]
    return Response({
        "annee": annee.nom, "eleve": identite, "jours": jours, "taux": taux,
        "comptes": comptes, "recentes": recentes,
    })


# ------------------------------------------------------------- personnel

def _enregistrer_membre(request, op):
    user = request.user
    jour = _lire_date(op.get("date"))
    statut = _lire_statut(op.get("statut"))
    remarque = _lire_remarque(op)
    membre = MembrePersonnel.objects.filter(pk=op.get("membre"), ecole_id=user.ecole_id).first()
    if membre is None:
        raise ErreurOperation("Membre du personnel introuvable.")

    existante = PresencePersonnel.objects.select_for_update().filter(membre=membre, date=jour).first()
    if existante is None:
        p = PresencePersonnel.objects.create(
            ecole_id=user.ecole_id, membre=membre, date=jour,
            statut=statut, remarque=remarque, enregistre_par=user,
        )
        return {"statut": "cree", "id": p.id}
    if existante.statut == statut and existante.remarque == remarque:
        return {"statut": "identique", "id": existante.id}
    existante.statut = statut
    existante.remarque = remarque
    existante.enregistre_par = user
    existante.save()
    return {"statut": "mis_a_jour", "id": existante.id}


@api_view(["GET"])
@permission_classes([IsSubscriptionActive, IsDirecteur])
def presences_personnel_du_jour(request):
    try:
        jour = _lire_date(request.query_params.get("date"))
    except ErreurOperation as e:
        return Response({"detail": str(e)}, status=400)
    lignes = PresencePersonnel.objects.filter(
        ecole_id=request.user.ecole_id, date=jour
    ).values("membre", "statut", "remarque")
    return Response(list(lignes))


@api_view(["POST"])
@permission_classes([IsSubscriptionActive, IsDirecteur])
def synchroniser_presences_personnel(request):
    return _synchroniser(request, _enregistrer_membre)



# ---------------------------------------------------------------- rapports

def _periode(request):
    aujourdhui = timezone.localdate()
    try:
        du = _date.fromisoformat(request.query_params.get("du") or str(aujourdhui))
        au = _date.fromisoformat(request.query_params.get("au") or str(du))
    except ValueError:
        raise ErreurOperation("Période invalide.")
    if au < du:
        raise ErreurOperation("La date de fin précède la date de début.")
    if (au - du).days > 366:
        raise ErreurOperation("Période trop longue (366 jours maximum).")
    return du, au


def _taux(comptes):
    total = sum(comptes.values())
    return round(100 * (comptes["present"] + comptes["retard"]) / total) if total else None


def _rapport_classes(user, du, au):
    classes = (
        Classe.objects.filter(ecole_id=user.ecole_id, annee_scolaire__est_active=True)
        .select_related("niveau").order_by("niveau__ordre", "nom")
    )
    if est_enseignant(user):
        classes = classes.filter(id__in=ids_classes(user))
    classes = list(classes)
    ids = [c.id for c in classes]

    lignes = PresenceEleve.objects.filter(classe_id__in=ids, date__range=(du, au))
    comptes = {i: {s: 0 for s in LIBELLES} for i in ids}
    for r in lignes.values("classe_id", "statut").annotate(n=Count("id")):
        comptes[r["classe_id"]][r["statut"]] = r["n"]
    jours = dict(lignes.values_list("classe_id").annotate(j=Count("date", distinct=True)))
    effectifs = dict(
        Inscription.objects.filter(classe_id__in=ids, annee_scolaire_id=F("classe__annee_scolaire_id"))
        .values_list("classe_id").annotate(n=Count("id"))
    )
    return [
        {
            "id": c.id, "nom": c.nom, "niveau": c.niveau.nom,
            "effectif": effectifs.get(c.id, 0), "jours_appel": jours.get(c.id, 0),
            "comptes": comptes[c.id], "taux": _taux(comptes[c.id]),
        }
        for c in classes
    ]


def _rapport_classe(classe, du, au):
    inscrits = list(
        Eleve.objects.filter(
            inscriptions__classe=classe, inscriptions__annee_scolaire=classe.annee_scolaire
        ).order_by("nom", "prenom").values("id", "nom", "prenom", "matricule")
    )
    lignes = PresenceEleve.objects.filter(classe=classe, date__range=(du, au))
    dates = sorted(set(lignes.values_list("date", flat=True)))
    jours_appel = len(dates)

    comptes = {e["id"]: {s: 0 for s in LIBELLES} for e in inscrits}
    for r in lignes.values("eleve_id", "statut").annotate(n=Count("id")):
        if r["eleve_id"] in comptes:
            comptes[r["eleve_id"]][r["statut"]] = r["n"]

    # Cahier d'appel : seulement sur une période courte (lisible à l'écran et à l'impression).
    cases = None
    if (au - du).days <= 30:
        cases = {}
        for eleve_id, jour, statut in lignes.values_list("eleve_id", "date", "statut"):
            cases.setdefault(eleve_id, {})[jour.isoformat()] = statut

    total = {s: 0 for s in LIBELLES}
    eleves = []
    for e in inscrits:
        c = comptes[e["id"]]
        for s, n in c.items():
            total[s] += n
        eleves.append({
            **e, "comptes": c, "taux": _taux(c),
            "non_renseigne": max(jours_appel - sum(c.values()), 0),
        })
    return {
        "jours_appel": jours_appel,
        "dates": [d.isoformat() for d in dates],
        "comptes": total, "taux": _taux(total),
        "eleves": eleves, "cases": cases,
    }


@api_view(["GET"])
@permission_classes([IsSubscriptionActive, PeutFaireAppel])
def rapport_presences(request):
    """Bilan sur une période : toutes les classes, ou le détail d'une classe (?classe=)."""
    user = request.user
    try:
        du, au = _periode(request)
        classe_id = request.query_params.get("classe")
        classe = _classe_pour(user, classe_id) if classe_id else None
    except ErreurOperation as e:
        return Response({"detail": str(e)}, status=400)

    base = {"du": du, "au": au}
    if classe is None:
        return Response({**base, "classes": _rapport_classes(user, du, au)})
    return Response({**base, "classe": {"id": classe.id, "nom": classe.nom}, **_rapport_classe(classe, du, au)})
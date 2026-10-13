import random
from datetime import date, timedelta
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction

from tenants.models import School, PlanAbonnement, Abonnement
from accounts.models import Utilisateur
from academique.models import AnneeScolaire, Niveau, Matiere, Classe, Note, Bulletin
from eleves.models import Parent, Eleve, RelationParentEleve, Inscription

PRENOMS_M = ["Mamadou", "Ibrahima", "Sekou", "Alpha", "Mohamed", "Boubacar", "Ousmane", "Thierno", "Moussa", "Abdoulaye"]
PRENOMS_F = ["Aminata", "Fatoumata", "Kadiatou", "Mariama", "Hawa", "Aissatou", "Nene", "Safiatou", "Djenab", "Rokia"]
NOMS = ["Diallo", "Camara", "Bah", "Sylla", "Soumah", "Barry", "Conde", "Keita", "Toure", "Sow", "Traore", "Kaba"]


class Command(BaseCommand):
    help = "Crée une école de démonstration avec des données fictives (idempotent)."

    @transaction.atomic
    def handle(self, *args, **options):
        rnd = random.Random(42)  # résultats identiques à chaque exécution
        today = date.today()

        ecole, _ = School.objects.get_or_create(
            slug="ecole-demo",
            defaults={
                "nom": "École Démo",
                "email_contact": "demo@sylium.example",
                "effectif_declare": 30,
                "prefixe_matricule": "DEM",
            },
        )

        plan, _ = PlanAbonnement.objects.get_or_create(
            nom="Démo", defaults={"prix_mensuel": 0, "prix_annuel": 0}
        )
        Abonnement.objects.get_or_create(
            ecole=ecole,
            defaults={
                "plan": plan,
                "date_debut": today,
                "date_fin": today + timedelta(days=365),
                "statut": "actif",
            },
        )

        # --- Comptes de démonstration ---
        comptes = [
            ("demo_directeur", "Awa", "Diallo", "directeur"),
            ("demo_enseignant", "Fatma", "Camara", "enseignant"),
        ]
        for username, prenom, nom, role in comptes:
            if not Utilisateur.objects.filter(username=username).exists():
                Utilisateur.objects.create_user(
                    username=username, password="Demo@2026",
                    first_name=prenom, last_name=nom, role=role, ecole=ecole,
                )
        enseignant = Utilisateur.objects.get(username="demo_enseignant")

        # --- Année, niveaux, matières ---
        annee, _ = AnneeScolaire.objects.get_or_create(
            ecole=ecole, nom="2026-2027",
            defaults={
                "date_debut": date(2026, 10, 1),
                "date_fin": date(2027, 7, 15),
                "est_active": True,
            },
        )

        niveaux = {}
        for nom, ordre, cycle, bareme in [
            ("2ème année", 2, "primaire", 10),
            ("7ème année", 7, "college", 20),
            ("10ème année", 10, "lycee", 20),
        ]:
            niveaux[nom], _ = Niveau.objects.get_or_create(
                ecole=ecole, nom=nom,
                defaults={"ordre": ordre, "cycle": cycle, "bareme_note": bareme},
            )

        matieres = []
        for nom, coef in [("Mathématiques", 3), ("Français", 3), ("Sciences", 2), ("Histoire-Géo", 2), ("Anglais", 1)]:
            m, _ = Matiere.objects.get_or_create(ecole=ecole, nom=nom, defaults={"coefficient": coef})
            matieres.append(m)

        classes = []
        for nom_classe, nom_niveau in [("2ème A", "2ème année"), ("7ème A", "7ème année"), ("10ème A", "10ème année")]:
            c, _ = Classe.objects.get_or_create(
                ecole=ecole, annee_scolaire=annee, nom=nom_classe,
                defaults={"niveau": niveaux[nom_niveau], "effectif_max": 40},
            )
            c.matieres.set(matieres)
            classes.append(c)

        # --- Élèves, parents, inscriptions, notes, bulletins ---
        if Eleve.objects.filter(ecole=ecole).exists():
            self.stdout.write(self.style.WARNING("Élèves déjà présents : rien de plus à créer."))
        else:
            annees_naissance = {"2ème A": 2018, "7ème A": 2013, "10ème A": 2010}
            for classe in classes:
                bareme = classe.niveau.bareme_note
                for _ in range(10):
                    sexe = rnd.choice(["M", "F"])
                    prenom = rnd.choice(PRENOMS_M if sexe == "M" else PRENOMS_F)
                    nom = rnd.choice(NOMS)
                    naissance = date(annees_naissance[classe.nom], rnd.randint(1, 12), rnd.randint(1, 28))

                    eleve = Eleve.objects.create(
                        ecole=ecole, nom=nom.upper(), prenom=prenom,
                        date_naissance=naissance, sexe=sexe, lieu_naissance="Conakry",
                    )
                    parent = Parent.objects.create(
                        ecole=ecole, nom=nom,
                        prenom=rnd.choice(PRENOMS_M if rnd.random() < 0.5 else PRENOMS_F),
                        telephone=f"62{rnd.randint(1000000, 9999999)}",
                    )
                    RelationParentEleve.objects.create(
                        parent=parent, eleve=eleve, type_lien="pere", contact_principal=True
                    )
                    Inscription.objects.create(eleve=eleve, classe=classe, annee_scolaire=annee)

                    # for matiere in matieres:
                    #     # primaire : notes entre 4 et 9,5 ; autres : entre 6 et 18
                    #     valeur = round(rnd.uniform(4, 9.5) if bareme == 10 else rnd.uniform(6, 18), 2)
                    #     Note.objects.create(
                    #         ecole=ecole, eleve=eleve, matiere=matiere, classe=classe,
                    #         annee_scolaire=annee, trimestre="t1", valeur=valeur, saisi_par=enseignant,
                    #     )
                    for matiere in matieres:
                        # primaire : notes entre 4 et 9,5 ; autres : entre 6 et 18
                        bas, haut = (4, 9.5) if bareme == 10 else (6, 18)
                        valeur = Decimal(str(round(rnd.uniform(bas, haut), 2)))
                        Note.objects.create(
                            ecole=ecole, eleve=eleve, matiere=matiere, classe=classe,
                            annee_scolaire=annee, trimestre="t1", valeur=valeur, saisi_par=enseignant,
                        )

                    Bulletin.objects.get_or_create(
                        ecole=ecole, eleve=eleve, classe=classe,
                        annee_scolaire=annee, trimestre="t1",
                    )
                Bulletin.recalculer_classement(classe, annee, "t1")

        self.stdout.write(self.style.SUCCESS(
            "Démo prête. Comptes : demo_directeur / demo_enseignant, mot de passe : Demo@2026"
        ))
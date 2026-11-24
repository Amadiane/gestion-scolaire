"""
Tests de sécurité : isolation entre écoles et contrôle des rôles.
À placer dans  Server/tenants/tests/test_isolation.py  (créez le dossier avec un __init__.py vide)
puis lancer :   python manage.py test tenants

Si un test échoue à cause d'un champ obligatoire manquant à la création (École, Utilisateur...),
adaptez les fonctions `creer_*` ci-dessous : c'est le seul endroit à modifier.
"""
from datetime import date
from unittest.mock import PropertyMock, patch

from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from academique.models import AnneeScolaire, Classe, Niveau
from tenants.models import School

Utilisateur = get_user_model()


# Adresse de la liste des classes : à adapter si votre routeur utilise un autre préfixe.
CLASSES_URL = "/api/classes/"


def creer_ecole(nom):
    slug = nom.lower().replace(" ", "-").replace("é", "e")
    return School.objects.create(nom=nom, slug=slug, email_contact=f"{slug}@test.gn")


def creer_utilisateur(ecole, username, role):
    return Utilisateur.objects.create_user(username=username, password="MotDePasse#2026", ecole=ecole, role=role)


def creer_classe(ecole, nom):
    annee = AnneeScolaire.objects.create(
        ecole=ecole, nom="2026-2027", date_debut=date(2026, 10, 1), date_fin=date(2027, 7, 1), est_active=True
    )
    niveau = Niveau.objects.create(ecole=ecole, nom="7ème", ordre=7, cycle="college", bareme_note=20)
    return Classe.objects.create(ecole=ecole, annee_scolaire=annee, niveau=niveau, nom=nom, effectif_max=50)


class IsolationEntreEcolesTests(APITestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        # On force l'accès autorisé pour tester la logique de rôles et d'isolation uniquement.
        cls._patch = patch.object(School, "acces_autorise", new_callable=PropertyMock, return_value=True)
        cls._patch.start()

    @classmethod
    def tearDownClass(cls):
        cls._patch.stop()
        super().tearDownClass()

    def setUp(self):
        self.ecole_a = creer_ecole("École A")
        self.ecole_b = creer_ecole("École B")
        self.dir_a = creer_utilisateur(self.ecole_a, "dir_a", "directeur")
        self.dir_b = creer_utilisateur(self.ecole_b, "dir_b", "directeur")
        self.classe_a = creer_classe(self.ecole_a, "Classe de A")
        self.classe_b = creer_classe(self.ecole_b, "Classe de B")

    # ----- Lecture -----
    def test_liste_ne_montre_que_son_ecole(self):
        self.client.force_authenticate(self.dir_a)
        data = self.client.get(CLASSES_URL).data
        data = data["results"] if isinstance(data, dict) and "results" in data else data
        noms = [c["nom"] for c in data]
        self.assertIn("Classe de A", noms)
        self.assertNotIn("Classe de B", noms)

    def test_detail_autre_ecole_introuvable(self):
        self.client.force_authenticate(self.dir_a)
        self.assertEqual(self.client.get(f"{CLASSES_URL}{self.classe_b.id}/").status_code, 404)

    # ----- Écriture -----
    def test_modification_autre_ecole_refusee(self):
        self.client.force_authenticate(self.dir_a)
        r = self.client.patch(f"{CLASSES_URL}{self.classe_b.id}/", {"nom": "Piratée"}, format="json")
        self.assertEqual(r.status_code, 404)
        self.classe_b.refresh_from_db()
        self.assertEqual(self.classe_b.nom, "Classe de B")

    def test_suppression_autre_ecole_refusee(self):
        self.client.force_authenticate(self.dir_a)
        self.assertEqual(self.client.delete(f"{CLASSES_URL}{self.classe_b.id}/").status_code, 404)
        self.assertTrue(Classe.objects.filter(pk=self.classe_b.pk).exists())

    def test_creation_avec_references_autre_ecole_refusee(self):
        """Créer une classe de l'école A en pointant vers le niveau / l'année de l'école B."""
        self.client.force_authenticate(self.dir_a)
        r = self.client.post(
            CLASSES_URL,
            {"nom": "Intruse", "niveau": self.classe_b.niveau_id, "annee_scolaire": self.classe_b.annee_scolaire_id},
            format="json",
        )
        self.assertGreaterEqual(r.status_code, 400)
        self.assertFalse(Classe.objects.filter(nom="Intruse").exists())

    # ----- Accès -----
    def test_sans_authentification_refuse(self):
        self.assertIn(self.client.get(CLASSES_URL).status_code, (401, 403))

    def test_utilisateur_sans_ecole_ne_voit_rien(self):
        sans_ecole = Utilisateur.objects.create_user(username="orphelin", password="x", role="secretaire")
        self.client.force_authenticate(sans_ecole)
        r = self.client.get(CLASSES_URL)
        # Soit refusé (403), soit liste vide : jamais les classes d'une école.
        if r.status_code == 200:
            data = r.data["results"] if isinstance(r.data, dict) and "results" in r.data else r.data
            self.assertEqual(len(data), 0)
        else:
            self.assertEqual(r.status_code, 403)


class ControleDesRolesTests(APITestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls._patch = patch.object(School, "acces_autorise", new_callable=PropertyMock, return_value=True)
        cls._patch.start()

    @classmethod
    def tearDownClass(cls):
        cls._patch.stop()
        super().tearDownClass()

    def setUp(self):
        self.ecole = creer_ecole("École A")
        self.classe = creer_classe(self.ecole, "7ème A")

    def _client_role(self, role):
        user = creer_utilisateur(self.ecole, f"u_{role}", role)
        self.client.force_authenticate(user)

    def test_enseignant_ne_peut_pas_supprimer_une_classe(self):
        self._client_role("enseignant")
        self.assertIn(self.client.delete(f"{CLASSES_URL}{self.classe.id}/").status_code, (403, 404))
        self.assertTrue(Classe.objects.filter(pk=self.classe.pk).exists())

    def test_enseignant_ne_peut_pas_creer_une_classe(self):
        self._client_role("enseignant")
        r = self.client.post(
            CLASSES_URL,
            {"nom": "X", "niveau": self.classe.niveau_id, "annee_scolaire": self.classe.annee_scolaire_id},
            format="json",
        )
        self.assertEqual(r.status_code, 403)

    def test_surveillant_ne_peut_pas_supprimer_une_classe(self):
        self._client_role("surveillant")
        self.assertEqual(self.client.delete(f"{CLASSES_URL}{self.classe.id}/").status_code, 403)
        self.assertTrue(Classe.objects.filter(pk=self.classe.pk).exists())

    def test_comptable_ne_peut_pas_modifier_une_classe(self):
        self._client_role("comptable")
        r = self.client.patch(f"{CLASSES_URL}{self.classe.id}/", {"nom": "Changée"}, format="json")
        self.assertEqual(r.status_code, 403)

    def test_parent_n_a_pas_acces_a_l_api_du_personnel(self):
        self._client_role("parent")
        self.assertEqual(self.client.get(CLASSES_URL).status_code, 403)
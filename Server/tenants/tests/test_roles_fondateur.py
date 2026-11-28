"""
Tests des rôles Fondateur et Censeur.
À placer dans  Server/tenants/tests/test_roles_fondateur.py   puis :  python manage.py test tenants

Règles vérifiées :
- le fondateur n'a accès à AUCUNE route du personnel (il ne peut donc rien modifier) ;
- il ne voit que sa propre école, sur son tableau de bord dédié ;
- le censeur lit les classes mais ne les modifie pas et ne gère pas les comptes.
"""
from unittest.mock import PropertyMock, patch

from rest_framework.test import APITestCase

from tenants.models import School
from tenants.tests.test_isolation import CLASSES_URL, creer_classe, creer_ecole, creer_utilisateur

DASHBOARD_URL = "/api/statistiques/dashboard/"
FONDATEUR_URL = "/api/statistiques/fondateur/"
UTILISATEURS_URL = "/api/utilisateurs-gestion/"


class RolesFondateurCenseurTests(APITestCase):
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
        self.ecole_a = creer_ecole("École A")
        self.ecole_b = creer_ecole("École B")
        self.classe_a = creer_classe(self.ecole_a, "Classe de A")
        self.classe_b = creer_classe(self.ecole_b, "Classe de B")
        self.fondateur = creer_utilisateur(self.ecole_a, "fond_a", "fondateur")
        self.directeur = creer_utilisateur(self.ecole_a, "dir_a", "directeur")
        self.censeur = creer_utilisateur(self.ecole_a, "cens_a", "censeur")
        self.comptable = creer_utilisateur(self.ecole_a, "compt_a", "comptable")
        self.surveillant = creer_utilisateur(self.ecole_a, "surv_a", "surveillant")

    # ----- Fondateur : lecture seule, tableau de bord dédié -----
    def test_fondateur_refuse_sur_l_api_du_personnel(self):
        self.client.force_authenticate(self.fondateur)
        self.assertEqual(self.client.get(CLASSES_URL).status_code, 403)
        self.assertEqual(self.client.get(DASHBOARD_URL).status_code, 403)
        self.assertEqual(self.client.get(UTILISATEURS_URL).status_code, 403)

    def test_fondateur_ne_peut_rien_modifier(self):
        self.client.force_authenticate(self.fondateur)
        r = self.client.post(
            CLASSES_URL,
            {"nom": "X", "niveau": self.classe_a.niveau_id, "annee_scolaire": self.classe_a.annee_scolaire_id},
            format="json",
        )
        self.assertEqual(r.status_code, 403)
        self.assertEqual(self.client.patch(f"{CLASSES_URL}{self.classe_a.id}/", {"nom": "Piratée"}, format="json").status_code, 403)
        self.assertEqual(self.client.delete(f"{CLASSES_URL}{self.classe_a.id}/").status_code, 403)
        self.classe_a.refresh_from_db()
        self.assertEqual(self.classe_a.nom, "Classe de A")

    def test_fondateur_tableau_de_bord_en_lecture_seule(self):
        self.client.force_authenticate(self.fondateur)
        r = self.client.get(FONDATEUR_URL)
        self.assertEqual(r.status_code, 200)
        for cle in ("ecole", "total_eleves", "classes", "finance", "resultats"):
            self.assertIn(cle, r.data)
        self.assertEqual(self.client.post(FONDATEUR_URL, {}, format="json").status_code, 403)

    def test_fondateur_ne_voit_que_son_ecole(self):
        self.client.force_authenticate(self.fondateur)
        r = self.client.get(FONDATEUR_URL)
        noms = [c["nom"] for c in r.data["classes"]]
        self.assertIn("Classe de A", noms)
        self.assertNotIn("Classe de B", noms)
        self.assertEqual(r.data["ecole"], "École A")

    def test_directeur_peut_voir_le_tableau_du_fondateur(self):
        self.client.force_authenticate(self.directeur)
        self.assertEqual(self.client.get(FONDATEUR_URL).status_code, 200)

    def test_autres_roles_n_ont_pas_le_tableau_du_fondateur(self):
        for user in (self.censeur, self.comptable, self.surveillant):
            self.client.force_authenticate(user)
            self.assertEqual(self.client.get(FONDATEUR_URL).status_code, 403, user.role)

    # ----- Censeur : lit, ne modifie pas, ne gère pas les comptes -----
    def test_censeur_lit_les_classes_de_son_ecole(self):
        self.client.force_authenticate(self.censeur)
        r = self.client.get(CLASSES_URL)
        self.assertEqual(r.status_code, 200)
        data = r.data["results"] if isinstance(r.data, dict) and "results" in r.data else r.data
        noms = [c["nom"] for c in data]
        self.assertIn("Classe de A", noms)
        self.assertNotIn("Classe de B", noms)

    def test_censeur_ne_modifie_pas_les_classes(self):
        self.client.force_authenticate(self.censeur)
        self.assertEqual(self.client.patch(f"{CLASSES_URL}{self.classe_a.id}/", {"nom": "Changée"}, format="json").status_code, 403)
        self.assertEqual(self.client.delete(f"{CLASSES_URL}{self.classe_a.id}/").status_code, 403)

    def test_censeur_ne_gere_pas_les_comptes(self):
        self.client.force_authenticate(self.censeur)
        self.assertEqual(self.client.get(UTILISATEURS_URL).status_code, 403)
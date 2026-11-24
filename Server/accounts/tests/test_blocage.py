"""
Tests du blocage après échecs de connexion.
À placer dans  Server/accounts/tests/test_blocage.py  (avec un __init__.py vide dans ce dossier).
Si Server/accounts/tests.py existe, supprimez-le d'abord (un fichier et un dossier ne peuvent pas coexister).
Lancer :  python manage.py test accounts
"""
from datetime import timedelta
from unittest.mock import PropertyMock, patch

from django.core.cache import cache
from django.utils import timezone
from rest_framework.test import APITestCase
from rest_framework.throttling import ScopedRateThrottle

from accounts.models import EvenementSecurite, Utilisateur
from tenants.models import School

LOGIN_URL = "/api/token/"
GESTION_URL = "/api/utilisateurs-gestion/"
MDP = "MotDePasse#2026"


class BlocageConnexionTests(APITestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls._p1 = patch.object(School, "acces_autorise", new_callable=PropertyMock, return_value=True)
        # On neutralise la limite de débit de la vue de connexion : on teste ici le blocage par compte.
        cls._p2 = patch.dict(ScopedRateThrottle.THROTTLE_RATES, {"login": "10000/min"})
        cls._p1.start()
        cls._p2.start()

    @classmethod
    def tearDownClass(cls):
        cls._p2.stop()
        cls._p1.stop()
        super().tearDownClass()

    def setUp(self):
        cache.clear()
        self.ecole = School.objects.create(nom="École A", slug="ecole-a", email_contact="a@test.gn")
        self.autre_ecole = School.objects.create(nom="École B", slug="ecole-b", email_contact="b@test.gn")
        self.directeur = Utilisateur.objects.create_user("dir_a", password=MDP, ecole=self.ecole, role="directeur")
        self.directeur2 = Utilisateur.objects.create_user("dir_a2", password=MDP, ecole=self.ecole, role="directeur")
        self.employe = Utilisateur.objects.create_user("emp_a", password=MDP, ecole=self.ecole, role="secretaire")
        self.employe_b = Utilisateur.objects.create_user("emp_b", password=MDP, ecole=self.autre_ecole, role="secretaire")

    def connexion(self, username, mdp=MDP):
        return self.client.post(LOGIN_URL, {"username": username, "password": mdp}, format="json")

    def echec(self, username):
        return self.connexion(username, "mauvais")

    # ----- Blocage -----
    def test_cinq_echecs_bloquent_temporairement(self):
        for _ in range(4):
            self.assertEqual(self.echec("emp_a").status_code, 401)
        r = self.echec("emp_a")
        self.assertEqual(r.status_code, 403)
        self.assertEqual(r.data["erreur"], "compte_bloque")
        # Même avec le bon mot de passe, le compte reste fermé.
        r = self.connexion("emp_a")
        self.assertEqual(r.status_code, 403)
        self.assertEqual(r.data["erreur"], "compte_bloque")
        self.assertTrue(EvenementSecurite.objects.filter(utilisateur=self.employe, type="blocage_temporaire").exists())

    def test_connexion_reussie_remet_le_compteur_a_zero(self):
        for _ in range(3):
            self.echec("emp_a")
        self.assertEqual(self.connexion("emp_a").status_code, 200)
        self.employe.refresh_from_db()
        self.assertEqual(self.employe.echecs_connexion, 0)

    def test_blocage_temporaire_expire(self):
        Utilisateur.objects.filter(pk=self.employe.pk).update(
            echecs_connexion=5, bloque_jusqua=timezone.now() - timedelta(minutes=1)
        )
        self.assertEqual(self.connexion("emp_a").status_code, 200)

    def test_dix_echecs_bloquent_definitivement(self):
        Utilisateur.objects.filter(pk=self.employe.pk).update(echecs_connexion=9)
        r = self.echec("emp_a")
        self.assertEqual(r.status_code, 403)
        self.employe.refresh_from_db()
        self.assertTrue(self.employe.bloque_definitivement)
        self.assertTrue(EvenementSecurite.objects.filter(utilisateur=self.employe, type="blocage_definitif").exists())
        self.assertEqual(self.connexion("emp_a").status_code, 403)

    def test_superutilisateur_jamais_bloque_definitivement(self):
        Utilisateur.objects.create_superuser("sylium", password=MDP)
        Utilisateur.objects.filter(username="sylium").update(echecs_connexion=9)
        self.echec("sylium")
        su = Utilisateur.objects.get(username="sylium")
        self.assertFalse(su.bloque_definitivement)
        self.assertIsNotNone(su.bloque_jusqua)

    def test_identifiant_inconnu_ne_plante_pas(self):
        self.assertEqual(self.echec("personne").status_code, 401)

    # ----- Déblocage -----
    def _bloquer(self, user):
        Utilisateur.objects.filter(pk=user.pk).update(bloque_definitivement=True, echecs_connexion=10)

    def test_directeur_debloque_son_personnel(self):
        self._bloquer(self.employe)
        self.client.force_authenticate(self.directeur)
        r = self.client.post(f"{GESTION_URL}{self.employe.id}/debloquer/")
        self.assertEqual(r.status_code, 200)
        self.client.force_authenticate(None)
        self.assertEqual(self.connexion("emp_a").status_code, 200)
        self.assertTrue(EvenementSecurite.objects.filter(
            utilisateur=self.employe, type="deblocage", auteur=self.directeur).exists())

    def test_directeur_ne_debloque_pas_un_autre_directeur(self):
        self._bloquer(self.directeur2)
        self.client.force_authenticate(self.directeur)
        r = self.client.post(f"{GESTION_URL}{self.directeur2.id}/debloquer/")
        self.assertEqual(r.status_code, 403)
        self.directeur2.refresh_from_db()
        self.assertTrue(self.directeur2.bloque_definitivement)

    def test_directeur_ne_debloque_pas_une_autre_ecole(self):
        self._bloquer(self.employe_b)
        self.client.force_authenticate(self.directeur)
        r = self.client.post(f"{GESTION_URL}{self.employe_b.id}/debloquer/")
        self.assertEqual(r.status_code, 404)
        self.employe_b.refresh_from_db()
        self.assertTrue(self.employe_b.bloque_definitivement)

    def test_sylium_debloque_un_directeur(self):
        self._bloquer(self.directeur)
        sylium = Utilisateur.objects.create_superuser("sylium", password=MDP)
        self.client.force_authenticate(sylium)
        r = self.client.post(f"{GESTION_URL}{self.directeur.id}/debloquer/")
        self.assertEqual(r.status_code, 200)
        self.directeur.refresh_from_db()
        self.assertFalse(self.directeur.bloque_definitivement)

    def test_employe_ne_peut_pas_debloquer(self):
        self._bloquer(self.directeur2)
        self.client.force_authenticate(self.employe)
        r = self.client.post(f"{GESTION_URL}{self.directeur2.id}/debloquer/")
        self.assertEqual(r.status_code, 403)
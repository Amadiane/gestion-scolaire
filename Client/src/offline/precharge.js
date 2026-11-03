import api from '../services/api.js';
import CONFIG from '../config/config.js';

// Listes à mémoriser dès la connexion. Seules les clés qui existent dans config.js
// sont utilisées : ajoutez ou retirez des noms selon votre fichier.
const CLES = [
  'API_DASHBOARD', 'API_ELEVES', 'API_PARENTS', 'API_CLASSES', 'API_ANNEES_SCOLAIRES',
  'API_PARENTS_CHOIX', 'API_NIVEAUX', 'API_MATIERES', 'API_NOTES', 'API_BULLETINS',
  'API_AFFECTATIONS', 'API_MES_AFFECTATIONS', 'API_FRAIS', 'API_PAIEMENTS',
  'API_FINANCE_ARRIERES',
];

export async function prechargerDonnees() {
  if (!navigator.onLine) return;
  let affectations = [];

  for (const nom of CLES) {
    const url = CONFIG[nom];
    if (typeof url !== 'string') continue;
    try {
      const res = await api.get(url);
      if (nom === 'API_MES_AFFECTATIONS' && Array.isArray(res.data)) affectations = res.data;
    } catch {
      /* page non autorisée pour ce rôle ou erreur passagère : on continue */
    }
  }

  // Enseignant : la liste des élèves de chacune de ses classes, pour pouvoir saisir hors ligne.
  if (typeof CONFIG.API_CLASSE_ELEVES === 'function') {
    const ids = [...new Set(affectations.map((a) => a.classe_id))];
    for (const id of ids) {
      try {
        await api.get(CONFIG.API_CLASSE_ELEVES(id));
      } catch {
        /* on continue */
      }
    }
  }
}
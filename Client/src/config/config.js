const BASE_URL =
  window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? "http://127.0.0.1:8000"
    : "https://gestion-scolaire-5epe.onrender.com"; // à remplacer une fois déployé sur Render

const CONFIG = {
  BASE_URL,

  // --- Authentification ---
  API_LOGIN: `${BASE_URL}/api/token/`,
  API_REFRESH_TOKEN: `${BASE_URL}/api/token/refresh/`,
  API_UTILISATEUR_MOI: `${BASE_URL}/api/utilisateur/moi/`,

  // --- Académique ---
  API_ANNEES_SCOLAIRES: `${BASE_URL}/api/annees-scolaires/`,
  API_NIVEAUX: `${BASE_URL}/api/niveaux/`,
  API_MATIERES: `${BASE_URL}/api/matieres/`,
  API_CLASSES: `${BASE_URL}/api/classes/`,
  API_NOTES: `${BASE_URL}/api/notes/`,
  API_BULLETINS: `${BASE_URL}/api/bulletins/`,
  API_BULLETIN_VALIDER: (id) => `${BASE_URL}/api/bulletins/${id}/valider/`,
  API_BULLETIN_GENERER_PDF: (id) => `${BASE_URL}/api/bulletins/${id}/generer_pdf/`,
  API_BULLETIN_RECHERCHER: (terme) =>
    `${BASE_URL}/api/bulletins/rechercher/?q=${encodeURIComponent(terme)}`,

  // --- Élèves ---
  API_ELEVES: `${BASE_URL}/api/eleves/`,
  API_ELEVE_DETAIL: (id) => `${BASE_URL}/api/eleves/${id}/`,
  API_PARENTS: `${BASE_URL}/api/parents/`,
  API_INSCRIPTIONS: `${BASE_URL}/api/inscriptions/`,
  API_BULLETIN_TELECHARGER: (id) => `${BASE_URL}/api/bulletins/${id}/telecharger_pdf/`,
  API_CLASSE_ELEVES: (id) => `${BASE_URL}/api/classes/${id}/eleves/`,
  API_PARENTS_CHOIX: `${BASE_URL}/api/parents/`,
  API_ELEVE_LIER_PARENT: (id) => `${BASE_URL}/api/eleves/${id}/lier_parent/`,
  API_UTILISATEURS: `${BASE_URL}/api/utilisateurs-gestion/`,
  API_UTILISATEUR_DETAIL: (id) => `${BASE_URL}/api/utilisateurs-gestion/${id}/`,

  API_FRAIS: `${BASE_URL}/api/frais/`,
  API_PAIEMENTS: `${BASE_URL}/api/paiements/`,
  API_PAIEMENT_RECU: (id) => `${BASE_URL}/api/paiements/${id}/recu/`,
  API_FINANCE_SITUATION: (eleveId) => `${BASE_URL}/api/finance/situation/?eleve=${eleveId}`,
  API_FINANCE_ARRIERES: `${BASE_URL}/api/finance/arrieres/`,
  API_FINANCE_REMISE: `${BASE_URL}/api/finance/remise/`,

  API_DASHBOARD: `${BASE_URL}/api/statistiques/dashboard/`,

  CLOUDINARY_NAME: "kdcjs7fx",
};

export default CONFIG;
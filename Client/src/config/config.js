const BASE_URL =
  window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? "http://127.0.0.1:8000"
    : "https://gestionscolaire.onrender.com"; // à remplacer une fois déployé sur Render

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

  CLOUDINARY_NAME: "kdcjs7fx",
};

export default CONFIG;
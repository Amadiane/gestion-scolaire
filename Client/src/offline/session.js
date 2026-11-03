import { db } from './db.js';
import { ITERATIONS, deriver, chiffrer, dechiffrer, nouveauSel, versB64, depuisB64, egal } from './crypto.js';

// Au-delà de cette durée sans contact avec le serveur, une reconnexion internet est exigée.
export const DUREE_MAX_HORS_LIGNE_JOURS = 7;
const MAX_ECHECS = 5;
const VERROU_MINUTES = 5;

// Valeur placée dans `access` pendant une session hors ligne : le serveur la refuse (401),
// ce qui déclenche le rafraîchissement automatique du vrai jeton au retour du réseau.
export const JETON_HORS_LIGNE = 'hors_ligne';

export const horsLigneDisponible = () =>
  typeof indexedDB !== 'undefined' && !!(globalThis.crypto && globalThis.crypto.subtle);

export async function compteExiste(username) {
  if (!horsLigneDisponible()) return false;
  try {
    return !!(await db.comptes.get(username));
  } catch {
    return false;
  }
}

// Appelé après une connexion réussie avec internet.
export async function enregistrerCompte({ username, password, user, refresh }) {
  if (!horsLigneDisponible() || user?.is_superuser) return false;
  const sel = nouveauSel();
  const { cle, verifieur } = await deriver(password, sel, ITERATIONS);
  await db.comptes.put({
    username,
    sel: versB64(sel),
    iterations: ITERATIONS,
    verifieur,
    profil: await chiffrer(cle, { user, refresh }),
    derniereConnexionEnLigne: Date.now(),
    echecs: 0,
    verrouJusqua: 0,
  });
  return true;
}

export async function connexionHorsLigne(username, password) {
  if (!horsLigneDisponible()) return { ok: false, raison: 'indisponible' };
  const compte = await db.comptes.get(username);
  if (!compte) return { ok: false, raison: 'inconnu' };

  const maintenant = Date.now();
  if (compte.verrouJusqua > maintenant) {
    return { ok: false, raison: 'verrouille', minutes: Math.ceil((compte.verrouJusqua - maintenant) / 60000) };
  }
  if (maintenant > compte.derniereConnexionEnLigne + DUREE_MAX_HORS_LIGNE_JOURS * 86400000) {
    return { ok: false, raison: 'expire' };
  }

  const { cle, verifieur } = await deriver(password, depuisB64(compte.sel), compte.iterations);
  if (!egal(verifieur, compte.verifieur)) {
    const echecs = (compte.echecs || 0) + 1;
    await db.comptes.update(
      username,
      echecs >= MAX_ECHECS ? { echecs: 0, verrouJusqua: maintenant + VERROU_MINUTES * 60000 } : { echecs }
    );
    return { ok: false, raison: 'mot_de_passe' };
  }

  const { user, refresh } = await dechiffrer(cle, compte.profil);
  await db.comptes.update(username, { echecs: 0, verrouJusqua: 0 });
  return { ok: true, user, refresh };
}

// Renouvelle la fenêtre de 7 jours à chaque réponse réussie du serveur (au plus toutes les 5 min).
let dernierMarquage = 0;
export function marquerEnLigne() {
  const maintenant = Date.now();
  if (maintenant - dernierMarquage < 5 * 60 * 1000) return;
  dernierMarquage = maintenant;
  try {
    const username = localStorage.getItem('compte_local');
    if (username) db.comptes.update(username, { derniereConnexionEnLigne: maintenant }).catch(() => {});
  } catch {
    /* sans importance */
  }
}
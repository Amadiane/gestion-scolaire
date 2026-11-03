import { db } from './db.js';
import { chiffrer, dechiffrer } from './crypto.js';
import { lireCle } from './session.js';

const identifiantRequete = (config) => {
  const base = (config.baseURL || '').replace(/\/$/, '');
  const url = /^https?:/.test(config.url || '') ? config.url : `${base}/${(config.url || '').replace(/^\//, '')}`;
  const p = config.params || {};
  const params = Object.keys(p).sort().map((k) => `${k}=${p[k]}`).join('&');
  return `${url}?${params}`;
};

export const estMemorisable = (config) =>
  (config.method || 'get').toLowerCase() === 'get' &&
  !['blob', 'arraybuffer'].includes(config.responseType) &&
  !/\/token\//.test(config.url || '');

// Enregistre (chiffré) la réponse d'une consultation.
// Le cache est un bonus : une erreur ici ne doit jamais gêner l'utilisateur.
export async function memoriser(config, data) {
  try {
    const username = localStorage.getItem('compte_local');
    const cle = await lireCle();
    if (!username || !cle) return;
    await db.cache.put({
      cle: `${username}|${identifiantRequete(config)}`,
      username,
      le: Date.now(),
      contenu: await chiffrer(cle, data),
    });
  } catch {
    /* ignoré */
  }
}

// Relit une consultation mémorisée. Renvoie null s'il n'y en a pas,
// ou { manqueCle: true } si la session doit être déverrouillée par le login.
export async function relire(config) {
  try {
    const username = localStorage.getItem('compte_local');
    if (!username) return null;
    const cle = await lireCle();
    if (!cle) return { manqueCle: true };
    const ligne = await db.cache.get(`${username}|${identifiantRequete(config)}`);
    if (!ligne) return null;
    return { data: await dechiffrer(cle, ligne.contenu), le: ligne.le };
  } catch {
    return null;
  }
}
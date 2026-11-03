// Chiffrement local avec l'API WebCrypto du navigateur (aucune bibliothèque).
// Le mot de passe ne quitte jamais l'appareil et n'est jamais stocké.

const enc = new TextEncoder();
const dec = new TextDecoder();

// Plus il y a d'itérations, plus c'est difficile à casser, mais plus c'est lent
// sur les vieux téléphones. 300 000 est un bon compromis.
export const ITERATIONS = 300000;

export const versB64 = (buf) => {
  const o = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < o.length; i += 0x8000) {
    s += String.fromCharCode.apply(null, o.subarray(i, i + 0x8000));
  }
  return btoa(s);
};

export const depuisB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export const nouveauSel = () => crypto.getRandomValues(new Uint8Array(16));

// Comparaison sans arrêt anticipé.
export const egal = (a, b) => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
};

// Du mot de passe, on tire : une clé AES (chiffrer les données) et un
// vérificateur (savoir si le mot de passe saisi est le bon).
export async function deriver(motDePasse, sel, iterations = ITERATIONS) {
  const base = await crypto.subtle.importKey('raw', enc.encode(motDePasse), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: sel, iterations },
    base,
    256
  );
  const cle = await crypto.subtle.importKey('raw', bits, 'AES-GCM', false, ['encrypt', 'decrypt']);
  const marque = new Uint8Array([...enc.encode('verif:'), ...new Uint8Array(bits)]);
  const verifieur = versB64(await crypto.subtle.digest('SHA-256', marque));
  return { cle, verifieur };
}

export async function chiffrer(cle, objet) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, cle, enc.encode(JSON.stringify(objet)));
  return { iv: versB64(iv), data: versB64(data) };
}

export async function dechiffrer(cle, { iv, data }) {
  const clair = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: depuisB64(iv) }, cle, depuisB64(data));
  return JSON.parse(dec.decode(clair));
}
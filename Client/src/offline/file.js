import { db } from './db.js';
import { chiffrer, dechiffrer } from './crypto.js';
import { lireCle } from './session.js';
import api from '../services/api.js';
import CONFIG from '../config/config.js';

const prevenir = () => window.dispatchEvent(new CustomEvent('sylium:file-changee'));
const utilisateur = () => localStorage.getItem('compte_local');
const sansSlash = (u) => String(u).replace(/\/$/, '');

// Ordre d'envoi : les élèves d'abord, puis les paiements, puis les notes.
const TYPES = [
  { type: 'eleve', url: () => `${sansSlash(CONFIG.API_ELEVES)}/synchroniser/`, lot: 10 },
  { type: 'paiement', url: () => `${sansSlash(CONFIG.API_PAIEMENTS)}/synchroniser/`, lot: 100 },
  { type: 'note', url: () => `${sansSlash(CONFIG.API_NOTES)}/synchroniser/`, lot: 200 },
];

// Ajoute (ou remplace) une opération. Le contenu est chiffré avec la clé de la session.
export async function ajouterOperation({ type, cleNat, charge }) {
  const username = utilisateur();
  const cle = await lireCle();
  if (!username || !cle) throw new Error('cle_absente');

  const ligne = {
    username, type, cleNat, creeLe: Date.now(), statut: 'attente', erreur: null,
    contenu: await chiffrer(cle, charge),
  };
  const existante = await db.file
    .where('cleNat').equals(cleNat)
    .filter((o) => o.username === username)
    .first();
  if (existante) await db.file.put({ ...ligne, id: existante.id });
  else await db.file.add(ligne);
  prevenir();
}

export async function compterFile() {
  const username = utilisateur();
  if (!username) return { attente: 0, problemes: 0 };
  const lignes = await db.file.where('username').equals(username).toArray();
  return {
    attente: lignes.filter((l) => l.statut === 'attente').length,
    problemes: lignes.filter((l) => l.statut !== 'attente').length,
  };
}

export async function listerProblemes() {
  const username = utilisateur();
  if (!username) return [];
  const lignes = await db.file.where('username').equals(username).toArray();
  return lignes.filter((l) => l.statut !== 'attente').map((l) => ({ id: l.id, type: l.type, detail: l.erreur }));
}

export async function abandonner(id) {
  await db.file.delete(id);
  prevenir();
}

// Opérations encore en attente d'un type donné (déchiffrées), pour les réafficher dans les pages.
export async function operationsEnAttente(type) {
  const username = utilisateur();
  const cle = await lireCle();
  if (!username || !cle) return [];
  const lignes = await db.file
    .where('username').equals(username)
    .filter((l) => l.type === type && l.statut === 'attente')
    .toArray();
  const sortie = [];
  for (const l of lignes) {
    try {
      sortie.push(await dechiffrer(cle, l.contenu));
    } catch {
      /* illisible : traité par synchroniser() */
    }
  }
  return sortie;
}

let enCours = false;

// Envoie la file au serveur. Sans danger si appelée plusieurs fois.
export async function synchroniser() {
  if (enCours || !navigator.onLine) return { ok: false, raison: 'indisponible' };
  const username = utilisateur();
  const cle = await lireCle();
  if (!username || !cle) return { ok: false, raison: 'cle' };

  enCours = true;
  let changement = false; // les pages ne sont prévenues que si la file a réellement bougé
  const bilan = { ok: true, envoyees: 0, ecrasees: [] };
  try {
    for (const { type, url, lot: tailleLot } of TYPES) {
      const lignes = await db.file
        .where('username').equals(username)
        .filter((l) => l.statut === 'attente' && l.type === type)
        .sortBy('creeLe');

      const aEnvoyer = [];
      for (const l of lignes) {
        try {
          aEnvoyer.push({ id: l.id, charge: await dechiffrer(cle, l.contenu) });
        } catch {
          await db.file.update(l.id, { statut: 'illisible', erreur: 'Données illisibles (mot de passe modifié depuis).' });
          changement = true;
        }
      }

      for (let i = 0; i < aEnvoyer.length; i += tailleLot) {
        const lot = aEnvoyer.slice(i, i + tailleLot);
        let res;
        try {
          res = await api.post(url(), {
            operations: lot.map((o) => ({ client_id: o.id, ...o.charge })),
          });
        } catch (err) {
          if (!err.response) return { ...bilan, ok: false, raison: 'reseau' };
          if (err.response.status >= 500) return { ...bilan, ok: false, raison: 'serveur' };
          const detail = err.response.data?.detail || `Refusé par le serveur (${err.response.status}).`;
          for (const o of lot) await db.file.update(o.id, { statut: 'erreur', erreur: String(detail) });
          changement = true;
          continue;
        }

        for (const r of res.data.resultats) {
          changement = true;
          if (r.statut === 'erreur') {
            await db.file.update(r.client_id, { statut: 'erreur', erreur: r.detail });
          } else {
            await db.file.delete(r.client_id);
            bilan.envoyees += 1;
            if (r.statut === 'modifie') bilan.ecrasees.push({ avant: r.ancienne_valeur, apres: r.valeur });
          }
        }
      }
    }
    return bilan;
  } finally {
    enCours = false;
    if (changement) prevenir();
  }
}
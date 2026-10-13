import api from '../services/api.js';
import CONFIG from '../config/config.js';

export const formatGNF = (n) => Number(n || 0).toLocaleString('fr-FR');

export const MODES = {
  especes: 'Espèces',
  orange_money: 'Orange Money',
  mtn_momo: 'MTN MoMo',
  virement: 'Virement',
};

// Le reçu passe par l'API (avec le token) puis est téléchargé en blob.
export const telechargerRecu = async (paiement) => {
  const res = await api.get(CONFIG.API_PAIEMENT_RECU(paiement.id), { responseType: 'blob' });
  const url = window.URL.createObjectURL(res.data);
  const lien = document.createElement('a');
  lien.href = url;
  lien.download = `${paiement.numero_recu}.pdf`;
  document.body.appendChild(lien);
  lien.click();
  document.body.removeChild(lien);
  window.URL.revokeObjectURL(url);
};
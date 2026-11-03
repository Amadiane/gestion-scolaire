import { MODES } from '../utils/finance.js';

const CLE_COMPTEUR = 'recu_prov_compteur';
const CLE_APPAREIL = 'appareil_id';

// Identifiant court propre à cet appareil : évite que deux appareils produisent le même numéro.
const idAppareil = () => {
  let id = localStorage.getItem(CLE_APPAREIL);
  if (!id) {
    id = crypto.randomUUID().slice(0, 4).toUpperCase();
    localStorage.setItem(CLE_APPAREIL, id);
  }
  return id;
};

export function prochainNumeroProvisoire() {
  const n = Number(localStorage.getItem(CLE_COMPTEUR) || 0) + 1;
  localStorage.setItem(CLE_COMPTEUR, String(n));
  return `PROV-${idAppareil()}-${String(n).padStart(4, '0')}`;
}

const echapper = (t) =>
  String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Ouvre la boîte d'impression (ou « Enregistrer en PDF » sur téléphone) avec le reçu provisoire.
export function imprimerRecuProvisoire(p) {
  const date = new Date(p.date_paiement).toLocaleDateString('fr-FR');
  const montant = Number(p.montant || 0).toLocaleString('fr-FR');
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<title>Reçu provisoire ${echapper(p.numeroProvisoire)}</title>
<style>
  body { font-family: Arial, sans-serif; color: #1f2937; margin: 32px; }
  h1 { font-size: 20px; color: #1e3a5f; margin: 0 0 4px; }
  .badge { display: inline-block; padding: 4px 10px; border-radius: 999px; background: #fef3c7; color: #92400e; font-size: 12px; font-weight: 700; }
  table { width: 100%; border-collapse: collapse; margin-top: 20px; }
  td { padding: 10px 0; border-bottom: 1px solid #e5e7eb; font-size: 14px; }
  td:first-child { color: #6b7280; width: 40%; }
  .total { font-size: 22px; font-weight: 800; color: #1e3a5f; }
  p { font-size: 12px; color: #6b7280; margin-top: 24px; line-height: 1.5; }
</style></head><body>
<h1>Reçu provisoire</h1>
<span class="badge">Non officiel : sera remplacé par le reçu officiel</span>
<table>
  <tr><td>N° provisoire</td><td><strong>${echapper(p.numeroProvisoire)}</strong></td></tr>
  <tr><td>Date</td><td>${echapper(date)}</td></tr>
  <tr><td>Élève</td><td>${echapper(p.eleveLabel)}</td></tr>
  <tr><td>Mode de paiement</td><td>${echapper(MODES[p.mode] || p.mode)}</td></tr>
  ${p.reference ? `<tr><td>Référence</td><td>${echapper(p.reference)}</td></tr>` : ''}
  <tr><td>Montant reçu</td><td class="total">${echapper(montant)} GNF</td></tr>
</table>
<p>Ce document atteste la réception de la somme indiquée. Le reçu officiel numéroté vous sera remis
dès que l'établissement aura synchronisé ses données. Conservez ce reçu provisoire.</p>
</body></html>`;

  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
  document.body.appendChild(iframe);
  const doc = iframe.contentWindow.document;
  doc.open();
  doc.write(html);
  doc.close();
  setTimeout(() => {
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
    setTimeout(() => iframe.remove(), 60000);
  }, 300);
}
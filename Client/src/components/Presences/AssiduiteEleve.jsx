import { useEffect, useState } from 'react';
import { Printer, FileSpreadsheet } from 'lucide-react';
import api from '../../services/api.js';
import CONFIG from '../../config/config.js';
import styles from '../../theme/pages/admin/Presences.module.css';

const formaterDate = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString('fr-FR');
const echapper = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const AssiduiteEleve = ({ eleveId }) => {
  const [donnees, setDonnees] = useState(null);
  const [export_, setExport] = useState(false);
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    api.get(CONFIG.API_PRESENCES_ELEVE(eleveId))
      .then((res) => setDonnees(res.data))
      .catch(() => setDonnees(null)); // indisponible sans réseau : on n'affiche rien
  }, [eleveId]);

  // Historique complet de l'année (la carte n'affiche que les 15 derniers jours).
  const chargerTout = async () => {
    const res = await api.get(`${CONFIG.API_PRESENCES_ELEVE(eleveId)}?tout=1`);
    return res.data;
  };

  const telechargerCsv = async () => {
    setErreur('');
    setExport(true);
    try {
      const d = await chargerTout();
      const lignes = [
        ['Date', 'Classe', 'Statut', 'Remarque'],
        ...d.recentes.map((p) => [formaterDate(p.date), p.classe, p.libelle, p.remarque || '']),
      ];
      // Séparateur « ; » et BOM : s'ouvre correctement dans Excel en français.
      const texte = lignes.map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\r\n');
      const blob = new Blob(['\ufeff' + texte], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const lien = document.createElement('a');
      lien.href = url;
      lien.download = `assiduite_${d.eleve.matricule}.csv`;
      document.body.appendChild(lien);
      lien.click();
      document.body.removeChild(lien);
      URL.revokeObjectURL(url);
    } catch {
      setErreur("Impossible de préparer le fichier. Vérifiez votre connexion.");
    } finally {
      setExport(false);
    }
  };

  const imprimer = async () => {
    setErreur('');
    setExport(true);
    try {
      const d = await chargerTout();
      const lignesHtml = d.recentes
        .map((p) => `<tr><td>${formaterDate(p.date)}</td><td>${echapper(p.classe)}</td><td>${echapper(p.libelle)}</td><td>${echapper(p.remarque)}</td></tr>`)
        .join('');
      const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<title>Assiduité ${echapper(d.eleve.prenom)} ${echapper(d.eleve.nom)}</title>
<style>
body{font-family:Arial,sans-serif;margin:24px;color:#111}
h1{font-size:18px;margin:0 0 4px} h2{font-size:14px;margin:0 0 14px;font-weight:normal;color:#444}
.resume{margin:12px 0;font-size:13px}
table{width:100%;border-collapse:collapse;font-size:13px}
th,td{border:1px solid #bbb;padding:6px 8px;text-align:left} th{background:#eee}
</style></head><body>
<h1>${echapper(d.eleve.ecole)}</h1>
<h2>Fiche d'assiduité · ${echapper(d.eleve.prenom)} ${echapper(d.eleve.nom)} (${echapper(d.eleve.matricule)}) · Année ${echapper(d.annee)}</h2>
<div class="resume">${d.jours} jour(s) appelé(s) · ${d.taux ?? '—'}% de présence ·
${d.comptes.present} présent · ${d.comptes.absent} absent · ${d.comptes.retard} retard · ${d.comptes.excuse} excusé</div>
<table><thead><tr><th>Date</th><th>Classe</th><th>Statut</th><th>Remarque</th></tr></thead><tbody>${lignesHtml}</tbody></table>
</body></html>`;

      const cadre = document.createElement('iframe');
      cadre.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
      document.body.appendChild(cadre);
      cadre.contentDocument.open();
      cadre.contentDocument.write(html);
      cadre.contentDocument.close();
      cadre.onload = () => {
        cadre.contentWindow.focus();
        cadre.contentWindow.print();
        setTimeout(() => document.body.removeChild(cadre), 1500);
      };
    } catch {
      setErreur("Impossible de préparer le document. Vérifiez votre connexion.");
    } finally {
      setExport(false);
    }
  };

  if (!donnees) return null;

  return (
    <section className={styles.assiduite}>
      <h3>Assiduité{donnees.annee ? ` · ${donnees.annee}` : ''}</h3>
      {donnees.jours === 0 ? (
        <p className={styles.etat}>Aucun appel enregistré pour cet élève.</p>
      ) : (
        <>
          <div className={styles.resume}>
            <span>{donnees.taux}% de présence</span>
            <span className={styles.pastille_present}>{donnees.comptes.present} présent</span>
            <span className={styles.pastille_absent}>{donnees.comptes.absent} absent</span>
            <span className={styles.pastille_retard}>{donnees.comptes.retard} retard</span>
            <span className={styles.pastille_excuse}>{donnees.comptes.excuse} excusé</span>
          </div>

          <div className={styles.filtres}>
            <button type="button" className={styles.bouton} onClick={imprimer} disabled={export_}>
              <Printer size={15} /> Imprimer / PDF
            </button>
            <button type="button" className={styles.bouton} onClick={telechargerCsv} disabled={export_}>
              <FileSpreadsheet size={15} /> Excel (CSV)
            </button>
          </div>
          {erreur && <p className={styles.erreur}>{erreur}</p>}

          <ul className={styles.recentes}>
            {donnees.recentes.map((p) => (
              <li key={p.date}>
                <span>{formaterDate(p.date)}</span>
                <span className={styles[`pastille_${p.statut}`]}>{p.libelle}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
};

export default AssiduiteEleve;
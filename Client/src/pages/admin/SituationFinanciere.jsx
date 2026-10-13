import { useState, useEffect, useCallback } from 'react';
import { Wallet, Pencil } from 'lucide-react';
import api from '../../services/api.js';
import CONFIG from '../../config/config.js';
import { formatGNF } from '../../utils/finance.js';
import styles from '../../theme/pages/admin/FicheEleve.module.css';

const SituationFinanciere = ({ eleveId }) => {
  const [sit, setSit] = useState(null);
  const [refuse, setRefuse] = useState(false);
  const [edition, setEdition] = useState(false);
  const [remise, setRemise] = useState({ montant: '', motif: '' });
  const [erreur, setErreur] = useState('');

  const charger = useCallback(async () => {
    try {
      const res = await api.get(CONFIG.API_FINANCE_SITUATION(eleveId));
      setSit(res.data);
      setRemise({ montant: res.data.remise || '', motif: res.data.motif_remise || '' });
    } catch {
      setRefuse(true); // rôle non autorisé ou pas d'année active : on masque la carte
    }
  }, [eleveId]);

  useEffect(() => { charger(); }, [charger]);

  const enregistrerRemise = async (e) => {
    e.preventDefault();
    setErreur('');
    try {
      const res = await api.post(CONFIG.API_FINANCE_REMISE, { eleve: eleveId, ...remise });
      setSit(res.data);
      setEdition(false);
    } catch (err) {
      setErreur(err.response?.data?.[0] || 'Impossible d\'enregistrer la remise.');
    }
  };

  if (refuse || !sit) return null;

  return (
    <div className={styles.card}>
      <h2 className={styles.cardTitle}><Wallet size={16} /> Situation financière</h2>

      {!sit.inscrit ? (
        <p className={styles.emptyMsg}>Élève non inscrit dans une classe cette année.</p>
      ) : (
        <>
          <dl className={styles.infoList}>
            {sit.frais.map((f) => (
              <div key={f.libelle}><dt>{f.libelle}</dt><dd>{formatGNF(f.montant)} GNF</dd></div>
            ))}
            <div><dt>Total des frais</dt><dd>{formatGNF(sit.total_du)} GNF</dd></div>
            <div>
              <dt>Remise{sit.motif_remise ? ` (${sit.motif_remise})` : ''}</dt>
              <dd>− {formatGNF(sit.remise)} GNF</dd>
            </div>
            <div><dt>Payé</dt><dd>{formatGNF(sit.paye)} GNF</dd></div>
            <div>
              <dt>Reste à payer</dt>
              <dd className={sit.reste > 0 ? styles.resteDu : styles.resteSolde}>
                {sit.reste > 0 ? `${formatGNF(sit.reste)} GNF` : 'Soldé'}
              </dd>
            </div>
          </dl>

          {sit.frais.length === 0 && (
            <p className={styles.emptyMsg}>Aucun frais défini pour ce niveau : voir Finance → Frais de scolarité.</p>
          )}

          {!edition ? (
            <button className={styles.remiseButton} onClick={() => setEdition(true)}>
              <Pencil size={13} /> Modifier la remise
            </button>
          ) : (
            <form className={styles.remiseForm} onSubmit={enregistrerRemise}>
              <input
                type="number" min="0" placeholder="Montant (GNF)"
                value={remise.montant}
                onChange={(e) => setRemise({ ...remise, montant: e.target.value })}
              />
              <input
                placeholder="Motif (fratrie, boursier...)"
                value={remise.motif}
                onChange={(e) => setRemise({ ...remise, motif: e.target.value })}
              />
              <div className={styles.remiseActions}>
                <button type="button" onClick={() => setEdition(false)}>Annuler</button>
                <button type="submit">Enregistrer</button>
              </div>
              {erreur && <p className={styles.remiseErreur}>{erreur}</p>}
            </form>
          )}
        </>
      )}
    </div>
  );
};

export default SituationFinanciere;
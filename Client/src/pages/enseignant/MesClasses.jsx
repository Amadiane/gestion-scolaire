import { useState, useEffect } from 'react';
import api from '../../services/api.js';
import CONFIG from '../../config/config.js';
import BoutonRetour from '../../components/BoutonRetour/BoutonRetour.jsx';
import styles from '../../theme/pages/enseignant/DashboardEnseignant.module.css';

const MesClasses = () => {
  const [blocs, setBlocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const charger = async () => {
      try {
        const res = await api.get(CONFIG.API_MES_AFFECTATIONS);
        const parClasse = {};
        res.data.forEach((a) => {
          parClasse[a.classe_id] = parClasse[a.classe_id] || { ...a, matieres: [] };
          parClasse[a.classe_id].matieres.push(a.matiere_nom);
        });
        const liste = await Promise.all(
          Object.values(parClasse).map(async (c) => {
            const eleves = await api.get(CONFIG.API_CLASSE_ELEVES(c.classe_id));
            return { ...c, eleves: eleves.data };
          })
        );
        setBlocs(liste);
      } catch {
        setError('Impossible de charger vos classes.');
      } finally {
        setLoading(false);
      }
    };
    charger();
  }, []);

  return (
    <div className={styles.wrapper}>
      <BoutonRetour vers="/enseignant" />

      <h1 className={styles.title}>Mes classes</h1>
      <p className={styles.subtitle}>Les classes qui vous sont affectées et leurs élèves</p>

      {error && <p className={styles.errorBanner}>{error}</p>}
      {loading && <p className={styles.stateMsg}>Chargement...</p>}

      {!loading && !error && blocs.length === 0 && (
        <div className={styles.placeholderCard}><p>Aucune classe ne vous est affectée pour le moment.</p></div>
      )}

      {blocs.map((c) => (
        <div key={c.classe_id} className={styles.classeBlock}>
          <div className={styles.classeHeader}>
            {c.classe_nom}
            <small>{c.matieres.join(' · ')} — {c.eleves.length} élève(s)</small>
          </div>
          {c.eleves.map((e) => (
            <div key={e.id} className={styles.eleveRow}>
              {e.prenom} {e.nom}
              <small>{e.matricule}</small>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};

export default MesClasses;
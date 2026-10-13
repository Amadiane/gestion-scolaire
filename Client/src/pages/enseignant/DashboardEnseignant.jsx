import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { School, BookOpen, Users, AlertTriangle } from 'lucide-react';
import api from '../../services/api.js';
import CONFIG from '../../config/config.js';
import styles from '../../theme/pages/enseignant/DashboardEnseignant.module.css';

const DashboardEnseignant = () => {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const [affectations, setAffectations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get(CONFIG.API_MES_AFFECTATIONS)
      .then((res) => setAffectations(res.data))
      .catch(() => setError('Impossible de charger vos classes.'))
      .finally(() => setLoading(false));
  }, []);

  const classes = [...new Set(affectations.map((a) => a.classe_id))];
  const totalEleves = classes
    .map((id) => affectations.find((a) => a.classe_id === id).effectif)
    .reduce((s, n) => s + n, 0);

  return (
    <div className={styles.wrapper}>
      <h1 className={styles.title}>Tableau de bord</h1>
      <p className={styles.subtitle}>Bienvenue, {user.first_name || user.username}</p>

      {error && <div className={styles.errorBanner}><AlertTriangle size={16} /> {error}</div>}
      {loading && <p className={styles.stateMsg}>Chargement...</p>}

      {!loading && !error && (
        affectations.length === 0 ? (
          <div className={styles.placeholderCard}>
            <p>Aucune classe ne vous est encore affectée. Demandez à la direction de vous attribuer vos classes et matières.</p>
          </div>
        ) : (
          <>
            <div className={styles.statsGrid}>
              <div className={styles.statCard}><School size={20} /><div><span>{classes.length}</span><small>Classe(s)</small></div></div>
              <div className={styles.statCard}><BookOpen size={20} /><div><span>{affectations.length}</span><small>Matière(s) enseignée(s)</small></div></div>
              <div className={styles.statCard}><Users size={20} /><div><span>{totalEleves}</span><small>Élève(s)</small></div></div>
            </div>

            <h2 className={styles.sectionTitle}>Mes enseignements</h2>
            <div className={styles.cardsGrid}>
              {affectations.map((a) => (
                <div key={a.id} className={styles.affCard}>
                  <div>
                    <strong>{a.classe_nom}</strong>
                    <span className={styles.affMatiere}>{a.matiere_nom}</span>
                    <span className={styles.affMeta}>{a.effectif} élève(s) · sur {a.bareme_note}</span>
                  </div>
                  <button className={styles.affButton} onClick={() => navigate('/enseignant/notes', { state: { affectation: a.id } })}>
                    Saisir les notes
                  </button>
                </div>
              ))}
            </div>
          </>
        )
      )}
    </div>
  );
};

export default DashboardEnseignant;
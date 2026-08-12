import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { School, Users } from 'lucide-react';
import api from '../../services/api.js';
import CONFIG from '../../config/config.js';
import styles from '../../theme/pages/admin/Classes.module.css';

const Classes = () => {
  const navigate = useNavigate();
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const charger = async () => {
      try {
        const res = await api.get(CONFIG.API_CLASSES);
        setClasses(res.data);
      } catch {
        setError('Impossible de charger les classes.');
      } finally {
        setLoading(false);
      }
    };
    charger();
  }, []);

  return (
    <div className={styles.wrapper}>
      <h1 className={styles.title}>Classes</h1>
      <p className={styles.subtitle}>{classes.length} classe(s)</p>

      {loading && <p className={styles.stateMsg}>Chargement...</p>}
      {error && <p className={styles.errorMsg}>{error}</p>}

      {!loading && !error && classes.length === 0 && (
        <div className={styles.emptyState}>
          <School size={40} color="var(--color-text-dim)" />
          <p>Aucune classe créée pour le moment.</p>
        </div>
      )}

      <div className={styles.grid}>
        {classes.map((classe) => (
          <div
            key={classe.id}
            className={styles.card}
            onClick={() => navigate(`/dashboardAdmin/classes/${classe.id}`)}
          >
            <div className={styles.cardIcon}>
              <School size={20} color="#fff" />
            </div>
            <div className={styles.cardInfo}>
              <h3 className={styles.cardName}>{classe.nom}</h3>
              <p className={styles.cardNiveau}>{classe.niveau_nom}</p>
            </div>
            <div className={styles.cardEffectif}>
              <Users size={14} />
              {classe.effectif}{classe.effectif_max ? `/${classe.effectif_max}` : ''}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Classes;
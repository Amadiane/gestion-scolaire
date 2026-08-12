import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, GraduationCap } from 'lucide-react';
import api from '../../services/api.js';
import CONFIG from '../../config/config.js';
import styles from '../../theme/pages/admin/RosterClasse.module.css';

const RosterClasse = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [eleves, setEleves] = useState([]);
  const [classe, setClasse] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const charger = async () => {
      try {
        const [resClasse, resEleves] = await Promise.all([
          api.get(`${CONFIG.API_CLASSES}${id}/`),
          api.get(CONFIG.API_CLASSE_ELEVES(id)),
        ]);
        setClasse(resClasse.data);
        setEleves(resEleves.data);
      } finally {
        setLoading(false);
      }
    };
    charger();
  }, [id]);

  return (
    <div className={styles.wrapper}>
      <button className={styles.backButton} onClick={() => navigate('/dashboardAdmin/classes')}>
        <ArrowLeft size={16} /> Retour aux classes
      </button>

      {loading ? (
        <p className={styles.stateMsg}>Chargement...</p>
      ) : (
        <>
          <h1 className={styles.title}>{classe?.nom}</h1>
          <p className={styles.subtitle}>{eleves.length} élève(s)</p>

          {eleves.length === 0 ? (
            <div className={styles.emptyState}>
              <GraduationCap size={40} color="var(--color-text-dim)" />
              <p>Aucun élève inscrit dans cette classe.</p>
            </div>
          ) : (
            <div className={styles.list}>
              {eleves.map((eleve) => (
                <div
                  key={eleve.id}
                  className={styles.row}
                  onClick={() => navigate(`/dashboardAdmin/eleves/${eleve.id}`)}
                >
                  <div className={styles.avatar}>
                    {eleve.photo ? (
                      <img src={eleve.photo} alt="" />
                    ) : (
                      <span>{eleve.prenom?.[0]}{eleve.nom?.[0]}</span>
                    )}
                  </div>
                  <div className={styles.info}>
                    <span className={styles.name}>{eleve.prenom} {eleve.nom}</span>
                    <span className={styles.matricule}>{eleve.matricule}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default RosterClasse;
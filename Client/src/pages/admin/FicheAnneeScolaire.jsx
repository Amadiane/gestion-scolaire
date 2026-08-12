import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, School, Users, BookOpen, FileText, CheckCircle2 } from 'lucide-react';
import api from '../../services/api.js';
import CONFIG from '../../config/config.js';
import styles from '../../theme/pages/admin/FicheAnneeScolaire.module.css';

const FicheAnneeScolaire = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [annee, setAnnee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const charger = async () => {
      setLoading(true);
      try {
        const res = await api.get(`${CONFIG.API_ANNEES_SCOLAIRES}${id}/`);
        setAnnee(res.data);
      } catch {
        setError("Impossible de charger cette année scolaire.");
      } finally {
        setLoading(false);
      }
    };
    charger();
  }, [id]);

  if (loading) return <div className={styles.wrapper}><p className={styles.stateMsg}>Chargement...</p></div>;
  if (error) return <div className={styles.wrapper}><p className={styles.errorMsg}>{error}</p></div>;
  if (!annee) return null;

  return (
    <div className={styles.wrapper}>
      <button className={styles.backButton} onClick={() => navigate('/dashboardAdmin/annees-scolaires')}>
        <ArrowLeft size={16} /> Retour aux années scolaires
      </button>

      <div className={styles.headerCard}>
        <div>
          <div className={styles.titleRow}>
            <h1 className={styles.title}>{annee.nom}</h1>
            {annee.est_active && (
              <span className={styles.activeBadge}>
                <CheckCircle2 size={14} /> Active
              </span>
            )}
          </div>
          <p className={styles.dates}>{annee.date_debut} → {annee.date_fin}</p>
        </div>
      </div>

      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <School size={20} color="var(--color-primary)" />
          <div>
            <span className={styles.statValue}>{annee.classes.length}</span>
            <span className={styles.statLabel}>Classe(s)</span>
          </div>
        </div>
        <div className={styles.statCard}>
          <Users size={20} color="var(--color-primary)" />
          <div>
            <span className={styles.statValue}>{annee.nb_eleves_total}</span>
            <span className={styles.statLabel}>Élève(s) inscrit(s)</span>
          </div>
        </div>
        <div className={styles.statCard}>
          <BookOpen size={20} color="var(--color-primary)" />
          <div>
            <span className={styles.statValue}>{annee.nb_notes}</span>
            <span className={styles.statLabel}>Note(s) saisie(s)</span>
          </div>
        </div>
        <div className={styles.statCard}>
          <FileText size={20} color="var(--color-primary)" />
          <div>
            <span className={styles.statValue}>{annee.nb_bulletins}</span>
            <span className={styles.statLabel}>Bulletin(s)</span>
          </div>
        </div>
      </div>

      <div className={styles.card}>
        <h2 className={styles.cardTitle}>Classes de cette année</h2>

        {annee.classes.length === 0 ? (
          <p className={styles.emptyMsg}>Aucune classe créée pour cette année scolaire.</p>
        ) : (
          <div className={styles.classesList}>
            {annee.classes.map((classe) => (
              <div
                key={classe.id}
                className={styles.classeRow}
                onClick={() => navigate(`/dashboardAdmin/classes/${classe.id}`)}
              >
                <div className={styles.classeInfo}>
                  <span className={styles.classeNom}>{classe.nom}</span>
                  <span className={styles.classeNiveau}>{classe.niveau_nom}</span>
                </div>
                <span className={styles.classeEffectif}>
                  <Users size={13} /> {classe.effectif}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default FicheAnneeScolaire;
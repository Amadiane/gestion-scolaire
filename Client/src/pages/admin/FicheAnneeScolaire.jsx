import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, School, Users, BookOpen, FileText, CheckCircle2 } from 'lucide-react';
import api from '../../services/api.js';
import CONFIG from '../../config/config.js';
import styles from '../../theme/pages/admin/FicheAnneeScolaire.module.css';

const fmtDate = (v) => {
  const [a, m, j] = String(v || '').slice(0, 10).split('-');
  return j ? `${j}/${m}/${a}` : '—';
};

const comparer = (a, b) =>
  String(a || '').localeCompare(String(b || ''), 'fr', { numeric: true, sensitivity: 'base' });

const FicheAnneeScolaire = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [annee, setAnnee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const charger = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await api.get(`${CONFIG.API_ANNEES_SCOLAIRES}${id}/`);
        setAnnee(res.data);
      } catch (err) {
        setError(
          err.response?.status === 404
            ? "Cette année scolaire n'existe pas ou n'appartient pas à votre école."
            : "Impossible de charger cette année scolaire."
        );
      } finally {
        setLoading(false);
      }
    };
    charger();
  }, [id]);

  const retour = () => navigate('/dashboardAdmin/annees-scolaires');

  if (loading) return <div className={styles.wrapper}><p className={styles.stateMsg}>Chargement...</p></div>;
  if (error) {
    return (
      <div className={styles.wrapper}>
        <button className={styles.backButton} onClick={retour}>
          <ArrowLeft size={16} /> Retour aux années scolaires
        </button>
        <p className={styles.errorMsg}>{error}</p>
      </div>
    );
  }
  if (!annee) return null;

  const classes = [...(annee.classes || [])].sort(
    (a, b) =>
      (a.niveau_ordre ?? 9999) - (b.niveau_ordre ?? 9999) ||
      comparer(a.niveau_nom, b.niveau_nom) ||
      comparer(a.nom, b.nom)
  );
  const effectifClasses = classes.reduce((s, c) => s + (c.effectif || 0), 0);
  const ecart = annee.nb_eleves_total != null && effectifClasses !== annee.nb_eleves_total;

  return (
    <div className={styles.wrapper}>
      <button className={styles.backButton} onClick={retour}>
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
          <p className={styles.dates}>{fmtDate(annee.date_debut)} → {fmtDate(annee.date_fin)}</p>
        </div>
      </div>

      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <School size={20} color="var(--color-primary)" />
          <div>
            <span className={styles.statValue}>{classes.length}</span>
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
        <h2 className={styles.cardTitle}>Classes de cette année ({effectifClasses} élève(s))</h2>

        {ecart && (
          <p className={styles.errorMsg}>
            Attention : {annee.nb_eleves_total} inscription(s) pour {effectifClasses} élève(s) comptés dans les classes.
          </p>
        )}

        {classes.length === 0 ? (
          <p className={styles.emptyMsg}>Aucune classe créée pour cette année scolaire.</p>
        ) : (
          <div className={styles.classesList}>
            {classes.map((classe) => (
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
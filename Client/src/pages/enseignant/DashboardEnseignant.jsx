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

  // Regroupement par classe, en gardant l'ordre fourni par le serveur
  // (niveau, classe, matière). Une Map conserve l'ordre d'insertion.
  const parClasse = new Map();
  affectations.forEach((a) => {
    if (!parClasse.has(a.classe_id)) {
      parClasse.set(a.classe_id, {
        id: a.classe_id,
        nom: a.classe_nom,
        effectif: a.effectif,
        items: [],
      });
    }
    parClasse.get(a.classe_id).items.push(a);
  });
  const classes = [...parClasse.values()];
  const totalEleves = classes.reduce((s, c) => s + (c.effectif || 0), 0);

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

            {classes.map((classe) => (
              <div key={classe.id}>
                <h3 className={styles.sectionTitle} style={{ fontSize: '0.95rem', marginTop: 18 }}>
                  {classe.nom} · {classe.effectif} élève(s)
                </h3>
                <div className={styles.cardsGrid}>
                  {classe.items.map((a) => (
                    <div key={a.id} className={styles.affCard}>
                      <div>
                        <strong>{a.matiere_nom}</strong>
                        <span className={styles.affMeta}>Notes sur {a.bareme_note}</span>
                      </div>
                      <button
                        className={styles.affButton}
                        onClick={() => navigate('/enseignant/notes', { state: { affectation: a.id } })}
                      >
                        Saisir les notes
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </>
        )
      )}
    </div>
  );
};

export default DashboardEnseignant;
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { School, Users, Search } from 'lucide-react';
import api from '../../services/api.js';
import CONFIG from '../../config/config.js';
import BoutonRetour from '../../components/BoutonRetour/BoutonRetour.jsx';
import styles from '../../theme/pages/admin/Classes.module.css';

const norm = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const comparer = (a, b) =>
  String(a || '').localeCompare(String(b || ''), 'fr', { numeric: true, sensitivity: 'base' });

const Classes = () => {
  const navigate = useNavigate();
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [recherche, setRecherche] = useState('');
  const [niveauFiltre, setNiveauFiltre] = useState('');

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

  // Niveaux dans l'ordre pédagogique (puis alphabétique si l'ordre est absent).
  const niveaux = [...new Map(classes.map((c) => [c.niveau_nom, c.niveau_ordre ?? 9999])).entries()]
    .sort((a, b) => a[1] - b[1] || comparer(a[0], b[0]))
    .map(([nom]) => nom);

  const filtrees = classes.filter(
    (c) =>
      (!niveauFiltre || c.niveau_nom === niveauFiltre) &&
      norm(`${c.nom} ${c.niveau_nom}`).includes(norm(recherche.trim()))
  );

  const groupes = niveaux
    .map((nom) => ({
      nom,
      classes: filtrees.filter((c) => c.niveau_nom === nom).sort((a, b) => comparer(a.nom, b.nom)),
    }))
    .filter((g) => g.classes.length > 0);

  const totalEleves = filtrees.reduce((s, c) => s + (c.effectif || 0), 0);

  return (
    <div className={styles.wrapper}>
      <BoutonRetour vers="/dashboardAdmin" />

      <h1 className={styles.title}>Classes</h1>
      <p className={styles.subtitle}>
        {classes.length} classe(s) · {totalEleves} élève(s)
        {(recherche || niveauFiltre) && ' (selon les filtres)'}
      </p>

      {classes.length > 0 && (
        <div className={styles.filtersRow}>
          <div className={styles.searchBar}>
            <Search size={16} color="var(--color-text-dim)" />
            <input
              type="text"
              placeholder="Rechercher une classe..."
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
            />
          </div>
          <select
            className={styles.niveauSelect}
            value={niveauFiltre}
            onChange={(e) => setNiveauFiltre(e.target.value)}
            aria-label="Filtrer par niveau"
          >
            <option value="">Tous les niveaux</option>
            {niveaux.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      )}

      {loading && <p className={styles.stateMsg}>Chargement...</p>}
      {error && <p className={styles.errorMsg}>{error}</p>}

      {!loading && !error && classes.length === 0 && (
        <div className={styles.emptyState}>
          <School size={40} color="var(--color-text-dim)" />
          <p>Aucune classe créée pour le moment.</p>
        </div>
      )}

      {!loading && !error && classes.length > 0 && groupes.length === 0 && (
        <div className={styles.emptyState}>
          <p>Aucune classe ne correspond à ces filtres.</p>
        </div>
      )}

      {groupes.map((g) => (
        <section key={g.nom} className={styles.groupe}>
          <h2 className={styles.groupeTitre}>
            {g.nom}
            <span>
              {g.classes.length} classe(s) · {g.classes.reduce((s, c) => s + (c.effectif || 0), 0)} élève(s)
            </span>
          </h2>
          <div className={styles.grid}>
            {g.classes.map((classe) => {
              const pleine = classe.effectif_max && classe.effectif >= classe.effectif_max;
              return (
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
                  <div
                    className={`${styles.cardEffectif} ${pleine ? styles.pleine : ''}`}
                    title={pleine ? 'Classe complète' : undefined}
                  >
                    <Users size={14} />
                    {classe.effectif}{classe.effectif_max ? `/${classe.effectif_max}` : ''}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
};

export default Classes;
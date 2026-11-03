import { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import api from '../../services/api.js';
import CONFIG from '../../config/config.js';
import BoutonRetour from '../../components/BoutonRetour/BoutonRetour.jsx';
import styles from '../../theme/pages/enseignant/DashboardEnseignant.module.css';
import listes from '../../theme/pages/admin/Listes.module.css';

const norm = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const comparer = (a, b) =>
  String(a || '').localeCompare(String(b || ''), 'fr', { numeric: true, sensitivity: 'base' });

const MesClasses = () => {
  const [blocs, setBlocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [recherche, setRecherche] = useState('');

  useEffect(() => {
    const charger = async () => {
      try {
        const res = await api.get(CONFIG.API_MES_AFFECTATIONS);
        // Map : conserve l'ordre du serveur (niveau, puis classe), contrairement à un objet
        // dont les clés numériques seraient triées par identifiant.
        const parClasse = new Map();
        res.data.forEach((a) => {
          if (!parClasse.has(a.classe_id)) parClasse.set(a.classe_id, { ...a, matieres: [] });
          parClasse.get(a.classe_id).matieres.push(a.matiere_nom);
        });
        const liste = await Promise.all(
          [...parClasse.values()].map(async (c) => {
            const eleves = await api.get(CONFIG.API_CLASSE_ELEVES(c.classe_id));
            const tries = [...eleves.data].sort((a, b) => comparer(a.matricule, b.matricule));
            return { ...c, eleves: tries };
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

  const texte = norm(recherche.trim());
  const blocsAffiches = blocs
    .map((c) => ({
      ...c,
      elevesAffiches: texte
        ? c.eleves.filter((e) => norm(`${e.nom} ${e.prenom} ${e.matricule}`).includes(texte))
        : c.eleves,
    }))
    .filter((c) => !texte || c.elevesAffiches.length > 0);

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

      {!loading && blocs.length > 0 && (
        <div className={listes.barre}>
          <div className={listes.recherche}>
            <Search size={16} color="var(--color-text-dim)" />
            <input
              type="text"
              placeholder="Rechercher un élève ou un matricule..."
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
            />
          </div>
        </div>
      )}

      {texte && blocsAffiches.length === 0 && (
        <p className={styles.stateMsg}>Aucun élève ne correspond à cette recherche.</p>
      )}

      {blocsAffiches.map((c) => (
        <div key={c.classe_id} className={styles.classeBlock}>
          <div className={styles.classeHeader}>
            {c.classe_nom}
            <small>{c.matieres.join(' · ')} — {c.eleves.length} élève(s)</small>
          </div>
          {c.elevesAffiches.map((e) => (
            <div key={e.id} className={styles.eleveRow}>
              {e.nom} {e.prenom}
              <small>{e.matricule}</small>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};

export default MesClasses;
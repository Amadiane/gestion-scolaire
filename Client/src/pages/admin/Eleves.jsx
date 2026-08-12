import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, GraduationCap } from 'lucide-react';
import api from '../../services/api.js';
import CONFIG from '../../config/config.js';
import AjouterEleveModal from './AjouterEleveModal.jsx';
import styles from '../../theme/pages/admin/Eleves.module.css';

const Eleves = () => {
  const navigate = useNavigate();
  const [eleves, setEleves] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [recherche, setRecherche] = useState('');
  const [classeFiltre, setClasseFiltre] = useState('');
  const [modalOuvert, setModalOuvert] = useState(false);

  const chargerDonnees = async () => {
    setLoading(true);
    try {
      const [resEleves, resClasses] = await Promise.all([
        api.get(CONFIG.API_ELEVES),
        api.get(CONFIG.API_CLASSES),
      ]);
      setEleves(resEleves.data);
      setClasses(resClasses.data);
    } catch {
      setError("Impossible de charger la liste des élèves.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    chargerDonnees();
  }, []);

  const handleSuccess = () => {
    setModalOuvert(false);
    chargerDonnees();
  };

  const elevesFiltres = eleves.filter((e) => {
    const matchTexte = `${e.nom} ${e.prenom} ${e.matricule}`.toLowerCase().includes(recherche.toLowerCase());
    const matchClasse = !classeFiltre || e.classe_actuelle_nom === classeFiltre;
    return matchTexte && matchClasse;
  });

  return (
    <div className={styles.wrapper}>
      <div className={styles.headerRow}>
        <div>
          <h1 className={styles.title}>Élèves</h1>
          <p className={styles.subtitle}>{eleves.length} élève(s) inscrit(s)</p>
        </div>
        <button className={styles.addButton} onClick={() => setModalOuvert(true)}>
          <Plus size={16} /> Ajouter un élève
        </button>
      </div>

      <div className={styles.filtersRow}>
        <div className={styles.searchBar}>
          <Search size={16} color="var(--color-text-dim)" />
          <input
            type="text"
            placeholder="Rechercher par nom, prénom ou matricule..."
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
          />
        </div>

        <select
          className={styles.classeSelect}
          value={classeFiltre}
          onChange={(e) => setClasseFiltre(e.target.value)}
        >
          <option value="">Toutes les classes</option>
          {classes.map((c) => (
            <option key={c.id} value={c.nom}>{c.nom}</option>
          ))}
        </select>
      </div>

      {loading && <p className={styles.stateMsg}>Chargement...</p>}
      {error && <p className={styles.errorMsg}>{error}</p>}

      {!loading && !error && elevesFiltres.length === 0 && (
        <div className={styles.emptyState}>
          <GraduationCap size={40} color="var(--color-text-dim)" />
          <p>Aucun élève trouvé.</p>
        </div>
      )}

      {!loading && !error && elevesFiltres.length > 0 && (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Matricule</th>
                <th>Nom</th>
                <th>Prénom</th>
                <th>Classe</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              {elevesFiltres.map((eleve) => (
                <tr
                  key={eleve.id}
                  className={styles.clickableRow}
                  onClick={() => navigate(`/dashboardAdmin/eleves/${eleve.id}`)}
                >
                  <td data-label="Matricule">{eleve.matricule}</td>
                  <td data-label="Nom">{eleve.nom}</td>
                  <td data-label="Prénom">{eleve.prenom}</td>
                  <td data-label="Classe">{eleve.classe_actuelle_nom || '—'}</td>
                  <td data-label="Statut">
                    <span className={`${styles.badge} ${styles['badge_' + eleve.statut]}`}>
                      {eleve.statut}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalOuvert && (
        <AjouterEleveModal
          onClose={() => setModalOuvert(false)}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  );
};

export default Eleves;
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, GraduationCap } from 'lucide-react';
import api from '../../services/api.js';
import CONFIG from '../../config/config.js';
import BoutonRetour from '../../components/BoutonRetour/BoutonRetour.jsx';
import Pagination from '../../components/Pagination/Pagination.jsx';
import usePagination from '../../hooks/usePagination.js';
import { operationsEnAttente } from '../../offline/file.js';
import AjouterEleveModal from './AjouterEleveModal.jsx';
import styles from '../../theme/pages/admin/Eleves.module.css';

const Eleves = () => {
  const navigate = useNavigate();
  const [eleves, setEleves] = useState([]);
  const [classes, setClasses] = useState([]);
  const [enAttente, setEnAttente] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [recherche, setRecherche] = useState('');
  const [classeFiltre, setClasseFiltre] = useState('');
  const [modalOuvert, setModalOuvert] = useState(false);

  const chargerDonnees = useCallback(async (silencieux = false) => {
    if (!silencieux) setLoading(true);
    try {
      const [resEleves, resClasses] = await Promise.all([
        api.get(CONFIG.API_ELEVES),
        api.get(CONFIG.API_CLASSES),
      ]);
      setEleves(resEleves.data);
      setClasses(resClasses.data);
      setError('');
    } catch {
      setError("Impossible de charger la liste des élèves.");
    } finally {
      setLoading(false);
    }
    setEnAttente(await operationsEnAttente('eleve'));
  }, []);

  useEffect(() => {
    chargerDonnees();
  }, [chargerDonnees]);

  // Quand la file change (saisie ou fin de synchronisation), on met la liste à jour.
  useEffect(() => {
    const maj = () => chargerDonnees(true);
    window.addEventListener('sylium:file-changee', maj);
    return () => window.removeEventListener('sylium:file-changee', maj);
  }, [chargerDonnees]);

  const handleSuccess = (resultat) => {
    setModalOuvert(false);
    if (resultat?.enAttente) {
      setInfo("Élève enregistré sur cet appareil. Il sera créé automatiquement au retour du réseau.");
    } else {
      setInfo('');
    }
    chargerDonnees();
  };

  const nomClasse = (id) => classes.find((c) => c.id === id)?.nom || '—';

  const correspond = (texte, classeNom) =>
    texte.toLowerCase().includes(recherche.toLowerCase()) && (!classeFiltre || classeNom === classeFiltre);

  const elevesFiltres = eleves.filter((e) =>
    correspond(`${e.nom} ${e.prenom} ${e.matricule}`, e.classe_actuelle_nom)
  );

  const attenteFiltres = enAttente.filter((o) =>
    correspond(`${o.nom} ${o.prenom}`, o.classe ? nomClasse(o.classe) : '')
  );

  const pagination = usePagination(elevesFiltres, 25, `${recherche}|${classeFiltre}`);

  const aDesLignes = elevesFiltres.length > 0 || attenteFiltres.length > 0;

  return (
    <div className={styles.wrapper}>
      <BoutonRetour vers="/dashboardAdmin" />

      <div className={styles.headerRow}>
        <div>
          <h1 className={styles.title}>Élèves</h1>
          <p className={styles.subtitle}>
            {eleves.length} élève(s) inscrit(s)
            {enAttente.length > 0 && ` · ${enAttente.length} en attente d'envoi`}
          </p>
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

      {info && <p className={styles.stateMsg}>{info}</p>}
      {loading && <p className={styles.stateMsg}>Chargement...</p>}
      {error && <p className={styles.errorMsg}>{error}</p>}

      {!loading && !error && !aDesLignes && (
        <div className={styles.emptyState}>
          <GraduationCap size={40} color="var(--color-text-dim)" />
          <p>Aucun élève trouvé.</p>
        </div>
      )}

      {!loading && aDesLignes && (
        <>
          <div className={styles.tableWrapper}>
            <table className={`${styles.table} stack`}>
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
                {attenteFiltres.map((o) => (
                  <tr key={o.reference}>
                    <td data-label="Matricule">Attribué à l'envoi</td>
                    <td data-label="Nom">{o.nom}</td>
                    <td data-label="Prénom">{o.prenom}</td>
                    <td data-label="Classe">{o.classe ? nomClasse(o.classe) : '—'}</td>
                    <td data-label="Statut">
                      <span
                        className={styles.badge}
                        style={{ background: '#fef3c7', color: '#92400e' }}
                      >
                        En attente
                      </span>
                    </td>
                  </tr>
                ))}
                {pagination.pageItems.map((eleve) => (
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
          {elevesFiltres.length > 0 && <Pagination {...pagination} unite="élèves" />}
        </>
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
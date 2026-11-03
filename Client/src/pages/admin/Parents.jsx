import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, Phone, Mail, Users, X } from 'lucide-react';
import api from '../../services/api.js';
import CONFIG from '../../config/config.js';
import BoutonRetour from '../../components/BoutonRetour/BoutonRetour.jsx';
import Pagination from '../../components/Pagination/Pagination.jsx';
import usePagination from '../../hooks/usePagination.js';
import AjouterParentModal from './AjouterParentModal.jsx';
import styles from '../../theme/pages/admin/Parents.module.css';
import listes from '../../theme/pages/admin/Listes.module.css';

const norm = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const comparer = (a, b) =>
  String(a || '').localeCompare(String(b || ''), 'fr', { numeric: true, sensitivity: 'base' });
const chiffres = (s) => String(s || '').replace(/\D/g, '');

const TRIS = {
  nom: { label: 'Nom (A → Z)', fn: (a, b) => comparer(a.nom, b.nom) || comparer(a.prenom, b.prenom) },
  prenom: { label: 'Prénom (A → Z)', fn: (a, b) => comparer(a.prenom, b.prenom) || comparer(a.nom, b.nom) },
  recents: { label: 'Plus récents', fn: (a, b) => comparer(b.date_creation, a.date_creation) },
};

const Parents = () => {
  const navigate = useNavigate();
  const [parents, setParents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [recherche, setRecherche] = useState('');
  const [tri, setTri] = useState('nom');
  const [modalOuvert, setModalOuvert] = useState(false);

  const chargerParents = async () => {
    setLoading(true);
    try {
      const res = await api.get(CONFIG.API_PARENTS);
      setParents(res.data);
      setError('');
    } catch {
      setError("Impossible de charger la liste des parents.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    chargerParents();
  }, []);

  const handleSuccess = () => {
    setModalOuvert(false);
    chargerParents();
  };

  const q = norm(recherche.trim());
  const qNum = chiffres(recherche);

  const parentsFiltres = parents
    .filter(
      (p) =>
        !q ||
        norm(`${p.nom} ${p.prenom} ${p.email || ''}`).includes(q) ||
        norm(p.telephone).includes(q) ||
        (qNum.length >= 3 && chiffres(p.telephone).includes(qNum))
    )
    .sort(TRIS[tri].fn);

  const pagination = usePagination(parentsFiltres, 24, `${recherche}|${tri}`);

  return (
    <div className={styles.wrapper}>
      <BoutonRetour vers="/dashboardAdmin" />

      <div className={styles.headerRow}>
        <div>
          <h1 className={styles.title}>Parents</h1>
          <p className={styles.subtitle}>{parents.length} parent(s) enregistré(s)</p>
        </div>
        <button className={styles.addButton} onClick={() => setModalOuvert(true)}>
          <Plus size={16} /> Ajouter un parent
        </button>
      </div>

      <div className={listes.barre}>
        <div className={listes.recherche}>
          <Search size={16} color="var(--color-text-dim)" />
          <input
            type="text"
            placeholder="Rechercher par nom, prénom, e-mail ou téléphone..."
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
          />
        </div>

        <select
          className={listes.select}
          value={tri}
          onChange={(e) => setTri(e.target.value)}
          aria-label="Trier les parents"
        >
          {Object.entries(TRIS).map(([cle, t]) => (
            <option key={cle} value={cle}>{t.label}</option>
          ))}
        </select>

        {recherche && (
          <button type="button" className={listes.effacer} onClick={() => setRecherche('')}>
            <X size={14} /> Effacer
          </button>
        )}
      </div>

      {loading && <p className={styles.stateMsg}>Chargement...</p>}
      {error && <p className={styles.errorMsg}>{error}</p>}

      {!loading && !error && parentsFiltres.length === 0 && (
        <div className={styles.emptyState}>
          <Users size={40} color="var(--color-text-dim)" />
          <p>Aucun parent trouvé.</p>
        </div>
      )}

      {!loading && !error && parentsFiltres.length > 0 && (
        <>
          <p className={listes.compteur}>
            {parentsFiltres.length}
            {parentsFiltres.length !== parents.length ? ` sur ${parents.length}` : ''} parent(s) affiché(s)
          </p>
          <div className={styles.grid}>
            {pagination.pageItems.map((parent) => (
              <div
                key={parent.id}
                className={styles.card}
                onClick={() => navigate(`/dashboardAdmin/parents/${parent.id}`)}
              >
                <div className={styles.avatar}>{parent.prenom?.[0]}{parent.nom?.[0]}</div>
                <div className={styles.info}>
                  <h3 className={styles.name}>{parent.prenom} {parent.nom}</h3>
                  <div className={styles.contactLine}>
                    <Phone size={12} /> {parent.telephone}
                  </div>
                  {parent.email && (
                    <div className={styles.contactLine}>
                      <Mail size={12} /> {parent.email}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          <Pagination {...pagination} unite="parents" />
        </>
      )}

      {modalOuvert && (
        <AjouterParentModal onClose={() => setModalOuvert(false)} onSuccess={handleSuccess} />
      )}
    </div>
  );
};

export default Parents;
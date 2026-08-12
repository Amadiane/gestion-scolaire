// src/pages/admin/Parents.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, Phone, Mail, Users } from 'lucide-react';
import api from '../../services/api.js';
import CONFIG from '../../config/config.js';
import AjouterParentModal from './AjouterParentModal.jsx';
import styles from '../../theme/pages/admin/Parents.module.css';

const Parents = () => {
  const navigate = useNavigate();
  const [parents, setParents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [recherche, setRecherche] = useState('');
  const [modalOuvert, setModalOuvert] = useState(false);

  const chargerParents = async () => {
    setLoading(true);
    try {
      const res = await api.get(CONFIG.API_PARENTS);
      setParents(res.data);
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

  const parentsFiltres = parents.filter((p) =>
    `${p.nom} ${p.prenom} ${p.telephone}`.toLowerCase().includes(recherche.toLowerCase())
  );

  return (
    <div className={styles.wrapper}>
      <div className={styles.headerRow}>
        <div>
          <h1 className={styles.title}>Parents</h1>
          <p className={styles.subtitle}>{parents.length} parent(s) enregistré(s)</p>
        </div>
        <button className={styles.addButton} onClick={() => setModalOuvert(true)}>
          <Plus size={16} /> Ajouter un parent
        </button>
      </div>

      <div className={styles.searchBar}>
        <Search size={16} color="var(--color-text-dim)" />
        <input
          type="text"
          placeholder="Rechercher par nom, prénom ou téléphone..."
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
        />
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
        <div className={styles.grid}>
          {parentsFiltres.map((parent) => (
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
      )}

      {modalOuvert && (
        <AjouterParentModal onClose={() => setModalOuvert(false)} onSuccess={handleSuccess} />
      )}
    </div>
  );
};

export default Parents;
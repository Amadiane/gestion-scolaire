import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Download, CheckCircle, Search } from 'lucide-react';
import api from '../../services/api.js';
import CONFIG from '../../config/config.js';
import BoutonRetour from '../../components/BoutonRetour/BoutonRetour.jsx';
import Pagination from '../../components/Pagination/Pagination.jsx';
import usePagination from '../../hooks/usePagination.js';
import styles from '../../theme/pages/admin/Bulletins.module.css';

const TRIMESTRE_LABEL = { t1: '1er trimestre', t2: '2ème trimestre', t3: '3ème trimestre' };

const Bulletins = () => {
  const navigate = useNavigate();
  const [bulletins, setBulletins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState(null);
  const [recherche, setRecherche] = useState('');
  const [periode, setPeriode] = useState('');

  const charger = async () => {
    setLoading(true);
    try {
      const res = await api.get(CONFIG.API_BULLETINS);
      setBulletins(res.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    charger();
  }, []);

  const handleValider = async (bulletin) => {
    setActionId(bulletin.id);
    try {
      await api.post(CONFIG.API_BULLETIN_VALIDER(bulletin.id));
      charger();
    } catch (err) {
      alert(err.response?.status === 403
        ? 'Seul le directeur peut valider un bulletin.'
        : 'Impossible de valider ce bulletin.');
    } finally {
      setActionId(null);
    }
  };

  const handleTelecharger = async (bulletin) => {
    setActionId(bulletin.id);
    try {
      const resUrl = await api.get(CONFIG.API_BULLETIN_TELECHARGER(bulletin.id));
      const response = await fetch(resUrl.data.url);
      if (!response.ok) throw new Error();
      const blob = await response.blob();
      const nomEleve = bulletin.eleve_nom.replace(/\s+/g, '_');
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `bulletin_${nomEleve}_${bulletin.trimestre.toUpperCase()}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch {
      alert('Impossible de télécharger ce bulletin.');
    } finally {
      setActionId(null);
    }
  };

  const bulletinsFiltres = bulletins.filter((b) => {
    const matchTexte = `${b.eleve_nom} ${b.classe_nom}`.toLowerCase().includes(recherche.toLowerCase());
    const matchPeriode = !periode || b.trimestre === periode;
    return matchTexte && matchPeriode;
  });

  const pagination = usePagination(bulletinsFiltres, 25, `${recherche}|${periode}`);

  return (
    <div className={styles.wrapper}>
      <BoutonRetour vers="/dashboardAdmin" />

      <h1 className={styles.title}>Bulletins</h1>
      <p className={styles.subtitle}>{bulletins.length} bulletin(s)</p>

      {!loading && bulletins.length > 0 && (
        <div className={styles.filtersRow}>
          <div className={styles.searchBar}>
            <Search size={16} color="var(--color-text-dim)" />
            <input
              type="text"
              placeholder="Rechercher par élève ou classe..."
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
            />
          </div>
          <select className={styles.periodeSelect} value={periode} onChange={(e) => setPeriode(e.target.value)}>
            <option value="">Toutes les périodes</option>
            {Object.entries(TRIMESTRE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
      )}

      {loading && <p className={styles.stateMsg}>Chargement...</p>}

      {!loading && bulletins.length === 0 && (
        <div className={styles.emptyState}>
          <FileText size={40} color="var(--color-text-dim)" />
          <p>Aucun bulletin pour le moment. Créez d'abord des notes, puis un bulletin depuis la fiche élève.</p>
        </div>
      )}

      {!loading && bulletins.length > 0 && bulletinsFiltres.length === 0 && (
        <div className={styles.emptyState}><p>Aucun bulletin ne correspond à ces critères.</p></div>
      )}

      {!loading && bulletinsFiltres.length > 0 && (
        <>
          <div className={styles.tableWrapper}>
            <table className={`${styles.table} stack`}>
              <thead>
                <tr>
                  <th>Élève</th>
                  <th>Classe</th>
                  <th>Période</th>
                  <th>Moyenne</th>
                  <th>Rang</th>
                  <th>Statut</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pagination.pageItems.map((b) => (
                  <tr key={b.id}>
                    <td
                      data-label="Élève"
                      className={styles.clickable}
                      onClick={() => navigate(`/dashboardAdmin/eleves/${b.eleve}`)}
                    >
                      {b.eleve_nom}
                    </td>
                    <td data-label="Classe">{b.classe_nom}</td>
                    <td data-label="Période">{TRIMESTRE_LABEL[b.trimestre]}</td>
                    <td data-label="Moyenne">
                      {b.moyenne_generale != null ? `${b.moyenne_generale}/${b.bareme ?? 20}` : '—'}
                    </td>
                    <td data-label="Rang">{b.rang || '—'}</td>
                    <td data-label="Statut">
                      <span className={`${styles.badge} ${styles['badge_' + b.statut]}`}>{b.statut}</span>
                    </td>
                    <td data-label="Actions" className={styles.actionsCell}>
                      {b.statut === 'brouillon' && (
                        <button
                          className={styles.iconButton}
                          onClick={() => handleValider(b)}
                          disabled={actionId === b.id}
                          title="Valider"
                        >
                          <CheckCircle size={15} />
                        </button>
                      )}
                      <button
                        className={styles.iconButton}
                        onClick={() => handleTelecharger(b)}
                        disabled={actionId === b.id}
                        title="Télécharger le PDF"
                      >
                        <Download size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination {...pagination} unite="bulletins" />
        </>
      )}
    </div>
  );
};

export default Bulletins;
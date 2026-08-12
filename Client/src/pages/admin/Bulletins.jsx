import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Download, CheckCircle } from 'lucide-react';
import api from '../../services/api.js';
import CONFIG from '../../config/config.js';
import styles from '../../theme/pages/admin/Bulletins.module.css';

const TRIMESTRE_LABEL = { t1: '1er trimestre', t2: '2ème trimestre', t3: '3ème trimestre' };

const Bulletins = () => {
  const navigate = useNavigate();
  const [bulletins, setBulletins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState(null);

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

  return (
    <div className={styles.wrapper}>
      <h1 className={styles.title}>Bulletins</h1>
      <p className={styles.subtitle}>{bulletins.length} bulletin(s)</p>

      {loading && <p className={styles.stateMsg}>Chargement...</p>}

      {!loading && bulletins.length === 0 && (
        <div className={styles.emptyState}>
          <FileText size={40} color="var(--color-text-dim)" />
          <p>Aucun bulletin pour le moment. Créez d'abord des notes, puis un bulletin depuis la fiche élève.</p>
        </div>
      )}

      {!loading && bulletins.length > 0 && (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
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
              {bulletins.map((b) => (
                <tr key={b.id}>
                  <td className={styles.clickable} onClick={() => navigate(`/dashboardAdmin/eleves/${b.eleve}`)}>
                    {b.eleve_nom}
                  </td>
                  <td>{b.classe_nom}</td>
                  <td>{TRIMESTRE_LABEL[b.trimestre]}</td>
                  <td>{b.moyenne_generale != null ? `${b.moyenne_generale}` : '—'}</td>
                  <td>{b.rang || '—'}</td>
                  <td>
                    <span className={`${styles.badge} ${styles['badge_' + b.statut]}`}>{b.statut}</span>
                  </td>
                  <td className={styles.actionsCell}>
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
      )}
    </div>
  );
};

export default Bulletins;
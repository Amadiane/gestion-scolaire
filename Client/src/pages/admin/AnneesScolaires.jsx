// src/pages/admin/AnneesScolaires.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Calendar, CheckCircle2, Trash2, X } from 'lucide-react';
import api from '../../services/api.js';
import CONFIG from '../../config/config.js';
import styles from '../../theme/pages/admin/AnneesScolaires.module.css';

const AnneesScolaires = () => {
  const navigate = useNavigate();
  const [annees, setAnnees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOuvert, setModalOuvert] = useState(false);
  const [form, setForm] = useState({ nom: '', date_debut: '', date_fin: '' });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [actionId, setActionId] = useState(null);

  const charger = async () => {
    setLoading(true);
    try {
      const res = await api.get(CONFIG.API_ANNEES_SCOLAIRES);
      setAnnees(res.data);
    } catch {
      setError("Impossible de charger les années scolaires.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    charger();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      await api.post(CONFIG.API_ANNEES_SCOLAIRES, { ...form, est_active: false });
      setModalOuvert(false);
      setForm({ nom: '', date_debut: '', date_fin: '' });
      charger();
    } catch (err) {
      const messages = err.response?.data;
      if (messages && typeof messages === 'object') {
        const premierMessage = Object.values(messages)[0];
        setFormError(Array.isArray(premierMessage) ? premierMessage[0] : String(premierMessage));
      } else {
        setFormError("Erreur lors de la création.");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleActiver = async (annee) => {
    setActionId(annee.id);
    try {
      // Le modèle Django désactive automatiquement les autres années
      // de la même école dès qu'on marque celle-ci active — on envoie
      // juste le champ, la logique est déjà posée dans AnneeScolaire.save().
      await api.patch(`${CONFIG.API_ANNEES_SCOLAIRES}${annee.id}/`, { est_active: true });
      charger();
    } catch {
      alert("Impossible d'activer cette année scolaire.");
    } finally {
      setActionId(null);
    }
  };

  const handleSupprimer = async (annee) => {
    if (!window.confirm(`Supprimer l'année "${annee.nom}" ? Cette action est irréversible.`)) return;
    setActionId(annee.id);
    try {
      await api.delete(`${CONFIG.API_ANNEES_SCOLAIRES}${annee.id}/`);
      charger();
    } catch (err) {
      const message = err.response?.data?.detail || err.response?.data?.[0]
        || "Impossible de supprimer cette année scolaire.";
      alert(message);
    } finally {
      setActionId(null);
    }
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.headerRow}>
        <div>
          <h1 className={styles.title}>Années scolaires</h1>
          <p className={styles.subtitle}>{annees.length} année(s) enregistrée(s)</p>
        </div>
        <button className={styles.addButton} onClick={() => setModalOuvert(true)}>
          <Plus size={16} /> Nouvelle année
        </button>
      </div>

      {loading && <p className={styles.stateMsg}>Chargement...</p>}
      {error && <p className={styles.errorMsg}>{error}</p>}

      {!loading && !error && annees.length === 0 && (
        <div className={styles.emptyState}>
          <Calendar size={40} color="var(--color-text-dim)" />
          <p>Aucune année scolaire créée pour le moment.</p>
        </div>
      )}

      {!loading && !error && annees.length > 0 && (
        <div className={styles.list}>
          {annees.map((annee) => (
            <div
              key={annee.id}
              className={styles.row}
              onClick={() => navigate(`/dashboardAdmin/annees-scolaires/${annee.id}`)}
            >
              <div className={styles.rowInfo}>
                <span className={styles.rowNom}>{annee.nom}</span>
                <span className={styles.rowDates}>
                  {annee.date_debut} → {annee.date_fin}
                </span>
              </div>

              {annee.est_active ? (
                <span className={styles.activeBadge}>
                  <CheckCircle2 size={14} /> Active
                </span>
              ) : (
                <button
                  className={styles.activerButton}
                  onClick={(e) => { e.stopPropagation(); handleActiver(annee); }}
                  disabled={actionId === annee.id}
                >
                  Activer
                </button>
              )}

              <button
                className={styles.deleteButton}
                onClick={(e) => { e.stopPropagation(); handleSupprimer(annee); }}
                disabled={actionId === annee.id}
                title="Supprimer"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      )}

      {modalOuvert && (
        <div className={styles.overlay} onClick={() => setModalOuvert(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>Nouvelle année scolaire</h2>
              <button className={styles.closeButton} onClick={() => setModalOuvert(false)}>
                <X size={20} />
              </button>
            </div>

            {formError && <div className={styles.errorBox}>{formError}</div>}

            <form onSubmit={handleSubmit} className={styles.form}>
              <div className={styles.field}>
                <label>Nom * (ex: 2027-2028)</label>
                <input name="nom" value={form.nom} onChange={handleChange} required placeholder="2027-2028" />
              </div>
              <div className={styles.field}>
                <label>Date de début *</label>
                <input type="date" name="date_debut" value={form.date_debut} onChange={handleChange} required />
              </div>
              <div className={styles.field}>
                <label>Date de fin *</label>
                <input type="date" name="date_fin" value={form.date_fin} onChange={handleChange} required />
              </div>

              <div className={styles.modalActions}>
                <button type="button" className={styles.cancelButton} onClick={() => setModalOuvert(false)}>
                  Annuler
                </button>
                <button type="submit" className={styles.submitButton} disabled={saving}>
                  {saving ? 'Création...' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnneesScolaires;
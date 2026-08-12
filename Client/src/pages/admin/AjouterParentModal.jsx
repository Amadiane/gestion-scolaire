import { useState } from 'react';
import { X } from 'lucide-react';
import api from '../../services/api.js';
import CONFIG from '../../config/config.js';
import styles from '../../theme/pages/admin/AjouterParentModal.module.css';

const AjouterParentModal = ({ onClose, onSuccess }) => {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ nom: '', prenom: '', telephone: '', email: '', adresse: '' });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.post(CONFIG.API_PARENTS, form);
      onSuccess();
    } catch (err) {
      const messages = err.response?.data;
      if (messages && typeof messages === 'object') {
        const premierMessage = Object.values(messages)[0];
        setError(Array.isArray(premierMessage) ? premierMessage[0] : String(premierMessage));
      } else {
        setError("Erreur lors de la création du parent.");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>Ajouter un parent</h2>
          <button className={styles.closeButton} onClick={onClose} aria-label="Fermer">
            <X size={20} />
          </button>
        </div>

        {error && <div className={styles.errorBox}>{error}</div>}

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.row}>
            <div className={styles.field}>
              <label>Nom *</label>
              <input name="nom" value={form.nom} onChange={handleChange} required />
            </div>
            <div className={styles.field}>
              <label>Prénom *</label>
              <input name="prenom" value={form.prenom} onChange={handleChange} required />
            </div>
          </div>

          <div className={styles.field}>
            <label>Téléphone *</label>
            <input name="telephone" value={form.telephone} onChange={handleChange} required />
          </div>

          <div className={styles.field}>
            <label>Email</label>
            <input type="email" name="email" value={form.email} onChange={handleChange} />
          </div>

          <div className={styles.field}>
            <label>Adresse</label>
            <input name="adresse" value={form.adresse} onChange={handleChange} />
          </div>

          <div className={styles.actions}>
            <button type="button" className={styles.cancelButton} onClick={onClose}>Annuler</button>
            <button type="submit" className={styles.submitButton} disabled={saving}>
              {saving ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AjouterParentModal;
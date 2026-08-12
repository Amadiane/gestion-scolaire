import { useState } from 'react';
import { X } from 'lucide-react';
import api from '../../services/api.js';
import CONFIG from '../../config/config.js';
import styles from '../../theme/pages/admin/AjouterUtilisateurModal.module.css';

const ROLES = [
  { value: 'directeur', label: 'Directeur' },
  { value: 'surveillant', label: 'Surveillant général' },
  { value: 'comptable', label: 'Comptable' },
  { value: 'secretaire', label: 'Secrétaire' },
  { value: 'enseignant', label: 'Enseignant' },
];

const AjouterUtilisateurModal = ({ onClose, onSuccess }) => {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    username: '', first_name: '', last_name: '', email: '',
    telephone: '', role: 'enseignant', password: '',
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.post(CONFIG.API_UTILISATEURS, form);
      onSuccess();
    } catch (err) {
      const messages = err.response?.data;
      if (messages && typeof messages === 'object') {
        const premierMessage = Object.values(messages)[0];
        setError(Array.isArray(premierMessage) ? premierMessage[0] : String(premierMessage));
      } else {
        setError("Erreur lors de la création de l'utilisateur.");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>Ajouter un utilisateur</h2>
          <button className={styles.closeButton} onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {error && <div className={styles.errorBox}>{error}</div>}

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <label>Identifiant de connexion *</label>
            <input name="username" value={form.username} onChange={handleChange} required />
          </div>

          <div className={styles.row}>
            <div className={styles.field}>
              <label>Nom *</label>
              <input name="last_name" value={form.last_name} onChange={handleChange} required />
            </div>
            <div className={styles.field}>
              <label>Prénom *</label>
              <input name="first_name" value={form.first_name} onChange={handleChange} required />
            </div>
          </div>

          <div className={styles.field}>
            <label>Rôle *</label>
            <select name="role" value={form.role} onChange={handleChange} required>
              {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>

          <div className={styles.field}>
            <label>Téléphone</label>
            <input name="telephone" value={form.telephone} onChange={handleChange} />
          </div>

          <div className={styles.field}>
            <label>Email</label>
            <input type="email" name="email" value={form.email} onChange={handleChange} />
          </div>

          <div className={styles.field}>
            <label>Mot de passe * (6 caractères minimum)</label>
            <input type="password" name="password" value={form.password} onChange={handleChange} required minLength={6} />
          </div>

          <div className={styles.actions}>
            <button type="button" className={styles.cancelButton} onClick={onClose}>Annuler</button>
            <button type="submit" className={styles.submitButton} disabled={saving}>
              {saving ? 'Création...' : 'Créer le compte'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AjouterUtilisateurModal;
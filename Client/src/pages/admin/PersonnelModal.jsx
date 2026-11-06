import { useState, useEffect } from 'react';
import { X, Camera, WifiOff, Trash2 } from 'lucide-react';
import api from '../../services/api.js';
import CONFIG from '../../config/config.js';
import useOnlineStatus from '../../hooks/useOnlineStatus';
import FenetreConfirmation from '../../components/FenetresCompte/FenetreConfirmation.jsx';
import { POSTES, STATUTS } from './personnelUtils.js';
import styles from '../../theme/pages/admin/AjouterEleveModal.module.css';

const PersonnelModal = ({ membre, personnel, onClose, onSuccess }) => {
  const enLigne = useOnlineStatus();
  const edition = Boolean(membre);

  const [form, setForm] = useState({
    nom: membre?.nom || '',
    prenom: membre?.prenom || '',
    sexe: membre?.sexe || 'M',
    date_naissance: membre?.date_naissance || '',
    telephone: membre?.telephone || '',
    email: membre?.email || '',
    adresse: membre?.adresse || '',
    poste: membre?.poste || 'enseignant',
    fonction: membre?.fonction || '',
    date_embauche: membre?.date_embauche || '',
    statut: membre?.statut || 'actif',
    utilisateur: membre?.utilisateur || '',
  });
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(membre?.photo || null);
  const [utilisateurs, setUtilisateurs] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [confirmerSuppression, setConfirmerSuppression] = useState(false);

  // Comptes que l'on peut lier : actifs et pas déjà liés à une autre fiche.
  useEffect(() => {
    api.get(CONFIG.API_UTILISATEURS)
      .then((res) => setUtilisateurs(res.data))
      .catch(() => setUtilisateurs([]));
  }, []);

  const dejaLies = new Set(
    personnel.filter((p) => p.utilisateur && p.id !== membre?.id).map((p) => p.utilisateur)
  );
  const comptesDisponibles = utilisateurs.filter(
    (u) => (u.is_active && !dejaLies.has(u.id)) || u.id === membre?.utilisateur
  );

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handlePhoto = (e) => {
    const file = e.target.files[0];
    if (file) {
      setPhoto(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const messageErreur = (err, defaut) => {
    const data = err.response?.data;
    if (data && typeof data === 'object') {
      const premier = Object.values(data)[0];
      return Array.isArray(premier) ? premier[0] : String(premier);
    }
    return defaut;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving || !enLigne) return;
    setSaving(true);
    setError('');
    try {
      const data = new FormData();
      Object.entries(form).forEach(([cle, valeur]) => data.append(cle, valeur ?? ''));
      if (photo) data.append('photo', photo);

      const config = { headers: { 'Content-Type': 'multipart/form-data' } };
      if (edition) await api.patch(`${CONFIG.API_PERSONNEL}${membre.id}/`, data, config);
      else await api.post(CONFIG.API_PERSONNEL, data, config);
      onSuccess();
    } catch (err) {
      setError(messageErreur(err, "Impossible d'enregistrer cette fiche."));
    } finally {
      setSaving(false);
    }
  };

  const supprimer = async () => {
    setSaving(true);
    try {
      await api.delete(`${CONFIG.API_PERSONNEL}${membre.id}/`);
      onSuccess();
    } catch (err) {
      setConfirmerSuppression(false);
      setError(messageErreur(err, 'Impossible de supprimer cette fiche.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>{edition ? `Modifier ${membre.prenom} ${membre.nom}` : 'Ajouter un membre du personnel'}</h2>
          <button className={styles.closeButton} onClick={onClose} aria-label="Fermer">
            <X size={20} />
          </button>
        </div>

        {!enLigne && (
          <div className={styles.errorBox} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <WifiOff size={16} />
            <span>Une connexion internet est nécessaire pour enregistrer une fiche du personnel.</span>
          </div>
        )}
        {error && <div className={styles.errorBox}>{error}</div>}

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.photoSection}>
            <label htmlFor="photo-personnel" className={styles.photoUpload}>
              {photoPreview ? (
                <img src={photoPreview} alt="Aperçu" className={styles.photoPreview} />
              ) : (
                <div className={styles.photoPlaceholder}>
                  <Camera size={22} color="var(--color-text-dim)" />
                </div>
              )}
            </label>
            <input
              id="photo-personnel"
              type="file"
              accept="image/*"
              onChange={handlePhoto}
              className={styles.hiddenInput}
            />
            <span className={styles.photoHint}>Photo (optionnel, utile pour la carte)</span>
          </div>

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

          <div className={styles.row}>
            <div className={styles.field}>
              <label>Sexe *</label>
              <select name="sexe" value={form.sexe} onChange={handleChange} required>
                <option value="M">Masculin</option>
                <option value="F">Féminin</option>
              </select>
            </div>
            <div className={styles.field}>
              <label>Date de naissance</label>
              <input type="date" name="date_naissance" value={form.date_naissance} onChange={handleChange} />
            </div>
          </div>

          <div className={styles.row}>
            <div className={styles.field}>
              <label>Poste *</label>
              <select name="poste" value={form.poste} onChange={handleChange} required>
                {Object.entries(POSTES).map(([cle, label]) => (
                  <option key={cle} value={cle}>{label}</option>
                ))}
              </select>
            </div>
            <div className={styles.field}>
              <label>Fonction précise</label>
              <input
                name="fonction"
                value={form.fonction}
                onChange={handleChange}
                placeholder="Ex : Professeur de mathématiques"
              />
            </div>
          </div>

          <div className={styles.row}>
            <div className={styles.field}>
              <label>Téléphone</label>
              <input name="telephone" value={form.telephone} onChange={handleChange} />
            </div>
            <div className={styles.field}>
              <label>Email</label>
              <input type="email" name="email" value={form.email} onChange={handleChange} />
            </div>
          </div>

          <div className={styles.field}>
            <label>Adresse</label>
            <input name="adresse" value={form.adresse} onChange={handleChange} />
          </div>

          <div className={styles.row}>
            <div className={styles.field}>
              <label>Date d'embauche</label>
              <input type="date" name="date_embauche" value={form.date_embauche} onChange={handleChange} />
            </div>
            <div className={styles.field}>
              <label>Statut</label>
              <select name="statut" value={form.statut} onChange={handleChange}>
                {Object.entries(STATUTS).map(([cle, label]) => (
                  <option key={cle} value={cle}>{label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className={styles.field}>
            <label>Compte de connexion lié (optionnel)</label>
            <select name="utilisateur" value={form.utilisateur} onChange={handleChange}>
              <option value="">— Aucun compte —</option>
              {comptesDisponibles.map((u) => (
                <option key={u.id} value={u.id}>
                  {`${u.first_name} ${u.last_name}`.trim() || u.username} (@{u.username})
                </option>
              ))}
            </select>
          </div>

          <div className={styles.actions}>
            {edition && (
              <button
                type="button"
                className={styles.cancelButton}
                onClick={() => setConfirmerSuppression(true)}
                disabled={saving}
                title="Supprimer cette fiche"
              >
                <Trash2 size={14} />
              </button>
            )}
            <button type="button" className={styles.cancelButton} onClick={onClose}>Annuler</button>
            <button type="submit" className={styles.submitButton} disabled={saving || !enLigne}>
              {saving ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>

      {confirmerSuppression && (
        <FenetreConfirmation
          titre="Supprimer cette fiche ?"
          message={`La fiche de ${membre.prenom} ${membre.nom} sera supprimée définitivement. Son compte de connexion, s'il existe, n'est pas supprimé. Pour un départ, préférez le statut « Parti ».`}
          confirmer="Supprimer"
          danger
          enCours={saving}
          onConfirm={supprimer}
          onCancel={() => setConfirmerSuppression(false)}
        />
      )}
    </div>
  );
};

export default PersonnelModal;
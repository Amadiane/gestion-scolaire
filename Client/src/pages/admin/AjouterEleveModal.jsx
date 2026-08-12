import { useState, useEffect } from 'react';
import { X, User, Camera } from 'lucide-react';
import api from '../../services/api.js';
import CONFIG from '../../config/config.js';
import styles from '../../theme/pages/admin/AjouterEleveModal.module.css';

const AjouterEleveModal = ({ onClose, onSuccess }) => {
  const [classes, setClasses] = useState([]);
  const [anneeActive, setAnneeActive] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    nom: '', prenom: '', date_naissance: '', lieu_naissance: '',
    sexe: 'M', classe: '', photo: null,
  });

  useEffect(() => {
    const chargerDonnees = async () => {
      try {
        const [resClasses, resAnnees] = await Promise.all([
          api.get(CONFIG.API_CLASSES),
          api.get(CONFIG.API_ANNEES_SCOLAIRES),
        ]);
        setClasses(resClasses.data);
        const active = resAnnees.data.find((a) => a.est_active);
        setAnneeActive(active || null);
      } catch {
        setError("Impossible de charger les classes disponibles.");
      }
    };
    chargerDonnees();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setForm((prev) => ({ ...prev, photo: file }));
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      // multipart/form-data obligatoire car on envoie un fichier (photo)
      // en plus des champs texte — un simple JSON ne peut pas transporter
      // un fichier binaire.
      const data = new FormData();
      data.append('nom', form.nom);
      data.append('prenom', form.prenom);
      data.append('date_naissance', form.date_naissance);
      data.append('lieu_naissance', form.lieu_naissance);
      data.append('sexe', form.sexe);
      if (form.photo) data.append('photo', form.photo);

      const resEleve = await api.post(CONFIG.API_ELEVES, data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      // Si une classe a été choisie ET qu'une année active existe,
      // on crée l'Inscription juste après — deux appels séparés car
      // ce sont deux ressources distinctes côté backend (voir la
      // discussion précédente sur pourquoi Eleve n'a pas de champ
      // "classe" direct).
      if (form.classe && anneeActive) {
        await api.post(CONFIG.API_INSCRIPTIONS, {
          eleve: resEleve.data.id,
          classe: form.classe,
          annee_scolaire: anneeActive.id,
        });
      }

      onSuccess();
    } catch (err) {
      const messages = err.response?.data;
      if (messages && typeof messages === 'object') {
        const premierMessage = Object.values(messages)[0];
        setError(Array.isArray(premierMessage) ? premierMessage[0] : String(premierMessage));
      } else {
        setError("Erreur lors de la création de l'élève.");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>Ajouter un élève</h2>
          <button className={styles.closeButton} onClick={onClose} aria-label="Fermer">
            <X size={20} />
          </button>
        </div>

        {error && <div className={styles.errorBox}>{error}</div>}

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.photoSection}>
            <label htmlFor="photo-input" className={styles.photoUpload}>
              {photoPreview ? (
                <img src={photoPreview} alt="Aperçu" className={styles.photoPreview} />
              ) : (
                <div className={styles.photoPlaceholder}>
                  <Camera size={22} color="var(--color-text-dim)" />
                </div>
              )}
            </label>
            <input
              id="photo-input"
              type="file"
              accept="image/*"
              onChange={handlePhotoChange}
              className={styles.hiddenInput}
            />
            <span className={styles.photoHint}>Photo (optionnel)</span>
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
              <label>Date de naissance *</label>
              <input type="date" name="date_naissance" value={form.date_naissance} onChange={handleChange} required />
            </div>
            <div className={styles.field}>
              <label>Sexe *</label>
              <select name="sexe" value={form.sexe} onChange={handleChange} required>
                <option value="M">Masculin</option>
                <option value="F">Féminin</option>
              </select>
            </div>
          </div>

          <div className={styles.field}>
            <label>Lieu de naissance</label>
            <input name="lieu_naissance" value={form.lieu_naissance} onChange={handleChange} />
          </div>

          <div className={styles.field}>
            <label>Classe {!anneeActive && '(aucune année scolaire active définie)'}</label>
            <select name="classe" value={form.classe} onChange={handleChange} disabled={!anneeActive}>
              <option value="">— Non assigné —</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.nom}</option>
              ))}
            </select>
          </div>

          <div className={styles.actions}>
            <button type="button" className={styles.cancelButton} onClick={onClose}>
              Annuler
            </button>
            <button type="submit" className={styles.submitButton} disabled={saving}>
              {saving ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AjouterEleveModal;
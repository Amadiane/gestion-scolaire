// src/pages/admin/AjouterEleveModal.jsx
import { useState, useEffect } from 'react';
import { X, Camera, Plus, Trash2 } from 'lucide-react';
import api from '../../services/api.js';
import CONFIG from '../../config/config.js';
import styles from '../../theme/pages/admin/AjouterEleveModal.module.css';

const AjouterEleveModal = ({ onClose, onSuccess }) => {
  const [classes, setClasses] = useState([]);
  const [anneeActive, setAnneeActive] = useState(null);
  const [parentsDisponibles, setParentsDisponibles] = useState([]);
  const [liensParents, setLiensParents] = useState([]);
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
        const [resClasses, resAnnees, resParents] = await Promise.all([
          api.get(CONFIG.API_CLASSES),
          api.get(CONFIG.API_ANNEES_SCOLAIRES),
          api.get(CONFIG.API_PARENTS_CHOIX),
        ]);
        setClasses(resClasses.data);
        const active = resAnnees.data.find((a) => a.est_active);
        setAnneeActive(active || null);
        setParentsDisponibles(resParents.data);
      } catch {
        setError("Impossible de charger les données du formulaire.");
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

  const ajouterLienParent = () => {
    setLiensParents((prev) => [
      ...prev,
      {
        mode: 'existant', // 'existant' ou 'nouveau'
        parent: '',
        nouveauNom: '',
        nouveauPrenom: '',
        nouveauTelephone: '',
        type_lien: 'pere',
        contact_principal: prev.length === 0,
      },
    ]);
  };

  const modifierLienParent = (index, champ, valeur) => {
    setLiensParents((prev) => {
      const copie = [...prev];
      copie[index] = { ...copie[index], [champ]: valeur };
      return copie;
    });
  };

  const supprimerLienParent = (index) => {
    setLiensParents((prev) => prev.filter((_, i) => i !== index));
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
      // on crée l'Inscription juste après.
      if (form.classe && anneeActive) {
        await api.post(CONFIG.API_INSCRIPTIONS, {
          eleve: resEleve.data.id,
          classe: form.classe,
          annee_scolaire: anneeActive.id,
        });
      }

      // Pour chaque ligne "nouveau parent" : on le crée d'abord (POST
      // /api/parents/), puis on récupère son ID pour le lier — contrairement
      // à un parent "existant" où l'ID est déjà connu. Boucle séquentielle
      // (pas Promise.all) car chaque lien dépend de la création préalable
      // du parent correspondant.
      for (const lien of liensParents) {
        let parentId = lien.parent;

        if (lien.mode === 'nouveau') {
          if (!lien.nouveauNom || !lien.nouveauTelephone) continue; // ligne incomplète, ignorée
          const resParent = await api.post(CONFIG.API_PARENTS, {
            nom: lien.nouveauNom,
            prenom: lien.nouveauPrenom,
            telephone: lien.nouveauTelephone,
          });
          parentId = resParent.data.id;
        }

        if (!parentId) continue;

        await api.post(CONFIG.API_ELEVE_LIER_PARENT(resEleve.data.id), {
          parent: parentId,
          type_lien: lien.type_lien,
          contact_principal: lien.contact_principal,
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

          <div className={styles.parentsSection}>
            <div className={styles.parentsSectionHeader}>
              <label>Parents / Responsables</label>
              <button type="button" className={styles.addParentButton} onClick={ajouterLienParent}>
                <Plus size={14} /> Ajouter
              </button>
            </div>

            {liensParents.length === 0 && (
              <p className={styles.noParentMsg}>Aucun parent lié — optionnel, ajoutable plus tard.</p>
            )}

            {liensParents.map((lien, index) => (
              <div key={index} className={styles.parentRow}>
                <div className={styles.parentRowTop}>
                  <div className={styles.modeToggle}>
                    <button
                      type="button"
                      className={`${styles.modeButton} ${lien.mode === 'existant' ? styles.modeButtonActive : ''}`}
                      onClick={() => modifierLienParent(index, 'mode', 'existant')}
                    >
                      Existant
                    </button>
                    <button
                      type="button"
                      className={`${styles.modeButton} ${lien.mode === 'nouveau' ? styles.modeButtonActive : ''}`}
                      onClick={() => modifierLienParent(index, 'mode', 'nouveau')}
                    >
                      Nouveau
                    </button>
                  </div>
                  <button
                    type="button"
                    className={styles.removeParentButton}
                    onClick={() => supprimerLienParent(index)}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                {lien.mode === 'existant' ? (
                  <select
                    value={lien.parent}
                    onChange={(e) => modifierLienParent(index, 'parent', e.target.value)}
                    className={styles.parentSelect}
                  >
                    <option value="">— Choisir un parent —</option>
                    {parentsDisponibles.map((p) => (
                      <option key={p.id} value={p.id}>{p.prenom} {p.nom} ({p.telephone})</option>
                    ))}
                  </select>
                ) : (
                  <div className={styles.nouveauParentFields}>
                    <input
                      placeholder="Nom *"
                      value={lien.nouveauNom}
                      onChange={(e) => modifierLienParent(index, 'nouveauNom', e.target.value)}
                    />
                    <input
                      placeholder="Prénom"
                      value={lien.nouveauPrenom}
                      onChange={(e) => modifierLienParent(index, 'nouveauPrenom', e.target.value)}
                    />
                    <input
                      placeholder="Téléphone *"
                      value={lien.nouveauTelephone}
                      onChange={(e) => modifierLienParent(index, 'nouveauTelephone', e.target.value)}
                    />
                  </div>
                )}

                <div className={styles.parentRowBottom}>
                  <select
                    value={lien.type_lien}
                    onChange={(e) => modifierLienParent(index, 'type_lien', e.target.value)}
                    className={styles.typeLienSelect}
                  >
                    <option value="pere">Père</option>
                    <option value="mere">Mère</option>
                    <option value="tuteur">Tuteur</option>
                    <option value="autre">Autre</option>
                  </select>

                  <label className={styles.contactPrincipalLabel}>
                    <input
                      type="checkbox"
                      checked={lien.contact_principal}
                      onChange={(e) => modifierLienParent(index, 'contact_principal', e.target.checked)}
                    />
                    Contact principal
                  </label>
                </div>
              </div>
            ))}
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
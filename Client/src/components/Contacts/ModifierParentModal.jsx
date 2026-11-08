import { useState } from 'react';
import { X } from 'lucide-react';
import api from '../../services/api.js';
import CONFIG from '../../config/config.js';
import styles from '../../theme/components/Contacts.module.css';

const baseParents = () => CONFIG.API_PARENTS.replace(/\/?$/, '/');

const ModifierParentModal = ({ parent, onClose, onSaved }) => {
  const [form, setForm] = useState({
    prenom: parent.prenom || '',
    nom: parent.nom || '',
    telephone: parent.telephone || '',
    telephone_secondaire: parent.telephone_secondaire || '',
    email: parent.email || '',
    adresse: parent.adresse || '',
  });
  const [erreur, setErreur] = useState('');
  const [envoi, setEnvoi] = useState(false);

  const maj = (champ) => (e) => setForm((f) => ({ ...f, [champ]: e.target.value }));

  const enregistrer = async (e) => {
    e.preventDefault();
    if (!form.prenom.trim() || !form.nom.trim() || !form.telephone.trim()) {
      setErreur('Le prénom, le nom et le téléphone sont obligatoires.');
      return;
    }
    setEnvoi(true);
    setErreur('');
    try {
      const res = await api.patch(`${baseParents()}${parent.id}/`, {
        prenom: form.prenom.trim(),
        nom: form.nom.trim(),
        telephone: form.telephone.trim(),
        telephone_secondaire: form.telephone_secondaire.trim(),
        email: form.email.trim() || null,
        adresse: form.adresse.trim(),
      });
      onSaved(res.data);
    } catch (err) {
      const d = err.response?.data;
      const premier = d && typeof d === 'object' ? Object.values(d)[0] : null;
      setErreur(
        (Array.isArray(premier) ? premier[0] : premier) || d?.detail ||
          "Impossible d'enregistrer. Vérifiez votre connexion."
      );
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <div className={styles.fond} onClick={onClose}>
      <form className={styles.fenetre} onClick={(e) => e.stopPropagation()} onSubmit={enregistrer}>
        <div className={styles.fenetreTitre}>
          <h3>Modifier le parent</h3>
          <button type="button" className={styles.fermer} onClick={onClose} aria-label="Fermer">
            <X size={18} />
          </button>
        </div>

        {erreur && <div className={styles.erreur}>{erreur}</div>}

        <div className={styles.deux}>
          <label className={styles.champ}>Prénom
            <input value={form.prenom} onChange={maj('prenom')} />
          </label>
          <label className={styles.champ}>Nom
            <input value={form.nom} onChange={maj('nom')} />
          </label>
        </div>
        <div className={styles.deux}>
          <label className={styles.champ}>Téléphone principal
            <input type="tel" value={form.telephone} onChange={maj('telephone')} />
          </label>
          <label className={styles.champ}>Téléphone secondaire
            <input type="tel" value={form.telephone_secondaire} onChange={maj('telephone_secondaire')} />
          </label>
        </div>
        <label className={styles.champ}>E-mail (facultatif)
          <input type="email" value={form.email} onChange={maj('email')} />
        </label>
        <label className={styles.champ}>Adresse (facultatif)
          <input value={form.adresse} onChange={maj('adresse')} />
        </label>

        <div className={styles.pied}>
          <button type="button" className={styles.btn} onClick={onClose}>Annuler</button>
          <button type="submit" className={styles.btnPrimaire} disabled={envoi}>
            {envoi ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ModifierParentModal;
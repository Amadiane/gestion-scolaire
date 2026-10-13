import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import api from '../../services/api.js';
import CONFIG from '../../config/config.js';
import { MODES } from '../../utils/finance.js';
import styles from '../../theme/pages/admin/AjouterEleveModal.module.css';

const aujourdhui = () => new Date().toISOString().slice(0, 10);

const PaiementModal = ({ eleveInitial, onClose, onSuccess }) => {
  const [eleves, setEleves] = useState([]);
  const [recherche, setRecherche] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    eleve: eleveInitial?.id || '',
    montant: '',
    date_paiement: aujourdhui(),
    mode: 'especes',
    reference: '',
  });

  useEffect(() => {
    if (eleveInitial) return;
    api.get(CONFIG.API_ELEVES)
      .then((res) => setEleves(res.data))
      .catch(() => setError('Impossible de charger la liste des élèves.'));
  }, [eleveInitial]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const filtres = eleves
    .filter((e) => `${e.nom} ${e.prenom} ${e.matricule}`.toLowerCase().includes(recherche.toLowerCase()))
    .slice(0, 50);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const res = await api.post(CONFIG.API_PAIEMENTS, form);
      onSuccess(res.data);
    } catch (err) {
      const data = err.response?.data;
      if (data && typeof data === 'object') {
        const premier = Object.values(data)[0];
        setError(Array.isArray(premier) ? premier[0] : String(premier));
      } else {
        setError("Erreur lors de l'enregistrement du paiement.");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>Enregistrer un paiement</h2>
          <button className={styles.closeButton} onClick={onClose}><X size={20} /></button>
        </div>

        {error && <div className={styles.errorBox}>{error}</div>}

        <form onSubmit={handleSubmit} className={styles.form}>
          {eleveInitial ? (
            <div className={styles.field}>
              <label>Élève</label>
              <input value={eleveInitial.nom} disabled />
            </div>
          ) : (
            <>
              <div className={styles.field}>
                <label>Rechercher un élève</label>
                <input
                  placeholder="Nom, prénom ou matricule..."
                  value={recherche}
                  onChange={(e) => setRecherche(e.target.value)}
                />
              </div>
              <div className={styles.field}>
                <label>Élève *</label>
                <select name="eleve" value={form.eleve} onChange={handleChange} required>
                  <option value="">— Choisir —</option>
                  {filtres.map((el) => (
                    <option key={el.id} value={el.id}>
                      {el.prenom} {el.nom} ({el.matricule})
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          <div className={styles.row}>
            <div className={styles.field}>
              <label>Montant (GNF) *</label>
              <input type="number" name="montant" min="1" value={form.montant} onChange={handleChange} required />
            </div>
            <div className={styles.field}>
              <label>Date *</label>
              <input type="date" name="date_paiement" value={form.date_paiement} onChange={handleChange} required />
            </div>
          </div>

          <div className={styles.row}>
            <div className={styles.field}>
              <label>Mode *</label>
              <select name="mode" value={form.mode} onChange={handleChange}>
                {Object.entries(MODES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div className={styles.field}>
              <label>Référence</label>
              <input name="reference" value={form.reference} onChange={handleChange} placeholder="N° transaction" />
            </div>
          </div>

          <div className={styles.actions}>
            <button type="button" className={styles.cancelButton} onClick={onClose}>Annuler</button>
            <button type="submit" className={styles.submitButton} disabled={saving}>
              {saving ? 'Enregistrement...' : 'Enregistrer et éditer le reçu'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PaiementModal;
import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, ClipboardList, AlertTriangle } from 'lucide-react';
import api from '../../services/api.js';
import CONFIG from '../../config/config.js';
import BoutonRetour from '../../components/BoutonRetour/BoutonRetour.jsx';
import styles from '../../theme/pages/admin/Affectations.module.css';

const Affectations = () => {
  const [affectations, setAffectations] = useState([]);
  const [enseignants, setEnseignants] = useState([]);
  const [classes, setClasses] = useState([]);
  const [matieres, setMatieres] = useState([]);
  const [form, setForm] = useState({ enseignant: '', classe: '', matiere: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');

  const charger = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [a, u, c, m] = await Promise.all([
        api.get(CONFIG.API_AFFECTATIONS),
        api.get(CONFIG.API_UTILISATEURS),
        api.get(CONFIG.API_CLASSES),
        api.get(CONFIG.API_MATIERES),
      ]);
      setAffectations(a.data);
      setEnseignants(u.data.filter((x) => x.role === 'enseignant' && x.is_active));
      setClasses(c.data);
      setMatieres(m.data);
    } catch (err) {
      setError(
        err.response?.status === 403
          ? 'Seul un directeur peut gérer les affectations.'
          : "Impossible de charger les affectations."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { charger(); }, [charger]);

  const ajouter = async (e) => {
    e.preventDefault();
    setFormError('');
    try {
      await api.post(CONFIG.API_AFFECTATIONS, form);
      setForm({ ...form, matiere: '' });
      charger();
    } catch (err) {
      const data = err.response?.data;
      const premier = data && typeof data === 'object' ? Object.values(data)[0] : null;
      setFormError(Array.isArray(premier) ? premier[0] : "Impossible d'ajouter cette affectation.");
    }
  };

  const supprimer = async (a) => {
    if (!window.confirm(`Retirer ${a.matiere_nom} en ${a.classe_nom} à ${a.enseignant_nom} ?`)) return;
    try {
      await api.delete(`${CONFIG.API_AFFECTATIONS}${a.id}/`);
      charger();
    } catch {
      alert("Impossible de supprimer cette affectation.");
    }
  };

  const parEnseignant = affectations.reduce((acc, a) => {
    (acc[a.enseignant_nom] = acc[a.enseignant_nom] || []).push(a);
    return acc;
  }, {});

  return (
    <div className={styles.wrapper}>
      <BoutonRetour vers="/dashboardAdmin" />

      <h1 className={styles.title}>Affectations</h1>
      <p className={styles.subtitle}>
        Qui enseigne quelle matière, dans quelle classe. Un enseignant ne voit et ne note que ses affectations.
      </p>

      {error && <div className={styles.errorBanner}><AlertTriangle size={16} /> {error}</div>}
      {loading && <p className={styles.stateMsg}>Chargement...</p>}

      {!loading && !error && (
        <>
          <form className={styles.form} onSubmit={ajouter}>
            <select value={form.enseignant} onChange={(e) => setForm({ ...form, enseignant: e.target.value })} required>
              <option value="">— Enseignant —</option>
              {enseignants.map((u) => (
                <option key={u.id} value={u.id}>{`${u.first_name} ${u.last_name}`.trim() || u.username}</option>
              ))}
            </select>
            <select value={form.classe} onChange={(e) => setForm({ ...form, classe: e.target.value })} required>
              <option value="">— Classe —</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
            </select>
            <select value={form.matiere} onChange={(e) => setForm({ ...form, matiere: e.target.value })} required>
              <option value="">— Matière —</option>
              {matieres.map((m) => <option key={m.id} value={m.id}>{m.nom}</option>)}
            </select>
            <button type="submit" className={styles.addButton}><Plus size={16} /> Affecter</button>
          </form>
          {formError && <p className={styles.errorMsg}>{formError}</p>}

          {enseignants.length === 0 && (
            <p className={styles.hint}>Aucun enseignant actif : créez-en dans « Utilisateurs » (rôle Enseignant).</p>
          )}

          {affectations.length === 0 ? (
            <div className={styles.emptyState}>
              <ClipboardList size={36} color="var(--color-text-dim)" />
              <p>Aucune affectation. Tant qu'un enseignant n'en a pas, il ne voit aucune classe.</p>
            </div>
          ) : (
            <div className={styles.groups}>
              {Object.entries(parEnseignant).map(([nom, liste]) => (
                <div key={nom} className={styles.group}>
                  <div className={styles.groupHeader}>{nom}</div>
                  {liste.map((a) => (
                    <div key={a.id} className={styles.row}>
                      <span><strong>{a.classe_nom}</strong> · {a.matiere_nom}</span>
                      <button className={styles.deleteButton} onClick={() => supprimer(a)} title="Retirer">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Affectations;
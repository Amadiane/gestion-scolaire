import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, ClipboardList, AlertTriangle, Search, X } from 'lucide-react';
import api from '../../services/api.js';
import CONFIG from '../../config/config.js';
import BoutonRetour from '../../components/BoutonRetour/BoutonRetour.jsx';
import styles from '../../theme/pages/admin/Affectations.module.css';
import listes from '../../theme/pages/admin/Listes.module.css';

const norm = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const comparer = (a, b) =>
  String(a || '').localeCompare(String(b || ''), 'fr', { numeric: true, sensitivity: 'base' });

const nomEnseignant = (u) => `${u.first_name} ${u.last_name}`.trim() || u.username;

const Affectations = () => {
  const [affectations, setAffectations] = useState([]);
  const [enseignants, setEnseignants] = useState([]);
  const [classes, setClasses] = useState([]);
  const [matieres, setMatieres] = useState([]);
  const [form, setForm] = useState({ enseignant: '', classe: '', matiere: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');

  const [vue, setVue] = useState('enseignant');
  const [recherche, setRecherche] = useState('');
  const [classeFiltre, setClasseFiltre] = useState('');
  const [matiereFiltre, setMatiereFiltre] = useState('');

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
      setEnseignants(
        u.data
          .filter((x) => x.role === 'enseignant' && x.is_active)
          .sort((x, y) => comparer(nomEnseignant(x), nomEnseignant(y)))
      );
      setClasses(c.data);
      setMatieres([...m.data].sort((x, y) => comparer(x.nom, y.nom)));
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

  // ---------- Filtres et regroupement ----------
  const indexClasse = (id) => {
    const i = classes.findIndex((c) => c.id === id);
    return i === -1 ? 9999 : i;
  };

  const q = norm(recherche.trim());
  const filtrees = affectations.filter(
    (a) =>
      norm(`${a.enseignant_nom} ${a.classe_nom} ${a.matiere_nom}`).includes(q) &&
      (!classeFiltre || String(a.classe) === classeFiltre) &&
      (!matiereFiltre || String(a.matiere) === matiereFiltre)
  );

  const groupes = new Map();
  filtrees.forEach((a) => {
    const cle = vue === 'enseignant' ? `e${a.enseignant}` : `c${a.classe}`;
    if (!groupes.has(cle)) {
      groupes.set(cle, {
        cle,
        titre: vue === 'enseignant' ? a.enseignant_nom : a.classe_nom,
        rang: vue === 'enseignant' ? 0 : indexClasse(a.classe),
        items: [],
      });
    }
    groupes.get(cle).items.push(a);
  });

  const liste = [...groupes.values()].sort(
    vue === 'enseignant' ? (x, y) => comparer(x.titre, y.titre) : (x, y) => x.rang - y.rang
  );
  liste.forEach((g) =>
    g.items.sort(
      vue === 'enseignant'
        ? (x, y) => indexClasse(x.classe) - indexClasse(y.classe) || comparer(x.matiere_nom, y.matiere_nom)
        : (x, y) => comparer(x.matiere_nom, y.matiere_nom) || comparer(x.enseignant_nom, y.enseignant_nom)
    )
  );

  const sansAffectation = enseignants.filter((u) => !affectations.some((a) => a.enseignant === u.id));
  const filtresActifs = recherche || classeFiltre || matiereFiltre;

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
                <option key={u.id} value={u.id}>{nomEnseignant(u)}</option>
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

          {sansAffectation.length > 0 && affectations.length > 0 && (
            <p className={styles.hint}>
              Sans affectation (ne voient aucune classe) : {sansAffectation.map(nomEnseignant).join(', ')}.
            </p>
          )}

          {affectations.length > 0 && (
            <div className={listes.barre}>
              <button
                type="button"
                className={listes.bouton}
                onClick={() => setVue((v) => (v === 'enseignant' ? 'classe' : 'enseignant'))}
              >
                {vue === 'enseignant' ? 'Voir par classe' : 'Voir par enseignant'}
              </button>

              <div className={listes.recherche}>
                <Search size={16} color="var(--color-text-dim)" />
                <input
                  type="text"
                  placeholder="Rechercher un enseignant, une classe ou une matière..."
                  value={recherche}
                  onChange={(e) => setRecherche(e.target.value)}
                />
              </div>

              <select
                className={listes.select}
                value={classeFiltre}
                onChange={(e) => setClasseFiltre(e.target.value)}
                aria-label="Filtrer par classe"
              >
                <option value="">Toutes les classes</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
              </select>

              <select
                className={listes.select}
                value={matiereFiltre}
                onChange={(e) => setMatiereFiltre(e.target.value)}
                aria-label="Filtrer par matière"
              >
                <option value="">Toutes les matières</option>
                {matieres.map((m) => <option key={m.id} value={m.id}>{m.nom}</option>)}
              </select>

              {filtresActifs && (
                <button
                  type="button"
                  className={listes.effacer}
                  onClick={() => { setRecherche(''); setClasseFiltre(''); setMatiereFiltre(''); }}
                >
                  <X size={14} /> Effacer
                </button>
              )}
            </div>
          )}

          {affectations.length === 0 ? (
            <div className={styles.emptyState}>
              <ClipboardList size={36} color="var(--color-text-dim)" />
              <p>Aucune affectation. Tant qu'un enseignant n'en a pas, il ne voit aucune classe.</p>
            </div>
          ) : liste.length === 0 ? (
            <div className={styles.emptyState}><p>Aucune affectation ne correspond à ces filtres.</p></div>
          ) : (
            <div className={styles.groups}>
              {liste.map((g) => (
                <div key={g.cle} className={styles.group}>
                  <div className={styles.groupHeader}>{g.titre}</div>
                  {g.items.map((a) => (
                    <div key={a.id} className={styles.row}>
                      {vue === 'enseignant' ? (
                        <span><strong>{a.classe_nom}</strong> · {a.matiere_nom}</span>
                      ) : (
                        <span><strong>{a.matiere_nom}</strong> · {a.enseignant_nom}</span>
                      )}
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
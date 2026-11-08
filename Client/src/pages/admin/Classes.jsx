import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { School, Users, Search, Plus, X } from 'lucide-react';
import api from '../../services/api.js';
import CONFIG from '../../config/config.js';
import BoutonRetour from '../../components/BoutonRetour/BoutonRetour.jsx';
import styles from '../../theme/pages/admin/Classes.module.css';
import formStyles from '../../theme/pages/admin/AjouterEleveModal.module.css';

const norm = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const comparer = (a, b) =>
  String(a || '').localeCompare(String(b || ''), 'fr', { numeric: true, sensitivity: 'base' });

const LETTRES = 'ABCDEFGH'.split('');
const ROLES_CREATION = ['directeur', 'secretaire'];

const messageErreur = (err) => {
  const data = err.response?.data;
  if (data && typeof data === 'object') {
    const premier = data.detail || Object.values(data)[0];
    return Array.isArray(premier) ? premier[0] : String(premier);
  }
  return err.response ? `Erreur serveur (code ${err.response.status}).` : 'Connexion internet requise.';
};

const formulaireVide = () => ({ nom: '', niveau: '', annee: '', effectif_max: 50, sections: 1 });

const Classes = () => {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const peutCreer = ROLES_CREATION.includes(user.role);

  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [recherche, setRecherche] = useState('');
  const [niveauFiltre, setNiveauFiltre] = useState('');

  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(formulaireVide());
  const [niveauxListe, setNiveauxListe] = useState([]);
  const [anneesListe, setAnneesListe] = useState([]);
  const [preparation, setPreparation] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [bilan, setBilan] = useState('');

  const charger = useCallback(async () => {
    try {
      const res = await api.get(CONFIG.API_CLASSES);
      setClasses(res.data);
      setError('');
    } catch {
      setError('Impossible de charger les classes.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { charger(); }, [charger]);

  const ouvrirFormulaire = async () => {
    setFormError('');
    setBilan('');
    setForm(formulaireVide());
    setModal(true);
    setPreparation(true);
    try {
      const [n, a] = await Promise.all([api.get(CONFIG.API_NIVEAUX), api.get(CONFIG.API_ANNEES_SCOLAIRES)]);
      const niveaux = [...n.data].sort((x, y) => (x.ordre ?? 0) - (y.ordre ?? 0));
      const annees = a.data;
      const active = annees.find((x) => x.est_active) || annees[0];
      setNiveauxListe(niveaux);
      setAnneesListe(annees);
      setForm((f) => ({ ...f, niveau: niveaux[0]?.id || '', annee: active?.id || '' }));
    } catch (err) {
      setFormError(`Impossible de charger les niveaux et années : ${messageErreur(err)}`);
    } finally {
      setPreparation(false);
    }
  };

  const maj = (champ, valeur) => setForm((f) => ({ ...f, [champ]: valeur }));

  const nomsAcreer = () => {
    const base = form.nom.trim();
    if (!base) return [];
    return form.sections > 1 ? LETTRES.slice(0, form.sections).map((l) => `${base} ${l}`) : [base];
  };

  const creer = async (e) => {
    e.preventDefault();
    setFormError('');
    setBilan('');
    const noms = nomsAcreer();
    if (noms.length === 0) return;

    setSaving(true);
    const crees = [];
    const echecs = [];
    for (const nom of noms) {
      try {
        await api.post(CONFIG.API_CLASSES, {
          nom,
          niveau: Number(form.niveau),
          annee_scolaire: Number(form.annee),
          effectif_max: Number(form.effectif_max) || 50,
        });
        crees.push(nom);
      } catch (err) {
        echecs.push(`${nom} : ${messageErreur(err)}`);
      }
    }
    await charger();
    setSaving(false);

    if (echecs.length === 0) {
      setModal(false);
    } else {
      // Les classes déjà créées ne sont pas recréées : on indique l'état exact.
      setBilan(crees.length ? `Créée(s) : ${crees.join(', ')}.` : '');
      setFormError(echecs.join(' | '));
    }
  };

  // Niveaux dans l'ordre pédagogique (puis alphabétique si l'ordre est absent).
  const niveaux = [...new Map(classes.map((c) => [c.niveau_nom, c.niveau_ordre ?? 9999])).entries()]
    .sort((a, b) => a[1] - b[1] || comparer(a[0], b[0]))
    .map(([nom]) => nom);

  const filtrees = classes.filter(
    (c) =>
      (!niveauFiltre || c.niveau_nom === niveauFiltre) &&
      norm(`${c.nom} ${c.niveau_nom}`).includes(norm(recherche.trim()))
  );

  const groupes = niveaux
    .map((nom) => ({
      nom,
      classes: filtrees.filter((c) => c.niveau_nom === nom).sort((a, b) => comparer(a.nom, b.nom)),
    }))
    .filter((g) => g.classes.length > 0);

  const totalEleves = filtrees.reduce((s, c) => s + (c.effectif || 0), 0);

  const apercu = nomsAcreer();

  return (
    <div className={styles.wrapper}>
      <BoutonRetour vers="/dashboardAdmin" />

      <div className={styles.entete}>
        <div>
          <h1 className={styles.title}>Classes</h1>
          <p className={styles.subtitle}>
            {classes.length} classe(s) · {totalEleves} élève(s)
            {(recherche || niveauFiltre) && ' (selon les filtres)'}
          </p>
        </div>
        {peutCreer && (
          <button type="button" className={styles.addButton} onClick={ouvrirFormulaire}>
            <Plus size={16} /> Nouvelle classe
          </button>
        )}
      </div>

      {classes.length > 0 && (
        <div className={styles.filtersRow}>
          <div className={styles.searchBar}>
            <Search size={16} color="var(--color-text-dim)" />
            <input
              type="text"
              placeholder="Rechercher une classe..."
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
            />
          </div>
          <select
            className={styles.niveauSelect}
            value={niveauFiltre}
            onChange={(e) => setNiveauFiltre(e.target.value)}
            aria-label="Filtrer par niveau"
          >
            <option value="">Tous les niveaux</option>
            {niveaux.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      )}

      {loading && <p className={styles.stateMsg}>Chargement...</p>}
      {error && <p className={styles.errorMsg}>{error}</p>}

      {!loading && !error && classes.length === 0 && (
        <div className={styles.emptyState}>
          <School size={40} color="var(--color-text-dim)" />
          <p>Aucune classe créée pour le moment.</p>
          {peutCreer ? (
            <button type="button" className={styles.addButton} onClick={ouvrirFormulaire}>
              <Plus size={16} /> Créer la première classe
            </button>
          ) : (
            <p className={styles.stateMsg}>Demandez à la direction de créer les classes.</p>
          )}
        </div>
      )}

      {!loading && !error && classes.length > 0 && groupes.length === 0 && (
        <div className={styles.emptyState}>
          <p>Aucune classe ne correspond à ces filtres.</p>
        </div>
      )}

      {groupes.map((g) => (
        <section key={g.nom} className={styles.groupe}>
          <h2 className={styles.groupeTitre}>
            {g.nom}
            <span>
              {g.classes.length} classe(s) · {g.classes.reduce((s, c) => s + (c.effectif || 0), 0)} élève(s)
            </span>
          </h2>
          <div className={styles.grid}>
            {g.classes.map((classe) => {
              const pleine = classe.effectif_max && classe.effectif >= classe.effectif_max;
              return (
                <div
                  key={classe.id}
                  className={styles.card}
                  onClick={() => navigate(`/dashboardAdmin/classes/${classe.id}`)}
                >
                  <div className={styles.cardIcon}>
                    <School size={20} color="#fff" />
                  </div>
                  <div className={styles.cardInfo}>
                    <h3 className={styles.cardName}>{classe.nom}</h3>
                    <p className={styles.cardNiveau}>{classe.niveau_nom}</p>
                  </div>
                  <div
                    className={`${styles.cardEffectif} ${pleine ? styles.pleine : ''}`}
                    title={pleine ? 'Classe complète' : undefined}
                  >
                    <Users size={14} />
                    {classe.effectif}{classe.effectif_max ? `/${classe.effectif_max}` : ''}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}

      {modal && (
        <div className={formStyles.overlay} onClick={() => !saving && setModal(false)}>
          <div className={formStyles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={formStyles.header}>
              <h2>Nouvelle classe</h2>
              <button className={formStyles.closeButton} onClick={() => setModal(false)} aria-label="Fermer">
                <X size={20} />
              </button>
            </div>

            {bilan && <div className={styles.bilan}>{bilan}</div>}
            {formError && <div className={formStyles.errorBox}>{formError}</div>}

            {preparation ? (
              <p className={styles.stateMsg}>Chargement...</p>
            ) : niveauxListe.length === 0 || anneesListe.length === 0 ? (
              <p className={styles.stateMsg}>
                {niveauxListe.length === 0
                  ? "Aucun niveau n'est défini pour cette école. Contactez Sylium pour les créer."
                  : "Aucune année scolaire n'est définie. Créez-en une dans « Années scolaires »."}
              </p>
            ) : (
              <form onSubmit={creer} className={formStyles.form}>
                <div className={formStyles.field}>
                  <label htmlFor="classe-nom">{form.sections > 1 ? 'Nom de base *' : 'Nom de la classe *'}</label>
                  <input
                    id="classe-nom"
                    value={form.nom}
                    maxLength={44}
                    placeholder={form.sections > 1 ? 'Ex. 7ème' : 'Ex. 7ème A'}
                    onChange={(e) => maj('nom', e.target.value)}
                    required
                    autoFocus
                  />
                </div>

                <div className={formStyles.row}>
                  <div className={formStyles.field}>
                    <label htmlFor="classe-niveau">Niveau *</label>
                    <select id="classe-niveau" value={form.niveau} onChange={(e) => maj('niveau', e.target.value)} required>
                      {niveauxListe.map((n) => <option key={n.id} value={n.id}>{n.nom}</option>)}
                    </select>
                  </div>
                  <div className={formStyles.field}>
                    <label htmlFor="classe-annee">Année scolaire *</label>
                    <select id="classe-annee" value={form.annee} onChange={(e) => maj('annee', e.target.value)} required>
                      {anneesListe.map((a) => (
                        <option key={a.id} value={a.id}>{a.nom}{a.est_active ? ' (en cours)' : ''}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className={formStyles.row}>
                  <div className={formStyles.field}>
                    <label htmlFor="classe-effectif">Effectif maximum</label>
                    <input
                      id="classe-effectif"
                      type="number"
                      min="1"
                      max="200"
                      value={form.effectif_max}
                      onChange={(e) => maj('effectif_max', e.target.value)}
                    />
                  </div>
                  <div className={formStyles.field}>
                    <label htmlFor="classe-sections">Nombre de sections</label>
                    <select
                      id="classe-sections"
                      value={form.sections}
                      onChange={(e) => maj('sections', Number(e.target.value))}
                    >
                      <option value={1}>1 (classe unique)</option>
                      {[2, 3, 4, 5, 6, 7, 8].map((n) => (
                        <option key={n} value={n}>{n} sections (A à {LETTRES[n - 1]})</option>
                      ))}
                    </select>
                  </div>
                </div>

                {apercu.length > 0 && (
                  <p className={styles.apercu}>
                    {apercu.length > 1 ? 'Seront créées : ' : 'Sera créée : '}
                    <strong>{apercu.join(', ')}</strong>
                  </p>
                )}

                <div className={formStyles.actions}>
                  <button type="button" className={formStyles.cancelButton} onClick={() => setModal(false)}>
                    Annuler
                  </button>
                  <button type="submit" className={formStyles.submitButton} disabled={saving || apercu.length === 0}>
                    {saving ? 'Création...' : apercu.length > 1 ? `Créer ${apercu.length} classes` : 'Créer la classe'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Classes;
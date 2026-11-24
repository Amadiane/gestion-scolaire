import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { School, Users, Search, Plus, X, Pencil, Trash2 } from 'lucide-react';
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

const formulaireVide = () => ({ nom: '', niveau: '', annee: '', effectif_max: 50, sections: 1, matieres: [] });

const racine = CONFIG.API_CLASSES.replace(/\/?$/, '/');
const urlClasse = (id) => `${racine}${id}/`;
const API_MATIERES = CONFIG.API_MATIERES || racine.replace('classes', 'matieres');

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
  const [edition, setEdition] = useState(null); // classe en cours de modification
  const [matieresListe, setMatieresListe] = useState([]);
  const [suppression, setSuppression] = useState(null); // { classe, usage, chargement, erreur, enCours }
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

  const ouvrirFormulaire = async (classeAModifier = null) => {
    setFormError('');
    setBilan('');
    setEdition(classeAModifier);
    setForm(formulaireVide());
    setModal(true);
    setPreparation(true);
    try {
      const [n, a, m] = await Promise.all([
        api.get(CONFIG.API_NIVEAUX),
        api.get(CONFIG.API_ANNEES_SCOLAIRES),
        api.get(API_MATIERES).catch(() => ({ data: [] })),
      ]);
      const niveaux = [...n.data].sort((x, y) => (x.ordre ?? 0) - (y.ordre ?? 0));
      const annees = a.data;
      const active = annees.find((x) => x.est_active) || annees[0];
      setNiveauxListe(niveaux);
      setAnneesListe(annees);
      setMatieresListe(m.data);
      if (classeAModifier) {
        setForm({
          nom: classeAModifier.nom,
          niveau: classeAModifier.niveau,
          annee: classeAModifier.annee_scolaire,
          effectif_max: classeAModifier.effectif_max || 50,
          sections: 1,
          matieres: classeAModifier.matieres || [],
        });
      } else {
        setForm((f) => ({ ...f, niveau: niveaux[0]?.id || '', annee: active?.id || '' }));
      }
    } catch (err) {
      setFormError(`Impossible de charger les niveaux et années : ${messageErreur(err)}`);
    } finally {
      setPreparation(false);
    }
  };

  const maj = (champ, valeur) => setForm((f) => ({ ...f, [champ]: valeur }));

  const basculerMatiere = (id) =>
    setForm((f) => ({
      ...f,
      matieres: f.matieres.includes(id) ? f.matieres.filter((x) => x !== id) : [...f.matieres, id],
    }));

  const modifier = async (e) => {
    e.preventDefault();
    setFormError('');
    setSaving(true);
    try {
      await api.patch(urlClasse(edition.id), {
        nom: form.nom.trim(),
        niveau: Number(form.niveau),
        effectif_max: Number(form.effectif_max) || 50,
        matieres: form.matieres,
      });
      await charger();
      setModal(false);
      setEdition(null);
    } catch (err) {
      setFormError(messageErreur(err));
    } finally {
      setSaving(false);
    }
  };

  const demanderSuppression = async (classe) => {
    setSuppression({ classe, usage: null, chargement: true, erreur: '', enCours: false });
    try {
      const res = await api.get(`${urlClasse(classe.id)}utilisation/`);
      setSuppression((s) => s && { ...s, usage: res.data, chargement: false });
    } catch (err) {
      setSuppression((s) => s && { ...s, chargement: false, erreur: messageErreur(err) });
    }
  };

  const confirmerSuppression = async () => {
    setSuppression((s) => ({ ...s, enCours: true, erreur: '' }));
    try {
      await api.delete(urlClasse(suppression.classe.id));
      setSuppression(null);
      await charger();
    } catch (err) {
      setSuppression((s) => ({ ...s, enCours: false, erreur: messageErreur(err) }));
    }
  };

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

  const apercu = edition ? [form.nom.trim()].filter(Boolean) : nomsAcreer();

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
          <button type="button" className={styles.addButton} onClick={() => ouvrirFormulaire()}>
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
            <button type="button" className={styles.addButton} onClick={() => ouvrirFormulaire()}>
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
                  {peutCreer && (
                    <div className={styles.cardActions} onClick={(e) => e.stopPropagation()}>
                      <button type="button" className={styles.iconBtn} title="Modifier" aria-label={`Modifier ${classe.nom}`}
                        onClick={() => ouvrirFormulaire(classe)}>
                        <Pencil size={15} />
                      </button>
                      <button type="button" className={`${styles.iconBtn} ${styles.iconBtnDanger}`} title="Supprimer"
                        aria-label={`Supprimer ${classe.nom}`} onClick={() => demanderSuppression(classe)}>
                        <Trash2 size={15} />
                      </button>
                    </div>
                  )}
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
              <h2>{edition ? `Modifier ${edition.nom}` : 'Nouvelle classe'}</h2>
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
              <form onSubmit={edition ? modifier : creer} className={formStyles.form}>
                <div className={formStyles.field}>
                  <label htmlFor="classe-nom">{!edition && form.sections > 1 ? 'Nom de base *' : 'Nom de la classe *'}</label>
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
                    <select id="classe-annee" value={form.annee} onChange={(e) => maj('annee', e.target.value)} required disabled={!!edition}>
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
                  {!edition && (
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
                  )}
                </div>

                {matieresListe.length > 0 && (
                  <div className={formStyles.field}>
                    <label>Matières enseignées dans cette classe</label>
                    <div className={styles.matieresGrid}>
                      {matieresListe.map((m) => (
                        <label key={m.id} className={styles.matiereCheck}>
                          <input type="checkbox" checked={form.matieres.includes(m.id)} onChange={() => basculerMatiere(m.id)} />
                          {m.nom}
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {!edition && apercu.length > 0 && (
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
                    {edition ? (saving ? 'Enregistrement...' : 'Enregistrer') : saving ? 'Création...' : apercu.length > 1 ? `Créer ${apercu.length} classes` : 'Créer la classe'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {suppression && (
        <div className={formStyles.overlay} onClick={() => !suppression.enCours && setSuppression(null)}>
          <div className={formStyles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={formStyles.header}>
              <h2>Supprimer {suppression.classe.nom} ?</h2>
              <button className={formStyles.closeButton} onClick={() => setSuppression(null)} aria-label="Fermer">
                <X size={20} />
              </button>
            </div>

            {suppression.chargement && <p className={styles.stateMsg}>Vérification...</p>}
            {suppression.erreur && <div className={formStyles.errorBox}>{suppression.erreur}</div>}

            {suppression.usage && !suppression.usage.peut_supprimer && (
              <div className={formStyles.errorBox}>
                Suppression impossible : cette classe contient encore {suppression.usage.message_bloquants}.
                Pour la supprimer, transférez ou retirez d'abord ces éléments.
              </div>
            )}
            {suppression.usage && suppression.usage.peut_supprimer && (
              <p className={styles.confirmTexte}>
                Cette classe est vide.
                {suppression.usage.message_supprimables &&
                  ` Seront aussi supprimés : ${suppression.usage.message_supprimables}.`}{' '}
                Cette action est définitive.
              </p>
            )}

            <div className={formStyles.actions}>
              <button type="button" className={formStyles.cancelButton} onClick={() => setSuppression(null)}>
                {suppression.usage?.peut_supprimer ? 'Annuler' : 'Fermer'}
              </button>
              {suppression.usage?.peut_supprimer && (
                <button type="button" className={`${formStyles.submitButton} ${styles.boutonDanger}`}
                  disabled={suppression.enCours} onClick={confirmerSuppression}>
                  {suppression.enCours ? 'Suppression...' : 'Supprimer définitivement'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Classes;
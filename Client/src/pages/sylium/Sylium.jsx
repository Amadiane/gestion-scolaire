import { useState, useEffect, useCallback } from 'react';
import { Plus, LogOut, Building2, Trash2, Copy, X, AlertTriangle } from 'lucide-react';
import api from '../../services/api.js';
import CONFIG from '../../config/config.js';
import { formatGNF } from '../../utils/finance.js';
import formStyles from '../../theme/pages/admin/AjouterEleveModal.module.css';
import styles from '../../theme/pages/sylium/Sylium.module.css';

const STATUT = {
  actif: ['Actif', 'ok'],
  expire: ['Expiré', 'danger'],
  suspendu: ['Suspendu', 'warn'],
  annule: ['Annulé', 'danger'],
  desactivee: ['Désactivée', 'danger'],
  aucun: ['Sans abonnement', 'danger'],
};

const DUREES = [[30, '1 mois'], [90, '3 mois'], [365, '1 an']];

const message = (err, defaut) => {
  const data = err.response?.data;
  if (Array.isArray(data)) return data[0];
  if (data && typeof data === 'object') {
    const premier = Object.values(data)[0];
    return Array.isArray(premier) ? premier[0] : String(premier);
  }
  return defaut;
};

const sansAccents = (s) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

const anneeParDefaut = () => {
  const now = new Date();
  const y = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
  return { nom: `${y}-${y + 1}`, debut: `${y}-10-01`, fin: `${y + 1}-07-15` };
};

const Sylium = () => {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const [onglet, setOnglet] = useState('ecoles');
  const [ecoles, setEcoles] = useState([]);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(false);
  const [identifiants, setIdentifiants] = useState(null);
  const [renouvelerId, setRenouvelerId] = useState(null);
  const [actionId, setActionId] = useState(null);
  const [nouveauPlan, setNouveauPlan] = useState({ nom: '', prix_mensuel: '', prix_annuel: '', effectif_max: '', modules_inclus: '' });
  const [planError, setPlanError] = useState('');

  const [form, setForm] = useState(null);
  const [usernameModifie, setUsernameModifie] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const charger = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [e, p] = await Promise.all([api.get(CONFIG.API_SYLIUM_ECOLES), api.get(CONFIG.API_SYLIUM_PLANS)]);
      setEcoles(e.data);
      setPlans(p.data);
    } catch (err) {
      setError(message(err, 'Impossible de charger les données.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { charger(); }, [charger]);

  const logout = () => {
    localStorage.removeItem('access');
    localStorage.removeItem('refresh');
    localStorage.removeItem('user');
    window.location.href = '/login';
  };

  const ouvrirFormulaire = () => {
    const a = anneeParDefaut();
    setForm({
      nom: '', email_contact: '', telephone: '', effectif_declare: '', prefixe_matricule: '',
      plan: plans[0]?.id || '', duree_jours: 365,
      directeur_username: '', directeur_prenom: '', directeur_nom: '', directeur_telephone: '',
      annee_nom: a.nom, annee_debut: a.debut, annee_fin: a.fin,
      creer_niveaux: true, creer_matieres: true,
    });
    setUsernameModifie(false);
    setFormError('');
    setModal(true);
  };

  const maj = (champ, valeur) => {
    setForm((prev) => {
      const suivant = { ...prev, [champ]: valeur };
      // Propose un identifiant tant que l'utilisateur ne l'a pas modifié lui-même.
      if (champ === 'nom' && !usernameModifie) {
        const base = sansAccents(valeur).slice(0, 14);
        suivant.directeur_username = base ? `dir.${base}` : '';
      }
      return suivant;
    });
  };

  const creer = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      const payload = { ...form, effectif_declare: Number(form.effectif_declare) || 0 };
      const res = await api.post(CONFIG.API_SYLIUM_ECOLES, payload);
      setModal(false);
      setIdentifiants({ ecole: res.data.ecole.nom, ...res.data.directeur });
      charger();
    } catch (err) {
      setFormError(message(err, "Impossible de créer l'école."));
    } finally {
      setSaving(false);
    }
  };

  const agir = async (ecole, action, donnees = {}) => {
    setActionId(ecole.id);
    try {
      await api.post(CONFIG.API_SYLIUM_ECOLE_ACTION(ecole.id, action), donnees);
      setRenouvelerId(null);
      charger();
    } catch (err) {
      alert(message(err, "Action impossible."));
    } finally {
      setActionId(null);
    }
  };

  const suspendre = (ecole) => {
    if (window.confirm(`Suspendre l'accès de « ${ecole.nom} » ? Ses utilisateurs ne pourront plus se connecter.`)) {
      agir(ecole, 'suspendre');
    }
  };

  const ajouterPlan = async (e) => {
    e.preventDefault();
    setPlanError('');
    try {
      await api.post(CONFIG.API_SYLIUM_PLANS, {
        nom: nouveauPlan.nom,
        prix_mensuel: Number(nouveauPlan.prix_mensuel) || 0,
        prix_annuel: Number(nouveauPlan.prix_annuel) || 0,
        effectif_max: nouveauPlan.effectif_max ? Number(nouveauPlan.effectif_max) : null,
        modules_inclus: nouveauPlan.modules_inclus,
      });
      setNouveauPlan({ nom: '', prix_mensuel: '', prix_annuel: '', effectif_max: '', modules_inclus: '' });
      charger();
    } catch (err) {
      setPlanError(message(err, "Impossible d'ajouter ce plan."));
    }
  };

  const supprimerPlan = async (plan) => {
    if (!window.confirm(`Supprimer le plan « ${plan.nom} » ?`)) return;
    try {
      await api.delete(CONFIG.API_SYLIUM_PLAN_DETAIL(plan.id));
      charger();
    } catch (err) {
      alert(message(err, 'Impossible de supprimer ce plan.'));
    }
  };

  const copier = (texte) => navigator.clipboard?.writeText(texte);

  return (
    <div className={styles.wrapper}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Sylium · Administration</h1>
          <p className={styles.subtitle}>Connecté en tant que {user.username}</p>
        </div>
        <button className={styles.logoutButton} onClick={logout}><LogOut size={15} /> Déconnexion</button>
      </header>

      <div className={styles.tabs}>
        <button className={`${styles.tab} ${onglet === 'ecoles' ? styles.tabActive : ''}`} onClick={() => setOnglet('ecoles')}>
          Écoles ({ecoles.length})
        </button>
        <button className={`${styles.tab} ${onglet === 'plans' ? styles.tabActive : ''}`} onClick={() => setOnglet('plans')}>
          Plans d'abonnement ({plans.length})
        </button>
      </div>

      {error && <div className={styles.errorBanner}><AlertTriangle size={16} /> {error}</div>}
      {loading && <p className={styles.stateMsg}>Chargement...</p>}

      {!loading && !error && onglet === 'ecoles' && (
        <>
          <div className={styles.toolbar}>
            <button
              className={styles.addButton}
              onClick={ouvrirFormulaire}
              disabled={plans.length === 0}
              title={plans.length === 0 ? "Créez d'abord un plan d'abonnement" : ''}
            >
              <Plus size={16} /> Nouvelle école
            </button>
            {plans.length === 0 && <span className={styles.hint}>Créez d'abord un plan dans l'onglet « Plans d'abonnement ».</span>}
          </div>

          {ecoles.length === 0 ? (
            <div className={styles.emptyState}><Building2 size={36} color="var(--color-text-dim)" /><p>Aucune école cliente pour le moment.</p></div>
          ) : (
            <div className={styles.grid}>
              {ecoles.map((e) => {
                const [label, ton] = STATUT[e.statut] || [e.statut, 'warn'];
                return (
                  <div key={e.id} className={styles.card}>
                    <div className={styles.cardTop}>
                      <div>
                        <h3 className={styles.cardNom}>{e.nom}</h3>
                        <span className={styles.cardMeta}>{e.email_contact}</span>
                      </div>
                      <span className={`${styles.badge} ${styles['badge_' + ton]}`}>{label}</span>
                    </div>

                    <dl className={styles.infos}>
                      <div><dt>Plan</dt><dd>{e.plan || '—'}</dd></div>
                      <div><dt>Élèves</dt><dd>{e.nb_eleves}</dd></div>
                      <div>
                        <dt>Fin d'abonnement</dt>
                        <dd>{e.date_fin ? `${new Date(e.date_fin).toLocaleDateString('fr-FR')} (${e.jours_restants} j)` : '—'}</dd>
                      </div>
                      <div><dt>Directeur</dt><dd>{e.directeurs.join(', ') || '—'}</dd></div>
                    </dl>

                    <div className={styles.actions}>
                      {renouvelerId === e.id ? (
                        <>
                          {DUREES.map(([jours, lib]) => (
                            <button key={jours} className={styles.smallButton} disabled={actionId === e.id}
                              onClick={() => agir(e, 'renouveler', { duree_jours: jours })}>
                              +{lib}
                            </button>
                          ))}
                          <button className={styles.linkButton} onClick={() => setRenouvelerId(null)}>Annuler</button>
                        </>
                      ) : (
                        <>
                          <button className={styles.smallButton} onClick={() => setRenouvelerId(e.id)}>Renouveler</button>
                          {e.statut === 'actif' ? (
                            <button className={styles.dangerButton} disabled={actionId === e.id} onClick={() => suspendre(e)}>Suspendre</button>
                          ) : (
                            <button className={styles.smallButton} disabled={actionId === e.id} onClick={() => agir(e, 'reactiver')}>Réactiver</button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {!loading && !error && onglet === 'plans' && (
        <>
          <form className={styles.planForm} onSubmit={ajouterPlan}>
            <input placeholder="Nom du plan *" value={nouveauPlan.nom} required
              onChange={(e) => setNouveauPlan({ ...nouveauPlan, nom: e.target.value })} />
            <input type="number" min="0" placeholder="Prix mensuel (GNF) *" value={nouveauPlan.prix_mensuel} required
              onChange={(e) => setNouveauPlan({ ...nouveauPlan, prix_mensuel: e.target.value })} />
            <input type="number" min="0" placeholder="Prix annuel (GNF) *" value={nouveauPlan.prix_annuel} required
              onChange={(e) => setNouveauPlan({ ...nouveauPlan, prix_annuel: e.target.value })} />
            <input type="number" min="1" placeholder="Élèves max (vide = illimité)" value={nouveauPlan.effectif_max}
              onChange={(e) => setNouveauPlan({ ...nouveauPlan, effectif_max: e.target.value })} />
            <input placeholder="Modules inclus (texte libre)" value={nouveauPlan.modules_inclus}
              onChange={(e) => setNouveauPlan({ ...nouveauPlan, modules_inclus: e.target.value })} />
            <button type="submit" className={styles.addButton}><Plus size={16} /> Ajouter</button>
          </form>
          {planError && <p className={styles.errorMsg}>{planError}</p>}

          {plans.length === 0 ? (
            <div className={styles.emptyState}><p>Aucun plan. Créez-en au moins un pour pouvoir ouvrir une école.</p></div>
          ) : (
            <div className={styles.tableWrapper}>
              <table className={`${styles.table} stack`}>
                <thead>
                  <tr><th>Plan</th><th>Mensuel</th><th>Annuel</th><th>Élèves max</th><th>Modules</th><th></th></tr>
                </thead>
                <tbody>
                  {plans.map((p) => (
                    <tr key={p.id}>
                      <td data-label="Plan"><strong>{p.nom}</strong></td>
                      <td data-label="Mensuel">{formatGNF(p.prix_mensuel)}</td>
                      <td data-label="Annuel">{formatGNF(p.prix_annuel)}</td>
                      <td data-label="Élèves max">{p.effectif_max || 'Illimité'}</td>
                      <td data-label="Modules">{p.modules_inclus || '—'}</td>
                      <td data-label="Supprimer">
                        <button className={styles.iconButton} onClick={() => supprimerPlan(p)} title="Supprimer"><Trash2 size={15} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {modal && form && (
        <div className={formStyles.overlay} onClick={() => setModal(false)}>
          <div className={formStyles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={formStyles.header}>
              <h2>Nouvelle école cliente</h2>
              <button className={formStyles.closeButton} onClick={() => setModal(false)}><X size={20} /></button>
            </div>

            {formError && <div className={formStyles.errorBox}>{formError}</div>}

            <form onSubmit={creer} className={formStyles.form}>
              <div className={formStyles.field}>
                <label>Nom de l'école *</label>
                <input value={form.nom} onChange={(e) => maj('nom', e.target.value)} required />
              </div>
              <div className={formStyles.row}>
                <div className={formStyles.field}>
                  <label>Email de contact *</label>
                  <input type="email" value={form.email_contact} onChange={(e) => maj('email_contact', e.target.value)} required />
                </div>
                <div className={formStyles.field}>
                  <label>Téléphone</label>
                  <input value={form.telephone} onChange={(e) => maj('telephone', e.target.value)} />
                </div>
              </div>
              <div className={formStyles.row}>
                <div className={formStyles.field}>
                  <label>Effectif approximatif</label>
                  <input type="number" min="0" value={form.effectif_declare} onChange={(e) => maj('effectif_declare', e.target.value)} />
                </div>
                <div className={formStyles.field}>
                  <label>Préfixe matricule</label>
                  <input value={form.prefixe_matricule} maxLength={10} placeholder="Auto" onChange={(e) => maj('prefixe_matricule', e.target.value)} />
                </div>
              </div>

              <div className={formStyles.row}>
                <div className={formStyles.field}>
                  <label>Plan *</label>
                  <select value={form.plan} onChange={(e) => maj('plan', e.target.value)} required>
                    {plans.map((p) => <option key={p.id} value={p.id}>{p.nom}</option>)}
                  </select>
                </div>
                <div className={formStyles.field}>
                  <label>Durée *</label>
                  <select value={form.duree_jours} onChange={(e) => maj('duree_jours', Number(e.target.value))}>
                    {DUREES.map(([j, l]) => <option key={j} value={j}>{l}</option>)}
                  </select>
                </div>
              </div>

              <div className={styles.separator}>Compte du directeur</div>
              <div className={formStyles.row}>
                <div className={formStyles.field}>
                  <label>Prénom *</label>
                  <input value={form.directeur_prenom} onChange={(e) => maj('directeur_prenom', e.target.value)} required />
                </div>
                <div className={formStyles.field}>
                  <label>Nom *</label>
                  <input value={form.directeur_nom} onChange={(e) => maj('directeur_nom', e.target.value)} required />
                </div>
              </div>
              <div className={formStyles.row}>
                <div className={formStyles.field}>
                  <label>Identifiant *</label>
                  <input value={form.directeur_username} required
                    onChange={(e) => { setUsernameModifie(true); maj('directeur_username', e.target.value); }} />
                </div>
                <div className={formStyles.field}>
                  <label>Téléphone</label>
                  <input value={form.directeur_telephone} onChange={(e) => maj('directeur_telephone', e.target.value)} />
                </div>
              </div>

              <div className={styles.separator}>Année scolaire</div>
              <div className={formStyles.row}>
                <div className={formStyles.field}>
                  <label>Nom *</label>
                  <input value={form.annee_nom} onChange={(e) => maj('annee_nom', e.target.value)} required />
                </div>
                <div className={formStyles.field}>
                  <label>Début *</label>
                  <input type="date" value={form.annee_debut} onChange={(e) => maj('annee_debut', e.target.value)} required />
                </div>
              </div>
              <div className={formStyles.field}>
                <label>Fin *</label>
                <input type="date" value={form.annee_fin} onChange={(e) => maj('annee_fin', e.target.value)} required />
              </div>

              <label className={styles.check}>
                <input type="checkbox" checked={form.creer_niveaux} onChange={(e) => maj('creer_niveaux', e.target.checked)} />
                Créer les niveaux types (1ère année à Terminale)
              </label>
              <label className={styles.check}>
                <input type="checkbox" checked={form.creer_matieres} onChange={(e) => maj('creer_matieres', e.target.checked)} />
                Créer les matières courantes
              </label>

              <div className={formStyles.actions}>
                <button type="button" className={formStyles.cancelButton} onClick={() => setModal(false)}>Annuler</button>
                <button type="submit" className={formStyles.submitButton} disabled={saving}>
                  {saving ? 'Création...' : "Créer l'école"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {identifiants && (
        <div className={formStyles.overlay} onClick={() => setIdentifiants(null)}>
          <div className={styles.credModal} onClick={(e) => e.stopPropagation()}>
            <h3>École « {identifiants.ecole} » créée</h3>
            <p className={styles.credWarning}>
              Transmettez ces identifiants au directeur maintenant : le mot de passe ne sera plus jamais affiché.
            </p>
            <div className={styles.credBox}>
              <div><span>Identifiant</span><strong>{identifiants.username}</strong></div>
              <div><span>Mot de passe</span><strong>{identifiants.mot_de_passe}</strong></div>
            </div>
            <div className={styles.credActions}>
              <button className={styles.smallButton}
                onClick={() => copier(`Identifiant : ${identifiants.username}\nMot de passe : ${identifiants.mot_de_passe}`)}>
                <Copy size={13} /> Copier
              </button>
              <button className={styles.addButton} onClick={() => setIdentifiants(null)}>Fermer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Sylium;
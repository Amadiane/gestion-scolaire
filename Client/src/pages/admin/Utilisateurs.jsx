import { useState, useEffect } from 'react';
import { Plus, UserCog, Search, KeyRound, ChevronUp, ChevronDown, X } from 'lucide-react';
import api from '../../services/api.js';
import CONFIG from '../../config/config.js';
import BoutonRetour from '../../components/BoutonRetour/BoutonRetour.jsx';
import Pagination from '../../components/Pagination/Pagination.jsx';
import usePagination from '../../hooks/usePagination.js';
import AjouterUtilisateurModal from './AjouterUtilisateurModal.jsx';
import styles from '../../theme/pages/admin/Utilisateurs.module.css';
import listes from '../../theme/pages/admin/Listes.module.css';

const ROLE_LABEL = {
  directeur: 'Directeur',
  surveillant: 'Surveillant général',
  comptable: 'Comptable',
  secretaire: 'Secrétaire',
  enseignant: 'Enseignant',
  parent: 'Parent',
  eleve: 'Élève',
};

const ORDRE_ROLES = ['directeur', 'comptable', 'secretaire', 'surveillant', 'enseignant', 'parent', 'eleve'];
const rangRole = (r) => {
  const i = ORDRE_ROLES.indexOf(r);
  return i === -1 ? 99 : i;
};

const norm = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const comparer = (a, b) =>
  String(a || '').localeCompare(String(b || ''), 'fr', { numeric: true, sensitivity: 'base' });
const nomComplet = (u) => `${u.last_name || ''} ${u.first_name || ''}`.trim();

const comparateurs = {
  role: (a, b) => rangRole(a.role) - rangRole(b.role) || comparer(nomComplet(a), nomComplet(b)),
  nom: (a, b) => comparer(nomComplet(a), nomComplet(b)) || comparer(a.username, b.username),
  identifiant: (a, b) => comparer(a.username, b.username),
  statut: (a, b) => Number(b.is_active) - Number(a.is_active) || comparer(nomComplet(a), nomComplet(b)),
};

const Utilisateurs = () => {
  const [utilisateurs, setUtilisateurs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [recherche, setRecherche] = useState('');
  const [roleFiltre, setRoleFiltre] = useState('');
  const [statutFiltre, setStatutFiltre] = useState('');
  const [tri, setTri] = useState({ cle: 'role', sens: 'asc' });
  const [modalOuvert, setModalOuvert] = useState(false);
  const [mdpGenere, setMdpGenere] = useState(null);

  const charger = async () => {
    setLoading(true);
    try {
      const res = await api.get(CONFIG.API_UTILISATEURS);
      setUtilisateurs(res.data);
    } catch (err) {
      setError(
        err.response?.status === 403
          ? "Seul un directeur peut accéder à la gestion des comptes."
          : "Impossible de charger la liste des utilisateurs."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    charger();
  }, []);

  const handleSuccess = () => {
    setModalOuvert(false);
    charger();
  };

  const handleToggleActif = async (utilisateur) => {
    try {
      await api.patch(CONFIG.API_UTILISATEUR_DETAIL(utilisateur.id), {
        is_active: !utilisateur.is_active,
      });
      charger();
    } catch {
      alert("Impossible de modifier le statut de ce compte.");
    }
  };

  const handleReinitialiser = async (utilisateur) => {
    if (!window.confirm(`Générer un nouveau mot de passe pour ${utilisateur.username} ?`)) return;
    try {
      const res = await api.post(`${CONFIG.API_UTILISATEUR_DETAIL(utilisateur.id)}reinitialiser_mot_de_passe/`);
      setMdpGenere({ username: utilisateur.username, motDePasse: res.data.nouveau_mot_de_passe });
    } catch {
      alert("Impossible de réinitialiser le mot de passe.");
    }
  };

  const basculerTri = (cle) =>
    setTri((t) => (t.cle === cle ? { cle, sens: t.sens === 'asc' ? 'desc' : 'asc' } : { cle, sens: 'asc' }));

  const entete = (cle, libelle) => (
    <th
      className={listes.sortable}
      onClick={() => basculerTri(cle)}
      aria-sort={tri.cle === cle ? (tri.sens === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      {libelle}
      {tri.cle === cle && (tri.sens === 'asc' ? <ChevronUp size={13} /> : <ChevronDown size={13} />)}
    </th>
  );

  const rolesPresents = [...new Set(utilisateurs.map((u) => u.role).filter(Boolean))].sort(
    (a, b) => rangRole(a) - rangRole(b)
  );

  const q = norm(recherche.trim());
  const utilisateursFiltres = utilisateurs
    .filter(
      (u) =>
        norm(`${u.first_name} ${u.last_name} ${u.username} ${u.telephone || ''}`).includes(q) &&
        (!roleFiltre || u.role === roleFiltre) &&
        (!statutFiltre || (statutFiltre === 'actif' ? u.is_active : !u.is_active))
    )
    .sort(comparateurs[tri.cle] || comparateurs.role);
  if (tri.sens === 'desc') utilisateursFiltres.reverse();

  const nbActifs = utilisateurs.filter((u) => u.is_active).length;
  const filtresActifs = recherche || roleFiltre || statutFiltre;

  const pagination = usePagination(
    utilisateursFiltres,
    25,
    `${recherche}|${roleFiltre}|${statutFiltre}|${tri.cle}|${tri.sens}`
  );

  return (
    <div className={styles.wrapper}>
      <BoutonRetour vers="/dashboardAdmin" />

      <div className={styles.headerRow}>
        <div>
          <h1 className={styles.title}>Utilisateurs</h1>
          <p className={styles.subtitle}>
            {utilisateurs.length} compte(s) — {nbActifs} actif(s), {utilisateurs.length - nbActifs} désactivé(s)
          </p>
        </div>
        <button className={styles.addButton} onClick={() => setModalOuvert(true)}>
          <Plus size={16} /> Ajouter un utilisateur
        </button>
      </div>

      <div className={listes.barre}>
        <div className={listes.recherche}>
          <Search size={16} color="var(--color-text-dim)" />
          <input
            type="text"
            placeholder="Rechercher par nom, identifiant ou téléphone..."
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
          />
        </div>

        <select
          className={listes.select}
          value={roleFiltre}
          onChange={(e) => setRoleFiltre(e.target.value)}
          aria-label="Filtrer par rôle"
        >
          <option value="">Tous les rôles</option>
          {rolesPresents.map((r) => <option key={r} value={r}>{ROLE_LABEL[r] || r}</option>)}
        </select>

        <select
          className={listes.select}
          value={statutFiltre}
          onChange={(e) => setStatutFiltre(e.target.value)}
          aria-label="Filtrer par statut"
        >
          <option value="">Tous les statuts</option>
          <option value="actif">Actifs</option>
          <option value="inactif">Désactivés</option>
        </select>

        {filtresActifs && (
          <button
            type="button"
            className={listes.effacer}
            onClick={() => { setRecherche(''); setRoleFiltre(''); setStatutFiltre(''); }}
          >
            <X size={14} /> Effacer
          </button>
        )}
      </div>

      {loading && <p className={styles.stateMsg}>Chargement...</p>}
      {error && <p className={styles.errorMsg}>{error}</p>}

      {!loading && !error && utilisateursFiltres.length === 0 && (
        <div className={styles.emptyState}>
          <UserCog size={40} color="var(--color-text-dim)" />
          <p>Aucun utilisateur trouvé.</p>
        </div>
      )}

      {!loading && !error && utilisateursFiltres.length > 0 && (
        <>
          <p className={listes.compteur}>
            {utilisateursFiltres.length}
            {utilisateursFiltres.length !== utilisateurs.length ? ` sur ${utilisateurs.length}` : ''} compte(s) affiché(s)
          </p>
          <div className={styles.tableWrapper}>
            <table className={`${styles.table} stack`}>
              <thead>
                <tr>
                  {entete('identifiant', 'Identifiant')}
                  {entete('nom', 'Nom complet')}
                  {entete('role', 'Rôle')}
                  <th>Téléphone</th>
                  {entete('statut', 'Statut')}
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pagination.pageItems.map((u) => (
                  <tr key={u.id}>
                    <td data-label="Identifiant">{u.username}</td>
                    <td data-label="Nom complet">{u.first_name} {u.last_name}</td>
                    <td data-label="Rôle">
                      <span className={styles.roleBadge}>{ROLE_LABEL[u.role] || u.role || '—'}</span>
                    </td>
                    <td data-label="Téléphone">{u.telephone || '—'}</td>
                    <td data-label="Statut">
                      <button
                        className={`${styles.statusButton} ${u.is_active ? styles.statusActive : styles.statusInactive}`}
                        onClick={() => handleToggleActif(u)}
                      >
                        {u.is_active ? 'Actif' : 'Désactivé'}
                      </button>
                    </td>
                    <td data-label="Actions">
                      <button className={styles.resetPwdButton} onClick={() => handleReinitialiser(u)}>
                        <KeyRound size={13} /> Réinitialiser
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination {...pagination} unite="comptes" />
        </>
      )}

      {mdpGenere && (
        <div className={styles.overlay} onClick={() => setMdpGenere(null)}>
          <div className={styles.pwdModal} onClick={(e) => e.stopPropagation()}>
            <h3>Nouveau mot de passe généré</h3>
            <p className={styles.pwdWarning}>
              Communiquez-le immédiatement à <strong>{mdpGenere.username}</strong> — il ne sera plus jamais affiché.
            </p>
            <div className={styles.pwdDisplay}>{mdpGenere.motDePasse}</div>
            <button className={styles.pwdCloseButton} onClick={() => setMdpGenere(null)}>Fermer</button>
          </div>
        </div>
      )}

      {modalOuvert && (
        <AjouterUtilisateurModal onClose={() => setModalOuvert(false)} onSuccess={handleSuccess} />
      )}
    </div>
  );
};

export default Utilisateurs;
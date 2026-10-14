import { useState, useEffect } from 'react';
import { Plus, UserCog, Search, KeyRound } from 'lucide-react';
import api from '../../services/api.js';
import CONFIG from '../../config/config.js';
import BoutonRetour from '../../components/BoutonRetour/BoutonRetour.jsx';
import AjouterUtilisateurModal from './AjouterUtilisateurModal.jsx';
import styles from '../../theme/pages/admin/Utilisateurs.module.css';

const ROLE_LABEL = {
  directeur: 'Directeur',
  surveillant: 'Surveillant général',
  comptable: 'Comptable',
  secretaire: 'Secrétaire',
  enseignant: 'Enseignant',
  parent: 'Parent',
  eleve: 'Élève',
};

const Utilisateurs = () => {
  const [utilisateurs, setUtilisateurs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [recherche, setRecherche] = useState('');
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

  const utilisateursFiltres = utilisateurs.filter((u) =>
    `${u.first_name} ${u.last_name} ${u.username}`.toLowerCase().includes(recherche.toLowerCase())
  );

  return (
    <div className={styles.wrapper}>
      <BoutonRetour vers="/dashboardAdmin" />

      <div className={styles.headerRow}>
        <div>
          <h1 className={styles.title}>Utilisateurs</h1>
          <p className={styles.subtitle}>{utilisateurs.length} compte(s) — personnel de l'établissement</p>
        </div>
        <button className={styles.addButton} onClick={() => setModalOuvert(true)}>
          <Plus size={16} /> Ajouter un utilisateur
        </button>
      </div>

      <div className={styles.searchBar}>
        <Search size={16} color="var(--color-text-dim)" />
        <input
          type="text"
          placeholder="Rechercher par nom ou identifiant..."
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
        />
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
        <div className={styles.tableWrapper}>
          <table className={`${styles.table} stack`}>
            <thead>
              <tr>
                <th>Identifiant</th>
                <th>Nom complet</th>
                <th>Rôle</th>
                <th>Téléphone</th>
                <th>Statut</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {utilisateursFiltres.map((u) => (
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
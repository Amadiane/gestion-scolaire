import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Lock, Eye, EyeOff, ShieldCheck, Check, Circle, GraduationCap, WifiOff } from 'lucide-react';
import api from '../../services/api.js';
import CONFIG from '../../config/config.js';
import { enregistrerCompte } from '../../offline/session.js';
import { prechargerDonnees } from '../../offline/precharge.js';
import styles from '../../theme/pages/auth/ChangerMotDePasse.module.css';

const ACCUEIL = {
  directeur: '/dashboardAdmin',
  comptable: '/dashboardAdmin',
  secretaire: '/dashboardAdmin',
  surveillant: '/dashboardAdmin',
  enseignant: '/enseignant',
};

const lireUser = () => {
  try { return JSON.parse(localStorage.getItem('user') || '{}'); } catch { return {}; }
};

const premierMessage = (err) => {
  const data = err.response?.data;
  if (data && typeof data === 'object') {
    const v = Object.values(data)[0];
    return Array.isArray(v) ? v[0] : String(v);
  }
  return "Impossible de changer le mot de passe. Réessayez.";
};

const ChangerMotDePasse = () => {
  const navigate = useNavigate();
  const token = localStorage.getItem('access');
  const user = lireUser();
  const obligatoire = Boolean(user.doit_changer_mdp);

  const [ancien, setAncien] = useState('');
  const [nouveau, setNouveau] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [visible, setVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if (!token) return <Navigate to="/login" replace />;

  const regles = [
    { ok: nouveau.length >= 8, texte: '8 caractères minimum' },
    { ok: /[A-Za-z]/.test(nouveau), texte: 'Au moins une lettre' },
    { ok: /\d/.test(nouveau), texte: 'Au moins un chiffre' },
    { ok: nouveau !== '' && nouveau !== ancien, texte: "Différent du mot de passe temporaire" },
    { ok: nouveau !== '' && nouveau === confirmation, texte: 'Confirmation identique' },
  ];
  const valide = ancien !== '' && regles.every((r) => r.ok);
  const horsLigne = !navigator.onLine;

  const seDeconnecter = () => {
    localStorage.removeItem('access');
    localStorage.removeItem('refresh');
    localStorage.removeItem('user');
    localStorage.removeItem('compte_local');
    navigate('/login', { replace: true });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!valide || saving) return;
    setSaving(true);
    setError('');
    try {
      const res = await api.post(CONFIG.API_CHANGER_MDP, {
        ancien_mot_de_passe: ancien,
        nouveau_mot_de_passe: nouveau,
      });
      const userMaj = res.data;
      localStorage.setItem('user', JSON.stringify(userMaj));

      // Le compte enregistré sur cet appareil (mode hors ligne) doit connaître le
      // nouveau mot de passe, sinon l'ancien resterait valide hors ligne.
      enregistrerCompte({
        username: userMaj.username,
        password: nouveau,
        user: userMaj,
        refresh: localStorage.getItem('refresh'),
      })
        .then((ok) => ok && prechargerDonnees())
        .catch(() => {});

      navigate(userMaj.is_superuser ? '/sylium' : (ACCUEIL[userMaj.role] || '/dashboardAdmin'), { replace: true });
    } catch (err) {
      setError(premierMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logo}><GraduationCap size={22} color="#fff" /></div>
        <h1 className={styles.title}>
          {obligatoire ? 'Choisissez votre mot de passe' : 'Changer mon mot de passe'}
        </h1>
        <p className={styles.subtitle}>
          {obligatoire
            ? `Bienvenue${user.first_name ? ` ${user.first_name}` : ''}. Le mot de passe qui vous a été remis est temporaire : définissez-en un personnel pour sécuriser votre compte.`
            : 'Saisissez votre mot de passe actuel puis choisissez-en un nouveau.'}
        </p>

        {horsLigne && (
          <div className={styles.infoBox}>
            <WifiOff size={15} /> Une connexion internet est nécessaire pour changer le mot de passe.
          </div>
        )}
        {error && <div className={styles.errorBox} role="alert">{error}</div>}

        <form onSubmit={handleSubmit} className={styles.form}>
          <label className={styles.label} htmlFor="ancien">
            {obligatoire ? 'Mot de passe temporaire' : 'Mot de passe actuel'}
          </label>
          <div className={styles.inputWrapper}>
            <Lock size={16} />
            <input
              id="ancien"
              type={visible ? 'text' : 'password'}
              value={ancien}
              onChange={(e) => setAncien(e.target.value)}
              autoComplete="current-password"
              autoFocus
            />
          </div>

          <label className={styles.label} htmlFor="nouveau">Nouveau mot de passe</label>
          <div className={styles.inputWrapper}>
            <Lock size={16} />
            <input
              id="nouveau"
              type={visible ? 'text' : 'password'}
              value={nouveau}
              onChange={(e) => setNouveau(e.target.value)}
              autoComplete="new-password"
            />
            <button
              type="button"
              className={styles.toggle}
              onClick={() => setVisible((v) => !v)}
              aria-label={visible ? 'Masquer les mots de passe' : 'Afficher les mots de passe'}
            >
              {visible ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          <label className={styles.label} htmlFor="confirmation">Confirmer le nouveau mot de passe</label>
          <div className={styles.inputWrapper}>
            <Lock size={16} />
            <input
              id="confirmation"
              type={visible ? 'text' : 'password'}
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              autoComplete="new-password"
            />
          </div>

          <ul className={styles.regles}>
            {regles.map((r) => (
              <li key={r.texte} className={r.ok ? styles.regleOk : ''}>
                {r.ok ? <Check size={13} /> : <Circle size={11} />} {r.texte}
              </li>
            ))}
          </ul>

          <button type="submit" className={styles.submit} disabled={!valide || saving || horsLigne}>
            {saving ? 'Enregistrement...' : <><ShieldCheck size={16} /> Enregistrer mon mot de passe</>}
          </button>
        </form>

        <button type="button" className={styles.lien} onClick={seDeconnecter}>
          {obligatoire ? 'Se déconnecter' : 'Annuler et me déconnecter'}
        </button>
      </div>
    </div>
  );
}

export default ChangerMotDePasse;
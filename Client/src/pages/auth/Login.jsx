import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Lock, Eye, EyeOff, GraduationCap, ArrowRight } from 'lucide-react';
import CONFIG from '../../config/config.js';
import styles from '../../theme/pages/auth/Login.module.css';

const REDIRECTIONS_PAR_ROLE = {
  directeur: '/dashboardAdmin',
  comptable: '/dashboardAdmin',
  secretaire: '/dashboardAdmin',
  surveillant: '/dashboardAdmin',
  enseignant: '/enseignant',
  parent: '/parent',
  eleve: '/eleve',
};

const TIMEOUT_MS = 20000;      // au-delà, on considère la requête perdue
const MAX_TENTATIVES = 3;

const MESSAGES_PANNE = {
  timeout: 'Le serveur met trop de temps à répondre. Vérifiez votre connexion puis réessayez.',
  reseau: 'Connexion impossible. Vérifiez votre accès internet puis réessayez.',
  serveur: 'Le service est momentanément indisponible. Réessayez dans une minute.',
  hors_ligne: "Vous n'êtes pas connecté à internet.",
};

const MESSAGES_ACCES = {
  expire: "L'abonnement de votre école est arrivé à échéance.",
  suspendu: "L'accès de votre école a été suspendu.",
  compte_desactive: 'Votre compte a été désactivé.',
  aucun_abonnement: "Aucun abonnement actif n'est associé à votre école.",
};

const pause = (ms) => new Promise((r) => setTimeout(r, ms));

const fetchAvecTimeout = async (url, options) => {
  const controller = new AbortController();
  const minuteur = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(minuteur);
  }
};

// Reprend uniquement en cas de panne technique (réseau, délai, 502/503/504).
// Une réponse 400/401/403 est définitive : jamais de nouvelle tentative.
const requete = async (url, options, surReprise) => {
  let panne = 'reseau';
  for (let essai = 1; essai <= MAX_TENTATIVES; essai++) {
    try {
      const res = await fetchAvecTimeout(url, options);
      if (![502, 503, 504].includes(res.status)) return res;
      panne = 'serveur';
    } catch (err) {
      panne = err.name === 'AbortError' ? 'timeout' : 'reseau';
    }
    if (essai < MAX_TENTATIVES) {
      surReprise(essai + 1);
      await pause(1500 * essai);
    }
  }
  const erreur = new Error(panne);
  erreur.code = panne;
  throw erreur;
};

// Une réponse HTML (page d'erreur) ne doit pas faire planter la lecture.
const lireJson = async (res) => {
  try {
    return await res.json();
  } catch {
    return {};
  }
};

const Login = () => {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [codeTechnique, setCodeTechnique] = useState('');
  const [statut, setStatut] = useState('');
  const [loading, setLoading] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (loading) return;

    setError('');
    setCodeTechnique('');
    if (!navigator.onLine) {
      setError(MESSAGES_PANNE.hors_ligne);
      return;
    }

    setLoading(true);
    setStatut('');
    const surReprise = (n) => setStatut(`Connexion lente, nouvelle tentative (${n}/${MAX_TENTATIVES})...`);

    try {
      const tokenRes = await requete(
        CONFIG.API_LOGIN,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password }),
        },
        surReprise
      );
      const tokenData = await lireJson(tokenRes);

      if (tokenRes.status === 429) {
        setError('Trop de tentatives de connexion. Patientez quelques minutes.');
        return;
      }
      if (tokenRes.status === 403 && tokenData.raison) {
        setError(MESSAGES_ACCES[tokenData.raison] || 'Accès actuellement indisponible.');
        return;
      }
      if (!tokenRes.ok || !tokenData.access) {
        if (tokenRes.status === 401) {
          setError(tokenData.detail || "Nom d'utilisateur ou mot de passe incorrect.");
        } else {
          setError('Le serveur a renvoyé une erreur inattendue. Réessayez.');
          setCodeTechnique(`http ${tokenRes.status}`);
        }
        return;
      }

      // Si le serveur renvoie déjà le profil, une seule requête suffit.
      let meData = tokenData.user;
      if (!meData) {
        const meRes = await requete(
          CONFIG.API_UTILISATEUR_MOI,
          { headers: { Authorization: `Bearer ${tokenData.access}` } },
          surReprise
        );
        meData = await lireJson(meRes);
        if (!meRes.ok) {
          setError(MESSAGES_ACCES[meData.raison] || 'Accès actuellement indisponible.');
          if (!meData.raison) setCodeTechnique(`http ${meRes.status}`);
          return;
        }
      }

      localStorage.setItem('access', tokenData.access);
      localStorage.setItem('refresh', tokenData.refresh);
      localStorage.setItem('user', JSON.stringify(meData));
      navigate(meData.is_superuser ? '/sylium' : (REDIRECTIONS_PAR_ROLE[meData.role] || '/dashboardAdmin'));
    } catch (err) {
      const code = err.code || 'reseau';
      setError(MESSAGES_PANNE[code] || MESSAGES_PANNE.reseau);
      setCodeTechnique(code);   // aide au diagnostic, sans rien révéler de sensible
    } finally {
      setLoading(false);
      setStatut('');
    }
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.logoBox}>
            <GraduationCap size={26} color="#fff" />
          </div>
          <div className={styles.eyebrow}>Sylium Intelligence Système</div>
          <h1 className={styles.title}>Gestion Scolaire</h1>
          <p className={styles.subtitle}>Connectez-vous à votre espace</p>
        </div>

        {error && (
          <div className={styles.errorBox} role="alert">
            {error}
            {codeTechnique && <span className={styles.errorCode}>Code : {codeTechnique}</span>}
          </div>
        )}

        {statut && <div className={styles.infoBox} role="status">{statut}</div>}

        <form onSubmit={handleLogin} className={styles.form}>
          <div>
            <label className={styles.label}>Nom d'utilisateur</label>
            <div className={styles.inputWrapper}>
              <User size={16} color="var(--color-text-dim)" />
              <input
                type="text"
                placeholder="Votre identifiant"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
              />
            </div>
          </div>

          <div>
            <label className={styles.label}>Mot de passe</label>
            <div className={styles.inputWrapper}>
              <Lock size={16} color="var(--color-text-dim)" />
              <input
                type={passwordVisible ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
              <button
                type="button"
                className={styles.toggleButton}
                onClick={() => setPasswordVisible(!passwordVisible)}
                aria-label={passwordVisible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
              >
                {passwordVisible ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button type="submit" disabled={loading || !username || !password} className={styles.submitButton}>
            {loading ? 'Connexion...' : <>Se connecter <ArrowRight size={16} /></>}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
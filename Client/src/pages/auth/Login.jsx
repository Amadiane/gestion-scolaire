import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User, Lock, Eye, EyeOff, GraduationCap, ArrowRight,
  BookOpen, Wallet, Users, ShieldCheck,
} from 'lucide-react';
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

const TIMEOUT_MS = 20000;
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

const FONCTIONS = [
  { icon: BookOpen, texte: 'Notes et bulletins PDF' },
  { icon: Wallet, texte: 'Frais, paiements et reçus' },
  { icon: Users, texte: 'Suivi des élèves et parents' },
];

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

// Nouvelle tentative uniquement en cas de panne technique, jamais sur un
// mauvais mot de passe.
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
      setCodeTechnique(code);
    } finally {
      setLoading(false);
      setStatut('');
    }
  };

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div
          className={styles.photo}
          role="img"
          aria-label="Enseignant et élèves utilisant une tablette en classe"
        />
        <div className={styles.shade} />

        <div className={styles.brand}>
          <div className={styles.logoMark}><GraduationCap size={20} color="#fff" /></div>
          <span>Sylium</span>
        </div>

        <div className={styles.heroInner}>
          <h2 className={styles.heroTitle}>
            Toute votre école, <span>au même endroit.</span>
          </h2>
          <p className={styles.heroText}>
            Élèves, notes, bulletins, paiements : une plateforme simple pour la direction,
            les enseignants et les parents.
          </p>
          <ul className={styles.features}>
            {FONCTIONS.map(({ icon: Icon, texte }) => (
              <li key={texte}><Icon size={15} /> {texte}</li>
            ))}
          </ul>
          <div className={styles.heroFooter}>
            <ShieldCheck size={15} /> Données hébergées de façon sécurisée
          </div>
        </div>
      </section>

      <main className={styles.panel}>
        <div className={styles.formWrap}>
          <div className={styles.header}>
            <h1 className={styles.title}>Bon retour 👋</h1>
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
              <label className={styles.label} htmlFor="username">Nom d'utilisateur</label>
              <div className={styles.inputWrapper}>
                <User size={17} />
                <input
                  id="username"
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
              <label className={styles.label} htmlFor="password">Mot de passe</label>
              <div className={styles.inputWrapper}>
                <Lock size={17} />
                <input
                  id="password"
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
                  {passwordVisible ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading || !username || !password} className={styles.submitButton}>
              {loading ? (
                <><span className={styles.spinner} /> Connexion...</>
              ) : (
                <>Se connecter <ArrowRight size={17} /></>
              )}
            </button>
          </form>

          <p className={styles.help}>
            Mot de passe oublié ? Contactez la direction de votre établissement.
          </p>
          <p className={styles.legal}>© Sylium Intelligence Système</p>
        </div>
      </main>
    </div>
  );
};

export default Login;
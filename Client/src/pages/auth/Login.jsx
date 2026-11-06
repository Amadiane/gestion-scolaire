import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User, Lock, Eye, EyeOff, GraduationCap, ArrowRight,
  BookOpen, Wallet, Users, ShieldCheck,
} from 'lucide-react';
import CONFIG from '../../config/config.js';
import styles from '../../theme/pages/auth/Login.module.css';
import {
  JETON_HORS_LIGNE, compteExiste, connexionHorsLigne, enregistrerCompte, effacerCle,
  DUREE_MAX_HORS_LIGNE_JOURS,
} from '../../offline/session.js';
import { prechargerDonnees } from '../../offline/precharge.js';

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

// Seul l'identifiant est mémorisé (jamais le mot de passe).
const CLE_DERNIER_IDENTIFIANT = 'dernier_identifiant';

const lireDernierIdentifiant = () => {
  try { return localStorage.getItem(CLE_DERNIER_IDENTIFIANT) || ''; } catch { return ''; }
};
const memoriserIdentifiant = (valeur) => {
  try { localStorage.setItem(CLE_DERNIER_IDENTIFIANT, valeur); } catch { /* ignoré */ }
};
const oublierIdentifiant = () => {
  try { localStorage.removeItem(CLE_DERNIER_IDENTIFIANT); } catch { /* ignoré */ }
};

const MESSAGES_PANNE = {
  timeout: 'Le serveur met trop de temps à répondre. Vérifiez votre connexion puis réessayez.',
  reseau: 'Connexion impossible. Vérifiez votre accès internet puis réessayez.',
  serveur: 'Le service est momentanément indisponible. Réessayez dans une minute.',
};

const MESSAGES_ACCES = {
  expire: "L'abonnement de votre école est arrivé à échéance.",
  suspendu: "L'accès de votre école a été suspendu.",
  compte_desactive: 'Votre compte a été désactivé.',
  aucun_abonnement: "Aucun abonnement actif n'est associé à votre école.",
};

const messageHorsLigne = (r) => {
  switch (r.raison) {
    case 'inconnu':
      return "Première connexion sur cet appareil : connectez-vous une fois avec internet pour activer le mode hors ligne.";
    case 'mot_de_passe':
      return "Nom d'utilisateur ou mot de passe incorrect.";
    case 'expire':
      return `Vous êtes resté plus de ${DUREE_MAX_HORS_LIGNE_JOURS} jours sans connexion. Reconnectez-vous avec internet.`;
    case 'verrouille':
      return `Trop d'essais. Réessayez dans ${r.minutes} minute(s).`;
    default:
      return "Le mode hors ligne n'est pas disponible sur ce navigateur.";
  }
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

  // L'identifiant de la dernière session est pré-rempli ; le mot de passe est toujours vide.
  const [memorise, setMemorise] = useState(lireDernierIdentifiant);
  const [username, setUsername] = useState(memorise);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [codeTechnique, setCodeTechnique] = useState('');
  const [statut, setStatut] = useState('');
  const [loading, setLoading] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);

  const usernameRef = useRef(null);
  const passwordRef = useRef(null);

  // Arriver sur le login efface la clé de chiffrement de la session précédente :
  // c'est ce qui sécurise la déconnexion.
  useEffect(() => { effacerCle(); }, []);

  // Curseur directement dans le mot de passe si l'identifiant est déjà connu.
  useEffect(() => {
    if (memorise) passwordRef.current?.focus();
    else usernameRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const changerUtilisateur = () => {
    oublierIdentifiant();
    setMemorise('');
    setUsername('');
    setPassword('');
    setError('');
    setCodeTechnique('');
    usernameRef.current?.focus();
  };

  const ouvrirSession = (user, access, refresh, identifiant) => {
    localStorage.setItem('access', access);
    localStorage.setItem('refresh', refresh);
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('compte_local', identifiant);
    memoriserIdentifiant(identifiant);

    // Destination retenue avant la connexion (scan d'une carte). Utilisée une seule fois.
    let destination = null;
    try {
      destination = sessionStorage.getItem('apres_connexion');
      sessionStorage.removeItem('apres_connexion');
    } catch { /* ignoré */ }

    // Mot de passe temporaire : le choix du mot de passe passe avant tout.
    if (user.doit_changer_mdp) {
      navigate('/changer-mot-de-passe');
      return;
    }
    // Seules les adresses de cartes sont acceptées : aucune redirection vers un autre site possible.
    if (destination && destination.startsWith('/carte/') && !user.is_superuser) {
      navigate(destination);
      return;
    }
    navigate(user.is_superuser ? '/sylium' : (REDIRECTIONS_PAR_ROLE[user.role] || '/dashboardAdmin'));
  };

  // Connexion avec les données enregistrées sur l'appareil.
  const tenterHorsLigne = async (identifiant) => {
    setStatut('Vérification sur cet appareil...');
    const r = await connexionHorsLigne(identifiant, password);
    if (r.ok) {
      ouvrirSession(r.user, JETON_HORS_LIGNE, r.refresh, identifiant);
      return true;
    }
    setError(messageHorsLigne(r));
    return false;
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (loading) return;

    const identifiant = username.trim();
    setError('');
    setCodeTechnique('');
    setLoading(true);
    setStatut('');

    try {
      // Sans réseau : on tente directement la connexion locale.
      if (!navigator.onLine) {
        await tenterHorsLigne(identifiant);
        return;
      }

      const surReprise = (n) => setStatut(`Connexion lente, nouvelle tentative (${n}/${MAX_TENTATIVES})...`);

      let tokenRes;
      try {
        tokenRes = await requete(
          CONFIG.API_LOGIN,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: identifiant, password }),
          },
          surReprise
        );
      } catch (err) {
        // Panne technique : si cet appareil connaît déjà le compte, on bascule en hors ligne.
        const code = err.code || 'reseau';
        if (await compteExiste(identifiant)) {
          await tenterHorsLigne(identifiant);
          return;
        }
        setError(MESSAGES_PANNE[code] || MESSAGES_PANNE.reseau);
        setCodeTechnique(code);
        return;
      }

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
      // On relit le profil si la réponse de connexion n'indique pas
      // l'obligation de changer de mot de passe.
      if (!meData || !('doit_changer_mdp' in meData)) {
        try {
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
        } catch (err) {
          const code = err.code || 'reseau';
          setError(MESSAGES_PANNE[code] || MESSAGES_PANNE.reseau);
          setCodeTechnique(code);
          return;
        }
      }

      // Enregistrement local puis préchargement, en arrière-plan
      // (ne bloque jamais la connexion).
      enregistrerCompte({ username: identifiant, password, user: meData, refresh: tokenData.refresh })
        .then((ok) => ok && prechargerDonnees())
        .catch(() => {});

      ouvrirSession(meData, tokenData.access, tokenData.refresh, identifiant);
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
            <p className={styles.subtitle}>
              {memorise ? 'Saisissez votre mot de passe pour continuer' : 'Connectez-vous à votre espace'}
            </p>
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
                  ref={usernameRef}
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
              {memorise && (
                <button type="button" className={styles.changerUser} onClick={changerUtilisateur}>
                  Ce n'est pas vous ? Changer d'utilisateur
                </button>
              )}
            </div>

            <div>
              <label className={styles.label} htmlFor="password">Mot de passe</label>
              <div className={styles.inputWrapper}>
                <Lock size={17} />
                <input
                  ref={passwordRef}
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
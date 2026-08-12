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

const Login = () => {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const tokenRes = await fetch(CONFIG.API_LOGIN, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const tokenData = await tokenRes.json();

      if (!tokenRes.ok || !tokenData.access) {
        setError(tokenData.detail || "Nom d'utilisateur ou mot de passe incorrect");
        return;
      }

      const meRes = await fetch(CONFIG.API_UTILISATEUR_MOI, {
        headers: { Authorization: `Bearer ${tokenData.access}` },
      });
      const meData = await meRes.json();

      if (!meRes.ok) {
        const messages = {
          expire: "L'abonnement de votre école est arrivé à échéance.",
          suspendu: "L'accès de votre école a été suspendu.",
          compte_desactive: "Votre compte a été désactivé.",
          aucun_abonnement: "Aucun abonnement actif n'est associé à votre école.",
        };
        setError(messages[meData.raison] || "Accès actuellement indisponible.");
        return;
      }

      localStorage.setItem('access', tokenData.access);
      localStorage.setItem('refresh', tokenData.refresh);
      localStorage.setItem('user', JSON.stringify(meData));
      navigate(REDIRECTIONS_PAR_ROLE[meData.role] || '/dashboardAdmin');
    } catch {
      setError('Impossible de se connecter au serveur.');
    } finally {
      setLoading(false);
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

        {error && <div className={styles.errorBox}>{error}</div>}

        <form onSubmit={handleLogin} className={styles.form}>
          <div>
            <label className={styles.label}>Nom d'utilisateur</label>
            <div className={styles.inputWrapper}>
              <User size={16} color="var(--color-text-dim)" />
              <input
                type="text"
                placeholder="Votre identifiant"
                value={username}
                onChange={e => setUsername(e.target.value)}
                autoComplete="username"
              />
            </div>
          </div>

          <div>
            <label className={styles.label}>Mot de passe</label>
            <div className={styles.inputWrapper}>
              <Lock size={16} color="var(--color-text-dim)" />
              <input
                type={passwordVisible ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
              />
              <button
                type="button"
                className={styles.toggleButton}
                onClick={() => setPasswordVisible(!passwordVisible)}
                aria-label={passwordVisible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
              >
                {passwordVisible ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button type="submit" disabled={loading || !username || !password} className={styles.submitButton}>
            {loading ? "Connexion..." : <>Se connecter <ArrowRight size={16} /></>}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
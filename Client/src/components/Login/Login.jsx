// src/pages/Login.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Lock, Eye, EyeOff, GraduationCap, ArrowRight } from 'lucide-react';
import CONFIG from '../../config/config.js';

const SS = {
  primary:      "#1E3A5F",
  primaryLight: "#2E5680",
  primaryDark:  "#122842",
  accent:       "#2F8F5B",
  accentLight:  "#E8F5EE",
  bg:           "#F7F8FA",
  surface:      "#FFFFFF",
  card:         "#F0F2F5",
  border:       "#DCE1E8",
  text:         "#1A2333",
  textMuted:    "#5B6472",
  textDim:      "#96A0AC",
  danger:       "#A32020",
  dangerBg:     "#FDEAEA",
};

// Chaque rôle "administratif" (Directeur, Comptable, Secrétaire, Surveillant)
// partage le même tableau de bord — cohérent avec DashboardAdmin.jsx.
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
  const [username, setUsername]               = useState('');
  const [password, setPassword]               = useState('');
  const [error, setError]                     = useState('');
  const [loading, setLoading]                 = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [focusUser, setFocusUser]             = useState(false);
  const [focusPass, setFocusPass]             = useState(false);

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
        setLoading(false);
        return;
      }

      const meRes = await fetch(CONFIG.API_UTILISATEUR_MOI, {
        headers: { Authorization: `Bearer ${tokenData.access}` },
      });
      const meData = await meRes.json();

      if (!meRes.ok) {
        if (meData.erreur === 'acces_bloque') {
          const messages = {
            expire: "L'abonnement de votre école est arrivé à échéance. Contactez l'administration.",
            suspendu: "L'accès de votre école a été suspendu. Contactez l'administration.",
            compte_desactive: "Votre compte a été désactivé. Contactez l'administration.",
            aucun_abonnement: "Aucun abonnement actif n'est associé à votre école.",
          };
          setError(messages[meData.raison] || "Accès actuellement indisponible.");
        } else {
          setError("Impossible de récupérer votre profil.");
        }
        setLoading(false);
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
    <div style={{
      minHeight: "100vh", background: SS.bg,
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "16px", fontFamily: "'Inter', system-ui, sans-serif",
    }}>
      <div style={{ width: "100%", maxWidth: "420px" }}>
        <div style={{
          background: SS.surface, border: `1px solid ${SS.border}`,
          borderRadius: "16px", padding: "40px 36px",
          boxShadow: "0 4px 24px rgba(30, 58, 95, 0.08)",
          position: "relative", overflow: "hidden",
        }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "4px", background: SS.primary }} />

          <div style={{ textAlign: "center", marginBottom: "32px" }}>
            <div style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              width: "60px", height: "60px", borderRadius: "14px",
              background: SS.primary, marginBottom: "16px",
            }}>
              <GraduationCap size={26} color="#fff" />
            </div>
            <div style={{ fontSize: "11px", color: SS.textDim, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "6px" }}>
              Sylium Intelligence Système
            </div>
            <h1 style={{ fontSize: "22px", fontWeight: "700", color: SS.primary, margin: "0 0 4px" }}>
              Gestion Scolaire
            </h1>
            <p style={{ fontSize: "13px", color: SS.textMuted, margin: 0 }}>
              Connectez-vous à votre espace
            </p>
          </div>

          {error && (
            <div style={{ marginBottom: "20px", padding: "12px 14px", background: SS.dangerBg, border: `1px solid ${SS.danger}30`, borderRadius: "8px", color: SS.danger, fontSize: "13px" }}>
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div>
              <label style={{ fontSize: "12px", fontWeight: "600", color: SS.textMuted, display: "block", marginBottom: "8px" }}>
                Nom d'utilisateur
              </label>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "0 14px", background: SS.card, border: `1px solid ${focusUser ? SS.primary : SS.border}`, borderRadius: "8px", transition: "border-color 0.15s" }}>
                <User size={16} color={focusUser ? SS.primary : SS.textDim} />
                <input type="text" placeholder="Votre identifiant" value={username}
                  onChange={e => setUsername(e.target.value)}
                  onFocus={() => setFocusUser(true)} onBlur={() => setFocusUser(false)}
                  style={{ flex: 1, background: "none", border: "none", outline: "none", color: SS.text, fontSize: "14px", padding: "12px 0" }} />
              </div>
            </div>

            <div>
              <label style={{ fontSize: "12px", fontWeight: "600", color: SS.textMuted, display: "block", marginBottom: "8px" }}>
                Mot de passe
              </label>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "0 14px", background: SS.card, border: `1px solid ${focusPass ? SS.primary : SS.border}`, borderRadius: "8px", transition: "border-color 0.15s" }}>
                <Lock size={16} color={focusPass ? SS.primary : SS.textDim} />
                <input type={passwordVisible ? "text" : "password"} placeholder="••••••••" value={password}
                  onChange={e => setPassword(e.target.value)}
                  onFocus={() => setFocusPass(true)} onBlur={() => setFocusPass(false)}
                  style={{ flex: 1, background: "none", border: "none", outline: "none", color: SS.text, fontSize: "14px", padding: "12px 0" }} />
                <button type="button" onClick={() => setPasswordVisible(!passwordVisible)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: SS.textDim, display: "flex", padding: 0 }}>
                  {passwordVisible ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading || !username || !password}
              style={{
                marginTop: "8px", padding: "13px", borderRadius: "8px", border: "none",
                background: loading || !username || !password ? SS.card : SS.primary,
                color: loading || !username || !password ? SS.textDim : "#fff",
                fontSize: "14px", fontWeight: "600",
                cursor: loading || !username || !password ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                transition: "background 0.15s",
              }}>
              {loading ? "Connexion..." : <>Se connecter <ArrowRight size={16} /></>}
            </button>
          </form>

          <div style={{ marginTop: "24px", paddingTop: "20px", borderTop: `1px solid ${SS.border}`, textAlign: "center" }}>
            <div style={{ fontSize: "12px", color: SS.textDim }}>Accès réservé au personnel de l'établissement</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
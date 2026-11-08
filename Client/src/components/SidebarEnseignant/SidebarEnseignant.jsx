import { NavLink } from 'react-router-dom';
// import { LayoutDashboard, BookOpen, School, ClipboardCheck, KeyRound, LogOut, X } from 'lucide-react';
import {
  LayoutDashboard, Users, School, BookOpen, FileText, UserCog,
  Calendar, CalendarDays, CalendarClock, Wallet, ShieldCheck, ClipboardList, Briefcase, CreditCard,
  Building2, ClipboardCheck, UserCheck, KeyRound, LogOut, X, MessageCircle, BellRing,
} from 'lucide-react';
import styles from '../../theme/components/SidebarEnseignant.module.css';

const SECTIONS = [
  {
    titre: null,
    liens: [
      { to: '/enseignant', label: 'Tableau de bord', icon: LayoutDashboard, end: true },
      { to: '/enseignant/mes-classes', label: 'Mes classes', icon: School },
    ],
  },
  {
    titre: 'Mon travail',
    liens: [
      { to: '/enseignant/presences', label: "Faire l'appel", icon: ClipboardCheck },
      { to: '/enseignant/notes', label: 'Saisir des notes', icon: BookOpen },
      { to: '/enseignant/emploi', label: 'Mon emploi du temps', icon: CalendarClock },
    ],
  },
];

const SidebarEnseignant = ({ isOpen, onClose }) => {
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const handleLogout = () => {
    localStorage.removeItem('access');
    localStorage.removeItem('refresh');
    localStorage.removeItem('user');
    window.location.href = '/login';
  };

  return (
    <>
      {isOpen && <div className={styles.overlay} onClick={onClose} />}

      <aside className={`${styles.sidebar} ${isOpen ? styles.sidebarOpen : ''}`}>
        <div className={styles.header}>
          <div className={styles.logo}>SI</div>
          <div>
            <div className={styles.brand}>Sylium</div>
            <div className={styles.brandSub}>Espace Enseignant</div>
          </div>
          <button className={styles.closeButton} onClick={onClose} aria-label="Fermer le menu">
            <X size={20} />
          </button>
        </div>

        <nav className={styles.nav}>
          {SECTIONS.map((section, i) => (
            <div key={section.titre || `section-${i}`}>
              {section.titre && <div className={styles.sectionTitle}>{section.titre}</div>}
              {section.liens.map(({ to, label, icon: Icon, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  onClick={onClose}
                  className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
                >
                  <Icon size={18} />
                  <span>{label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className={styles.footer}>
          <div className={styles.userBox}>
            <div className={styles.userAvatar}>
              {(user.first_name?.[0] || user.username?.[0] || '?').toUpperCase()}
            </div>
            <div>
              <div className={styles.userName}>{user.first_name || user.username}</div>
              <div className={styles.userRole}>Enseignant</div>
            </div>
          </div>
          <NavLink to="/changer-mot-de-passe" onClick={onClose} className={styles.passwordLink}>
            <KeyRound size={15} /> Mon mot de passe
          </NavLink>
          <button className={styles.logoutButton} onClick={handleLogout}>
            <LogOut size={16} /> Déconnexion
          </button>
        </div>
      </aside>
    </>
  );
};

export default SidebarEnseignant;
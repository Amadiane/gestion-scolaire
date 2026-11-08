// src/components/Sidebar/Sidebar.jsx
import { NavLink } from 'react-router-dom';
// import {
//   LayoutDashboard, Users, School, BookOpen, FileText, UserCog,
//   Calendar, CalendarDays, Wallet, ShieldCheck, ClipboardList, Briefcase, CreditCard,
//   Building2, ClipboardCheck, UserCheck, KeyRound, LogOut, X, MessageCircle, BellRing,
// } from 'lucide-react';
import {
  LayoutDashboard, Users, School, BookOpen, FileText, UserCog,
  Calendar, CalendarDays, CalendarClock, Wallet, ShieldCheck, ClipboardList, Briefcase, CreditCard,
  Building2, ClipboardCheck, UserCheck, KeyRound, LogOut, X, MessageCircle, BellRing,
} from 'lucide-react';
import styles from '../../theme/components/Sidebar.module.css';

// `roles` limite l'affichage du lien. Le vrai contrôle d'accès reste côté
// backend : masquer un lien n'est qu'une question d'ergonomie.
// Les liens sont regroupés par thème ; un groupe sans lien visible n'est pas affiché.
const SECTIONS = [
  {
    titre: null,
    liens: [
      { to: '/dashboardAdmin', label: 'Tableau de bord', icon: LayoutDashboard, end: true },
    ],
  },
  {
    titre: 'Scolarité',
    liens: [
      { to: '/dashboardAdmin/eleves', label: 'Élèves', icon: Users },
      { to: '/dashboardAdmin/parents', label: 'Parents', icon: UserCog },
      { to: '/dashboardAdmin/classes', label: 'Classes', icon: School },
      { to: '/dashboardAdmin/notes', label: 'Notes', icon: BookOpen },
      { to: '/dashboardAdmin/bulletins', label: 'Bulletins', icon: FileText },
      { to: '/dashboardAdmin/cartes', label: 'Cartes', icon: CreditCard, roles: ['directeur', 'secretaire'] },
      { to: '/dashboardAdmin/emplois-du-temps', label: 'Emplois du temps', icon: CalendarClock },
    ],
  },
  {
    titre: 'Présences',
    liens: [
      { to: '/dashboardAdmin/presences', label: 'Faire l\'appel', icon: ClipboardCheck, roles: ['directeur', 'secretaire', 'surveillant'] },
      { to: '/dashboardAdmin/presences-suivi', label: 'Suivi des présences', icon: CalendarDays, roles: ['directeur', 'secretaire', 'surveillant'] },
      { to: '/dashboardAdmin/alertes-parents', label: 'Alertes parents', icon: MessageCircle, roles: ['directeur', 'secretaire', 'surveillant'] },
      { to: '/dashboardAdmin/presences-personnel', label: 'Présences personnel', icon: UserCheck, roles: ['directeur'] },
    ],
  },
  {
    titre: 'Finance',
    liens: [
      { to: '/dashboardAdmin/finance', label: 'Finance', icon: Wallet, roles: ['directeur', 'comptable'] },
      { to: '/dashboardAdmin/relances-paiement', label: 'Relances paiement', icon: BellRing, roles: ['directeur', 'comptable'] },
    ],
  },
  {
    titre: 'Administration',
    liens: [
      { to: '/dashboardAdmin/personnel', label: 'Personnel', icon: Briefcase, roles: ['directeur'] },
      { to: '/dashboardAdmin/annees-scolaires', label: 'Années scolaires', icon: Calendar },
      { to: '/dashboardAdmin/utilisateurs', label: 'Utilisateurs', icon: ShieldCheck, roles: ['directeur'] },
      { to: '/dashboardAdmin/affectations', label: 'Affectations', icon: ClipboardList, roles: ['directeur'] },
      { to: '/dashboardAdmin/mon-ecole', label: 'Mon école', icon: Building2, roles: ['directeur'] },
    ],
  },
];

const Sidebar = ({ isOpen, onClose }) => {
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const handleLogout = () => {
    localStorage.removeItem('access');
    localStorage.removeItem('refresh');
    localStorage.removeItem('user');
    window.location.href = '/login';
  };

  const sections = SECTIONS
    .map((s) => ({ ...s, liens: s.liens.filter((l) => !l.roles || l.roles.includes(user.role)) }))
    .filter((s) => s.liens.length > 0);

  return (
    <>
      {isOpen && <div className={styles.overlay} onClick={onClose} />}

      <aside className={`${styles.sidebar} ${isOpen ? styles.sidebarOpen : ''}`}>
        <div className={styles.header}>
          <div className={styles.logo}>SI</div>
          <div>
            <div className={styles.brand}>Sylium</div>
            <div className={styles.brandSub}>Gestion Scolaire</div>
          </div>
          <button className={styles.closeButton} onClick={onClose} aria-label="Fermer le menu">
            <X size={20} />
          </button>
        </div>

        <nav className={styles.nav}>
          {sections.map((section, i) => (
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
              <div className={styles.userRole}>{user.role}</div>
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

export default Sidebar;
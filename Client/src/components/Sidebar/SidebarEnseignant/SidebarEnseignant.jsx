import { NavLink } from 'react-router-dom';
import { LayoutDashboard, BookOpen, School, LogOut, X } from 'lucide-react';
import styles from '../../theme/components/SidebarEnseignant.module.css';

const NAV_ITEMS = [
  { to: '/enseignant', label: 'Tableau de bord', icon: LayoutDashboard, end: true },
  { to: '/enseignant/mes-classes', label: 'Mes classes', icon: School },
  { to: '/enseignant/notes', label: 'Saisir des notes', icon: BookOpen },
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
          {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
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
          <button className={styles.logoutButton} onClick={handleLogout}>
            <LogOut size={16} /> Déconnexion
          </button>
        </div>
      </aside>
    </>
  );
};

export default SidebarEnseignant;
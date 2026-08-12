import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Menu } from 'lucide-react';
import SidebarEnseignant from '../components/SidebarEnseignant/SidebarEnseignant.jsx';
import styles from '../theme/layouts/AdminLayout.module.css';

const EnseignantLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className={styles.wrapper}>
      <SidebarEnseignant isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <button className={styles.menuButton} onClick={() => setSidebarOpen(true)} aria-label="Ouvrir le menu">
        <Menu size={22} />
      </button>

      <main className={styles.content}>
        <Outlet />
      </main>
    </div>
  );
};

export default EnseignantLayout;
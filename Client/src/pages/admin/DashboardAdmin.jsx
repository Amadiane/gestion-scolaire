import styles from '../../theme/pages/admin/DashboardAdmin.module.css';

const DashboardAdmin = () => {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  return (
    <div className={styles.wrapper}>
      <h1 className={styles.title}>Tableau de bord</h1>
      <p className={styles.subtitle}>Bienvenue, {user.first_name || user.username}</p>
    </div>
  );
};

export default DashboardAdmin;
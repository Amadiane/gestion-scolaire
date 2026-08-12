import styles from '../../theme/pages/enseignant/DashboardEnseignant.module.css';

const DashboardEnseignant = () => {
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  return (
    <div className={styles.wrapper}>
      <h1 className={styles.title}>Tableau de bord</h1>
      <p className={styles.subtitle}>Bienvenue, {user.first_name || user.username}</p>

      <div className={styles.placeholderCard}>
        <p>La liste de vos classes et la saisie de notes seront bientôt disponibles ici.</p>
      </div>
    </div>
  );
};

export default DashboardEnseignant;
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import styles from '../../theme/components/BoutonRetour.module.css';

const BoutonRetour = ({ vers, label = 'Retour au tableau de bord' }) => {
  const navigate = useNavigate();
  return (
    <button className={styles.bouton} onClick={() => navigate(vers)}>
      <ArrowLeft size={16} /> {label}
    </button>
  );
};

export default BoutonRetour;
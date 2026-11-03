import { AlertTriangle } from 'lucide-react';
import styles from '../../theme/components/FenetresCompte.module.css';

const FenetreConfirmation = ({
  titre, message, confirmer = 'Confirmer', annuler = 'Annuler',
  danger = false, enCours = false, onConfirm, onCancel,
}) => (
  <div className={styles.overlay} onClick={onCancel}>
    <div className={styles.fenetre} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
      <div className={`${styles.icone} ${danger ? styles.iconeDanger : styles.iconeAlerte}`}>
        <AlertTriangle size={22} />
      </div>
      <h3 className={styles.titre}>{titre}</h3>
      <p className={styles.message}>{message}</p>
      <div className={styles.actions}>
        <button type="button" className={styles.secondaire} onClick={onCancel} disabled={enCours}>
          {annuler}
        </button>
        <button
          type="button"
          className={danger ? styles.danger : styles.primaire}
          onClick={onConfirm}
          disabled={enCours}
        >
          {enCours ? 'Veuillez patienter...' : confirmer}
        </button>
      </div>
    </div>
  </div>
);

export default FenetreConfirmation;
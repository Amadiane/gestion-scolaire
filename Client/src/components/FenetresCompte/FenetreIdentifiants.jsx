import { useState } from 'react';
import { KeyRound, Copy, Check, Eye, EyeOff, Info } from 'lucide-react';
import styles from '../../theme/components/FenetresCompte.module.css';

const FenetreIdentifiants = ({ titre, nom, username, motDePasse, onClose }) => {
  const [visible, setVisible] = useState(true);
  const [copie, setCopie] = useState(false);

  const copier = async () => {
    const texte = `Identifiant : ${username}\nMot de passe temporaire : ${motDePasse}`;
    try {
      await navigator.clipboard.writeText(texte);
      setCopie(true);
      setTimeout(() => setCopie(false), 2000);
    } catch {
      /* copie indisponible : le mot de passe reste lisible à l'écran */
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.fenetre} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className={`${styles.icone} ${styles.iconeOk}`}><KeyRound size={22} /></div>
        <h3 className={styles.titre}>{titre}</h3>
        {nom && <p className={styles.message}>Compte de <strong>{nom}</strong></p>}

        <div className={styles.carteIds}>
          <div className={styles.ligneId}>
            <span>Identifiant</span>
            <strong>{username}</strong>
          </div>
          <div className={styles.ligneId}>
            <span>Mot de passe temporaire</span>
            <strong className={styles.mdp}>{visible ? motDePasse : '••••••••••'}</strong>
            <button
              type="button"
              className={styles.oeil}
              onClick={() => setVisible((v) => !v)}
              aria-label={visible ? 'Masquer' : 'Afficher'}
            >
              {visible ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </div>

        <div className={styles.note}>
          <Info size={15} />
          <span>
            Ce mot de passe est <strong>temporaire</strong> et ne sera plus jamais affiché.
            À sa première connexion, l'utilisateur devra choisir son propre mot de passe.
          </span>
        </div>

        <div className={styles.actions}>
          <button type="button" className={styles.secondaire} onClick={copier}>
            {copie ? <><Check size={15} /> Copié</> : <><Copy size={15} /> Copier</>}
          </button>
          <button type="button" className={styles.primaire} onClick={onClose}>J'ai transmis les accès</button>
        </div>
      </div>
    </div>
  );
};

export default FenetreIdentifiants;
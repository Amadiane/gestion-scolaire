import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ScanLine } from 'lucide-react';
import api from '../../services/api.js';
import CONFIG from '../../config/config.js';
import BoutonRetour from '../../components/BoutonRetour/BoutonRetour.jsx';
import styles from '../../theme/pages/admin/Personnel.module.css';

// Page ouverte par le QR code d'une carte : retrouve la personne et ouvre sa fiche.
const ScanCarte = () => {
  const { matricule } = useParams();
  const navigate = useNavigate();
  const [message, setMessage] = useState('Recherche de la carte...');
  const [erreur, setErreur] = useState(false);

  useEffect(() => {
    let annule = false;

    const echec = (texte) => {
      if (annule) return;
      setErreur(true);
      setMessage(texte);
    };

    const chercher = async () => {
      const code = decodeURIComponent(matricule || '').trim().toUpperCase();
      try {
        if (code.includes('-PERS-')) {
          const res = await api.get(CONFIG.API_PERSONNEL);
          if (annule) return;
          const membre = res.data.find((m) => String(m.matricule).toUpperCase() === code);
          if (membre) {
            navigate(`/dashboardAdmin/personnel?q=${encodeURIComponent(membre.matricule)}`, { replace: true });
          } else {
            echec(`Aucun membre du personnel ne porte le matricule ${code} dans votre école.`);
          }
        } else {
          const res = await api.get(CONFIG.API_ELEVES);
          if (annule) return;
          const eleve = res.data.find((e) => String(e.matricule).toUpperCase() === code);
          if (eleve) {
            navigate(`/dashboardAdmin/eleves/${eleve.id}`, { replace: true });
          } else {
            echec(`Aucun élève ne porte le matricule ${code} dans votre école.`);
          }
        }
      } catch (err) {
        echec(
          err.response?.status === 403
            ? "Vous n'avez pas le droit de consulter cette fiche."
            : 'Impossible de rechercher cette carte. Vérifiez votre connexion.'
        );
      }
    };

    chercher();
    return () => { annule = true; };
  }, [matricule, navigate]);

  return (
    <div className={styles.wrapper}>
      <BoutonRetour vers="/dashboardAdmin" />
      <div className={styles.emptyState}>
        <ScanLine size={40} color="var(--color-text-dim)" />
        <p className={erreur ? styles.errorMsg : styles.stateMsg}>{message}</p>
      </div>
    </div>
  );
};

export default ScanCarte;
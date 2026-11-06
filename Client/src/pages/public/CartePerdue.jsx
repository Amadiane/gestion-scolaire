import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { GraduationCap, Phone, LogIn, Loader2 } from 'lucide-react';
import CONFIG from '../../config/config.js';
import styles from '../../theme/pages/public/CartePerdue.module.css';

// Déduit l'adresse de l'API publique à partir de celle du personnel (…/api/personnel/).
const urlPublique = (matricule) =>
  CONFIG.API_PERSONNEL.replace(/personnel\/?$/, '') + `carte-publique/${encodeURIComponent(matricule)}/`;

const CartePerdue = () => {
  const { matricule } = useParams();
  const navigate = useNavigate();
  const [ecole, setEcole] = useState(null);
  const [telephone, setTelephone] = useState('');
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    const controleur = new AbortController();
    (async () => {
      try {
        const res = await fetch(urlPublique(matricule), { signal: controleur.signal });
        if (res.ok) {
          const data = await res.json();
          setEcole(data.ecole || null);
          setTelephone(data.telephone || '');
        }
      } catch {
        /* hors ligne ou erreur : on affiche le message général */
      } finally {
        setChargement(false);
      }
    })();
    return () => controleur.abort();
  }, [matricule]);

  const seConnecter = () => {
    try { sessionStorage.setItem('apres_connexion', `/carte/${encodeURIComponent(matricule)}`); } catch { /* ignoré */ }
    navigate('/login');
  };

  return (
    <main className={styles.page}>
      <section className={styles.carte}>
        <div className={styles.logo}><GraduationCap size={28} color="#fff" /></div>

        {chargement ? (
          <p className={styles.chargement}><Loader2 size={18} className={styles.tourne} /> Chargement…</p>
        ) : (
          <>
            <p className={styles.etiquette}>Carte d'identité scolaire</p>
            <h1 className={styles.ecole}>{ecole || 'Établissement scolaire'}</h1>

            <p className={styles.texte}>
              Cette carte appartient à {ecole ? `l'école ${ecole}` : 'un établissement scolaire'}.
              Si vous l'avez trouvée, merci de la rapporter au secrétariat de l'école.
            </p>

            {telephone ? (
              <a className={styles.appel} href={`tel:${telephone.replace(/\s+/g, '')}`}>
                <Phone size={17} /> Appeler l'école · {telephone}
              </a>
            ) : (
              <p className={styles.texteDiscret}>Contactez directement l'établissement.</p>
            )}
          </>
        )}

        <button type="button" className={styles.personnel} onClick={seConnecter}>
          <LogIn size={15} /> Personnel de l'école : se connecter
        </button>
      </section>

      <p className={styles.pied}>Sylium Intelligence Système</p>
    </main>
  );
};

export default CartePerdue;
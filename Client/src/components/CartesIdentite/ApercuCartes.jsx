import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import QRCode from 'qrcode';
import { X, Printer } from 'lucide-react';
import styles from '../../theme/components/CartesIdentite.module.css';

// Le QR code contient un lien vers l'application : l'appareil photo d'un téléphone
// l'ouvre directement. Sans connexion, la page n'affiche que le nom et le téléphone de l'école.
const lienCarte = (matricule) => `${window.location.origin}/carte/${encodeURIComponent(matricule)}`;

// Téléphone de l'école : fourni par la page appelante, sinon lu dans la session.
const telephoneEcole = (ecoleTel) => {
  if (ecoleTel !== undefined) return ecoleTel;
  try {
    return JSON.parse(localStorage.getItem('user') || '{}').ecole_telephone || '';
  } catch {
    return '';
  }
};

const ApercuCartes = ({ cartes, ecoleNom, ecoleTel, onClose }) => {
  const [qr, setQr] = useState({});
  const ecole = ecoleNom || 'Établissement';
  const telEcole = telephoneEcole(ecoleTel);

  useEffect(() => {
    let annule = false;
    (async () => {
      const resultat = {};
      for (const c of cartes) {
        try {
          resultat[c.cle] = await QRCode.toDataURL(lienCarte(c.matricule), {
            margin: 0, width: 300, errorCorrectionLevel: 'M',
          });
        } catch {
          /* QR indisponible pour cette carte : elle s'imprime sans */
        }
      }
      if (!annule) setQr(resultat);
    })();
    return () => { annule = true; };
  }, [cartes]);

  return createPortal(
    <div className={styles.overlay}>
      <div className={styles.barre}>
        <strong>{cartes.length} carte(s)</strong>
        <span className={styles.astuce}>
          Format carte bancaire, 8 par page A4. Dans la fenêtre d'impression, laissez les marges sur « Par défaut ».
        </span>
        <div className={styles.barreActions}>
          <button className={styles.imprimer} onClick={() => window.print()}>
            <Printer size={16} /> Imprimer
          </button>
          <button className={styles.fermer} onClick={onClose} aria-label="Fermer">
            <X size={18} />
          </button>
        </div>
      </div>

      <div className={styles.feuille}>
        {cartes.map((c) => (
          <article key={c.cle} className={styles.carte}>
            <header className={`${styles.entete} ${c.type === 'personnel' ? styles.entetePersonnel : ''}`}>
              <span className={styles.ecole}>{ecole}</span>
              <small>{c.type === 'eleve' ? "Carte d'élève" : 'Carte du personnel'}</small>
            </header>

            <div className={styles.corps}>
              <div className={styles.photo}>
                {c.photo ? (
                  <img src={c.photo} alt="" />
                ) : (
                  <span>{c.prenom?.[0]}{c.nom?.[0]}</span>
                )}
              </div>

              <div className={styles.infos}>
                <strong className={styles.nom}>{c.nom}</strong>
                <span className={styles.prenom}>{c.prenom}</span>
                <span className={styles.ligne}>{c.ligne}</span>
                <span className={styles.matricule}>{c.matricule}</span>
              </div>

              {qr[c.cle] && <img className={styles.qr} src={qr[c.cle]} alt="" />}
            </div>

            <p className={styles.pied}>
              Si trouvée, merci de rapporter à l'école{telEcole ? ` · ${telEcole}` : ''}
            </p>
          </article>
        ))}
      </div>
    </div>,
    document.body
  );
};

export default ApercuCartes;
import { useEffect, useState } from 'react';
import { Building2, Phone, Mail, Hash, CheckCircle2, AlertTriangle, Info } from 'lucide-react';
import api from '../../services/api.js';
import CONFIG from '../../config/config.js';
import styles from '../../theme/pages/admin/MonEcole.module.css';

// Déduit l'adresse de l'API à partir de celle du personnel (…/api/personnel/).
const URL_MON_ECOLE = CONFIG.API_PERSONNEL.replace(/personnel\/?$/, 'mon-ecole/');

const messageErreur = (err) => {
  const data = err.response?.data;
  if (data && typeof data === 'object') {
    const premier = data.detail || Object.values(data)[0];
    return Array.isArray(premier) ? premier[0] : String(premier);
  }
  const code = err.response?.status;
  return code
    ? `Erreur serveur (code ${code}). Réessayez ou contactez le support.`
    : "Impossible d'enregistrer. Vérifiez votre connexion.";
};

const MonEcole = () => {
  const [ecole, setEcole] = useState(null);
  const [telephone, setTelephone] = useState('');
  const [email, setEmail] = useState('');
  const [chargement, setChargement] = useState(true);
  const [enregistrement, setEnregistrement] = useState(false);
  const [erreur, setErreur] = useState('');
  const [succes, setSucces] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get(URL_MON_ECOLE);
        setEcole(data);
        setTelephone(data.telephone || '');
        setEmail(data.email_contact || '');
      } catch (err) {
        setErreur(
          err.response ? messageErreur(err) : 'Cette page nécessite une connexion internet.'
        );
      } finally {
        setChargement(false);
      }
    })();
  }, []);

  // Rien à enregistrer tant que les valeurs sont celles du serveur.
  const modifie =
    ecole && (telephone.trim() !== (ecole.telephone || '') || email.trim() !== (ecole.email_contact || ''));

  const enregistrer = async (e) => {
    e.preventDefault();
    setErreur('');
    setSucces(false);
    setEnregistrement(true);
    try {
      const { data } = await api.patch(URL_MON_ECOLE, {
        telephone: telephone.trim(),
        email_contact: email.trim(),
      });
      setEcole(data);
      setTelephone(data.telephone || '');
      setEmail(data.email_contact || '');
      // Les cartes imprimées lisent le téléphone dans la session : on le met à jour tout de suite.
      try {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        localStorage.setItem('user', JSON.stringify({ ...user, ecole_telephone: data.telephone || '' }));
      } catch { /* ignoré */ }
      setSucces(true);
    } catch (err) {
      setErreur(messageErreur(err));
    } finally {
      setEnregistrement(false);
    }
  };

  return (
    <div className={styles.page}>
      <header className={styles.entete}>
        <div className={styles.icone}><Building2 size={22} /></div>
        <div>
          <h1>Mon</h1>
          <p>Ces informations apparaissent sur la page publique des cartes d'identité perdues.</p>
        </div>
      </header>

      {chargement && <p className={styles.etat}>Chargement…</p>}

      {erreur && (
        <div className={styles.erreur} role="alert"><AlertTriangle size={16} /> {erreur}</div>
      )}

      {ecole && (
        <form className={styles.carte} onSubmit={enregistrer}>
          <section className={styles.section}>
            <h2>Identité</h2>
            <div className={styles.grille}>
              <div className={styles.champ}>
                <label>Nom de l'école</label>
                <input value={ecole.nom} disabled />
              </div>
              <div className={styles.champ}>
                <label><Hash size={14} /> Préfixe des matricules</label>
                <input value={ecole.prefixe_matricule || 'Automatique'} disabled />
              </div>
            </div>
            <p className={styles.note}>
              <Info size={14} /> Le nom et le préfixe sont gérés par Sylium : les modifier casserait les matricules
              déjà imprimés. Contactez-nous si nécessaire.
            </p>
          </section>

          <section className={styles.section}>
            <h2>Contact</h2>
            <div className={styles.grille}>
              <div className={styles.champ}>
                <label htmlFor="tel"><Phone size={14} /> Téléphone du secrétariat</label>
                <input
                  id="tel"
                  type="tel"
                  inputMode="tel"
                  autoComplete="off"
                  placeholder="Ex. 620 00 00 00"
                  maxLength={20}
                  value={telephone}
                  onChange={(e) => { setTelephone(e.target.value); setSucces(false); }}
                />
                <small>Affiché sur la carte imprimée et sur la page « carte perdue ».</small>
              </div>

              <div className={styles.champ}>
                <label htmlFor="mail"><Mail size={14} /> E-mail de contact</label>
                <input
                  id="mail"
                  type="email"
                  autoComplete="off"
                  required
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setSucces(false); }}
                />
                <small>Utilisé par Sylium pour vous joindre.</small>
              </div>
            </div>
          </section>

          <footer className={styles.actions}>
            <span className={styles.statut} role="status" aria-live="polite">
              {succes && (<><CheckCircle2 size={16} /> Modifications enregistrées</>)}
            </span>
            <button type="submit" className={styles.bouton} disabled={enregistrement || !modifie}>
              {enregistrement ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </footer>
        </form>
      )}
    </div>
  );
};

export default MonEcole;
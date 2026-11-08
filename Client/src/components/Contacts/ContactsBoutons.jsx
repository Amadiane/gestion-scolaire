import { useState } from 'react';
import { MessageCircle, Phone } from 'lucide-react';
import { numeroWhatsApp } from '../../utils/whatsapp.js';
import styles from '../../theme/pages/admin/AlertesParents.module.css';

/**
 * Contacts d'un élève : le principal d'abord, les autres sur demande.
 * `onWhatsApp(contact, telephone)` est appelé au clic (l'ouverture de WhatsApp se fait chez l'appelant).
 */
const ContactsBoutons = ({ contacts, onWhatsApp }) => {
  const [tous, setTous] = useState(false);

  if (!contacts || contacts.length === 0) {
    return <span className={styles.parent}>Aucun parent enregistré</span>;
  }

  const affiches = tous ? contacts : contacts.slice(0, 1);

  return (
    <div className={styles.contacts}>
      {affiches.map((c) => (
        <div key={c.parent_id} className={styles.contact}>
          <span className={styles.parent}>
            {c.principal && '★ '}{c.prenom} {c.nom} ({c.lien})
          </span>
          {c.telephones.length === 0 && <small className={styles.remarque}>Aucun numéro enregistré</small>}
          {c.telephones.map((tel) => (
            <div key={tel} className={styles.contactTel}>
              <span>{tel}</span>
              {numeroWhatsApp(tel) && (
                <button type="button" className={styles.btnWhats} onClick={() => onWhatsApp(c, tel)}>
                  <MessageCircle size={14} /> WhatsApp
                </button>
              )}
              <a className={styles.btnAppel} href={`tel:${tel}`}>
                <Phone size={14} /> Appeler
              </a>
            </div>
          ))}
        </div>
      ))}
      {contacts.length > 1 && (
        <button type="button" className={styles.lien} onClick={() => setTous((t) => !t)}>
          {tous ? 'Masquer les autres contacts' : `Joindre quelqu'un d'autre (${contacts.length - 1})`}
        </button>
      )}
    </div>
  );
};

export default ContactsBoutons;
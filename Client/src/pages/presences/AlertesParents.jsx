import { useState, useEffect, useMemo, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Check, RotateCcw } from 'lucide-react';
import api from '../../services/api.js';
import CONFIG from '../../config/config.js';
import { lienWhatsApp } from '../../utils/whatsapp.js';
import ContactsBoutons from '../../components/Contacts/ContactsBoutons.jsx';
import styles from '../../theme/pages/admin/AlertesParents.module.css';

// const CLE_MODELE = 'sylium_modele_alerte';
// const MODELE_DEFAUT =
//   "Bonjour {parent}, {ecole} vous informe que {eleve} était {statut} le {date}. " +
//   'Merci de nous contacter si besoin.';
const CLE_MODELE = 'sylium_modele_alerte_v2';
const MODELE_DEFAUT =
  'Bonjour {parent}, {ecole} vous informe que {eleve} était {statut} le {date}. ' +
  'Merci de nous contacter si besoin.';

const iso = (d) => d.toLocaleDateString('en-CA');
const decaler = (dateIso, jours) => {
  const d = new Date(`${dateIso}T12:00:00`);
  d.setDate(d.getDate() + jours);
  return iso(d);
};
const fmtDate = (v) => {
  const [a, m, j] = String(v).slice(0, 10).split('-');
  return `${j}/${m}/${a}`;
};

const libelleStatut = (a) => {
  if (a.statut === 'retard') return 'en retard';
  return a.sexe === 'F' ? 'absente' : 'absent';
};

const lireModele = () => {
  try {
    return localStorage.getItem(CLE_MODELE) || MODELE_DEFAUT;
  } catch {
    return MODELE_DEFAUT;
  }
};

const AlertesParents = () => {
  const aujourdhui = iso(new Date());
  const [date, setDate] = useState(aujourdhui);
  const [donnees, setDonnees] = useState({ ecole: '', alertes: [] });
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState('');
  const [classe, setClasse] = useState('');
  const [filtre, setFiltre] = useState('a_prevenir'); // a_prevenir | tous | prevenus
  const [modele, setModele] = useState(lireModele);
  const [modeleOuvert, setModeleOuvert] = useState(false);

  const charger = useCallback(async () => {
    setChargement(true);
    setErreur('');
    try {
      const res = await api.get(CONFIG.API_ALERTES, { params: { date } });
      setDonnees(res.data);
    } catch (err) {
      setDonnees({ ecole: '', alertes: [] });
      setErreur(
        err.response?.data?.detail ||
          'Impossible de charger les alertes. Cette page demande une connexion internet.'
      );
    } finally {
      setChargement(false);
    }
  }, [date]);

  useEffect(() => {
    charger();
  }, [charger]);

  const sauverModele = (v) => {
    setModele(v);
    try {
      localStorage.setItem(CLE_MODELE, v);
    } catch {
      /* stockage indisponible : le modèle reste valable pour la session */
    }
  };

  const classes = useMemo(() => {
    const m = new Map();
    donnees.alertes.forEach((a) => m.set(a.classe_id, a.classe));
    return [...m.entries()];
  }, [donnees]);

  const visibles = useMemo(
    () =>
      donnees.alertes.filter((a) => {
        if (classe && String(a.classe_id) !== classe) return false;
        if (filtre === 'a_prevenir') return !a.prevenu;
        if (filtre === 'prevenus') return a.prevenu;
        return true;
      }),
    [donnees, classe, filtre]
  );

  const nbPrevenus = donnees.alertes.filter((a) => a.prevenu).length;

  const message = (a, contact) =>
    modele
      .replaceAll('{parent}', contact ? `${contact.prenom} ${contact.nom}` : '')
      .replaceAll('{eleve}', `${a.prenom} ${a.nom}`)
      .replaceAll('{statut}', libelleStatut(a))
      .replaceAll('{date}', fmtDate(date))
      .replaceAll('{ecole}', donnees.ecole);

  const marquer = async (a, prevenu) => {
    try {
      await api.post(CONFIG.API_ALERTES_MARQUER, { eleve_id: a.eleve_id, date, prevenu });
      setDonnees((d) => ({
        ...d,
        alertes: d.alertes.map((x) =>
          x.eleve_id === a.eleve_id ? { ...x, prevenu, prevenu_le: prevenu ? new Date().toISOString() : null } : x
        ),
      }));
    } catch {
      setErreur("Impossible d'enregistrer. Vérifiez votre connexion.");
    }
  };

  const ouvrirWhatsApp = (a, contact, tel) => {
    // Ouverture immédiate (avant tout await) pour ne pas être bloquée par le navigateur.
    window.open(lienWhatsApp(tel, message(a, contact)), '_blank', 'noopener');
    marquer(a, true);
  };

  return (
    <div className={styles.wrapper}>
      <h1 className={styles.titre}>Alertes aux parents</h1>
      <p className={styles.aide}>
        Élèves absents ou en retard à la date choisie. Le bouton WhatsApp ouvre un message déjà rédigé ;
        l'élève est ensuite marqué « prévenu ». Si le premier contact ne répond pas, utilisez les autres.
      </p>

      <div className={styles.barre}>
        <div className={styles.jourNav}>
          <button type="button" onClick={() => setDate(decaler(date, -1))} aria-label="Jour précédent">
            <ChevronLeft size={16} />
          </button>
          <input
            type="date"
            value={date}
            max={aujourdhui}
            onChange={(e) => e.target.value && setDate(e.target.value)}
          />
          <button
            type="button"
            onClick={() => setDate(decaler(date, 1))}
            disabled={date >= aujourdhui}
            aria-label="Jour suivant"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        <select value={classe} onChange={(e) => setClasse(e.target.value)} className={styles.select}>
          <option value="">Toutes les classes</option>
          {classes.map(([id, nom]) => (
            <option key={id} value={id}>{nom}</option>
          ))}
        </select>

        <div className={styles.onglets} role="tablist">
          {[
            ['a_prevenir', 'À prévenir'],
            ['prevenus', 'Prévenus'],
            ['tous', 'Tous'],
          ].map(([cle, lib]) => (
            <button
              key={cle}
              type="button"
              className={filtre === cle ? styles.ongletActif : styles.onglet}
              onClick={() => setFiltre(cle)}
            >
              {lib}
            </button>
          ))}
        </div>
      </div>

      <p className={styles.resume}>
        {donnees.alertes.length} alerte(s) · {nbPrevenus} prévenu(s) · {donnees.alertes.length - nbPrevenus} à prévenir
      </p>

      <button type="button" className={styles.lien} onClick={() => setModeleOuvert((o) => !o)}>
        {modeleOuvert ? 'Masquer le message type' : 'Modifier le message type'}
      </button>
      {modeleOuvert && (
        <div className={styles.modele}>
          <textarea rows={4} value={modele} onChange={(e) => sauverModele(e.target.value)} />
          <p className={styles.aide}>
            Variables : {'{parent}'} {'{eleve}'} {'{statut}'} {'{date}'} {'{ecole}'}
          </p>
          <button type="button" className={styles.lien} onClick={() => sauverModele(MODELE_DEFAUT)}>
            Rétablir le message par défaut
          </button>
        </div>
      )}

      {erreur && <p className={styles.erreur}>{erreur}</p>}
      {chargement && <p className={styles.aide}>Chargement…</p>}

      {!chargement && !erreur && visibles.length === 0 && (
        <p className={styles.vide}>
          {donnees.alertes.length === 0
            ? "Aucun absent ni retard enregistré ce jour (ou l'appel n'a pas encore été fait)."
            : 'Personne dans cette liste.'}
        </p>
      )}

      <ul className={styles.liste}>
        {visibles.map((a) => (
          <li key={a.eleve_id} className={a.prevenu ? styles.carteFaite : styles.carte}>
            <div className={styles.infos}>
              <strong>{a.prenom} {a.nom}</strong>
              <span className={styles.classe}>{a.classe}</span>
              <span className={a.statut === 'retard' ? styles.tagRetard : styles.tagAbsent}>
                {a.statut === 'retard' ? 'Retard' : 'Absent'}
              </span>
              {a.remarque && <em className={styles.remarque}>{a.remarque}</em>}
              <ContactsBoutons
                contacts={a.contacts}
                onWhatsApp={(contact, tel) => ouvrirWhatsApp(a, contact, tel)}
              />
              {a.prevenu && <span className={styles.fait}><Check size={13} /> Parent prévenu</span>}
            </div>

            <div className={styles.actions}>
              {a.prevenu ? (
                <button type="button" className={styles.btnSecondaire} onClick={() => marquer(a, false)}>
                  <RotateCcw size={14} /> Annuler
                </button>
              ) : (
                <button type="button" className={styles.btnSecondaire} onClick={() => marquer(a, true)}>
                  <Check size={14} /> Marquer prévenu
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default AlertesParents;
import { useState, useEffect, useMemo, useCallback } from 'react';
import { MessageCircle, Phone, Check, RotateCcw, Search } from 'lucide-react';
import api from '../../services/api.js';
import CONFIG from '../../config/config.js';
import { formatGNF } from '../../utils/finance.js';
import { numeroWhatsApp, lienWhatsApp } from '../../utils/whatsapp.js';
import styles from '../../theme/pages/admin/AlertesParents.module.css';

const CLE_MODELE = 'sylium_modele_relance';
const MODELE_DEFAUT =
  "Bonjour {parent}, l'école {ecole} vous informe qu'il reste {reste} GNF à régler pour la scolarité de {eleve}. " +
  'Merci de passer à l\'école ou de nous contacter. Si vous avez déjà payé, veuillez ignorer ce message.';

const fmtDate = (v) => {
  if (!v) return '';
  const [a, m, j] = String(v).slice(0, 10).split('-');
  return `${j}/${m}/${a}`;
};

const lireModele = () => {
  try {
    return localStorage.getItem(CLE_MODELE) || MODELE_DEFAUT;
  } catch {
    return MODELE_DEFAUT;
  }
};

const RelancesPaiement = () => {
  const [donnees, setDonnees] = useState({ ecole: '', total_reste: 0, eleves: [] });
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState('');
  const [classe, setClasse] = useState('');
  const [filtre, setFiltre] = useState('a_relancer'); // a_relancer | relances | tous
  const [recherche, setRecherche] = useState('');
  const [modele, setModele] = useState(lireModele);
  const [modeleOuvert, setModeleOuvert] = useState(false);

  const charger = useCallback(async () => {
    setChargement(true);
    setErreur('');
    try {
      const res = await api.get(CONFIG.API_RELANCES);
      setDonnees(res.data);
    } catch (err) {
      setDonnees({ ecole: '', total_reste: 0, eleves: [] });
      setErreur(
        err.response?.data?.detail ||
          'Impossible de charger les relances. Cette page demande une connexion internet.'
      );
    } finally {
      setChargement(false);
    }
  }, []);

  useEffect(() => {
    charger();
  }, [charger]);

  const sauverModele = (v) => {
    setModele(v);
    try {
      localStorage.setItem(CLE_MODELE, v);
    } catch {
      /* stockage indisponible : valable pour la session seulement */
    }
  };

  const classes = useMemo(() => {
    const m = new Map();
    donnees.eleves.forEach((e) => e.classe_id && m.set(e.classe_id, e.classe));
    return [...m.entries()];
  }, [donnees]);

  const visibles = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return donnees.eleves.filter((e) => {
      if (classe && String(e.classe_id) !== classe) return false;
      if (filtre === 'a_relancer' && e.nb_relances > 0) return false;
      if (filtre === 'relances' && e.nb_relances === 0) return false;
      if (q && !`${e.prenom} ${e.nom}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [donnees, classe, filtre, recherche]);

  const totalVisible = visibles.reduce((s, e) => s + e.reste, 0);
  const nbRelances = donnees.eleves.filter((e) => e.nb_relances > 0).length;

  const message = (e) =>
    modele
      .replaceAll('{parent}', e.parent ? `${e.parent.prenom} ${e.parent.nom}` : '')
      .replaceAll('{eleve}', `${e.prenom} ${e.nom}`)
      .replaceAll('{reste}', formatGNF(e.reste))
      .replaceAll('{ecole}', donnees.ecole);

  const marquer = async (e, annuler = false) => {
    try {
      const res = await api.post(CONFIG.API_RELANCES_MARQUER, { eleve_id: e.eleve_id, annuler });
      setDonnees((d) => ({
        ...d,
        eleves: d.eleves.map((x) =>
          x.eleve_id === e.eleve_id
            ? { ...x, nb_relances: res.data.nb_relances, derniere_relance: res.data.derniere_relance }
            : x
        ),
      }));
    } catch {
      setErreur("Impossible d'enregistrer. Vérifiez votre connexion.");
    }
  };

  const ouvrirWhatsApp = (e) => {
    // Ouverture immédiate (avant tout await) pour ne pas être bloquée par le navigateur.
    window.open(lienWhatsApp(e.parent.telephone, message(e)), '_blank', 'noopener');
    marquer(e);
  };

  return (
    <div className={styles.wrapper}>
      <h1 className={styles.titre}>Relances de paiement</h1>
      <p className={styles.aide}>
        Élèves de l'année active qui ont un reste à payer. Le bouton WhatsApp ouvre un message déjà rédigé
        et enregistre la relance. Aucun paiement n'est créé ni modifié ici.
      </p>

      <div className={styles.barre}>
        <label className={styles.recherche}>
          <Search size={15} />
          <input
            type="search"
            placeholder="Rechercher un élève"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
          />
        </label>

        <select value={classe} onChange={(e) => setClasse(e.target.value)} className={styles.select}>
          <option value="">Toutes les classes</option>
          {classes.map(([id, nom]) => (
            <option key={id} value={id}>{nom}</option>
          ))}
        </select>

        <div className={styles.onglets} role="tablist">
          {[
            ['a_relancer', 'À relancer'],
            ['relances', 'Déjà relancés'],
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
        {visibles.length} élève(s) · {formatGNF(totalVisible)} GNF dus · {nbRelances} déjà relancé(s) sur{' '}
        {donnees.eleves.length}
      </p>

      <button type="button" className={styles.lien} onClick={() => setModeleOuvert((o) => !o)}>
        {modeleOuvert ? 'Masquer le message type' : 'Modifier le message type'}
      </button>
      {modeleOuvert && (
        <div className={styles.modele}>
          <textarea rows={4} value={modele} onChange={(e) => sauverModele(e.target.value)} />
          <p className={styles.aide}>
            Variables : {'{parent}'} {'{eleve}'} {'{reste}'} {'{ecole}'}
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
          {donnees.eleves.length === 0
            ? 'Aucun reste à payer pour le moment.'
            : 'Personne dans cette liste.'}
        </p>
      )}

      <ul className={styles.liste}>
        {visibles.map((e) => {
          const sansNumero = !e.parent || !numeroWhatsApp(e.parent.telephone);
          const relance = e.nb_relances > 0;
          return (
            <li key={e.eleve_id} className={relance ? styles.carteFaite : styles.carte}>
              <div className={styles.infos}>
                <strong>{e.prenom} {e.nom}</strong>
                <span className={styles.classe}>{e.classe}</span>
                <span className={styles.montant}>
                  Reste : <b>{formatGNF(e.reste)} GNF</b>
                  <small> (payé {formatGNF(e.paye)} sur {formatGNF(e.a_payer)})</small>
                </span>
                <span className={styles.parent}>
                  {e.parent
                    ? `${e.parent.prenom} ${e.parent.nom} (${e.parent.lien}) · ${e.parent.telephone}`
                    : 'Aucun parent enregistré'}
                </span>
                {relance && (
                  <span className={styles.fait}>
                    <Check size={13} /> Relancé {e.nb_relances} fois · dernière le {fmtDate(e.derniere_relance)}
                  </span>
                )}
              </div>

              <div className={styles.actions}>
                {!sansNumero && (
                  <>
                    <button type="button" className={styles.btnWhats} onClick={() => ouvrirWhatsApp(e)}>
                      <MessageCircle size={15} /> {relance ? 'Relancer encore' : 'WhatsApp'}
                    </button>
                    <a className={styles.btnAppel} href={`tel:${e.parent.telephone}`}>
                      <Phone size={15} /> Appeler
                    </a>
                  </>
                )}
                {relance ? (
                  <button type="button" className={styles.btnSecondaire} onClick={() => marquer(e, true)}>
                    <RotateCcw size={14} /> Annuler la dernière
                  </button>
                ) : (
                  <button type="button" className={styles.btnSecondaire} onClick={() => marquer(e)}>
                    <Check size={14} /> Marquer relancé
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default RelancesPaiement;
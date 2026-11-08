import { useEffect, useState } from 'react';
import api from '../../services/api.js';
import CONFIG from '../../config/config.js';
import BoutonRetour from '../../components/BoutonRetour/BoutonRetour.jsx';
import ListeAppel from '../../components/Presences/ListeAppel.jsx';
import {
  ajouterOperation, listerProblemes, operationsEnAttente, synchroniser,
} from '../../offline/file.js';
import styles from '../../theme/pages/admin/Presences.module.css';

const comparer = (a, b) =>
  String(a || '').localeCompare(String(b || ''), 'fr', { numeric: true, sensitivity: 'base' });

// Date locale (et non UTC) : un appel du matin ne doit pas tomber sur la veille.
const aujourdhui = () => new Date().toLocaleDateString('en-CA');
const enDate = (iso) => new Date(`${iso}T00:00:00`);

const AppelClasse = () => {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const enseignant = user.role === 'enseignant';

  const [classes, setClasses] = useState([]);
  const [classeId, setClasseId] = useState('');
  const [jour, setJour] = useState(aujourdhui());
  const [eleves, setEleves] = useState([]);
  const [statuts, setStatuts] = useState({});
  const [dejaFait, setDejaFait] = useState(false);
  const [nbAttente, setNbAttente] = useState(0);
  const [chargement, setChargement] = useState(false);
  const [enregistrement, setEnregistrement] = useState(false);
  const [message, setMessage] = useState('');
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    api.get(enseignant ? CONFIG.API_MES_AFFECTATIONS : CONFIG.API_CLASSES)
      .then((res) => {
        const vues = new Map();
        res.data.forEach((x) => {
          const id = enseignant ? x.classe_id : x.id;
          const nom = enseignant ? x.classe_nom : x.nom;
          if (!vues.has(id)) vues.set(id, { id, nom });
        });
        setClasses([...vues.values()]);
      })
      .catch(() => setErreur('Impossible de charger vos classes.'));
  }, [enseignant]);

  useEffect(() => {
    if (!classeId) { setEleves([]); setStatuts({}); setDejaFait(false); return undefined; }
    let annule = false;
    (async () => {
      setChargement(true);
      setMessage('');
      setErreur('');
      try {
        const resEleves = await api.get(CONFIG.API_CLASSE_ELEVES(classeId));
        // L'appel déjà enregistré est facultatif : sans réseau, on repart des élèves seulement.
        let serveur = [];
        try {
          serveur = (await api.get(`${CONFIG.API_PRESENCES}?classe=${classeId}&date=${jour}`)).data;
        } catch { /* hors ligne */ }
        const attente = (await operationsEnAttente('presence')).filter(
          (o) => String(o.classe) === String(classeId) && o.date === jour
        );
        if (annule) return;

        const valeurs = {};
        serveur.forEach((p) => { valeurs[p.eleve] = p.statut; });
        attente.forEach((o) => { valeurs[o.eleve] = o.statut; }); // ce qui est sur l'appareil prime
        setEleves([...resEleves.data].sort((a, b) => comparer(`${a.nom} ${a.prenom}`, `${b.nom} ${b.prenom}`)));
        setStatuts(valeurs);
        setDejaFait(serveur.length > 0 || attente.length > 0);
        setNbAttente(attente.length);
      } catch {
        if (!annule) setErreur('Impossible de charger les élèves de cette classe.');
      } finally {
        if (!annule) setChargement(false);
      }
    })();
    return () => { annule = true; };
  }, [classeId, jour]);

  const decaler = (n) => {
    const d = enDate(jour);
    d.setDate(d.getDate() + n);
    const v = d.toLocaleDateString('en-CA');
    if (v <= aujourdhui()) setJour(v);
  };

  const changer = (id, valeur) => setStatuts((prev) => {
    const suite = { ...prev };
    if (valeur) suite[id] = valeur; else delete suite[id];
    return suite;
  });

  // Tout le monde présent : on corrige ensuite les absents, retards et excusés.
  const toutPresent = () => {
    const suite = {};
    eleves.forEach((e) => { suite[e.id] = 'present'; });
    setStatuts(suite);
  };

  const enregistrer = async () => {
    setMessage('');
    setErreur('');
    const lignes = eleves
      .filter((e) => statuts[e.id])
      .map((e) => ({ eleve: e.id, classe: Number(classeId), date: jour, statut: statuts[e.id] }));
    if (lignes.length === 0) { setErreur("Appelez au moins un élève avant d'enregistrer."); return; }

    setEnregistrement(true);
    try {
      // Toujours par la file de l'appareil : même chemin en ligne et hors ligne, jamais de doublon.
      for (const l of lignes) {
        await ajouterOperation({ type: 'presence', cleNat: `presence|${l.eleve}|${l.date}`, charge: l });
      }
      await synchroniser();

      const reste = (await operationsEnAttente('presence')).filter(
        (o) => String(o.classe) === String(classeId) && o.date === jour
      );
      const refus = (await listerProblemes()).filter((p) => p.type === 'presence');
      setNbAttente(reste.length);

      if (refus.length > 0) {
        setErreur(`Une partie de l'appel a été refusée : ${refus[0].detail}`);
      } else if (reste.length > 0) {
        setMessage(`${reste.length} présence(s) enregistrée(s) sur cet appareil. Envoi automatique dès le retour du réseau.`);
        setDejaFait(true);
      } else {
        setMessage('Appel enregistré.');
        setDejaFait(true);
      }
    } catch {
      setErreur("Impossible d'enregistrer sur cet appareil. Reconnectez-vous avec internet puis réessayez.");
    } finally {
      setEnregistrement(false);
    }
  };

  const libelleJour = enDate(jour).toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
  const estDimanche = enDate(jour).getDay() === 0;

  return (
    <div className={styles.wrapper}>
      <BoutonRetour vers={enseignant ? '/enseignant' : '/dashboardAdmin'} />
      <h1 className={styles.titre}>Appel des élèves</h1>
      <p className={styles.sousTitre}>Choisissez la classe et le jour, puis touchez le statut de chaque élève.</p>

      <div className={styles.filtres}>
        <select className={styles.champ} value={classeId} onChange={(e) => setClasseId(e.target.value)}>
          <option value="">— Classe —</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
        </select>
      </div>

      <div className={styles.jourNav}>
        <button type="button" className={styles.bouton} onClick={() => decaler(-1)}>◀ Veille</button>
        <div className={styles.jourLibelle}>{libelleJour}</div>
        <button type="button" className={styles.bouton} onClick={() => decaler(1)} disabled={jour >= aujourdhui()}>
          Lendemain ▶
        </button>
        {jour !== aujourdhui() && (
          <button type="button" className={styles.bouton} onClick={() => setJour(aujourdhui())}>Aujourd'hui</button>
        )}
      </div>
      <div className={styles.filtres}>
        <input
          type="date"
          className={styles.champ}
          value={jour}
          max={aujourdhui()}
          onChange={(e) => e.target.value && setJour(e.target.value)}
        />
      </div>

      {estDimanche && <p className={styles.etat}>Ce jour est un dimanche : vérifiez que l'école a bien classe.</p>}
      {classeId && !chargement && eleves.length > 0 && (
        <p className={dejaFait ? styles.info : styles.etat}>
          {dejaFait
            ? "Un appel est déjà enregistré pour ce jour : vous pouvez le corriger."
            : "Pas encore d'appel pour ce jour."}
        </p>
      )}

      {classes.length === 0 && !erreur && (
        <p className={styles.etat}>
          {enseignant ? 'Aucune classe ne vous est affectée : contactez la direction.' : 'Aucune classe pour cette année.'}
        </p>
      )}
      {nbAttente > 0 && !message && <p className={styles.info}>{nbAttente} présence(s) de cet écran sont en attente d'envoi.</p>}
      {message && <p className={styles.info}>{message}</p>}
      {erreur && <p className={styles.erreur}>{erreur}</p>}
      {chargement && <p className={styles.etat}>Chargement des élèves…</p>}
      {!chargement && classeId && eleves.length === 0 && !erreur && (
        <p className={styles.etat}>Aucun élève inscrit dans cette classe.</p>
      )}

      {!chargement && classeId && eleves.length > 0 && (
        <ListeAppel
          lignes={eleves.map((e) => ({ id: e.id, titre: `${e.nom} ${e.prenom}`, sous: e.matricule }))}
          statuts={statuts}
          onChange={changer}
          onToutPresent={toutPresent}
          onEnregistrer={enregistrer}
          enregistrement={enregistrement}
        />
      )}
    </div>
  );
};

export default AppelClasse;
import { useEffect, useState } from 'react';
import api from '../../services/api.js';
import CONFIG from '../../config/config.js';
import BoutonRetour from '../../components/BoutonRetour/BoutonRetour.jsx';
import ListeAppel from '../../components/Presences/ListeAppel.jsx';
import {
  ajouterOperation, listerProblemes, operationsEnAttente, synchroniser,
} from '../../offline/file.js';
import styles from '../../theme/pages/admin/Presences.module.css';

const aujourdhui = () => new Date().toLocaleDateString('en-CA');

const PresencesPersonnel = () => {
  const [membres, setMembres] = useState([]);
  const [jour, setJour] = useState(aujourdhui());
  const [statuts, setStatuts] = useState({});
  const [chargement, setChargement] = useState(true);
  const [enregistrement, setEnregistrement] = useState(false);
  const [message, setMessage] = useState('');
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    let annule = false;
    (async () => {
      setChargement(true);
      setMessage('');
      setErreur('');
      try {
        const res = await api.get(CONFIG.API_PERSONNEL);
        let serveur = [];
        try {
          serveur = (await api.get(`${CONFIG.API_PRESENCES_PERSONNEL}?date=${jour}`)).data;
        } catch { /* hors ligne */ }
        const attente = (await operationsEnAttente('presence_personnel')).filter((o) => o.date === jour);
        if (annule) return;

        const valeurs = {};
        serveur.forEach((p) => { valeurs[p.membre] = p.statut; });
        attente.forEach((o) => { valeurs[o.membre] = o.statut; });
        const liste = Array.isArray(res.data) ? res.data : res.data.results || [];
        setMembres(liste.filter((m) => m.statut === 'actif'));
        setStatuts(valeurs);
      } catch {
        if (!annule) setErreur('Impossible de charger le personnel.');
      } finally {
        if (!annule) setChargement(false);
      }
    })();
    return () => { annule = true; };
  }, [jour]);

  const changer = (id, valeur) => setStatuts((prev) => {
    const suite = { ...prev };
    if (valeur) suite[id] = valeur; else delete suite[id];
    return suite;
  });

  const toutPresent = () => {
    const suite = {};
    membres.forEach((m) => { suite[m.id] = 'present'; });
    setStatuts(suite);
  };

  const enregistrer = async () => {
    setMessage('');
    setErreur('');
    const lignes = membres
      .filter((m) => statuts[m.id])
      .map((m) => ({ membre: m.id, date: jour, statut: statuts[m.id] }));
    if (lignes.length === 0) { setErreur("Appelez au moins une personne avant d'enregistrer."); return; }

    setEnregistrement(true);
    try {
      for (const l of lignes) {
        await ajouterOperation({ type: 'presence_personnel', cleNat: `presence_personnel|${l.membre}|${l.date}`, charge: l });
      }
      await synchroniser();
      const reste = (await operationsEnAttente('presence_personnel')).filter((o) => o.date === jour);
      const refus = (await listerProblemes()).filter((p) => p.type === 'presence_personnel');
      if (refus.length > 0) setErreur(`Une partie du pointage a été refusée : ${refus[0].detail}`);
      else if (reste.length > 0) setMessage(`${reste.length} pointage(s) enregistré(s) sur cet appareil. Envoi automatique dès le retour du réseau.`);
      else setMessage('Pointage enregistré.');
    } catch {
      setErreur("Impossible d'enregistrer sur cet appareil. Reconnectez-vous avec internet puis réessayez.");
    } finally {
      setEnregistrement(false);
    }
  };

  return (
    <div className={styles.wrapper}>
      <BoutonRetour vers="/dashboardAdmin" />
      <h1 className={styles.titre}>Présences du personnel</h1>
      <p className={styles.sousTitre}>Pointage du jour pour les membres actifs de l'école.</p>

      <div className={styles.filtres}>
        <input
          type="date"
          className={styles.champ}
          value={jour}
          max={aujourdhui()}
          onChange={(e) => e.target.value && setJour(e.target.value)}
        />
      </div>

      {message && <p className={styles.info}>{message}</p>}
      {erreur && <p className={styles.erreur}>{erreur}</p>}
      {chargement && <p className={styles.etat}>Chargement…</p>}
      {!chargement && membres.length === 0 && !erreur && (
        <p className={styles.etat}>Aucun membre actif dans le personnel.</p>
      )}

      {!chargement && membres.length > 0 && (
        <ListeAppel
          lignes={membres.map((m) => ({
            id: m.id,
            titre: `${m.nom} ${m.prenom}`,
            sous: [m.poste_label, m.matricule].filter(Boolean).join(' · '),
          }))}
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

export default PresencesPersonnel;
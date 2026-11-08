import { useState, useEffect, useMemo, useCallback } from 'react';
import { Plus, Printer, FileSpreadsheet, Copy } from 'lucide-react';
import api from '../../services/api.js';
import CONFIG from '../../config/config.js';
import BoutonRetour from '../../components/BoutonRetour/BoutonRetour.jsx';
import GrilleEmploi from '../../components/Emplois/GrilleEmploi.jsx';
import EditeurCreneau from '../../components/Emplois/EditeurCreneau.jsx';
import { imprimerEmplois, telechargerEmploiCsv } from '../../utils/exportEmploi.js';
import styles from '../../theme/components/Emplois.module.css';

const messageErreur = (err) => {
  const d = err.response?.data;
  const premier = d && typeof d === 'object' ? Object.values(d)[0] : null;
  return (Array.isArray(premier) ? premier[0] : premier) || d?.detail || 'Opération impossible. Vérifiez votre connexion.';
};
const nomUtilisateur = (u) => `${u.first_name} ${u.last_name}`.trim() || u.username;

const EmploisDuTemps = () => {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const peutEcrire = ['directeur', 'secretaire'].includes(user.role);

  const [creneaux, setCreneaux] = useState([]);
  const [classes, setClasses] = useState([]);
  const [matieres, setMatieres] = useState([]);
  const [enseignantsListe, setEnseignantsListe] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState('');
  const [info, setInfo] = useState('');

  const [vue, setVue] = useState('classe'); // classe | enseignant
  const [classeId, setClasseId] = useState('');
  const [enseignantId, setEnseignantId] = useState('');

  const [editeur, setEditeur] = useState(null); // { initial }
  const [erreurEditeur, setErreurEditeur] = useState('');
  const [envoi, setEnvoi] = useState(false);

  const [dupliquerOuvert, setDupliquerOuvert] = useState(false);
  const [cible, setCible] = useState('');
  const [ecraser, setEcraser] = useState(false);

  const charger = useCallback(async () => {
    setErreur('');
    try {
      const [e, c, m] = await Promise.all([
        api.get(CONFIG.API_EMPLOIS),
        api.get(CONFIG.API_CLASSES),
        api.get(CONFIG.API_MATIERES),
      ]);
      setCreneaux(e.data);
      setClasses(c.data);
      setMatieres([...m.data].sort((a, b) => String(a.nom).localeCompare(String(b.nom), 'fr')));
      setClasseId((id) => id || (c.data[0] ? String(c.data[0].id) : ''));
    } catch {
      setErreur("Impossible de charger les emplois du temps. Cette page demande une connexion internet.");
    } finally {
      setChargement(false);
    }
    if (peutEcrire) {
      try {
        const u = await api.get(CONFIG.API_UTILISATEURS);
        setEnseignantsListe(
          u.data
            .filter((x) => x.role === 'enseignant' && x.is_active)
            .map((x) => ({ id: x.id, nom: nomUtilisateur(x) }))
            .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
        );
      } catch {
        setEnseignantsListe([]); // liste indisponible : on enregistre sans choisir d'enseignant
      }
    }
  }, [peutEcrire]);

  useEffect(() => {
    charger();
  }, [charger]);

  const classe = classes.find((c) => String(c.id) === classeId);

  // Enseignants ayant au moins un créneau, plus ceux de la liste des utilisateurs (vue « par enseignant »).
  const enseignantsVue = useMemo(() => {
    const m = new Map();
    enseignantsListe.forEach((u) => m.set(u.id, u.nom));
    creneaux.forEach((c) => c.enseignant && m.set(c.enseignant, c.enseignant_nom));
    return [...m.entries()].sort((a, b) => String(a[1]).localeCompare(String(b[1]), 'fr'));
  }, [creneaux, enseignantsListe]);

  const affiches = useMemo(() => {
    if (vue === 'classe') return creneaux.filter((c) => String(c.classe) === classeId);
    return creneaux.filter((c) => String(c.enseignant) === enseignantId);
  }, [creneaux, vue, classeId, enseignantId]);

  const documentCourant = () => {
    if (vue === 'classe') {
      return { titre: `Emploi du temps — ${classe?.nom || ''}`, creneaux: affiches, mode: 'classe' };
    }
    const nom = enseignantsVue.find(([id]) => String(id) === enseignantId)?.[1] || '';
    return { titre: `Emploi du temps — ${nom}`, sousTitre: 'Enseignant', creneaux: affiches, mode: 'enseignant' };
  };

  const imprimerTous = () => {
    const docs = classes
      .map((c) => ({
        titre: `Emploi du temps — ${c.nom}`,
        creneaux: creneaux.filter((x) => x.classe === c.id),
        mode: 'classe',
      }))
      .filter((d) => d.creneaux.length > 0);
    if (docs.length === 0) {
      setInfo('');
      setErreur("Aucun emploi du temps à imprimer pour le moment.");
      return;
    }
    imprimerEmplois(docs);
  };

  const nomFichier = () =>
    documentCourant().titre.replace('Emploi du temps — ', 'emploi_').replace(/[^\w-]+/g, '_');

  const ouvrirAjout = () => {
    setErreurEditeur('');
    setEditeur({
      initial:
        vue === 'classe'
          ? { classe: Number(classeId) }
          : { classe: classes[0]?.id, enseignant: enseignantId ? Number(enseignantId) : null },
    });
  };

  const enregistrer = async (payloads, id) => {
    setEnvoi(true);
    setErreurEditeur('');
    let faits = 0;
    try {
      if (id) {
        await api.patch(`${CONFIG.API_EMPLOIS}${id}/`, payloads[0]);
        faits = 1;
      } else {
        for (const p of payloads) {
          await api.post(CONFIG.API_EMPLOIS, p);
          faits += 1;
        }
      }
      // On affiche la classe où le créneau vient d'être ajouté.
      if (vue === 'classe' && payloads[0]?.classe) setClasseId(String(payloads[0].classe));
      setEditeur(null);
      setInfo(`${faits} créneau(x) enregistré(s).`);
      await charger();
    } catch (err) {
      const deja = faits > 0 ? ` (${faits} créneau(x) déjà enregistré(s) avant cette erreur)` : '';
      setErreurEditeur(`${messageErreur(err)}${deja}`);
      if (faits > 0) charger();
    } finally {
      setEnvoi(false);
    }
  };

  const supprimer = async (c) => {
    if (!window.confirm('Supprimer ce créneau ?')) return;
    setEnvoi(true);
    try {
      await api.delete(`${CONFIG.API_EMPLOIS}${c.id}/`);
      setEditeur(null);
      await charger();
    } catch (err) {
      setErreurEditeur(messageErreur(err));
    } finally {
      setEnvoi(false);
    }
  };

  const dupliquer = async () => {
    setErreur('');
    setInfo('');
    try {
      const res = await api.post(`${CONFIG.API_EMPLOIS}dupliquer/`, { source: classeId, cible, ecraser });
      setInfo(`${res.data.copies} créneau(x) copié(s). Ajoutez ensuite les enseignants et les salles si besoin.`);
      setDupliquerOuvert(false);
      setCible('');
      setEcraser(false);
      await charger();
    } catch (err) {
      setErreur(messageErreur(err));
    }
  };

  return (
    <div className={styles.wrapper}>
      <BoutonRetour vers="/dashboardAdmin" />
      <h1 className={styles.titre}>Emplois du temps</h1>
      <p className={styles.aide}>
        Chaque classe a son propre emploi du temps, avec les horaires de votre choix. Les enseignants peuvent aussi
        ajouter leurs propres créneaux ; ils apparaissent ici.
      </p>

      {erreur && <div className={styles.erreur}>{erreur}</div>}
      {info && <div className={styles.info}>{info}</div>}
      {chargement && <p className={styles.aide}>Chargement…</p>}

      {!chargement && classes.length === 0 && (
        <p className={styles.vide}>Aucune classe : créez d'abord vos classes.</p>
      )}

      {!chargement && classes.length > 0 && (
        <>
          <div className={styles.barre}>
            <div className={styles.onglets}>
              <button type="button" className={vue === 'classe' ? styles.ongletActif : styles.onglet} onClick={() => setVue('classe')}>
                Par classe
              </button>
              <button type="button" className={vue === 'enseignant' ? styles.ongletActif : styles.onglet} onClick={() => setVue('enseignant')}>
                Par enseignant
              </button>
            </div>

            {vue === 'classe' ? (
              <select className={styles.select} value={classeId} onChange={(e) => setClasseId(e.target.value)} aria-label="Classe">
                {classes.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
              </select>
            ) : (
              <select className={styles.select} value={enseignantId} onChange={(e) => setEnseignantId(e.target.value)} aria-label="Enseignant">
                <option value="">— Choisir un enseignant —</option>
                {enseignantsVue.map(([id, nom]) => <option key={id} value={id}>{nom}</option>)}
              </select>
            )}

            <span className={styles.espace} />

            {peutEcrire && vue === 'classe' && (
              <button type="button" className={styles.btn} onClick={() => setDupliquerOuvert((o) => !o)}>
                <Copy size={15} /> Dupliquer vers…
              </button>
            )}
            {peutEcrire && (
              <button
                type="button"
                className={styles.btnPrimaire}
                onClick={ouvrirAjout}
                disabled={vue === 'enseignant' && !enseignantId}
                title={vue === 'enseignant' && !enseignantId ? "Choisissez d'abord un enseignant" : undefined}
              >
                <Plus size={15} /> Ajouter un créneau
              </button>
            )}
          </div>

          {dupliquerOuvert && vue === 'classe' && (
            <div className={styles.panneau}>
              <p style={{ margin: '0 0 8px' }}>
                Copier l'emploi de <strong>{classe?.nom}</strong> (matières et horaires, sans enseignants ni salles) vers :
              </p>
              <select className={styles.select} value={cible} onChange={(e) => setCible(e.target.value)}>
                <option value="">— Classe de destination —</option>
                {classes.filter((c) => String(c.id) !== classeId).map((c) => (
                  <option key={c.id} value={c.id}>{c.nom}</option>
                ))}
              </select>
              <label className={styles.coche}>
                <input type="checkbox" checked={ecraser} onChange={(e) => setEcraser(e.target.checked)} />
                Remplacer l'emploi du temps existant de la classe de destination
              </label>
              <button type="button" className={styles.btnPrimaire} disabled={!cible} onClick={dupliquer}>
                Copier
              </button>
            </div>
          )}

          <div className={styles.barre}>
            <button
              type="button"
              className={styles.btn}
              disabled={affiches.length === 0}
              onClick={() => imprimerEmplois([documentCourant()])}
            >
              <Printer size={15} /> Imprimer / PDF
            </button>
            <button
              type="button"
              className={styles.btn}
              disabled={affiches.length === 0}
              onClick={() => telechargerEmploiCsv(nomFichier(), affiches)}
            >
              <FileSpreadsheet size={15} /> Excel (CSV)
            </button>
            <button type="button" className={styles.btn} onClick={imprimerTous}>
              <Printer size={15} /> Imprimer tous les emplois
            </button>
          </div>

          {vue === 'enseignant' && !enseignantId ? (
            <p className={styles.vide}>Choisissez un enseignant pour voir son emploi du temps.</p>
          ) : (
            <GrilleEmploi
              creneaux={affiches}
              mode={vue === 'classe' ? 'classe' : 'enseignant'}
              onSelect={peutEcrire ? (c) => { setErreurEditeur(''); setEditeur({ initial: c }); } : undefined}
            />
          )}
        </>
      )}

      {editeur && (
        <EditeurCreneau
          mode="direction"
          initial={editeur.initial}
          classes={classes}
          matieres={matieres}
          enseignants={enseignantsListe}
          envoi={envoi}
          erreur={erreurEditeur}
          onClose={() => setEditeur(null)}
          onSave={enregistrer}
          onDelete={supprimer}
        />
      )}
    </div>
  );
};

export default EmploisDuTemps;
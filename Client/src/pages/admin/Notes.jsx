import { useState, useEffect } from 'react';
import { Save, History, AlertTriangle, Search, X } from 'lucide-react';
import api from '../../services/api.js';
import CONFIG from '../../config/config.js';
import BoutonRetour from '../../components/BoutonRetour/BoutonRetour.jsx';
import { ajouterOperation, operationsEnAttente } from '../../offline/file.js';
import styles from '../../theme/pages/admin/Notes.module.css';
import listes from '../../theme/pages/admin/Listes.module.css';

const TRIMESTRES = [
  { value: 't1', label: '1er trimestre' },
  { value: 't2', label: '2ème trimestre' },
  { value: 't3', label: '3ème trimestre' },
];

const TRIMESTRE_LABEL = { t1: '1er trimestre', t2: '2ème trimestre', t3: '3ème trimestre' };
const ELEVES_PAR_PAGE = 15;

const norm = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const comparer = (a, b) =>
  String(a || '').localeCompare(String(b || ''), 'fr', { numeric: true, sensitivity: 'base' });

const Notes = () => {
  const [classes, setClasses] = useState([]);
  const [matieres, setMatieres] = useState([]);
  const [anneeActive, setAnneeActive] = useState(null);
  const [chargementErreur, setChargementErreur] = useState('');

  const [classeId, setClasseId] = useState('');
  const [matiereId, setMatiereId] = useState('');
  const [trimestre, setTrimestre] = useState('t1');
  const [recherche, setRecherche] = useState('');
  const [page, setPage] = useState(1);
  const [triSaisie, setTriSaisie] = useState('matricule');

  const [eleves, setEleves] = useState([]);
  const [notesExistantes, setNotesExistantes] = useState({});
  const [valeurs, setValeurs] = useState({});
  const [bareme, setBareme] = useState(20);
  const [nbAttente, setNbAttente] = useState(0);
  const [rev, setRev] = useState(0);

  const [loadingListe, setLoadingListe] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [erreurSaisie, setErreurSaisie] = useState('');

  const [toutesLesNotes, setToutesLesNotes] = useState([]);
  const [loadingHistorique, setLoadingHistorique] = useState(true);

  const chargerHistorique = async () => {
    setLoadingHistorique(true);
    try {
      const res = await api.get(CONFIG.API_NOTES);
      setToutesLesNotes([...res.data].sort((a, b) => new Date(b.date_saisie) - new Date(a.date_saisie)));
    } catch {
      /* hors ligne sans copie locale : l'historique reste vide */
    } finally {
      setLoadingHistorique(false);
    }
  };

  useEffect(() => {
    const chargerBase = async () => {
      setChargementErreur('');
      try {
        const [resClasses, resMatieres, resAnnees] = await Promise.all([
          api.get(CONFIG.API_CLASSES),
          api.get(CONFIG.API_MATIERES),
          api.get(CONFIG.API_ANNEES_SCOLAIRES),
        ]);
        setClasses(resClasses.data);
        setMatieres([...resMatieres.data].sort((a, b) => comparer(a.nom, b.nom)));
        setAnneeActive(resAnnees.data.find((a) => a.est_active) || null);
      } catch (err) {
        setChargementErreur(
          "Impossible de charger les classes/matières/années scolaires. " +
          (err.response?.data?.detail || err.message)
        );
      }
    };
    chargerBase();
    chargerHistorique();
  }, []);

  // Quand la file change (note rangée sur l'appareil, ou envoyée au serveur), on rafraîchit.
  useEffect(() => {
    const maj = () => { chargerHistorique(); setRev((r) => r + 1); };
    window.addEventListener('sylium:file-changee', maj);
    return () => window.removeEventListener('sylium:file-changee', maj);
  }, []);

  // Retour à la page 1 dès qu'un filtre change.
  useEffect(() => { setPage(1); }, [classeId, matiereId, trimestre, recherche]);

  useEffect(() => {
    if (!classeId || !matiereId || !trimestre || !anneeActive) {
      setEleves([]);
      return;
    }

    const chargerEleves = async () => {
      setLoadingListe(true);
      setMessage('');
      setErreurSaisie('');
      try {
        const classeChoisie = classes.find((c) => c.id === Number(classeId));
        setBareme(classeChoisie?.bareme_note || 20);

        const [resEleves, resNotes] = await Promise.all([
          api.get(CONFIG.API_CLASSE_ELEVES(classeId)),
          api.get(CONFIG.API_NOTES),
        ]);

        setEleves(resEleves.data);

        const idsNotes = {};
        const valeursInit = {};
        resNotes.data
          .filter((n) => n.classe === Number(classeId) && n.matiere === Number(matiereId) && n.trimestre === trimestre)
          .forEach((n) => {
            idsNotes[n.eleve] = n.id;
            valeursInit[n.eleve] = n.valeur;
          });

        // Notes saisies sur cet appareil et pas encore envoyées : elles priment à l'affichage.
        const enAttente = (await operationsEnAttente('note')).filter(
          (o) => o.classe === Number(classeId) && o.matiere === Number(matiereId) && o.trimestre === trimestre
        );
        enAttente.forEach((o) => { valeursInit[o.eleve] = o.valeur; });

        setNotesExistantes(idsNotes);
        setValeurs(valeursInit);
        setNbAttente(enAttente.length);
      } catch {
        setEleves([]);
        setErreurSaisie("Impossible de charger les élèves de cette classe. Ouvrez-la une fois avec internet pour l'utiliser hors ligne.");
      } finally {
        setLoadingListe(false);
      }
    };
    chargerEleves();
  }, [classeId, matiereId, trimestre, anneeActive, classes, rev]);

  const handleValeurChange = (eleveId, val) => {
    setValeurs((prev) => ({ ...prev, [eleveId]: val }));
  };

  const estVide = (v) => v === undefined || v === null || v === '';
  const valeurInvalide = (v) => {
    if (estVide(v)) return false;
    const n = Number(v);
    return Number.isNaN(n) || n < 0 || n > bareme;
  };

  // Range les notes dans la file d'attente de l'appareil (envoi automatique plus tard).
  const placerEnFile = async (lignes) => {
    try {
      for (const l of lignes) {
        await ajouterOperation({
          type: 'note',
          cleNat: `note|${l.eleve}|${l.matiere}|${l.classe}|${l.annee_scolaire}|${l.trimestre}`,
          charge: l,
        });
      }
      setNbAttente(lignes.length);
      setMessage(
        `${lignes.length} note(s) enregistrée(s) sur cet appareil. ` +
        'Elles seront envoyées automatiquement dès le retour du réseau.'
      );
    } catch {
      setErreurSaisie("Impossible d'enregistrer sur cet appareil. Reconnectez-vous avec internet puis réessayez.");
    }
  };

  const handleEnregistrerTout = async () => {
    setMessage('');
    setErreurSaisie('');

    const nbInvalides = eleves.filter((e) => valeurInvalide(valeurs[e.id])).length;
    if (nbInvalides > 0) {
      setErreurSaisie(`${nbInvalides} note(s) hors limites (de 0 à ${bareme}) : corrigez les cases en rouge.`);
      return;
    }

    const lignes = eleves
      .filter((e) => !estVide(valeurs[e.id]))
      .map((e) => ({
        eleve: e.id,
        matiere: Number(matiereId),
        classe: Number(classeId),
        annee_scolaire: anneeActive.id,
        trimestre,
        valeur: String(valeurs[e.id]),
      }));

    if (lignes.length === 0) {
      setErreurSaisie('Saisissez au moins une note.');
      return;
    }

    setSaving(true);

    // Pas de réseau : on enregistre directement sur l'appareil.
    if (!navigator.onLine) {
      await placerEnFile(lignes);
      setSaving(false);
      return;
    }

    try {
      await Promise.all(
        lignes.map((payload) => {
          const noteId = notesExistantes[payload.eleve];
          return noteId
            ? api.patch(`${CONFIG.API_NOTES}${noteId}/`, payload)
            : api.post(CONFIG.API_NOTES, payload);
        })
      );
      setNbAttente(0);
      setMessage('Notes enregistrées avec succès.');
      chargerHistorique();
    } catch (err) {
      if (!err.response) {
        // Le réseau a lâché en cours de route : rien n'est perdu, on garde tout sur l'appareil.
        await placerEnFile(lignes);
      } else {
        const data = err.response.data;
        const premier = data && typeof data === 'object' ? Object.values(data)[0] : null;
        setErreurSaisie(Array.isArray(premier) ? premier[0] : "Erreur lors de l'enregistrement d'une ou plusieurs notes.");
      }
    } finally {
      setSaving(false);
    }
  };

  const reinitialiserFiltres = () => {
    setClasseId('');
    setMatiereId('');
    setRecherche('');
  };

  // ---------- Saisie : élèves par matricule (ou A → Z) ----------
  const elevesSaisie = [...eleves].sort(
    triSaisie === 'nom'
      ? (a, b) => comparer(`${a.nom} ${a.prenom}`, `${b.nom} ${b.prenom}`)
      : (a, b) => comparer(a.matricule, b.matricule)
  );
  const nbSaisies = eleves.filter((e) => !estVide(valeurs[e.id])).length;

  // ---------- Historique ----------
  const texteRecherche = norm(recherche.trim());

  const notesFiltrees = toutesLesNotes.filter((note) => {
    const matchClasse = !classeId || note.classe === Number(classeId);
    const matchMatiere = !matiereId || note.matiere === Number(matiereId);
    const matchTrimestre = note.trimestre === trimestre;
    const matchRecherche =
      !texteRecherche || norm(`${note.eleve_nom} ${note.eleve_matricule}`).includes(texteRecherche);
    return matchClasse && matchMatiere && matchTrimestre && matchRecherche;
  });

  // Regroupement par identifiant d'élève (deux homonymes ne sont plus fusionnés).
  const groupes = {};
  notesFiltrees.forEach((note) => {
    if (!groupes[note.eleve]) {
      groupes[note.eleve] = {
        id: note.eleve,
        nom: note.eleve_nom || `Élève #${note.eleve}`,
        matricule: note.eleve_matricule || '',
        notes: [],
      };
    }
    groupes[note.eleve].notes.push(note);
  });
  const groupesTries = Object.values(groupes).sort(
    (a, b) => comparer(a.matricule, b.matricule) || comparer(a.nom, b.nom)
  );

  const totalPages = Math.max(1, Math.ceil(groupesTries.length / ELEVES_PAR_PAGE));
  const pageCourante = Math.min(page, totalPages);
  const debut = (pageCourante - 1) * ELEVES_PAR_PAGE;
  const groupesPage = groupesTries.slice(debut, debut + ELEVES_PAR_PAGE);

  return (
    <div className={styles.wrapper}>
      <BoutonRetour vers="/dashboardAdmin" />

      <h1 className={styles.title}>Notes</h1>
      <p className={styles.subtitle}>Saisissez les notes ou consultez l'historique ci-dessous</p>

      {chargementErreur && (
        <div className={styles.errorBanner}>
          <AlertTriangle size={16} /> {chargementErreur}
        </div>
      )}

      <div className={styles.filters}>
        <select value={classeId} onChange={(e) => setClasseId(e.target.value)} className={styles.select}>
          <option value="">— Classe —</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
        </select>

        <select value={matiereId} onChange={(e) => setMatiereId(e.target.value)} className={styles.select}>
          <option value="">— Matière —</option>
          {matieres.map((m) => <option key={m.id} value={m.id}>{m.nom}</option>)}
        </select>

        <select value={trimestre} onChange={(e) => setTrimestre(e.target.value)} className={styles.select}>
          {TRIMESTRES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>

        {(classeId || matiereId || recherche) && (
          <button className={styles.resetButton} onClick={reinitialiserFiltres}>
            <X size={14} /> Réinitialiser
          </button>
        )}
      </div>

      {matieres.length === 0 && !chargementErreur && (
        <p className={styles.errorMsg}>Aucune matière disponible pour votre école.</p>
      )}

      {!anneeActive && (
        <p className={styles.errorMsg}>Aucune année scolaire active — impossible de saisir des notes.</p>
      )}

      {nbAttente > 0 && !message && (
        <p className={styles.infoMsg}>{nbAttente} note(s) de cet écran sont en attente d'envoi.</p>
      )}
      {message && <p className={styles.infoMsg}>{message}</p>}
      {erreurSaisie && <p className={styles.errorMsg}>{erreurSaisie}</p>}

      {loadingListe && <p className={styles.stateMsg}>Chargement des élèves...</p>}

      {!loadingListe && classeId && matiereId && eleves.length === 0 && (
        <p className={styles.stateMsg}>Aucun élève inscrit dans cette classe.</p>
      )}

      {!loadingListe && eleves.length > 0 && (
        <>
          <h2 className={styles.sectionTitle}>Saisie</h2>

          <div className={listes.barre}>
            <button
              type="button"
              className={listes.bouton}
              onClick={() => setTriSaisie((t) => (t === 'nom' ? 'matricule' : 'nom'))}
            >
              {triSaisie === 'nom' ? 'Trier par matricule' : 'Trier A → Z'}
            </button>
          </div>
          <p className={listes.progression}>
            {nbSaisies}/{eleves.length} note(s) saisie(s)
          </p>

          <div className={styles.tableWrapper}>
            <table className={`${styles.table} stack`}>
              <thead>
                <tr>
                  <th>Matricule</th>
                  <th>Élève</th>
                  <th>Note (sur {bareme})</th>
                </tr>
              </thead>
              <tbody>
                {elevesSaisie.map((eleve) => (
                  <tr key={eleve.id}>
                    <td data-label="Matricule">{eleve.matricule}</td>
                    <td data-label="Élève">{eleve.nom} {eleve.prenom}</td>
                    <td data-label={`Note /${bareme}`}>
                      <input
                        type="number"
                        min="0"
                        max={bareme}
                        step="0.25"
                        className={`${styles.noteInput} ${valeurInvalide(valeurs[eleve.id]) ? listes.invalide : ''}`}
                        value={valeurs[eleve.id] ?? ''}
                        onChange={(e) => handleValeurChange(eleve.id, e.target.value)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button className={styles.saveButton} onClick={handleEnregistrerTout} disabled={saving}>
            <Save size={16} /> {saving ? 'Enregistrement...' : 'Enregistrer toutes les notes'}
          </button>
        </>
      )}

      <div className={styles.historiqueSection}>
        <h2 className={styles.historiqueTitle}>
          <History size={16} /> Historique des notes ({notesFiltrees.length}
          {notesFiltrees.length !== toutesLesNotes.length ? ` sur ${toutesLesNotes.length}` : ''})
        </h2>

        <div className={listes.barre}>
          <div className={listes.recherche}>
            <Search size={16} color="var(--color-text-dim)" />
            <input
              type="text"
              placeholder="Rechercher un élève ou un matricule..."
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
            />
          </div>
        </div>

        {loadingHistorique && <p className={styles.stateMsg}>Chargement de l'historique...</p>}

        {!loadingHistorique && groupesTries.length === 0 && (
          <p className={styles.stateMsg}>Aucune note ne correspond à ces critères.</p>
        )}

        {!loadingHistorique && groupesTries.length > 0 && (
          <>
            <div className={styles.groupesWrapper}>
              {groupesPage.map((g) => (
                <div key={g.id} className={styles.groupeEleve}>
                  <div className={styles.groupeHeader}>
                    {g.nom}{g.matricule && <small> · {g.matricule}</small>}
                  </div>
                  <table className={styles.groupeTable}>
                    <tbody>
                      {[...g.notes]
                        .sort((a, b) => comparer(a.matiere_nom, b.matiere_nom))
                        .map((note) => (
                          <tr key={note.id}>
                            <td className={styles.matiereCell}>{note.matiere_nom || `Matière #${note.matiere}`}</td>
                            <td className={styles.trimestreCell}>{TRIMESTRE_LABEL[note.trimestre]}</td>
                            <td className={styles.noteCell}>{note.valeur}/{note.valeur_max}</td>
                            <td className={styles.dateCell}>
                              {note.date_saisie ? new Date(note.date_saisie).toLocaleDateString('fr-FR') : '—'}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>

            <div className={styles.pagination}>
              <span className={styles.paginationInfo}>
                Élèves {debut + 1}–{Math.min(debut + ELEVES_PAR_PAGE, groupesTries.length)} sur {groupesTries.length}
              </span>
              <div className={styles.paginationButtons}>
                <button onClick={() => setPage(pageCourante - 1)} disabled={pageCourante === 1}>
                  Précédent
                </button>
                <button onClick={() => setPage(pageCourante + 1)} disabled={pageCourante === totalPages}>
                  Suivant
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Notes;
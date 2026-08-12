import { useState, useEffect } from 'react';
import { Save, History } from 'lucide-react';
import api from '../../services/api.js';
import CONFIG from '../../config/config.js';
import styles from '../../theme/pages/admin/Notes.module.css';

const TRIMESTRES = [
  { value: 't1', label: '1er trimestre' },
  { value: 't2', label: '2ème trimestre' },
  { value: 't3', label: '3ème trimestre' },
];

const TRIMESTRE_LABEL = { t1: '1er trimestre', t2: '2ème trimestre', t3: '3ème trimestre' };

const Notes = () => {
  const [classes, setClasses] = useState([]);
  const [matieres, setMatieres] = useState([]);
  const [anneeActive, setAnneeActive] = useState(null);

  const [classeId, setClasseId] = useState('');
  const [matiereId, setMatiereId] = useState('');
  const [trimestre, setTrimestre] = useState('t1');

  const [eleves, setEleves] = useState([]);
  const [notesExistantes, setNotesExistantes] = useState({});
  const [valeurs, setValeurs] = useState({});
  const [bareme, setBareme] = useState(20);

  const [loadingListe, setLoadingListe] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  // Historique complet — visible dès l'arrivée sur la page, indépendant
  // des filtres de saisie ci-dessus.
  const [toutesLesNotes, setToutesLesNotes] = useState([]);
  const [loadingHistorique, setLoadingHistorique] = useState(true);

  const chargerHistorique = async () => {
    setLoadingHistorique(true);
    try {
      const res = await api.get(CONFIG.API_NOTES);
      // Tri du plus récent au plus ancien pour voir en premier ce qui
      // vient d'être saisi.
      const trie = [...res.data].sort(
        (a, b) => new Date(b.date_saisie) - new Date(a.date_saisie)
      );
      setToutesLesNotes(trie);
    } catch {
      // silencieux — l'historique n'est pas critique si ça échoue,
      // la saisie reste utilisable
    } finally {
      setLoadingHistorique(false);
    }
  };

  useEffect(() => {
    const chargerBase = async () => {
      const [resClasses, resMatieres, resAnnees] = await Promise.all([
        api.get(CONFIG.API_CLASSES),
        api.get(CONFIG.API_MATIERES),
        api.get(CONFIG.API_ANNEES_SCOLAIRES),
      ]);
      setClasses(resClasses.data);
      setMatieres(resMatieres.data);
      setAnneeActive(resAnnees.data.find((a) => a.est_active) || null);
    };
    chargerBase();
    chargerHistorique();
  }, []);

  useEffect(() => {
    if (!classeId || !matiereId || !trimestre || !anneeActive) {
      setEleves([]);
      return;
    }

    const chargerEleves = async () => {
      setLoadingListe(true);
      setMessage('');
      try {
        const classeChoisie = classes.find((c) => c.id === Number(classeId));
        setBareme(classeChoisie?.bareme_note || 20);

        const [resEleves, resNotes] = await Promise.all([
          api.get(CONFIG.API_CLASSE_ELEVES(classeId)),
          api.get(CONFIG.API_NOTES),
        ]);

        setEleves(resEleves.data);

        const notesFiltrees = {};
        const valeursInit = {};
        resNotes.data
          .filter((n) => n.classe === Number(classeId) && n.matiere === Number(matiereId) && n.trimestre === trimestre)
          .forEach((n) => {
            notesFiltrees[n.eleve] = n.id;
            valeursInit[n.eleve] = n.valeur;
          });
        setNotesExistantes(notesFiltrees);
        setValeurs(valeursInit);
      } finally {
        setLoadingListe(false);
      }
    };
    chargerEleves();
  }, [classeId, matiereId, trimestre, anneeActive, classes]);

  const handleValeurChange = (eleveId, val) => {
    setValeurs((prev) => ({ ...prev, [eleveId]: val }));
  };

  const handleEnregistrerTout = async () => {
    setSaving(true);
    setMessage('');
    try {
      const appels = eleves
        .filter((e) => valeurs[e.id] !== undefined && valeurs[e.id] !== '')
        .map((e) => {
          const payload = {
            eleve: e.id,
            matiere: Number(matiereId),
            classe: Number(classeId),
            annee_scolaire: anneeActive.id,
            trimestre,
            valeur: valeurs[e.id],
          };
          const noteId = notesExistantes[e.id];
          return noteId
            ? api.patch(`${CONFIG.API_NOTES}${noteId}/`, payload)
            : api.post(CONFIG.API_NOTES, payload);
        });
      await Promise.all(appels);
      setMessage('Notes enregistrées avec succès.');
      chargerHistorique(); // rafraîchit la liste en bas immédiatement
    } catch {
      setMessage("Erreur lors de l'enregistrement d'une ou plusieurs notes.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.wrapper}>
      <h1 className={styles.title}>Notes</h1>
      <p className={styles.subtitle}>Saisissez les notes ou consultez l'historique ci-dessous</p>

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
      </div>

      {!anneeActive && (
        <p className={styles.errorMsg}>Aucune année scolaire active — impossible de saisir des notes.</p>
      )}

      {message && <p className={styles.infoMsg}>{message}</p>}

      {loadingListe && <p className={styles.stateMsg}>Chargement des élèves...</p>}

      {!loadingListe && classeId && matiereId && eleves.length === 0 && (
        <p className={styles.stateMsg}>Aucun élève inscrit dans cette classe.</p>
      )}

      {!loadingListe && eleves.length > 0 && (
        <>
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Élève</th>
                  <th>Matricule</th>
                  <th>Note (sur {bareme})</th>
                </tr>
              </thead>
              <tbody>
                {eleves.map((eleve) => (
                  <tr key={eleve.id}>
                    <td>{eleve.prenom} {eleve.nom}</td>
                    <td>{eleve.matricule}</td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        max={bareme}
                        step="0.25"
                        className={styles.noteInput}
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

      {/* --- Historique, toujours visible --- */}
      <div className={styles.historiqueSection}>
        <h2 className={styles.historiqueTitle}>
          <History size={16} /> Historique des notes ({toutesLesNotes.length})
        </h2>

        {loadingHistorique && <p className={styles.stateMsg}>Chargement de l'historique...</p>}

        {!loadingHistorique && toutesLesNotes.length === 0 && (
          <p className={styles.stateMsg}>Aucune note enregistrée pour le moment.</p>
        )}

        {!loadingHistorique && toutesLesNotes.length > 0 && (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Élève</th>
                  <th>Matière</th>
                  <th>Période</th>
                  <th>Note</th>
                  <th>Saisie le</th>
                </tr>
              </thead>
              <tbody>
                {toutesLesNotes.slice(0, 50).map((note) => (
                  <tr key={note.id}>
                    <td>{note.eleve_nom || `Élève #${note.eleve}`}</td>
                    <td>{note.matiere_nom || `Matière #${note.matiere}`}</td>
                    <td>{TRIMESTRE_LABEL[note.trimestre]}</td>
                    <td>{note.valeur}/{note.valeur_max}</td>
                    <td>{note.date_saisie ? new Date(note.date_saisie).toLocaleDateString('fr-FR') : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {toutesLesNotes.length > 50 && (
              <p className={styles.limitMsg}>Affichage limité aux 50 notes les plus récentes.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Notes;
import { useState, useEffect } from 'react';
import { Save } from 'lucide-react';
import api from '../../services/api.js';
import CONFIG from '../../config/config.js';
import styles from '../../theme/pages/admin/Notes.module.css';

const TRIMESTRES = [
  { value: 't1', label: '1er trimestre' },
  { value: 't2', label: '2ème trimestre' },
  { value: 't3', label: '3ème trimestre' },
];

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
    } catch {
      setMessage("Erreur lors de l'enregistrement d'une ou plusieurs notes.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.wrapper}>
      <h1 className={styles.title}>Saisie des notes</h1>
      <p className={styles.subtitle}>Sélectionnez une classe, une matière et un trimestre</p>

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
    </div>
  );
};

export default Notes;
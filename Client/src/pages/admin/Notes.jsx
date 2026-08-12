// src/pages/admin/Notes.jsx
import { useState, useEffect } from 'react';
import { Save, History, AlertTriangle, Search, X } from 'lucide-react';
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
  const [chargementErreur, setChargementErreur] = useState('');

  const [classeId, setClasseId] = useState('');
  const [matiereId, setMatiereId] = useState('');
  const [trimestre, setTrimestre] = useState('t1');
  const [recherche, setRecherche] = useState('');

  const [eleves, setEleves] = useState([]);
  const [notesExistantes, setNotesExistantes] = useState({});
  const [valeurs, setValeurs] = useState({});
  const [bareme, setBareme] = useState(20);

  const [loadingListe, setLoadingListe] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const [toutesLesNotes, setToutesLesNotes] = useState([]);
  const [loadingHistorique, setLoadingHistorique] = useState(true);

  const chargerHistorique = async () => {
    setLoadingHistorique(true);
    try {
      const res = await api.get(CONFIG.API_NOTES);
      const trie = [...res.data].sort(
        (a, b) => new Date(b.date_saisie) - new Date(a.date_saisie)
      );
      setToutesLesNotes(trie);
    } catch (err) {
      console.error('Erreur chargement historique notes :', err);
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
        setMatieres(resMatieres.data);
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

        const notesFiltreesLocal = {};
        const valeursInit = {};
        resNotes.data
          .filter((n) => n.classe === Number(classeId) && n.matiere === Number(matiereId) && n.trimestre === trimestre)
          .forEach((n) => {
            notesFiltreesLocal[n.eleve] = n.id;
            valeursInit[n.eleve] = n.valeur;
          });
        setNotesExistantes(notesFiltreesLocal);
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
      chargerHistorique();
    } catch {
      setMessage("Erreur lors de l'enregistrement d'une ou plusieurs notes.");
    } finally {
      setSaving(false);
    }
  };

  const reinitialiserFiltres = () => {
    setClasseId('');
    setMatiereId('');
    setRecherche('');
  };

  // L'historique respecte les mêmes filtres que la saisie (classe/matière
  // si sélectionnées), le trimestre (toujours actif), plus une recherche
  // libre sur le nom de l'élève.
  const notesFiltrees = toutesLesNotes.filter((note) => {
    const matchClasse = !classeId || note.classe === Number(classeId);
    const matchMatiere = !matiereId || note.matiere === Number(matiereId);
    const matchTrimestre = note.trimestre === trimestre;
    const matchRecherche = !recherche || (note.eleve_nom || '').toLowerCase().includes(recherche.toLowerCase());
    return matchClasse && matchMatiere && matchTrimestre && matchRecherche;
  });

  // Regroupe les notes par élève, trié alphabétiquement — bien plus
  // lisible qu'une simple liste chronologique mélangeant tout le monde.
  const groupesParEleve = notesFiltrees.reduce((acc, note) => {
    const cle = note.eleve_nom || `Élève #${note.eleve}`;
    if (!acc[cle]) acc[cle] = [];
    acc[cle].push(note);
    return acc;
  }, {});

  const elevesTries = Object.keys(groupesParEleve).sort((a, b) => a.localeCompare(b));

  return (
    <div className={styles.wrapper}>
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

      <div className={styles.searchBar}>
        <Search size={16} color="var(--color-text-dim)" />
        <input
          type="text"
          placeholder="Rechercher un élève dans l'historique..."
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
        />
      </div>

      {matieres.length === 0 && !chargementErreur && (
        <p className={styles.errorMsg}>Aucune matière disponible pour votre école.</p>
      )}

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
          <h2 className={styles.sectionTitle}>Saisie</h2>
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

      <div className={styles.historiqueSection}>
        <h2 className={styles.historiqueTitle}>
          <History size={16} /> Historique des notes ({notesFiltrees.length}
          {notesFiltrees.length !== toutesLesNotes.length ? ` sur ${toutesLesNotes.length}` : ''})
        </h2>

        {loadingHistorique && <p className={styles.stateMsg}>Chargement de l'historique...</p>}

        {!loadingHistorique && elevesTries.length === 0 && (
          <p className={styles.stateMsg}>Aucune note ne correspond à ces critères.</p>
        )}

        {!loadingHistorique && elevesTries.length > 0 && (
          <div className={styles.groupesWrapper}>
            {elevesTries.map((nomEleve) => (
              <div key={nomEleve} className={styles.groupeEleve}>
                <div className={styles.groupeHeader}>{nomEleve}</div>
                <table className={styles.groupeTable}>
                  <tbody>
                    {groupesParEleve[nomEleve]
                      .sort((a, b) => (a.matiere_nom || '').localeCompare(b.matiere_nom || ''))
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
        )}
      </div>
    </div>
  );
};

export default Notes;
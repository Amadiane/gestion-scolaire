import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Save } from 'lucide-react';
import api from '../../services/api.js';
import CONFIG from '../../config/config.js';
import BoutonRetour from '../../components/BoutonRetour/BoutonRetour.jsx';
import styles from '../../theme/pages/admin/Notes.module.css';

const TRIMESTRES = [
  { value: 't1', label: '1er trimestre' },
  { value: 't2', label: '2ème trimestre' },
  { value: 't3', label: '3ème trimestre' },
];

const NotesEnseignant = () => {
  const location = useLocation();
  const [affectations, setAffectations] = useState([]);
  const [choix, setChoix] = useState(location.state?.affectation ? String(location.state.affectation) : '');
  const [trimestre, setTrimestre] = useState('t1');
  const [eleves, setEleves] = useState([]);
  const [valeurs, setValeurs] = useState({});
  const [existantes, setExistantes] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [erreur, setErreur] = useState('');

  const aff = affectations.find((a) => String(a.id) === choix);

  useEffect(() => {
    api.get(CONFIG.API_MES_AFFECTATIONS)
      .then((res) => setAffectations(res.data))
      .catch(() => setErreur('Impossible de charger vos affectations.'));
  }, []);

  useEffect(() => {
    if (!aff) { setEleves([]); return; }
    const charger = async () => {
      setLoading(true);
      setMessage('');
      setErreur('');
      try {
        const [resEleves, resNotes] = await Promise.all([
          api.get(CONFIG.API_CLASSE_ELEVES(aff.classe_id)),
          api.get(CONFIG.API_NOTES),
        ]);
        setEleves(resEleves.data);
        const ids = {};
        const vals = {};
        resNotes.data
          .filter((n) => n.classe === aff.classe_id && n.matiere === aff.matiere_id && n.trimestre === trimestre)
          .forEach((n) => { ids[n.eleve] = n.id; vals[n.eleve] = n.valeur; });
        setExistantes(ids);
        setValeurs(vals);
      } catch {
        setErreur('Impossible de charger les élèves.');
      } finally {
        setLoading(false);
      }
    };
    charger();
  }, [aff, trimestre]);

  const enregistrer = async () => {
    setSaving(true);
    setMessage('');
    setErreur('');
    try {
      const appels = eleves
        .filter((e) => valeurs[e.id] !== undefined && valeurs[e.id] !== '')
        .map((e) => {
          const payload = {
            eleve: e.id,
            matiere: aff.matiere_id,
            classe: aff.classe_id,
            annee_scolaire: aff.annee_scolaire,
            trimestre,
            valeur: valeurs[e.id],
          };
          return existantes[e.id]
            ? api.patch(`${CONFIG.API_NOTES}${existantes[e.id]}/`, payload)
            : api.post(CONFIG.API_NOTES, payload);
        });
      await Promise.all(appels);
      setMessage('Notes enregistrées avec succès.');
    } catch (err) {
      const data = err.response?.data;
      const premier = data && typeof data === 'object' ? Object.values(data)[0] : null;
      setErreur(Array.isArray(premier) ? premier[0] : "Erreur lors de l'enregistrement d'une ou plusieurs notes.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.wrapper}>
      <BoutonRetour vers="/enseignant" />

      <h1 className={styles.title}>Saisir des notes</h1>
      <p className={styles.subtitle}>Choisissez l'un de vos enseignements et le trimestre</p>

      <div className={styles.filters}>
        <select className={styles.select} value={choix} onChange={(e) => setChoix(e.target.value)}>
          <option value="">— Classe · matière —</option>
          {affectations.map((a) => (
            <option key={a.id} value={a.id}>{a.classe_nom} · {a.matiere_nom}</option>
          ))}
        </select>
        <select className={styles.select} value={trimestre} onChange={(e) => setTrimestre(e.target.value)}>
          {TRIMESTRES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>

      {affectations.length === 0 && !erreur && (
        <p className={styles.stateMsg}>Aucune classe ne vous est affectée : contactez la direction.</p>
      )}
      {message && <p className={styles.infoMsg}>{message}</p>}
      {erreur && <p className={styles.errorMsg}>{erreur}</p>}
      {loading && <p className={styles.stateMsg}>Chargement des élèves...</p>}

      {!loading && aff && eleves.length > 0 && (
        <>
          <div className={styles.tableWrapper}>
            <table className={`${styles.table} stack`}>
              <thead>
                <tr><th>Élève</th><th>Matricule</th><th>Note (sur {aff.bareme_note})</th></tr>
              </thead>
              <tbody>
                {eleves.map((e) => (
                  <tr key={e.id}>
                    <td data-label="Élève">{e.prenom} {e.nom}</td>
                    <td data-label="Matricule">{e.matricule}</td>
                    <td data-label={`Note /${aff.bareme_note}`}>
                      <input
                        type="number" min="0" max={aff.bareme_note} step="0.25"
                        className={styles.noteInput}
                        value={valeurs[e.id] ?? ''}
                        onChange={(ev) => setValeurs((prev) => ({ ...prev, [e.id]: ev.target.value }))}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button className={styles.saveButton} onClick={enregistrer} disabled={saving}>
            <Save size={16} /> {saving ? 'Enregistrement...' : 'Enregistrer toutes les notes'}
          </button>
        </>
      )}
    </div>
  );
};

export default NotesEnseignant;
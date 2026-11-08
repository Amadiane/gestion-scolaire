import { useState, useEffect, useMemo, useCallback } from 'react';
import { Plus, Printer, FileSpreadsheet } from 'lucide-react';
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

const MonEmploi = () => {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const monNom = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username || 'Enseignant';

  const [creneaux, setCreneaux] = useState([]);
  const [affectations, setAffectations] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState('');
  const [info, setInfo] = useState('');
  const [source, setSource] = useState('moi'); // 'moi' ou id d'une de mes classes
  const [editeur, setEditeur] = useState(null);
  const [erreurEditeur, setErreurEditeur] = useState('');
  const [envoi, setEnvoi] = useState(false);

  const charger = useCallback(async () => {
    setErreur('');
    try {
      const [e, a] = await Promise.all([
        api.get(CONFIG.API_EMPLOIS),
        api.get(CONFIG.API_MES_AFFECTATIONS),
      ]);
      setCreneaux(e.data);
      setAffectations(a.data);
    } catch {
      setErreur("Impossible de charger votre emploi du temps. Cette page demande une connexion internet.");
    } finally {
      setChargement(false);
    }
  }, []);

  useEffect(() => {
    charger();
  }, [charger]);

  // Une ligne par couple classe + matière qui m'est affecté.
  const choix = useMemo(
    () =>
      affectations.map((a) => ({
        classe: a.classe_id,
        classe_nom: a.classe_nom,
        matiere: a.matiere_id ?? a.matiere,
        matiere_nom: a.matiere_nom,
      })),
    [affectations]
  );

  const mesClasses = useMemo(() => {
    const m = new Map();
    affectations.forEach((a) => m.set(a.classe_id, a.classe_nom));
    return [...m.entries()];
  }, [affectations]);

  const affiches = useMemo(
    () => (source === 'moi' ? creneaux.filter((c) => c.mien) : creneaux.filter((c) => String(c.classe) === source)),
    [creneaux, source]
  );

  const titre =
    source === 'moi'
      ? `Emploi du temps — ${monNom}`
      : `Emploi du temps — ${mesClasses.find(([id]) => String(id) === source)?.[1] || ''}`;

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

  return (
    <div className={styles.wrapper}>
      <BoutonRetour vers="/enseignant" />
      <h1 className={styles.titre}>Mon emploi du temps</h1>
      <p className={styles.aide}>
        Ajoutez vos cours dans les classes et matières qui vous sont affectées. Vous pouvez aussi consulter l'emploi
        du temps de vos classes. Vous ne modifiez que les créneaux que vous avez créés.
      </p>

      {erreur && <div className={styles.erreur}>{erreur}</div>}
      {info && <div className={styles.info}>{info}</div>}
      {chargement && <p className={styles.aide}>Chargement…</p>}

      {!chargement && !erreur && choix.length === 0 && (
        <p className={styles.vide}>
          Aucune classe ne vous est affectée. Demandez à la direction de vous affecter vos classes et matières.
        </p>
      )}

      {!chargement && choix.length > 0 && (
        <>
          <div className={styles.barre}>
            <select className={styles.select} value={source} onChange={(e) => setSource(e.target.value)}>
              <option value="moi">Mon emploi (tous mes cours)</option>
              {mesClasses.map(([id, nom]) => <option key={id} value={String(id)}>Classe {nom}</option>)}
            </select>

            <span className={styles.espace} />

            <button
              type="button"
              className={styles.btnPrimaire}
              onClick={() => { setErreurEditeur(''); setEditeur({ initial: null }); }}
            >
              <Plus size={15} /> Ajouter un créneau
            </button>
          </div>

          <div className={styles.barre}>
            <button
              type="button"
              className={styles.btn}
              disabled={affiches.length === 0}
              onClick={() =>
                imprimerEmplois([{
                  titre,
                  creneaux: affiches,
                  mode: source === 'moi' ? 'enseignant' : 'classe',
                }])
              }
            >
              <Printer size={15} /> Imprimer / PDF
            </button>
            <button
              type="button"
              className={styles.btn}
              disabled={affiches.length === 0}
              onClick={() => telechargerEmploiCsv(titre.replace(/[^\w-]+/g, '_'), affiches)}
            >
              <FileSpreadsheet size={15} /> Excel (CSV)
            </button>
          </div>

          <GrilleEmploi
            creneaux={affiches}
            mode={source === 'moi' ? 'enseignant' : 'classe'}
            onSelect={(c) => { setErreurEditeur(''); setEditeur({ initial: c }); }}
          />
        </>
      )}

      {editeur && (
        <EditeurCreneau
          mode="enseignant"
          initial={editeur.initial}
          choix={choix}
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

export default MonEmploi;
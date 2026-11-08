import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Printer, FileSpreadsheet } from 'lucide-react';
import api from '../../services/api.js';
import CONFIG from '../../config/config.js';
import BoutonRetour from '../../components/BoutonRetour/BoutonRetour.jsx';
import { imprimerTableau, telechargerCsv } from '../../utils/exportTableau.js';
import styles from '../../theme/pages/admin/Presences.module.css';

// Dates locales (jamais en UTC) pour éviter le décalage d'un jour.
const iso = (d) => d.toLocaleDateString('en-CA');
const afficher = (s) => new Date(`${s}T00:00:00`).toLocaleDateString('fr-FR');
const courte = (s) => new Date(`${s}T00:00:00`).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });

const PERIODES = {
  jour: { label: "Aujourd'hui", calcul: () => { const t = iso(new Date()); return [t, t]; } },
  semaine: {
    label: 'Cette semaine',
    calcul: () => {
      const d = new Date();
      const lundi = new Date(d);
      lundi.setDate(d.getDate() - ((d.getDay() + 6) % 7));
      return [iso(lundi), iso(d)];
    },
  },
  mois: {
    label: 'Ce mois',
    calcul: () => { const d = new Date(); return [iso(new Date(d.getFullYear(), d.getMonth(), 1)), iso(d)]; },
  },
  moisPasse: {
    label: 'Mois dernier',
    calcul: () => {
      const d = new Date();
      return [iso(new Date(d.getFullYear(), d.getMonth() - 1, 1)), iso(new Date(d.getFullYear(), d.getMonth(), 0))];
    },
  },
  libre: { label: 'Personnalisée' },
};

const LETTRES = { present: 'P', absent: 'A', retard: 'R', excuse: 'E' };

const RapportPresences = () => {
  const navigate = useNavigate();
  const [periode, setPeriode] = useState('jour');
  const [[du, au], setDates] = useState(PERIODES.jour.calcul());
  const [classes, setClasses] = useState([]);
  const [classeId, setClasseId] = useState('');
  const [vue, setVue] = useState('resume');
  const [data, setData] = useState(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    api.get(CONFIG.API_CLASSES).then((res) => setClasses(res.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!du || !au) return undefined;
    let annule = false;
    (async () => {
      setChargement(true);
      setErreur('');
      try {
        const params = new URLSearchParams({ du, au });
        if (classeId) params.set('classe', classeId);
        const res = await api.get(`${CONFIG.API_PRESENCES_RAPPORT}?${params}`);
        if (!annule) setData(res.data);
      } catch (err) {
        if (!annule) {
          setData(null);
          setErreur(err.response?.data?.detail || 'Impossible de charger le suivi. Cette page nécessite internet.');
        }
      } finally {
        if (!annule) setChargement(false);
      }
    })();
    return () => { annule = true; };
  }, [du, au, classeId]);

  const choisirPeriode = (cle) => {
    setPeriode(cle);
    if (PERIODES[cle].calcul) setDates(PERIODES[cle].calcul());
  };

  const unJour = du === au;
  const titrePeriode = unJour ? `le ${afficher(du)}` : `du ${afficher(du)} au ${afficher(au)}`;
  const nomClasse = data?.classe?.nom || 'Toutes les classes';

  // Tableau courant → mêmes données pour l'écran, l'impression et l'export.
  const tableauExport = () => {
    if (!data) return null;
    if (!data.classe) {
      return {
        entetes: ['Classe', 'Effectif', "Jours d'appel", 'Présent', 'Absent', 'Retard', 'Excusé', 'Taux de présence'],
        lignes: data.classes.map((c) => [
          c.nom, c.effectif, c.jours_appel, c.comptes.present, c.comptes.absent,
          c.comptes.retard, c.comptes.excuse, c.taux == null ? '' : `${c.taux}%`,
        ]),
      };
    }
    if (vue === 'cahier' && data.cases) {
      return {
        entetes: ['Élève', ...data.dates.map(courte)],
        lignes: data.eleves.map((e) => [
          `${e.nom} ${e.prenom}`,
          ...data.dates.map((d) => LETTRES[data.cases[e.id]?.[d]] || ''),
        ]),
      };
    }
    return {
      entetes: ['Élève', 'Matricule', 'Présent', 'Absent', 'Retard', 'Excusé', 'Non renseigné', 'Taux de présence'],
      lignes: data.eleves.map((e) => [
        `${e.nom} ${e.prenom}`, e.matricule, e.comptes.present, e.comptes.absent, e.comptes.retard,
        e.comptes.excuse, e.non_renseigne, e.taux == null ? '' : `${e.taux}%`,
      ]),
    };
  };

  const exporter = (format) => {
    const t = tableauExport();
    if (!t) return;
    const titre = `Présences · ${nomClasse}`;
    if (format === 'csv') telechargerCsv(`presences_${du}_${au}.csv`, t.entetes, t.lignes);
    else imprimerTableau(titre, `Période : ${titrePeriode}`, t.entetes, t.lignes);
  };

  const elevesTries = data?.eleves
    ? [...data.eleves].sort((a, b) => b.comptes.absent - a.comptes.absent || a.nom.localeCompare(b.nom, 'fr'))
    : [];
  const classesSansAppel = data?.classes ? data.classes.filter((c) => c.jours_appel === 0).length : 0;

  return (
    <div className={styles.wrapperLarge}>
      <BoutonRetour vers="/dashboardAdmin" />
      <h1 className={styles.titre}>Suivi des présences</h1>
      <p className={styles.sousTitre}>Bilan par classe et par élève, sur la période de votre choix.</p>

      <div className={styles.onglets}>
        {Object.entries(PERIODES).map(([cle, p]) => (
          <button
            key={cle}
            type="button"
            className={`${styles.onglet} ${periode === cle ? styles.ongletActif : ''}`}
            onClick={() => choisirPeriode(cle)}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className={styles.filtres}>
        {periode === 'libre' && (
          <>
            <input type="date" className={styles.champ} value={du} max={au} onChange={(e) => e.target.value && setDates([e.target.value, au])} />
            <input type="date" className={styles.champ} value={au} min={du} onChange={(e) => e.target.value && setDates([du, e.target.value])} />
          </>
        )}
        <select className={styles.champ} value={classeId} onChange={(e) => { setClasseId(e.target.value); setVue('resume'); }}>
          <option value="">Toutes les classes</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
        </select>
      </div>

      <p className={styles.etat}>Période : {titrePeriode}</p>
      {erreur && <p className={styles.erreur}>{erreur}</p>}
      {chargement && <p className={styles.etat}>Chargement…</p>}

      {!chargement && data && (
        <>
          <div className={styles.filtres}>
            <button type="button" className={styles.bouton} onClick={() => exporter('print')}>
              <Printer size={15} /> Imprimer / PDF
            </button>
            <button type="button" className={styles.bouton} onClick={() => exporter('csv')}>
              <FileSpreadsheet size={15} /> Excel (CSV)
            </button>
          </div>

          {!data.classe ? (
            <>
              {unJour && (
                <p className={classesSansAppel ? styles.erreur : styles.info}>
                  {classesSansAppel
                    ? `${classesSansAppel} classe(s) n'ont pas encore fait l'appel ce jour.`
                    : "Toutes les classes ont fait l'appel ce jour."}
                </p>
              )}
              <div className={styles.tableWrap}>
                <table className={styles.tableau}>
                  <thead>
                    <tr>
                      <th>Classe</th><th>Effectif</th><th>{unJour ? 'Appel' : "Jours d'appel"}</th>
                      <th>Présent</th><th>Absent</th><th>Retard</th><th>Excusé</th><th>Taux</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.classes.map((c) => (
                      <tr key={c.id} className={styles.cliquable} onClick={() => setClasseId(String(c.id))}>
                        <td>{c.nom}</td>
                        <td>{c.effectif}</td>
                        <td>
                          {unJour ? (
                            <span className={c.jours_appel ? styles.pastille_present : styles.pastille_absent}>
                              {c.jours_appel ? 'Fait' : 'Non fait'}
                            </span>
                          ) : c.jours_appel}
                        </td>
                        <td>{c.comptes.present}</td><td>{c.comptes.absent}</td>
                        <td>{c.comptes.retard}</td><td>{c.comptes.excuse}</td>
                        <td>{c.taux == null ? '—' : `${c.taux}%`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {data.classes.length === 0 && <p className={styles.etat}>Aucune classe pour l'année active.</p>}
            </>
          ) : (
            <>
              <div className={styles.resume}>
                <span>{data.jours_appel} jour(s) d'appel</span>
                <span>{data.taux == null ? '—' : `${data.taux}%`} de présence</span>
                <span className={styles.pastille_present}>{data.comptes.present} présent</span>
                <span className={styles.pastille_absent}>{data.comptes.absent} absent</span>
                <span className={styles.pastille_retard}>{data.comptes.retard} retard</span>
                <span className={styles.pastille_excuse}>{data.comptes.excuse} excusé</span>
              </div>

              <div className={styles.onglets}>
                <button type="button" className={`${styles.onglet} ${vue === 'resume' ? styles.ongletActif : ''}`} onClick={() => setVue('resume')}>
                  Résumé par élève
                </button>
                {data.cases && data.dates.length > 0 && (
                  <button type="button" className={`${styles.onglet} ${vue === 'cahier' ? styles.ongletActif : ''}`} onClick={() => setVue('cahier')}>
                    Cahier d'appel
                  </button>
                )}
              </div>

              {data.jours_appel === 0 && <p className={styles.etat}>Aucun appel enregistré pour cette classe sur la période.</p>}

              {vue === 'resume' || !data.cases ? (
                <div className={styles.tableWrap}>
                  <table className={styles.tableau}>
                    <thead>
                      <tr>
                        <th>Élève</th><th>Présent</th><th>Absent</th><th>Retard</th><th>Excusé</th>
                        <th>Non renseigné</th><th>Taux</th>
                      </tr>
                    </thead>
                    <tbody>
                      {elevesTries.map((e) => (
                        <tr key={e.id} className={styles.cliquable} onClick={() => navigate(`/dashboardAdmin/eleves/${e.id}`)}>
                          <td>{e.nom} {e.prenom}<div className={styles.sous}>{e.matricule}</div></td>
                          <td>{e.comptes.present}</td><td>{e.comptes.absent}</td>
                          <td>{e.comptes.retard}</td><td>{e.comptes.excuse}</td>
                          <td>{e.non_renseigne}</td>
                          <td>{e.taux == null ? '—' : `${e.taux}%`}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className={styles.tableWrap}>
                  <table className={`${styles.tableau} ${styles.cahier}`}>
                    <thead>
                      <tr>
                        <th className={styles.colonneFixe}>Élève</th>
                        {data.dates.map((d) => <th key={d}>{courte(d)}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {data.eleves.map((e) => (
                        <tr key={e.id}>
                          <td className={styles.colonneFixe}>{e.nom} {e.prenom}</td>
                          {data.dates.map((d) => {
                            const s = data.cases[e.id]?.[d];
                            return <td key={d} className={s ? styles[`case_${s}`] : ''}>{LETTRES[s] || '·'}</td>;
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className={styles.legende}>P présent · A absent · R retard · E excusé · · non renseigné</p>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
};

export default RapportPresences;
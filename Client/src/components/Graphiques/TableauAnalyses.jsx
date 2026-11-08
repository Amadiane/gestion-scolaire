import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api.js';
import CONFIG from '../../config/config.js';
import { MODES, formatGNF } from '../../utils/finance.js';
import { Anneau, BarresEmpilees, BarresHorizontales, COULEURS, Courbes, NOMS } from './Graphiques.jsx';
import styles from '../../theme/components/TableauAnalyses.module.css';

const ROLES_PRESENCES = ['directeur', 'secretaire', 'surveillant'];
const ROLES_FINANCE = ['directeur', 'comptable'];
const JOURS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

// Toutes les dates sont locales (jamais en UTC) pour éviter le décalage d'un jour.
const iso = (d) => d.toLocaleDateString('en-CA');
const enDate = (s) => new Date(`${s}T00:00:00`);
const fr = (s) => enDate(s).toLocaleDateString('fr-FR');
const etiquette = (cle, gran) =>
  gran === 'mois'
    ? enDate(`${cle}-01`).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })
    : enDate(cle).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
const court = (v) => {
  if (v >= 1e6) return `${(v / 1e6).toFixed(1).replace('.0', '')} M`;
  if (v >= 1e3) return `${Math.round(v / 1e3)} k`;
  return String(v);
};
const couleurTaux = (t) => (t >= 90 ? COULEURS.present : t >= 75 ? COULEURS.retard : COULEURS.absent);

const calculerBornes = (type, ref, annee) => {
  const d = new Date(ref);
  d.setHours(0, 0, 0, 0);
  if (type === 'jour') return [iso(d), iso(d)];
  if (type === 'semaine') {
    const lundi = new Date(d);
    lundi.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    const dimanche = new Date(lundi);
    dimanche.setDate(lundi.getDate() + 6);
    return [iso(lundi), iso(dimanche)];
  }
  if (type === 'mois') {
    return [iso(new Date(d.getFullYear(), d.getMonth(), 1)), iso(new Date(d.getFullYear(), d.getMonth() + 1, 0))];
  }
  if (annee) return [annee.date_debut, annee.date_fin];
  return [iso(new Date(d.getFullYear(), 0, 1)), iso(new Date(d.getFullYear(), 11, 31))];
};

const libelleBornes = (type, du, au, annee) => {
  if (type === 'jour') {
    return enDate(du).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }
  if (type === 'semaine') return `Semaine du ${fr(du)} au ${fr(au)}`;
  if (type === 'mois') return enDate(du).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  return annee ? `Année scolaire ${annee.nom}` : `Année ${du.slice(0, 4)}`;
};

const Bascule = ({ valeur, options, onChange }) => (
  <div className={styles.bascule}>
    {options.map(([v, l]) => (
      <button
        key={v}
        type="button"
        className={`${styles.basculeBtn} ${valeur === v ? styles.actif : ''}`}
        onClick={() => onChange(v)}
      >
        {l}
      </button>
    ))}
  </div>
);

const TableauAnalyses = ({ role }) => {
  const navigate = useNavigate();
  const voitPresences = ROLES_PRESENCES.includes(role);
  const voitFinance = ROLES_FINANCE.includes(role);

  const [type, setType] = useState('semaine');
  const [ref, setRef] = useState(new Date());
  const [annees, setAnnees] = useState([]);
  const [iAnnee, setIAnnee] = useState(0);
  const [classes, setClasses] = useState([]);
  const [classeId, setClasseId] = useState('');
  const [data, setData] = useState(null);
  const [finance, setFinance] = useState(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState('');

  const [grEvol, setGrEvol] = useState('barres');
  const [grRepart, setGrRepart] = useState('anneau');
  const [grClasses, setGrClasses] = useState('taux');
  const [grFin, setGrFin] = useState('barres');

  useEffect(() => {
    api.get(CONFIG.API_ANNEES_SCOLAIRES)
      .then((res) => {
        const liste = [...res.data].sort((a, b) => String(b.date_debut).localeCompare(String(a.date_debut)));
        setAnnees(liste);
        const active = liste.findIndex((a) => a.est_active);
        setIAnnee(active >= 0 ? active : 0);
      })
      .catch(() => {});
    if (voitPresences) api.get(CONFIG.API_CLASSES).then((res) => setClasses(res.data)).catch(() => {});
  }, [voitPresences]);

  const annee = annees[iAnnee];
  const [du, au] = useMemo(() => calculerBornes(type, ref, annee), [type, ref, annee]);

  useEffect(() => {
    let annule = false;
    (async () => {
      setChargement(true);
      setErreur('');
      try {
        const params = new URLSearchParams({ du, au });
        if (classeId) params.set('classe', classeId);
        const [p, f] = await Promise.all([
          voitPresences ? api.get(`${CONFIG.API_TABLEAU_PRESENCES}?${params}`) : null,
          voitFinance ? api.get(`${CONFIG.API_TABLEAU_FINANCE}?du=${du}&au=${au}`).catch(() => null) : null,
        ]);
        if (annule) return;
        setData(p ? p.data : null);
        setFinance(f && f.data.disponible ? f.data : null);
      } catch (err) {
        if (!annule) {
          setData(null);
          setFinance(null);
          setErreur(err.response?.data?.detail || 'Les diagrammes nécessitent une connexion internet.');
        }
      } finally {
        if (!annule) setChargement(false);
      }
    })();
    return () => { annule = true; };
  }, [du, au, classeId, voitPresences, voitFinance]);

  const decaler = (n) => {
    if (type === 'annee') {
      setIAnnee((i) => Math.min(Math.max(i - n, 0), Math.max(annees.length - 1, 0)));
      return;
    }
    const d = new Date(ref);
    if (type === 'jour') d.setDate(d.getDate() + n);
    else if (type === 'semaine') d.setDate(d.getDate() + 7 * n);
    else { d.setDate(1); d.setMonth(d.getMonth() + n); }
    setRef(d);
  };
  const suivantBloque = type === 'annee' ? iAnnee <= 0 : au >= iso(new Date());
  const precedentBloque = type === 'annee' && iAnnee >= annees.length - 1;

  const delta = data && data.taux != null && data.taux_precedent != null ? data.taux - data.taux_precedent : null;
  const gran = data?.granularite || 'jour';
  const labels = data ? data.serie.map((s) => etiquette(s.cle, gran)) : [];
  const classesFaites = data ? data.classes.filter((c) => c.jours_appel > 0).length : 0;

  const lignesClasses = useMemo(() => {
    if (!data) return [];
    if (grClasses === 'taux') {
      return data.classes
        .filter((c) => c.taux != null)
        .sort((a, b) => a.taux - b.taux)
        .map((c) => ({
          label: c.nom, valeur: c.taux, texte: `${c.taux}%`, couleur: couleurTaux(c.taux),
          onClick: () => setClasseId(String(c.id)),
        }));
    }
    return [...data.classes]
      .sort((a, b) => b.comptes.absent - a.comptes.absent)
      .map((c) => ({
        label: c.nom, valeur: c.comptes.absent, texte: String(c.comptes.absent), couleur: COULEURS.absent,
        onClick: () => setClasseId(String(c.id)),
      }));
  }, [data, grClasses]);
  const maxClasses = grClasses === 'taux' ? 100 : Math.max(1, ...lignesClasses.map((l) => l.valeur));

  const partsPresence = (comptes) =>
    ['present', 'absent', 'retard', 'excuse'].map((k) => ({ label: NOMS[k], valeur: comptes[k], couleur: COULEURS[k] }));

  // Nombre de cartes de la deuxième rangée : sert à les répartir sans carte orpheline.
  const nbSecondaires = data ? (classeId ? 0 : 1) + 2 + (data.personnel ? 1 : 0) : 0;

  return (
    <section className={styles.section}>
      <h2 className={styles.titreSection}>Analyses</h2>

      <div className={styles.barre}>
        <div className={styles.types}>
          {[['jour', 'Jour'], ['semaine', 'Semaine'], ['mois', 'Mois'], ['annee', 'Année']].map(([v, l]) => (
            <button
              key={v}
              type="button"
              className={`${styles.typeBtn} ${type === v ? styles.actif : ''}`}
              onClick={() => { setType(v); if (v !== 'annee') setRef(new Date()); }}
            >
              {l}
            </button>
          ))}
        </div>
        <div className={styles.navigation}>
          <button type="button" className={styles.navBtn} onClick={() => decaler(-1)} disabled={precedentBloque} aria-label="Période précédente">◀</button>
          <div className={styles.libelle}>{libelleBornes(type, du, au, annee)}</div>
          <button type="button" className={styles.navBtn} onClick={() => decaler(1)} disabled={suivantBloque} aria-label="Période suivante">▶</button>
        </div>
        {voitPresences ? (
          <select className={styles.champ} value={classeId} onChange={(e) => setClasseId(e.target.value)}>
            <option value="">Toutes les classes</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
          </select>
        ) : <span />}
      </div>

      {erreur && <p className={styles.erreur}>{erreur}</p>}
      {chargement && <p className={styles.etat}>Chargement des diagrammes…</p>}

      {!chargement && data && (
        <>
          <div className={styles.kpis}>
            <div className={styles.kpi}>
              <span className={styles.kpiValeur}>{data.taux == null ? '—' : `${data.taux}%`}</span>
              <span className={styles.kpiLabel}>Taux de présence</span>
              {delta != null && delta !== 0 && (
                <span className={delta > 0 ? styles.hausse : styles.baisse}>
                  {delta > 0 ? '▲' : '▼'} {Math.abs(delta)} pt vs période précédente
                </span>
              )}
            </div>
            <div className={styles.kpi}><span className={styles.kpiValeur}>{data.comptes.present}</span><span className={styles.kpiLabel}>Présences</span></div>
            <div className={styles.kpi}><span className={styles.kpiValeur}>{data.comptes.absent}</span><span className={styles.kpiLabel}>Absences</span></div>
            <div className={styles.kpi}><span className={styles.kpiValeur}>{data.comptes.retard}</span><span className={styles.kpiLabel}>Retards</span></div>
            <div className={styles.kpi}>
              <span className={styles.kpiValeur}>{du === au ? `${classesFaites}/${data.classes.length}` : data.jours_appel}</span>
              <span className={styles.kpiLabel}>{du === au ? "Classes ayant fait l'appel" : "Jours d'appel"}</span>
            </div>
          </div>

          {data.jours_appel === 0 ? (
            <p className={styles.etat}>Aucun appel enregistré sur cette période.</p>
          ) : (
            <>
              <div className={styles.principale}>
                <div className={styles.carte}>
                  <div className={styles.carteEntete}>
                    <h3 className={styles.carteTitre}>Évolution</h3>
                    <Bascule
                      valeur={grEvol}
                      onChange={setGrEvol}
                      options={[['barres', 'Barres'], ['taux', 'Taux'], ['lignes', 'Absences']]}
                    />
                  </div>
                  {grEvol === 'barres' && (
                    <BarresEmpilees
                      donnees={data.serie.map((s, i) => ({ label: labels[i], valeurs: s }))}
                      cles={['present', 'retard', 'excuse', 'absent']}
                      couleurs={COULEURS}
                    />
                  )}
                  {grEvol === 'taux' && (
                    <Courbes
                      labels={labels}
                      max={100}
                      suffixe="%"
                      aire
                      series={[{ nom: 'Taux de présence', couleur: COULEURS.present, valeurs: data.serie.map((s) => s.taux) }]}
                    />
                  )}
                  {grEvol === 'lignes' && (
                    <Courbes
                      labels={labels}
                      series={[
                        { nom: 'Absents', couleur: COULEURS.absent, valeurs: data.serie.map((s) => s.absent) },
                        { nom: 'Retards', couleur: COULEURS.retard, valeurs: data.serie.map((s) => s.retard) },
                      ]}
                    />
                  )}
                </div>

                <div className={styles.carte}>
                  <div className={styles.carteEntete}>
                    <h3 className={styles.carteTitre}>Répartition</h3>
                    <Bascule valeur={grRepart} onChange={setGrRepart} options={[['anneau', 'Anneau'], ['barres', 'Barres']]} />
                  </div>
                  {grRepart === 'anneau' ? (
                    <Anneau parts={partsPresence(data.comptes)} centre={data.taux == null ? '—' : `${data.taux}%`} />
                  ) : (
                    <BarresHorizontales
                      max={Math.max(1, ...Object.values(data.comptes))}
                      lignes={partsPresence(data.comptes).map((p) => ({
                        label: p.label, valeur: p.valeur, texte: String(p.valeur), couleur: p.couleur,
                      }))}
                    />
                  )}
                </div>
              </div>

              <div
                className={styles.grilleAuto}
                style={{
                  '--c-moyen': Math.min(nbSecondaires, 2),
                  '--c-large': nbSecondaires === 4 ? 2 : nbSecondaires,
                }}
              >
                {!classeId && (
                  <div className={styles.carte}>
                    <div className={styles.carteEntete}>
                      <h3 className={styles.carteTitre}>Par classe</h3>
                      <Bascule valeur={grClasses} onChange={setGrClasses} options={[['taux', 'Taux'], ['absences', 'Absences']]} />
                    </div>
                    {lignesClasses.length === 0
                      ? <p className={styles.etat}>Aucune donnée par classe.</p>
                      : <BarresHorizontales lignes={lignesClasses} max={maxClasses} />}
                  </div>
                )}

                <div className={styles.carte}>
                  <div className={styles.carteEntete}><h3 className={styles.carteTitre}>Absences par jour de la semaine</h3></div>
                  <BarresEmpilees
                    donnees={data.par_jour_semaine.map((j, i) => ({ label: JOURS[i], valeurs: { absent: j.absent } }))}
                    cles={['absent']}
                    couleurs={COULEURS}
                  />
                </div>

                <div className={styles.carte}>
                  <div className={styles.carteEntete}><h3 className={styles.carteTitre}>Élèves les plus absents</h3></div>
                  {data.top_absents.length === 0 ? (
                    <p className={styles.etat}>Aucune absence sur la période.</p>
                  ) : (
                    <ul className={styles.top}>
                      {data.top_absents.map((e) => (
                        <li key={e.eleve_id} onClick={() => navigate(`/dashboardAdmin/eleves/${e.eleve_id}`)}>
                          <span>
                            {e.nom} {e.prenom}
                            <span className={styles.sous}> · {e.classe}</span>
                          </span>
                          <strong>{e.n} abs.</strong>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {data.personnel && (
                  <div className={styles.carte}>
                    <div className={styles.carteEntete}><h3 className={styles.carteTitre}>Présences du personnel</h3></div>
                    <Anneau
                      parts={partsPresence(data.personnel.comptes)}
                      centre={data.personnel.taux == null ? '—' : `${data.personnel.taux}%`}
                    />
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}

      {!chargement && finance && (
        <div className={styles.principale}>
          <div className={styles.carte}>
            <div className={styles.carteEntete}>
              <h3 className={styles.carteTitre}>Encaissements · {formatGNF(finance.total)} GNF</h3>
              <Bascule valeur={grFin} onChange={setGrFin} options={[['barres', 'Barres'], ['courbe', 'Courbe']]} />
            </div>
            {finance.serie.length === 0 ? (
              <p className={styles.etat}>Aucun paiement sur cette période.</p>
            ) : grFin === 'barres' ? (
              <BarresEmpilees
                donnees={finance.serie.map((s) => ({ label: etiquette(s.cle, finance.granularite), valeurs: { montant: s.montant } }))}
                cles={['montant']}
                couleurs={{ montant: COULEURS.present }}
                format={court}
              />
            ) : (
              <Courbes
                labels={finance.serie.map((s) => etiquette(s.cle, finance.granularite))}
                series={[{ nom: 'Encaissé', couleur: COULEURS.present, valeurs: finance.serie.map((s) => s.montant) }]}
                aire
                format={court}
              />
            )}
          </div>

          <div className={styles.carte}>
            <div className={styles.carteEntete}><h3 className={styles.carteTitre}>Par mode de paiement</h3></div>
            {finance.par_mode.length === 0 ? (
              <p className={styles.etat}>Aucun paiement sur cette période.</p>
            ) : (
              <BarresHorizontales
                max={Math.max(1, ...finance.par_mode.map((m) => m.montant))}
                lignes={finance.par_mode.map((m) => ({
                  label: MODES[m.mode] || m.mode, valeur: m.montant, texte: court(m.montant), couleur: COULEURS.excuse,
                }))}
              />
            )}
          </div>
        </div>
      )}
    </section>
  );
};

export default TableauAnalyses;
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Download, Wallet, Trash2, AlertTriangle, Printer, ChevronUp, ChevronDown, X,
} from 'lucide-react';
import api from '../../services/api.js';
import CONFIG from '../../config/config.js';
import BoutonRetour from '../../components/BoutonRetour/BoutonRetour.jsx';
import Pagination from '../../components/Pagination/Pagination.jsx';
import usePagination from '../../hooks/usePagination.js';
import { operationsEnAttente } from '../../offline/file.js';
import { imprimerRecuProvisoire } from '../../offline/recu.js';
import PaiementModal from './PaiementModal.jsx';
import { formatGNF, MODES, telechargerRecu } from '../../utils/finance.js';
import styles from '../../theme/pages/admin/Finance.module.css';

// ---------- Outils ----------
const norm = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const comparer = (a, b) =>
  String(a || '').localeCompare(String(b || ''), 'fr', { numeric: true, sensitivity: 'base' });

const dateISO = (d) => d.toLocaleDateString('en-CA'); // AAAA-MM-JJ, heure locale
const aujourdhui = () => dateISO(new Date());
const debutSemaine = () => {
  const d = new Date();
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // lundi
  return dateISO(d);
};
const debutMois = () => {
  const d = new Date();
  d.setDate(1);
  return dateISO(d);
};
const jour = (v) => String(v || '').slice(0, 10);
const fmtDate = (v) => {
  const [a, m, j] = jour(v).split('-');
  return j ? `${j}/${m}/${a}` : '—';
};

// Sens par défaut quand on clique une colonne pour la première fois.
const SENS_DEFAUT = { date: 'desc', montant: 'desc', apayer: 'desc', paye: 'desc', reste: 'desc' };

const trier = (liste, tri, comparateurs) => {
  const l = [...liste].sort(comparateurs[tri.cle]);
  return tri.sens === 'desc' ? l.reverse() : l;
};

const Finance = () => {
  const navigate = useNavigate();
  const [onglet, setOnglet] = useState('paiements');
  const [paiements, setPaiements] = useState([]);
  const [arrieres, setArrieres] = useState({ eleves: [], nb_eleves: 0, total_reste: 0, total_paye: 0, total_a_payer: 0 });
  const [frais, setFrais] = useState([]);
  const [niveaux, setNiveaux] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null);
  const [recuId, setRecuId] = useState(null);
  const [nouveauFrais, setNouveauFrais] = useState({ niveau: '', libelle: 'Scolarité', montant: '' });
  const [fraisError, setFraisError] = useState('');
  const [enAttente, setEnAttente] = useState([]);

  // Filtres : paiements
  const [recherche, setRecherche] = useState('');
  const [modeFiltre, setModeFiltre] = useState('');
  const [classeP, setClasseP] = useState('');
  const [du, setDu] = useState('');
  const [au, setAu] = useState('');
  const [triP, setTriP] = useState({ cle: 'date', sens: 'desc' });

  // Filtres : arriérés
  const [rechercheA, setRechercheA] = useState('');
  const [classeA, setClasseA] = useState('');
  const [triA, setTriA] = useState({ cle: 'reste', sens: 'desc' });

  // Filtre : frais
  const [niveauFiltre, setNiveauFiltre] = useState('');

  const charger = useCallback(async (silencieux = false) => {
    if (!silencieux) setLoading(true);
    setError('');
    try {
      const [p, a, f, n] = await Promise.all([
        api.get(CONFIG.API_PAIEMENTS),
        api.get(CONFIG.API_FINANCE_ARRIERES),
        api.get(CONFIG.API_FRAIS),
        api.get(CONFIG.API_NIVEAUX),
      ]);
      setPaiements(p.data);
      setArrieres(a.data);
      setFrais(f.data);
      setNiveaux(n.data);
    } catch (err) {
      setError(
        err.response?.status === 403
          ? "Accès réservé au directeur et au comptable."
          : err.response?.data?.[0] || err.response?.data?.detail || "Impossible de charger les données financières."
      );
    } finally {
      setLoading(false);
    }
    setEnAttente(await operationsEnAttente('paiement'));
  }, []);

  useEffect(() => { charger(); }, [charger]);

  // Quand la file change (saisie ou fin de synchronisation), on met la liste à jour.
  useEffect(() => {
    const maj = () => charger(true);
    window.addEventListener('sylium:file-changee', maj);
    return () => window.removeEventListener('sylium:file-changee', maj);
  }, [charger]);

  const handleRecu = async (paiement) => {
    setRecuId(paiement.id);
    try {
      await telechargerRecu(paiement);
    } catch {
      alert('Impossible de télécharger ce reçu.');
    } finally {
      setRecuId(null);
    }
  };

  const handlePaiementCree = async (paiement) => {
    setModal(null);
    await charger();
    handleRecu(paiement);
  };

  const ajouterFrais = async (e) => {
    e.preventDefault();
    setFraisError('');
    try {
      await api.post(CONFIG.API_FRAIS, nouveauFrais);
      setNouveauFrais({ niveau: '', libelle: 'Scolarité', montant: '' });
      charger();
    } catch (err) {
      const data = err.response?.data;
      const premier = data && typeof data === 'object' ? Object.values(data)[0] : null;
      setFraisError(Array.isArray(premier) ? premier[0] : "Impossible d'ajouter ce frais.");
    }
  };

  const supprimerFrais = async (f) => {
    if (!window.confirm(`Supprimer « ${f.libelle} » (${f.niveau_nom}) ?`)) return;
    try {
      await api.delete(`${CONFIG.API_FRAIS}${f.id}/`);
      charger();
    } catch {
      alert('Impossible de supprimer ce frais.');
    }
  };

  // En-tête de colonne triable (clic = tri, second clic = sens inverse).
  const entete = (tri, setTri, cle, libelle) => (
    <th
      className={styles.sortable}
      onClick={() =>
        setTri((t) =>
          t.cle === cle
            ? { cle, sens: t.sens === 'asc' ? 'desc' : 'asc' }
            : { cle, sens: SENS_DEFAUT[cle] || 'asc' }
        )
      }
      aria-sort={tri.cle === cle ? (tri.sens === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      {libelle}
      {tri.cle === cle && (tri.sens === 'asc' ? <ChevronUp size={13} /> : <ChevronDown size={13} />)}
    </th>
  );

  // ---------- Paiements ----------
  const dansPeriode = (d) => {
    const j = jour(d);
    return (!du || j >= du) && (!au || j <= au);
  };

  const texteRecherche = norm(recherche.trim());

  const paiementsFiltres = trier(
    paiements.filter(
      (p) =>
        norm(`${p.eleve_nom} ${p.numero_recu}`).includes(texteRecherche) &&
        (!modeFiltre || p.mode === modeFiltre) &&
        (!classeP || p.classe_nom === classeP) &&
        dansPeriode(p.date_paiement)
    ),
    triP,
    {
      date: (a, b) => comparer(jour(a.date_paiement), jour(b.date_paiement)) || a.id - b.id,
      montant: (a, b) => Number(a.montant) - Number(b.montant) || a.id - b.id,
      eleve: (a, b) => comparer(a.eleve_nom, b.eleve_nom) || a.id - b.id,
      recu: (a, b) => comparer(a.numero_recu, b.numero_recu),
    }
  );

  // Les paiements en attente d'envoi suivent la recherche, le mode et la période.
  const attenteFiltres = enAttente
    .filter(
      (p) =>
        !classeP &&
        norm(`${p.eleveLabel} ${p.numeroProvisoire}`).includes(texteRecherche) &&
        (!modeFiltre || p.mode === modeFiltre) &&
        dansPeriode(p.date_paiement)
    )
    .sort((a, b) => comparer(jour(b.date_paiement), jour(a.date_paiement)));

  const totalEnAttente = enAttente.reduce((somme, p) => somme + Number(p.montant || 0), 0);

  const totalFiltre = paiementsFiltres.reduce((s, p) => s + Number(p.montant || 0), 0);
  const parMode = {};
  paiementsFiltres.forEach((p) => {
    parMode[p.mode] = (parMode[p.mode] || 0) + Number(p.montant || 0);
  });

  // Filtre par classe : disponible dès que le serveur fournit `classe_nom` pour chaque paiement.
  const classesP = [...new Set(paiements.map((p) => p.classe_nom).filter(Boolean))].sort(comparer);

  const PRESETS = [
    { id: 'jour', label: "Aujourd'hui", du: aujourdhui(), au: aujourdhui() },
    { id: 'semaine', label: 'Cette semaine', du: debutSemaine(), au: aujourdhui() },
    { id: 'mois', label: 'Ce mois', du: debutMois(), au: aujourdhui() },
  ];

  const filtresPActifs = recherche || modeFiltre || classeP || du || au;
  const effacerFiltresP = () => {
    setRecherche('');
    setModeFiltre('');
    setClasseP('');
    setDu('');
    setAu('');
  };

  const paginationP = usePagination(
    paiementsFiltres,
    25,
    `${recherche}|${modeFiltre}|${classeP}|${du}|${au}|${triP.cle}|${triP.sens}`
  );

  // ---------- Arriérés ----------
  const classesA = [...new Set(arrieres.eleves.map((s) => s.classe_nom).filter(Boolean))].sort(comparer);

  const arrieresFiltres = trier(
    arrieres.eleves.filter(
      (s) =>
        norm(s.eleve_nom).includes(norm(rechercheA.trim())) &&
        (!classeA || s.classe_nom === classeA)
    ),
    triA,
    {
      eleve: (a, b) => comparer(a.eleve_nom, b.eleve_nom),
      classe: (a, b) => comparer(a.classe_nom, b.classe_nom) || comparer(a.eleve_nom, b.eleve_nom),
      apayer: (a, b) => a.a_payer - b.a_payer,
      paye: (a, b) => a.paye - b.paye,
      reste: (a, b) => a.reste - b.reste,
    }
  );
  const totalResteFiltre = arrieresFiltres.reduce((s, x) => s + Number(x.reste || 0), 0);
  const paginationA = usePagination(arrieresFiltres, 25, `${rechercheA}|${classeA}|${triA.cle}|${triA.sens}`);

  // ---------- Frais ----------
  const niveauxTries = [...niveaux].sort((a, b) => (a.ordre ?? 9999) - (b.ordre ?? 9999) || comparer(a.nom, b.nom));
  const ordreNiveau = (nom) => niveaux.find((n) => n.nom === nom)?.ordre ?? 9999;
  const niveauChoisi = niveaux.find((n) => String(n.id) === niveauFiltre);
  const fraisAffiches = frais
    .filter((f) => !niveauChoisi || f.niveau_nom === niveauChoisi.nom)
    .sort((a, b) => ordreNiveau(a.niveau_nom) - ordreNiveau(b.niveau_nom) || comparer(a.libelle, b.libelle));

  const tauxRecouvrement = arrieres.total_a_payer
    ? Math.round((arrieres.total_paye / arrieres.total_a_payer) * 100)
    : 0;

  return (
    <div className={styles.wrapper}>
      <BoutonRetour vers="/dashboardAdmin" />

      <div className={styles.headerRow}>
        <div>
          <h1 className={styles.title}>Finance</h1>
          <p className={styles.subtitle}>Frais de scolarité, paiements et arriérés (année active)</p>
        </div>
        <button className={styles.addButton} onClick={() => setModal({ eleve: null })}>
          <Plus size={16} /> Enregistrer un paiement
        </button>
      </div>

      {error && <div className={styles.errorBanner}><AlertTriangle size={16} /> {error}</div>}
      {loading && <p className={styles.stateMsg}>Chargement...</p>}

      {!loading && !error && (
        <>
          <div className={styles.summary}>
            <div className={styles.summaryCard}>
              <span className={styles.summaryValue}>{formatGNF(arrieres.total_paye)}</span>
              <span className={styles.summaryLabel}>Encaissé (GNF)</span>
            </div>
            <div className={styles.summaryCard}>
              <span className={styles.summaryValue}>{formatGNF(arrieres.total_reste)}</span>
              <span className={styles.summaryLabel}>Reste à recouvrer (GNF)</span>
            </div>
            <div className={styles.summaryCard}>
              <span className={styles.summaryValue}>{tauxRecouvrement}%</span>
              <span className={styles.summaryLabel}>Taux de recouvrement</span>
            </div>
            <div className={styles.summaryCard}>
              <span className={styles.summaryValue}>{arrieres.nb_eleves}</span>
              <span className={styles.summaryLabel}>Élèves en retard</span>
            </div>
          </div>

          {enAttente.length > 0 && (
            <div className={styles.errorBanner} style={{ background: '#fef3c7', color: '#92400e' }}>
              <AlertTriangle size={16} />
              {enAttente.length} paiement(s) en attente d'envoi ({formatGNF(totalEnAttente)} GNF) :
              ils ne sont pas encore inclus dans les totaux ci-dessus.
            </div>
          )}

          <div className={styles.tabs}>
            {[
              ['paiements', `Paiements (${paiements.length})`],
              ['arrieres', `Arriérés (${arrieres.nb_eleves})`],
              ['frais', 'Frais de scolarité'],
            ].map(([cle, label]) => (
              <button
                key={cle}
                className={`${styles.tab} ${onglet === cle ? styles.tabActive : ''}`}
                onClick={() => setOnglet(cle)}
              >
                {label}
              </button>
            ))}
          </div>

          {/* ===================== PAIEMENTS ===================== */}
          {onglet === 'paiements' && (
            <>
              <div className={styles.filtersRow}>
                <input
                  className={styles.searchInput}
                  placeholder="Rechercher par élève ou n° de reçu..."
                  value={recherche}
                  onChange={(e) => setRecherche(e.target.value)}
                />
                <select
                  className={styles.selectFiltre}
                  value={modeFiltre}
                  onChange={(e) => setModeFiltre(e.target.value)}
                  aria-label="Filtrer par mode de paiement"
                >
                  <option value="">Tous les modes</option>
                  {Object.entries(MODES).map(([cle, label]) => (
                    <option key={cle} value={cle}>{label}</option>
                  ))}
                </select>
                {classesP.length > 0 && (
                  <select
                    className={styles.selectFiltre}
                    value={classeP}
                    onChange={(e) => setClasseP(e.target.value)}
                    aria-label="Filtrer par classe"
                  >
                    <option value="">Toutes les classes</option>
                    {classesP.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                )}
              </div>

              <div className={styles.filtersRow}>
                <div className={styles.presets}>
                  {PRESETS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className={`${styles.presetBtn} ${du === p.du && au === p.au ? styles.presetActif : ''}`}
                      onClick={() => { setDu(p.du); setAu(p.au); }}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                <label className={styles.dateField}>
                  Du <input type="date" value={du} max={au || undefined} onChange={(e) => setDu(e.target.value)} />
                </label>
                <label className={styles.dateField}>
                  Au <input type="date" value={au} min={du || undefined} onChange={(e) => setAu(e.target.value)} />
                </label>
                {filtresPActifs && (
                  <button type="button" className={styles.effacer} onClick={effacerFiltresP}>
                    <X size={14} /> Effacer les filtres
                  </button>
                )}
              </div>

              {paiementsFiltres.length > 0 && (
                <div className={styles.totalBar}>
                  <strong>{paiementsFiltres.length} paiement(s)</strong>
                  <span>Total : <b>{formatGNF(totalFiltre)} GNF</b></span>
                  <span className={styles.modeChips}>
                    {Object.entries(parMode).map(([cle, valeur]) => (
                      <span key={cle} className={styles.modeChip}>
                        {MODES[cle] || cle} : {formatGNF(valeur)}
                      </span>
                    ))}
                  </span>
                </div>
              )}

              {paiementsFiltres.length === 0 && attenteFiltres.length === 0 ? (
                <div className={styles.emptyState}><Wallet size={36} color="var(--color-text-dim)" /><p>Aucun paiement trouvé.</p></div>
              ) : (
                <>
                  <div className={styles.tableWrapper}>
                    <table className={`${styles.table} stack`}>
                      <thead>
                        <tr>
                          {entete(triP, setTriP, 'recu', 'Reçu')}
                          {entete(triP, setTriP, 'date', 'Date')}
                          {entete(triP, setTriP, 'eleve', 'Élève')}
                          {entete(triP, setTriP, 'montant', 'Montant')}
                          <th>Mode</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {attenteFiltres.map((p) => (
                          <tr key={p.uuid_client}>
                            <td data-label="Reçu">
                              {p.numeroProvisoire}{' '}
                              <span className={styles.badge} style={{ background: '#fef3c7', color: '#92400e' }}>
                                En attente
                              </span>
                            </td>
                            <td data-label="Date">{fmtDate(p.date_paiement)}</td>
                            <td data-label="Élève">{p.eleveLabel}</td>
                            <td data-label="Montant" className={styles.montant}>{formatGNF(p.montant)}</td>
                            <td data-label="Mode">{MODES[p.mode] || p.mode}</td>
                            <td data-label="Reçu provisoire">
                              <button
                                className={styles.iconButton}
                                onClick={() => imprimerRecuProvisoire(p)}
                                title="Imprimer le reçu provisoire"
                              >
                                <Printer size={15} />
                              </button>
                            </td>
                          </tr>
                        ))}
                        {paginationP.pageItems.map((p) => (
                          <tr key={p.id}>
                            <td data-label="Reçu">{p.numero_recu}</td>
                            <td data-label="Date">{fmtDate(p.date_paiement)}</td>
                            <td
                              data-label="Élève"
                              className={styles.link}
                              onClick={() => navigate(`/dashboardAdmin/eleves/${p.eleve}`)}
                            >
                              {p.eleve_nom}
                            </td>
                            <td data-label="Montant" className={styles.montant}>{formatGNF(p.montant)}</td>
                            <td data-label="Mode">{MODES[p.mode] || p.mode}</td>
                            <td data-label="Reçu PDF">
                              <button
                                className={styles.iconButton}
                                onClick={() => handleRecu(p)}
                                disabled={recuId === p.id}
                                title="Télécharger le reçu"
                              >
                                <Download size={15} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {paiementsFiltres.length > 0 && <Pagination {...paginationP} unite="paiements" />}
                </>
              )}
            </>
          )}

          {/* ===================== ARRIÉRÉS ===================== */}
          {onglet === 'arrieres' && (
            arrieres.eleves.length === 0 ? (
              <div className={styles.emptyState}><p>Aucun arriéré : tous les élèves sont à jour, ou aucun frais n'est encore défini.</p></div>
            ) : (
              <>
                <div className={styles.filtersRow}>
                  <input
                    className={styles.searchInput}
                    placeholder="Rechercher un élève..."
                    value={rechercheA}
                    onChange={(e) => setRechercheA(e.target.value)}
                  />
                  <select
                    className={styles.selectFiltre}
                    value={classeA}
                    onChange={(e) => setClasseA(e.target.value)}
                    aria-label="Filtrer par classe"
                  >
                    <option value="">Toutes les classes</option>
                    {classesA.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  {(rechercheA || classeA) && (
                    <button
                      type="button"
                      className={styles.effacer}
                      onClick={() => { setRechercheA(''); setClasseA(''); }}
                    >
                      <X size={14} /> Effacer les filtres
                    </button>
                  )}
                </div>

                {arrieresFiltres.length > 0 && (
                  <div className={styles.totalBar}>
                    <strong>{arrieresFiltres.length} élève(s) en retard</strong>
                    <span>Reste à recouvrer : <b>{formatGNF(totalResteFiltre)} GNF</b></span>
                  </div>
                )}

                {arrieresFiltres.length === 0 ? (
                  <div className={styles.emptyState}><p>Aucun élève ne correspond à ces filtres.</p></div>
                ) : (
                  <>
                    <div className={styles.tableWrapper}>
                      <table className={`${styles.table} stack`}>
                        <thead>
                          <tr>
                            {entete(triA, setTriA, 'eleve', 'Élève')}
                            {entete(triA, setTriA, 'classe', 'Classe')}
                            {entete(triA, setTriA, 'apayer', 'À payer')}
                            {entete(triA, setTriA, 'paye', 'Payé')}
                            {entete(triA, setTriA, 'reste', 'Reste')}
                            <th></th>
                          </tr>
                        </thead>
                        <tbody>
                          {paginationA.pageItems.map((s) => (
                            <tr key={s.eleve_id}>
                              <td
                                data-label="Élève"
                                className={styles.link}
                                onClick={() => navigate(`/dashboardAdmin/eleves/${s.eleve_id}`)}
                              >
                                {s.eleve_nom}
                              </td>
                              <td data-label="Classe">{s.classe_nom}</td>
                              <td data-label="À payer">{formatGNF(s.a_payer)}</td>
                              <td data-label="Payé">{formatGNF(s.paye)}</td>
                              <td data-label="Reste" className={styles.reste}>{formatGNF(s.reste)}</td>
                              <td data-label="Action">
                                <button
                                  className={styles.encaisserButton}
                                  onClick={() => setModal({ eleve: { id: s.eleve_id, nom: s.eleve_nom } })}
                                >
                                  Encaisser
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <Pagination {...paginationA} unite="élèves" />
                  </>
                )}
              </>
            )
          )}

          {/* ===================== FRAIS ===================== */}
          {onglet === 'frais' && (
            <>
              <form className={styles.fraisForm} onSubmit={ajouterFrais}>
                <select value={nouveauFrais.niveau} onChange={(e) => setNouveauFrais({ ...nouveauFrais, niveau: e.target.value })} required>
                  <option value="">— Niveau —</option>
                  {niveauxTries.map((n) => <option key={n.id} value={n.id}>{n.nom}</option>)}
                </select>
                <input
                  placeholder="Libellé (ex. Scolarité)"
                  value={nouveauFrais.libelle}
                  onChange={(e) => setNouveauFrais({ ...nouveauFrais, libelle: e.target.value })}
                  required
                />
                <input
                  type="number" min="0" placeholder="Montant (GNF)"
                  value={nouveauFrais.montant}
                  onChange={(e) => setNouveauFrais({ ...nouveauFrais, montant: e.target.value })}
                  required
                />
                <button type="submit" className={styles.addButton}><Plus size={16} /> Ajouter</button>
              </form>
              {fraisError && <p className={styles.errorMsg}>{fraisError}</p>}

              {frais.length > 0 && (
                <div className={styles.filtersRow}>
                  <select
                    className={styles.selectFiltre}
                    value={niveauFiltre}
                    onChange={(e) => setNiveauFiltre(e.target.value)}
                    aria-label="Filtrer par niveau"
                  >
                    <option value="">Tous les niveaux</option>
                    {niveauxTries.map((n) => <option key={n.id} value={n.id}>{n.nom}</option>)}
                  </select>
                </div>
              )}

              {frais.length === 0 ? (
                <div className={styles.emptyState}><p>Définissez les frais de chaque niveau : les restes à payer en dépendent.</p></div>
              ) : (
                <div className={styles.tableWrapper}>
                  <table className={`${styles.table} stack`}>
                    <thead><tr><th>Niveau</th><th>Libellé</th><th>Montant</th><th></th></tr></thead>
                    <tbody>
                      {fraisAffiches.map((f) => (
                        <tr key={f.id}>
                          <td data-label="Niveau">{f.niveau_nom}</td>
                          <td data-label="Libellé">{f.libelle}</td>
                          <td data-label="Montant" className={styles.montant}>{formatGNF(f.montant)}</td>
                          <td data-label="Supprimer">
                            <button className={styles.iconButton} onClick={() => supprimerFrais(f)} title="Supprimer">
                              <Trash2 size={15} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </>
      )}

      {modal && (
        <PaiementModal
          eleveInitial={modal.eleve}
          onClose={() => setModal(null)}
          onSuccess={handlePaiementCree}
          onEnAttente={() => { setModal(null); charger(true); }}
        />
      )}
    </div>
  );
};

export default Finance;
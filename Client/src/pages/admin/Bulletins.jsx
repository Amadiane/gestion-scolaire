import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Download, CheckCircle, Search, ChevronUp, ChevronDown, X } from 'lucide-react';
import api from '../../services/api.js';
import CONFIG from '../../config/config.js';
import BoutonRetour from '../../components/BoutonRetour/BoutonRetour.jsx';
import Pagination from '../../components/Pagination/Pagination.jsx';
import usePagination from '../../hooks/usePagination.js';
import styles from '../../theme/pages/admin/Bulletins.module.css';
import listes from '../../theme/pages/admin/Listes.module.css';

const TRIMESTRE_LABEL = { t1: '1er trimestre', t2: '2ème trimestre', t3: '3ème trimestre' };

const norm = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const comparer = (a, b) =>
  String(a || '').localeCompare(String(b || ''), 'fr', { numeric: true, sensitivity: 'base' });
const rangNum = (r) => (r == null || r === '' ? 9999 : Number(r));
const majuscule = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

const SENS_DEFAUT = { moyenne: 'desc' };

const comparateurs = {
  eleve: (a, b) => comparer(a.eleve_nom, b.eleve_nom),
  classe: (a, b) =>
    comparer(a.classe_nom, b.classe_nom) ||
    comparer(a.trimestre, b.trimestre) ||
    rangNum(a.rang) - rangNum(b.rang) ||
    comparer(a.eleve_matricule, b.eleve_matricule),
  periode: (a, b) =>
    comparer(a.trimestre, b.trimestre) ||
    comparer(a.classe_nom, b.classe_nom) ||
    rangNum(a.rang) - rangNum(b.rang),
  moyenne: (a, b) => Number(a.moyenne_generale ?? -1) - Number(b.moyenne_generale ?? -1),
  rang: (a, b) => rangNum(a.rang) - rangNum(b.rang) || comparer(a.classe_nom, b.classe_nom),
  statut: (a, b) => comparer(a.statut, b.statut) || comparer(a.classe_nom, b.classe_nom),
};

const Bulletins = () => {
  const navigate = useNavigate();
  const [bulletins, setBulletins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState(null);
  const [recherche, setRecherche] = useState('');
  const [periode, setPeriode] = useState('');
  const [classeFiltre, setClasseFiltre] = useState('');
  const [statutFiltre, setStatutFiltre] = useState('');
  const [tri, setTri] = useState({ cle: 'classe', sens: 'asc' });

  const charger = async () => {
    setLoading(true);
    try {
      const res = await api.get(CONFIG.API_BULLETINS);
      setBulletins(res.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    charger();
  }, []);

  const handleValider = async (bulletin) => {
    setActionId(bulletin.id);
    try {
      await api.post(CONFIG.API_BULLETIN_VALIDER(bulletin.id));
      charger();
    } catch (err) {
      alert(err.response?.status === 403
        ? 'Seul le directeur peut valider un bulletin.'
        : 'Impossible de valider ce bulletin.');
    } finally {
      setActionId(null);
    }
  };

  const handleTelecharger = async (bulletin) => {
    setActionId(bulletin.id);
    try {
      const resUrl = await api.get(CONFIG.API_BULLETIN_TELECHARGER(bulletin.id));
      const response = await fetch(resUrl.data.url);
      if (!response.ok) throw new Error();
      const blob = await response.blob();
      const nomEleve = bulletin.eleve_nom.replace(/\s+/g, '_');
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `bulletin_${nomEleve}_${bulletin.trimestre.toUpperCase()}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch {
      alert('Impossible de télécharger ce bulletin.');
    } finally {
      setActionId(null);
    }
  };

  const basculerTri = (cle) =>
    setTri((t) =>
      t.cle === cle
        ? { cle, sens: t.sens === 'asc' ? 'desc' : 'asc' }
        : { cle, sens: SENS_DEFAUT[cle] || 'asc' }
    );

  const entete = (cle, libelle) => (
    <th
      className={listes.sortable}
      onClick={() => basculerTri(cle)}
      aria-sort={tri.cle === cle ? (tri.sens === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      {libelle}
      {tri.cle === cle && (tri.sens === 'asc' ? <ChevronUp size={13} /> : <ChevronDown size={13} />)}
    </th>
  );

  const classesDispo = [...new Set(bulletins.map((b) => b.classe_nom).filter(Boolean))].sort(comparer);
  const statutsDispo = [...new Set(bulletins.map((b) => b.statut).filter(Boolean))].sort(comparer);

  const texte = norm(recherche.trim());
  const bulletinsFiltres = bulletins
    .filter(
      (b) =>
        norm(`${b.eleve_nom} ${b.classe_nom} ${b.eleve_matricule}`).includes(texte) &&
        (!periode || b.trimestre === periode) &&
        (!classeFiltre || b.classe_nom === classeFiltre) &&
        (!statutFiltre || b.statut === statutFiltre)
    )
    .sort(comparateurs[tri.cle] || comparateurs.classe);
  if (tri.sens === 'desc') bulletinsFiltres.reverse();

  const nbBrouillons = bulletins.filter((b) => b.statut === 'brouillon').length;
  const filtresActifs = recherche || periode || classeFiltre || statutFiltre;
  const effacerFiltres = () => {
    setRecherche('');
    setPeriode('');
    setClasseFiltre('');
    setStatutFiltre('');
  };

  const pagination = usePagination(
    bulletinsFiltres,
    25,
    `${recherche}|${periode}|${classeFiltre}|${statutFiltre}|${tri.cle}|${tri.sens}`
  );

  return (
    <div className={styles.wrapper}>
      <BoutonRetour vers="/dashboardAdmin" />

      <h1 className={styles.title}>Bulletins</h1>
      <p className={styles.subtitle}>
        {bulletins.length} bulletin(s)
        {nbBrouillons > 0 && ` · ${nbBrouillons} brouillon(s) à valider`}
      </p>

      {!loading && bulletins.length > 0 && (
        <div className={listes.barre}>
          <div className={listes.recherche}>
            <Search size={16} color="var(--color-text-dim)" />
            <input
              type="text"
              placeholder="Rechercher par élève, matricule ou classe..."
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
            />
          </div>

          <select
            className={listes.select}
            value={classeFiltre}
            onChange={(e) => setClasseFiltre(e.target.value)}
            aria-label="Filtrer par classe"
          >
            <option value="">Toutes les classes</option>
            {classesDispo.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>

          <select
            className={listes.select}
            value={periode}
            onChange={(e) => setPeriode(e.target.value)}
            aria-label="Filtrer par période"
          >
            <option value="">Toutes les périodes</option>
            {Object.entries(TRIMESTRE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>

          <select
            className={listes.select}
            value={statutFiltre}
            onChange={(e) => setStatutFiltre(e.target.value)}
            aria-label="Filtrer par statut"
          >
            <option value="">Tous les statuts</option>
            {statutsDispo.map((s) => <option key={s} value={s}>{majuscule(s)}</option>)}
          </select>

          {filtresActifs && (
            <button type="button" className={listes.effacer} onClick={effacerFiltres}>
              <X size={14} /> Effacer les filtres
            </button>
          )}
        </div>
      )}

      {loading && <p className={styles.stateMsg}>Chargement...</p>}

      {!loading && bulletins.length === 0 && (
        <div className={styles.emptyState}>
          <FileText size={40} color="var(--color-text-dim)" />
          <p>Aucun bulletin pour le moment. Créez d'abord des notes, puis un bulletin depuis la fiche élève.</p>
        </div>
      )}

      {!loading && bulletins.length > 0 && bulletinsFiltres.length === 0 && (
        <div className={styles.emptyState}><p>Aucun bulletin ne correspond à ces critères.</p></div>
      )}

      {!loading && bulletinsFiltres.length > 0 && (
        <>
          <p className={listes.compteur}>{bulletinsFiltres.length} bulletin(s) affiché(s)</p>
          <div className={styles.tableWrapper}>
            <table className={`${styles.table} stack`}>
              <thead>
                <tr>
                  {entete('eleve', 'Élève')}
                  {entete('classe', 'Classe')}
                  {entete('periode', 'Période')}
                  {entete('moyenne', 'Moyenne')}
                  {entete('rang', 'Rang')}
                  {entete('statut', 'Statut')}
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pagination.pageItems.map((b) => (
                  <tr key={b.id}>
                    <td
                      data-label="Élève"
                      className={styles.clickable}
                      onClick={() => navigate(`/dashboardAdmin/eleves/${b.eleve}`)}
                    >
                      {b.eleve_nom}
                      {b.eleve_matricule && <small className={listes.matriculePetit}>{b.eleve_matricule}</small>}
                    </td>
                    <td data-label="Classe">{b.classe_nom}</td>
                    <td data-label="Période">{TRIMESTRE_LABEL[b.trimestre]}</td>
                    <td data-label="Moyenne">
                      {b.moyenne_generale != null ? `${b.moyenne_generale}/${b.bareme ?? 20}` : '—'}
                    </td>
                    <td data-label="Rang">{b.rang || '—'}</td>
                    <td data-label="Statut">
                      <span className={`${styles.badge} ${styles['badge_' + b.statut]}`}>{b.statut}</span>
                    </td>
                    <td data-label="Actions" className={styles.actionsCell}>
                      {b.statut === 'brouillon' && (
                        <button
                          className={styles.iconButton}
                          onClick={() => handleValider(b)}
                          disabled={actionId === b.id}
                          title="Valider"
                        >
                          <CheckCircle size={15} />
                        </button>
                      )}
                      <button
                        className={styles.iconButton}
                        onClick={() => handleTelecharger(b)}
                        disabled={actionId === b.id}
                        title="Télécharger le PDF"
                      >
                        <Download size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination {...pagination} unite="bulletins" />
        </>
      )}
    </div>
  );
};

export default Bulletins;
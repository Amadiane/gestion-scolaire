import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Search, Briefcase, Pencil, CreditCard, ChevronUp, ChevronDown, X,
} from 'lucide-react';
import api from '../../services/api.js';
import CONFIG from '../../config/config.js';
import BoutonRetour from '../../components/BoutonRetour/BoutonRetour.jsx';
import Pagination from '../../components/Pagination/Pagination.jsx';
import ApercuCartes from '../../components/CartesIdentite/ApercuCartes.jsx';
import usePagination from '../../hooks/usePagination.js';
import PersonnelModal from './PersonnelModal.jsx';
import { POSTES, STATUTS, norm, comparer, chiffres, cartePersonnel } from './personnelUtils.js';
import styles from '../../theme/pages/admin/Personnel.module.css';
import listes from '../../theme/pages/admin/Listes.module.css';

const nomComplet = (m) => `${m.nom} ${m.prenom}`.trim();

const comparateurs = {
  matricule: (a, b) => comparer(a.matricule, b.matricule),
  nom: (a, b) => comparer(nomComplet(a), nomComplet(b)),
  poste: (a, b) => comparer(POSTES[a.poste], POSTES[b.poste]) || comparer(nomComplet(a), nomComplet(b)),
  statut: (a, b) => comparer(STATUTS[a.statut], STATUTS[b.statut]) || comparer(nomComplet(a), nomComplet(b)),
};

const Personnel = () => {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const [membres, setMembres] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [recherche, setRecherche] = useState('');
  const [posteFiltre, setPosteFiltre] = useState('');
  const [statutFiltre, setStatutFiltre] = useState('');
  const [tri, setTri] = useState({ cle: 'matricule', sens: 'asc' });
  const [modal, setModal] = useState(null); // { membre: objet | null }
  const [cartes, setCartes] = useState(null);

  const charger = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(CONFIG.API_PERSONNEL);
      setMembres(res.data);
      setError('');
    } catch (err) {
      setError(
        err.response?.status === 403
          ? 'Seul un directeur peut gérer le personnel.'
          : 'Impossible de charger la liste du personnel.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { charger(); }, [charger]);

  const apresEnregistrement = () => {
    setModal(null);
    charger();
  };

  const basculerTri = (cle) =>
    setTri((t) => (t.cle === cle ? { cle, sens: t.sens === 'asc' ? 'desc' : 'asc' } : { cle, sens: 'asc' }));

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

  const q = norm(recherche.trim());
  const qNum = chiffres(recherche);
  const filtres = membres
    .filter(
      (m) =>
        (!q ||
          norm(`${m.nom} ${m.prenom} ${m.matricule} ${m.fonction || ''} ${POSTES[m.poste] || ''}`).includes(q) ||
          (qNum.length >= 3 && chiffres(m.telephone).includes(qNum))) &&
        (!posteFiltre || m.poste === posteFiltre) &&
        (!statutFiltre || m.statut === statutFiltre)
    )
    .sort(comparateurs[tri.cle] || comparateurs.matricule);
  if (tri.sens === 'desc') filtres.reverse();

  const postesPresents = [...new Set(membres.map((m) => m.poste))].sort((a, b) =>
    comparer(POSTES[a], POSTES[b])
  );
  const filtresActifs = recherche || posteFiltre || statutFiltre;
  const nbActifs = membres.filter((m) => m.statut === 'actif').length;

  const pagination = usePagination(
    filtres, 25, `${recherche}|${posteFiltre}|${statutFiltre}|${tri.cle}|${tri.sens}`
  );

  const imprimerFiltres = () =>
    setCartes(filtres.filter((m) => m.statut !== 'parti').map(cartePersonnel));

  return (
    <div className={styles.wrapper}>
      <BoutonRetour vers="/dashboardAdmin" />

      <div className={styles.headerRow}>
        <div>
          <h1 className={styles.title}>Personnel</h1>
          <p className={styles.subtitle}>
            {membres.length} membre(s) — {nbActifs} en activité
          </p>
        </div>
        <div className={styles.headerActions}>
          <button
            className={styles.secondaryButton}
            onClick={imprimerFiltres}
            disabled={filtres.filter((m) => m.statut !== 'parti').length === 0}
          >
            <CreditCard size={16} /> Cartes de la sélection
          </button>
          <button className={styles.addButton} onClick={() => setModal({ membre: null })}>
            <Plus size={16} /> Ajouter un membre
          </button>
        </div>
      </div>

      <div className={listes.barre}>
        <div className={listes.recherche}>
          <Search size={16} color="var(--color-text-dim)" />
          <input
            type="text"
            placeholder="Rechercher par nom, matricule, fonction ou téléphone..."
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
          />
        </div>

        <select
          className={listes.select}
          value={posteFiltre}
          onChange={(e) => setPosteFiltre(e.target.value)}
          aria-label="Filtrer par poste"
        >
          <option value="">Tous les postes</option>
          {postesPresents.map((p) => <option key={p} value={p}>{POSTES[p] || p}</option>)}
        </select>

        <select
          className={listes.select}
          value={statutFiltre}
          onChange={(e) => setStatutFiltre(e.target.value)}
          aria-label="Filtrer par statut"
        >
          <option value="">Tous les statuts</option>
          {Object.entries(STATUTS).map(([cle, label]) => <option key={cle} value={cle}>{label}</option>)}
        </select>

        {filtresActifs && (
          <button
            type="button"
            className={listes.effacer}
            onClick={() => { setRecherche(''); setPosteFiltre(''); setStatutFiltre(''); }}
          >
            <X size={14} /> Effacer
          </button>
        )}
      </div>

      {loading && <p className={styles.stateMsg}>Chargement...</p>}
      {error && <p className={styles.errorMsg}>{error}</p>}

      {!loading && !error && filtres.length === 0 && (
        <div className={styles.emptyState}>
          <Briefcase size={40} color="var(--color-text-dim)" />
          <p>{membres.length === 0 ? 'Aucun membre du personnel enregistré.' : 'Aucun membre ne correspond à ces filtres.'}</p>
        </div>
      )}

      {!loading && !error && filtres.length > 0 && (
        <>
          <p className={listes.compteur}>
            {filtres.length}{filtres.length !== membres.length ? ` sur ${membres.length}` : ''} membre(s) affiché(s)
          </p>
          <div className={styles.tableWrapper}>
            <table className={`${styles.table} stack`}>
              <thead>
                <tr>
                  {entete('matricule', 'Matricule')}
                  {entete('nom', 'Nom complet')}
                  {entete('poste', 'Poste')}
                  <th>Téléphone</th>
                  {entete('statut', 'Statut')}
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pagination.pageItems.map((m) => (
                  <tr key={m.id}>
                    <td data-label="Matricule"><span className={styles.matricule}>{m.matricule}</span></td>
                    <td data-label="Nom complet">
                      <div className={styles.identite}>
                        {m.photo ? (
                          <img src={m.photo} alt="" className={styles.thumb} />
                        ) : (
                          <span className={styles.thumbPlaceholder}>{m.prenom?.[0]}{m.nom?.[0]}</span>
                        )}
                        <span>{m.prenom} {m.nom}</span>
                      </div>
                    </td>
                    <td data-label="Poste">
                      <span className={`${styles.badge} ${styles.posteBadge}`}>{POSTES[m.poste] || m.poste}</span>
                      {m.fonction && <div style={{ fontSize: '0.75rem', color: 'var(--color-text-dim)' }}>{m.fonction}</div>}
                    </td>
                    <td data-label="Téléphone">{m.telephone || '—'}</td>
                    <td data-label="Statut">
                      <span className={`${styles.badge} ${styles['statut_' + m.statut]}`}>
                        {STATUTS[m.statut] || m.statut}
                      </span>
                    </td>
                    <td data-label="Actions">
                      <div className={styles.rowActions}>
                        <button className={styles.iconButton} onClick={() => setCartes([cartePersonnel(m)])}>
                          <CreditCard size={13} /> Carte
                        </button>
                        <button className={styles.iconButton} onClick={() => setModal({ membre: m })}>
                          <Pencil size={13} /> Modifier
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination {...pagination} unite="membres" />
        </>
      )}

      <p style={{ marginTop: 16, fontSize: '0.85rem', color: 'var(--color-text-dim)' }}>
        Les cartes des élèves se trouvent dans{' '}
        <a href="/dashboardAdmin/cartes" onClick={(e) => { e.preventDefault(); navigate('/dashboardAdmin/cartes'); }}>
          Cartes
        </a>.
      </p>

      {modal && (
        <PersonnelModal
          membre={modal.membre}
          personnel={membres}
          onClose={() => setModal(null)}
          onSuccess={apresEnregistrement}
        />
      )}

      {cartes && (
        <ApercuCartes cartes={cartes} ecoleNom={user.ecole_nom} onClose={() => setCartes(null)} />
      )}
    </div>
  );
};

export default Personnel;
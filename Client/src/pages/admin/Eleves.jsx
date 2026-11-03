import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, GraduationCap, ChevronUp, ChevronDown, X } from 'lucide-react';
import api from '../../services/api.js';
import CONFIG from '../../config/config.js';
import BoutonRetour from '../../components/BoutonRetour/BoutonRetour.jsx';
import Pagination from '../../components/Pagination/Pagination.jsx';
import usePagination from '../../hooks/usePagination.js';
import { operationsEnAttente } from '../../offline/file.js';
import AjouterEleveModal from './AjouterEleveModal.jsx';
import styles from '../../theme/pages/admin/Eleves.module.css';

const SANS_CLASSE = '__sans_classe__';

const STATUTS = [
  { value: 'actif', label: 'Actif' },
  { value: 'transfere', label: 'Transféré' },
  { value: 'exclu', label: 'Exclu' },
  { value: 'diplome', label: 'Diplômé / Sorti' },
  { value: 'attente', label: "En attente d'envoi" },
];

// Préférences d'affichage (vue et dernière classe), propres à chaque utilisateur.
const cleVue = () => {
  let compte = '';
  try { compte = localStorage.getItem('compte_local') || ''; } catch { /* ignoré */ }
  return `eleves_prefs_${compte}`;
};
const lirePrefs = () => {
  try { return JSON.parse(localStorage.getItem(cleVue())) || {}; } catch { return {}; }
};
const ecrirePrefs = (p) => {
  try { localStorage.setItem(cleVue(), JSON.stringify(p)); } catch { /* ignoré */ }
};

// Recherche sans tenir compte des accents ni des majuscules.
const norm = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const comparerTexte = (a, b) =>
  String(a || '').localeCompare(String(b || ''), 'fr', { numeric: true, sensitivity: 'base' });

// Classes dans l'ordre pédagogique : par niveau, puis par nom.
const trierClasses = (liste) =>
  [...liste].sort(
    (a, b) => (a.niveau_ordre ?? 9999) - (b.niveau_ordre ?? 9999) || comparerTexte(a.nom, b.nom)
  );

const Eleves = () => {
  const navigate = useNavigate();
  const prefs = useRef(lirePrefs()).current;
  const derniereClasse = useRef(prefs.classeSel || '');

  const [eleves, setEleves] = useState([]);
  const [classes, setClasses] = useState([]);
  const [enAttente, setEnAttente] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [modalOuvert, setModalOuvert] = useState(false);

  const [vue, setVue] = useState(prefs.vue === 'ecole' ? 'ecole' : 'classe');
  const [classeSel, setClasseSel] = useState(prefs.vue === 'ecole' ? '' : (prefs.classeSel || ''));
  const [recherche, setRecherche] = useState('');
  const [statutFiltre, setStatutFiltre] = useState('');
  const [sexeFiltre, setSexeFiltre] = useState('');
  const [tri, setTri] = useState({ cle: prefs.vue === 'ecole' ? 'classe' : 'matricule', sens: 'asc' });

  const chargerDonnees = useCallback(async (silencieux = false) => {
    if (!silencieux) setLoading(true);
    try {
      const [resEleves, resClasses] = await Promise.all([
        api.get(CONFIG.API_ELEVES),
        api.get(CONFIG.API_CLASSES),
      ]);
      setEleves(resEleves.data);
      setClasses(trierClasses(resClasses.data));
      setError('');
    } catch {
      setError("Impossible de charger la liste des élèves.");
    } finally {
      setLoading(false);
    }
    setEnAttente(await operationsEnAttente('eleve'));
  }, []);

  useEffect(() => {
    chargerDonnees();
  }, [chargerDonnees]);

  // Quand la file change (saisie ou fin de synchronisation), on met la liste à jour.
  useEffect(() => {
    const maj = () => chargerDonnees(true);
    window.addEventListener('sylium:file-changee', maj);
    return () => window.removeEventListener('sylium:file-changee', maj);
  }, [chargerDonnees]);

  useEffect(() => {
    ecrirePrefs({ vue, classeSel: derniereClasse.current });
  }, [vue, classeSel]);

  const handleSuccess = (resultat) => {
    setModalOuvert(false);
    if (resultat?.enAttente) {
      setInfo("Élève enregistré sur cet appareil. Il sera créé automatiquement au retour du réseau.");
    } else {
      setInfo('');
    }
    chargerDonnees();
  };

  // ---------- Classes ----------
  const nomsClasses = classes.map((c) => c.nom);
  const nomClasse = (id) => classes.find((c) => c.id === id)?.nom || '';
  const indexClasse = (nom) => {
    const i = nomsClasses.indexOf(nom);
    return i === -1 ? 9999 : i;
  };

  const classeValide =
    classeSel === SANS_CLASSE || nomsClasses.includes(classeSel) ? classeSel : '';
  // Vue « Par classe » : une classe est toujours sélectionnée (la première par défaut).
  const classeActive = vue === 'classe' ? (classeValide || nomsClasses[0] || '') : classeValide;

  // Une recherche dans la vue « Par classe » cherche dans toute l'école.
  const rechercheGlobale = vue === 'classe' && recherche.trim() !== '';

  const choisirClasse = (nom) => {
    setClasseSel(nom);
    if (vue === 'classe') derniereClasse.current = nom;
  };

  const changerVue = (v) => {
    if (v === vue) return;
    setVue(v);
    setStatutFiltre('');
    setSexeFiltre('');
    if (v === 'ecole') {
      setClasseSel('');
      setTri({ cle: 'classe', sens: 'asc' });
    } else {
      setClasseSel(derniereClasse.current);
      setTri({ cle: 'matricule', sens: 'asc' });
    }
  };

  // ---------- Filtres ----------
  const passe = ({ texte, classeNom, statut, sexe }) => {
    if (recherche.trim() && !norm(texte).includes(norm(recherche.trim()))) return false;
    if (!rechercheGlobale && classeActive) {
      if (classeActive === SANS_CLASSE ? !!classeNom : classeNom !== classeActive) return false;
    }
    if (statutFiltre && statut !== statutFiltre) return false;
    if (sexeFiltre && sexe !== sexeFiltre) return false;
    return true;
  };

  const comparateurs = {
    matricule: (a, b) => comparerTexte(a.matricule, b.matricule),
    nom: (a, b) =>
      comparerTexte(`${a.nom} ${a.prenom}`, `${b.nom} ${b.prenom}`) ||
      comparerTexte(a.matricule, b.matricule),
    classe: (a, b) =>
      indexClasse(a.classe_actuelle_nom) - indexClasse(b.classe_actuelle_nom) ||
      comparerTexte(a.matricule, b.matricule),
    statut: (a, b) => comparerTexte(a.statut, b.statut) || comparerTexte(a.matricule, b.matricule),
  };

  const elevesFiltres = eleves
    .filter((e) =>
      passe({
        texte: `${e.nom} ${e.prenom} ${e.matricule}`,
        classeNom: e.classe_actuelle_nom,
        statut: e.statut,
        sexe: e.sexe,
      })
    )
    .sort(comparateurs[tri.cle] || comparateurs.matricule);
  if (tri.sens === 'desc') elevesFiltres.reverse();

  const attenteFiltres = enAttente
    .filter((o) =>
      passe({
        texte: `${o.nom} ${o.prenom}`,
        classeNom: o.classe ? nomClasse(o.classe) : '',
        statut: 'attente',
        sexe: o.sexe,
      })
    )
    .sort((a, b) => comparerTexte(`${a.nom} ${a.prenom}`, `${b.nom} ${b.prenom}`));

  // Effectifs affichés sur les boutons de classe (élèves + en attente d'envoi).
  const effectifs = {};
  let sansClasse = 0;
  eleves.forEach((e) => {
    if (e.classe_actuelle_nom) effectifs[e.classe_actuelle_nom] = (effectifs[e.classe_actuelle_nom] || 0) + 1;
    else sansClasse += 1;
  });
  enAttente.forEach((o) => {
    const n = o.classe ? nomClasse(o.classe) : '';
    if (n) effectifs[n] = (effectifs[n] || 0) + 1;
    else sansClasse += 1;
  });
  const total = eleves.length + enAttente.length;

  const pagination = usePagination(
    elevesFiltres,
    25,
    `${vue}|${classeActive}|${recherche}|${statutFiltre}|${sexeFiltre}|${tri.cle}|${tri.sens}`
  );

  const aDesLignes = elevesFiltres.length > 0 || attenteFiltres.length > 0;
  const filtresActifs = recherche || statutFiltre || sexeFiltre;
  const afficherGroupes = vue === 'ecole' && tri.cle === 'classe' && !classeActive;

  const effacerFiltres = () => {
    setRecherche('');
    setStatutFiltre('');
    setSexeFiltre('');
  };

  const basculerTri = (cle) =>
    setTri((t) => (t.cle === cle ? { cle, sens: t.sens === 'asc' ? 'desc' : 'asc' } : { cle, sens: 'asc' }));

  const entete = (cle, libelle) => (
    <th
      className={styles.sortable}
      onClick={() => basculerTri(cle)}
      aria-sort={tri.cle === cle ? (tri.sens === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      {libelle}
      {tri.cle === cle && (tri.sens === 'asc' ? <ChevronUp size={13} /> : <ChevronDown size={13} />)}
    </th>
  );

  // Lignes de la page courante, avec un en-tête à chaque changement de classe.
  const lignesEleves = [];
  let classePrecedente;
  pagination.pageItems.forEach((eleve) => {
    const nomC = eleve.classe_actuelle_nom || 'Sans classe';
    if (afficherGroupes && nomC !== classePrecedente) {
      const nb = elevesFiltres.filter((x) => (x.classe_actuelle_nom || 'Sans classe') === nomC).length;
      lignesEleves.push(
        <tr key={`g-${nomC}`} className={styles.groupRow}>
          <td colSpan={5}>{nomC} · {nb} élève(s)</td>
        </tr>
      );
      classePrecedente = nomC;
    }
    lignesEleves.push(
      <tr
        key={eleve.id}
        className={styles.clickableRow}
        onClick={() => navigate(`/dashboardAdmin/eleves/${eleve.id}`)}
      >
        <td data-label="Matricule">{eleve.matricule}</td>
        <td data-label="Nom">{eleve.nom}</td>
        <td data-label="Prénom">{eleve.prenom}</td>
        <td data-label="Classe">{eleve.classe_actuelle_nom || '—'}</td>
        <td data-label="Statut">
          <span className={`${styles.badge} ${styles['badge_' + eleve.statut]}`}>
            {eleve.statut}
          </span>
        </td>
      </tr>
    );
  });

  return (
    <div className={styles.wrapper}>
      <BoutonRetour vers="/dashboardAdmin" />

      <div className={styles.headerRow}>
        <div>
          <h1 className={styles.title}>Élèves</h1>
          <p className={styles.subtitle}>
            {total} élève(s) dans l'école
            {enAttente.length > 0 && ` · ${enAttente.length} en attente d'envoi`}
          </p>
        </div>
        <button className={styles.addButton} onClick={() => setModalOuvert(true)}>
          <Plus size={16} /> Ajouter un élève
        </button>
      </div>

      <div className={styles.vues} role="tablist">
        <button
          role="tab"
          aria-selected={vue === 'classe'}
          className={`${styles.vueBtn} ${vue === 'classe' ? styles.vueActive : ''}`}
          onClick={() => changerVue('classe')}
        >
          Par classe
        </button>
        <button
          role="tab"
          aria-selected={vue === 'ecole'}
          className={`${styles.vueBtn} ${vue === 'ecole' ? styles.vueActive : ''}`}
          onClick={() => changerVue('ecole')}
        >
          Toute l'école
        </button>
      </div>

      <div className={styles.chips}>
        {vue === 'ecole' && (
          <button
            className={`${styles.chip} ${!classeActive ? styles.chipActive : ''}`}
            onClick={() => choisirClasse('')}
          >
            Toutes <span className={styles.chipCount}>{total}</span>
          </button>
        )}
        {classes.map((c) => (
          <button
            key={c.id}
            className={`${styles.chip} ${classeActive === c.nom ? styles.chipActive : ''}`}
            onClick={() => choisirClasse(c.nom)}
          >
            {c.nom} <span className={styles.chipCount}>{effectifs[c.nom] || 0}</span>
          </button>
        ))}
        {sansClasse > 0 && (
          <button
            className={`${styles.chip} ${classeActive === SANS_CLASSE ? styles.chipActive : ''}`}
            onClick={() => choisirClasse(SANS_CLASSE)}
          >
            Sans classe <span className={styles.chipCount}>{sansClasse}</span>
          </button>
        )}
      </div>

      <div className={styles.filtersRow}>
        <div className={styles.searchBar}>
          <Search size={16} color="var(--color-text-dim)" />
          <input
            type="text"
            placeholder="Rechercher par nom, prénom ou matricule..."
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
          />
        </div>

        <select
          className={`${styles.classeSelect} ${styles.petitSelect}`}
          value={sexeFiltre}
          onChange={(e) => setSexeFiltre(e.target.value)}
          aria-label="Filtrer par sexe"
        >
          <option value="">Tous les sexes</option>
          <option value="M">Masculin</option>
          <option value="F">Féminin</option>
        </select>

        <select
          className={`${styles.classeSelect} ${styles.petitSelect}`}
          value={statutFiltre}
          onChange={(e) => setStatutFiltre(e.target.value)}
          aria-label="Filtrer par statut"
        >
          <option value="">Tous les statuts</option>
          {STATUTS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>

        <button
          type="button"
          className={styles.triRapide}
          onClick={() => setTri({ cle: tri.cle === 'nom' ? 'matricule' : 'nom', sens: 'asc' })}
        >
          {tri.cle === 'nom' ? 'Trier par matricule' : 'Trier A → Z'}
        </button>

        {filtresActifs && (
          <button type="button" className={styles.effacer} onClick={effacerFiltres}>
            <X size={14} /> Effacer les filtres
          </button>
        )}
      </div>

      {rechercheGlobale && (
        <p className={styles.notice}>Recherche dans toute l'école (toutes les classes).</p>
      )}
      {info && <p className={styles.stateMsg}>{info}</p>}
      {loading && <p className={styles.stateMsg}>Chargement...</p>}
      {error && <p className={styles.errorMsg}>{error}</p>}

      {!loading && !error && !aDesLignes && (
        <div className={styles.emptyState}>
          <GraduationCap size={40} color="var(--color-text-dim)" />
          <p>Aucun élève trouvé.</p>
        </div>
      )}

      {!loading && aDesLignes && (
        <>
          <p className={styles.compteur}>
            {elevesFiltres.length + attenteFiltres.length} élève(s) affiché(s)
          </p>
          <div className={styles.tableWrapper}>
            <table className={`${styles.table} stack`}>
              <thead>
                <tr>
                  {entete('matricule', 'Matricule')}
                  {entete('nom', 'Nom')}
                  <th>Prénom</th>
                  {entete('classe', 'Classe')}
                  {entete('statut', 'Statut')}
                </tr>
              </thead>
              <tbody>
                {attenteFiltres.length > 0 && (
                  <tr className={styles.groupRow}>
                    <td colSpan={5}>En attente d'envoi · {attenteFiltres.length}</td>
                  </tr>
                )}
                {attenteFiltres.map((o) => (
                  <tr key={o.reference}>
                    <td data-label="Matricule">Attribué à l'envoi</td>
                    <td data-label="Nom">{o.nom}</td>
                    <td data-label="Prénom">{o.prenom}</td>
                    <td data-label="Classe">{o.classe ? nomClasse(o.classe) || '—' : '—'}</td>
                    <td data-label="Statut">
                      <span
                        className={styles.badge}
                        style={{ background: '#fef3c7', color: '#92400e' }}
                      >
                        En attente
                      </span>
                    </td>
                  </tr>
                ))}
                {lignesEleves}
              </tbody>
            </table>
          </div>
          {elevesFiltres.length > 0 && <Pagination {...pagination} unite="élèves" />}
        </>
      )}

      {modalOuvert && (
        <AjouterEleveModal
          onClose={() => setModalOuvert(false)}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  );
};

export default Eleves;
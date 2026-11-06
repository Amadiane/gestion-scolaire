import { useState, useEffect, useMemo } from 'react';
import { CreditCard, Search, X } from 'lucide-react';
import api from '../../services/api.js';
import CONFIG from '../../config/config.js';
import BoutonRetour from '../../components/BoutonRetour/BoutonRetour.jsx';
import Pagination from '../../components/Pagination/Pagination.jsx';
import ApercuCartes from '../../components/CartesIdentite/ApercuCartes.jsx';
import usePagination from '../../hooks/usePagination.js';
import { POSTES, norm, comparer, carteEleve, cartePersonnel } from './personnelUtils.js';
import styles from '../../theme/pages/admin/Personnel.module.css';
import listes from '../../theme/pages/admin/Listes.module.css';

const Cartes = () => {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const [onglet, setOnglet] = useState('eleves');
  const [eleves, setEleves] = useState([]);
  const [classes, setClasses] = useState([]);
  const [personnel, setPersonnel] = useState(null); // null : pas d'accès (rôle non directeur)
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [recherche, setRecherche] = useState('');
  const [classeFiltre, setClasseFiltre] = useState('');
  const [posteFiltre, setPosteFiltre] = useState('');
  const [actifSeul, setActifSeul] = useState(true);
  const [selection, setSelection] = useState({ eleves: new Set(), personnel: new Set() });
  const [cartes, setCartes] = useState(null);

  useEffect(() => {
    const charger = async () => {
      const [e, c, p] = await Promise.allSettled([
        api.get(CONFIG.API_ELEVES),
        api.get(CONFIG.API_CLASSES),
        api.get(CONFIG.API_PERSONNEL),
      ]);
      if (e.status === 'fulfilled') setEleves(e.value.data);
      else setError('Impossible de charger la liste des élèves.');
      if (c.status === 'fulfilled') setClasses(c.value.data);
      if (p.status === 'fulfilled') setPersonnel(p.value.data);
      setLoading(false);
    };
    charger();
  }, []);

  const changerOnglet = (nouveau) => {
    setOnglet(nouveau);
    setRecherche('');
    setClasseFiltre('');
    setPosteFiltre('');
  };

  const classesTriees = useMemo(
    () => [...classes].sort((a, b) => (a.niveau_ordre ?? 9999) - (b.niveau_ordre ?? 9999) || comparer(a.nom, b.nom)),
    [classes]
  );

  const q = norm(recherche.trim());

  const elevesTries = useMemo(() => [...eleves].sort((a, b) => comparer(a.matricule, b.matricule)), [eleves]);
  const personnelTrie = useMemo(
    () => [...(personnel || [])].sort((a, b) => comparer(a.matricule, b.matricule)),
    [personnel]
  );

  const filtres = onglet === 'eleves'
    ? elevesTries.filter(
        (e) =>
          (!actifSeul || e.statut === 'actif') &&
          (!classeFiltre ||
            (classeFiltre === 'sans' ? !e.classe_actuelle_nom : e.classe_actuelle_nom === classeFiltre)) &&
          (!q || norm(`${e.nom} ${e.prenom} ${e.matricule}`).includes(q))
      )
    : personnelTrie.filter(
        (m) =>
          (!actifSeul || m.statut === 'actif') &&
          (!posteFiltre || m.poste === posteFiltre) &&
          (!q || norm(`${m.nom} ${m.prenom} ${m.matricule} ${m.fonction || ''}`).includes(q))
      );

  const choisis = selection[onglet];
  const tousChoisis = filtres.length > 0 && filtres.every((x) => choisis.has(x.id));

  const basculer = (id) =>
    setSelection((prev) => {
      const copie = new Set(prev[onglet]);
      if (copie.has(id)) copie.delete(id);
      else copie.add(id);
      return { ...prev, [onglet]: copie };
    });

  const basculerTous = () =>
    setSelection((prev) => {
      const copie = new Set(prev[onglet]);
      if (tousChoisis) filtres.forEach((x) => copie.delete(x.id));
      else filtres.forEach((x) => copie.add(x.id));
      return { ...prev, [onglet]: copie };
    });

  const pagination = usePagination(filtres, 30, `${onglet}|${recherche}|${classeFiltre}|${posteFiltre}|${actifSeul}`);

  const apercu = () => {
    const source = onglet === 'eleves' ? elevesTries : personnelTrie;
    const creer = onglet === 'eleves' ? carteEleve : cartePersonnel;
    setCartes(source.filter((x) => choisis.has(x.id)).map(creer));
  };

  const postesPresents = [...new Set((personnel || []).map((m) => m.poste))].sort((a, b) =>
    comparer(POSTES[a], POSTES[b])
  );
  const filtresActifs = recherche || classeFiltre || posteFiltre;

  return (
    <div className={styles.wrapper}>
      <BoutonRetour vers="/dashboardAdmin" />

      <h1 className={styles.title}>Cartes d'identité</h1>
      <p className={styles.subtitle}>
        Choisissez une classe ou un groupe, cochez les personnes, puis imprimez les cartes.
      </p>

      <div className={styles.onglets}>
        <button
          className={`${styles.onglet} ${onglet === 'eleves' ? styles.ongletActif : ''}`}
          onClick={() => changerOnglet('eleves')}
        >
          Élèves
        </button>
        {personnel && (
          <button
            className={`${styles.onglet} ${onglet === 'personnel' ? styles.ongletActif : ''}`}
            onClick={() => changerOnglet('personnel')}
          >
            Personnel
          </button>
        )}
      </div>

      {loading && <p className={styles.stateMsg}>Chargement...</p>}
      {error && <p className={styles.errorMsg}>{error}</p>}

      {!loading && !error && (
        <>
          <div className={listes.barre}>
            <div className={listes.recherche}>
              <Search size={16} color="var(--color-text-dim)" />
              <input
                type="text"
                placeholder="Rechercher par nom ou matricule..."
                value={recherche}
                onChange={(e) => setRecherche(e.target.value)}
              />
            </div>

            {onglet === 'eleves' ? (
              <select
                className={listes.select}
                value={classeFiltre}
                onChange={(e) => setClasseFiltre(e.target.value)}
                aria-label="Filtrer par classe"
              >
                <option value="">Toutes les classes</option>
                {classesTriees.map((c) => <option key={c.id} value={c.nom}>{c.nom}</option>)}
                <option value="sans">Sans classe</option>
              </select>
            ) : (
              <select
                className={listes.select}
                value={posteFiltre}
                onChange={(e) => setPosteFiltre(e.target.value)}
                aria-label="Filtrer par poste"
              >
                <option value="">Tous les postes</option>
                {postesPresents.map((p) => <option key={p} value={p}>{POSTES[p] || p}</option>)}
              </select>
            )}

            <label className={styles.actif}>
              <input
                type="checkbox"
                className={styles.checkbox}
                checked={actifSeul}
                onChange={(e) => setActifSeul(e.target.checked)}
              />
              {onglet === 'eleves' ? 'Élèves actifs uniquement' : 'Personnel actif uniquement'}
            </label>

            {filtresActifs && (
              <button
                type="button"
                className={listes.effacer}
                onClick={() => { setRecherche(''); setClasseFiltre(''); setPosteFiltre(''); }}
              >
                <X size={14} /> Effacer
              </button>
            )}
          </div>

          <div className={styles.selectionBar}>
            <span>
              <strong>{choisis.size}</strong> sélectionné(s) · {filtres.length} affiché(s)
            </span>
            <div className={styles.headerActions}>
              <button className={styles.secondaryButton} onClick={basculerTous} disabled={filtres.length === 0}>
                {tousChoisis ? 'Tout désélectionner' : `Tout sélectionner (${filtres.length})`}
              </button>
              <button className={styles.addButton} onClick={apercu} disabled={choisis.size === 0}>
                <CreditCard size={16} /> Aperçu et impression
              </button>
            </div>
          </div>

          {filtres.length === 0 ? (
            <div className={styles.emptyState}>
              <CreditCard size={40} color="var(--color-text-dim)" />
              <p>Aucune personne ne correspond à ces critères.</p>
            </div>
          ) : (
            <>
              <div className={styles.tableWrapper}>
                <table className={`${styles.table} stack`}>
                  <thead>
                    <tr>
                      <th style={{ width: 40 }}>
                        <input
                          type="checkbox"
                          className={styles.checkbox}
                          checked={tousChoisis}
                          onChange={basculerTous}
                          aria-label="Tout sélectionner"
                        />
                      </th>
                      <th>Matricule</th>
                      <th>Nom complet</th>
                      <th>{onglet === 'eleves' ? 'Classe' : 'Poste'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagination.pageItems.map((x) => (
                      <tr key={x.id} className={styles.clickable} onClick={() => basculer(x.id)}>
                        <td data-label="Choisir">
                          <input
                            type="checkbox"
                            className={styles.checkbox}
                            checked={choisis.has(x.id)}
                            onChange={() => basculer(x.id)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </td>
                        <td data-label="Matricule"><span className={styles.matricule}>{x.matricule}</span></td>
                        <td data-label="Nom complet">
                          <div className={styles.identite}>
                            {x.photo ? (
                              <img src={x.photo} alt="" className={styles.thumb} />
                            ) : (
                              <span className={styles.thumbPlaceholder}>{x.prenom?.[0]}{x.nom?.[0]}</span>
                            )}
                            <span>{x.prenom} {x.nom}</span>
                          </div>
                        </td>
                        <td data-label={onglet === 'eleves' ? 'Classe' : 'Poste'}>
                          {onglet === 'eleves'
                            ? (x.classe_actuelle_nom || '—')
                            : (x.fonction || POSTES[x.poste] || x.poste)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination {...pagination} unite={onglet === 'eleves' ? 'élèves' : 'membres'} />
            </>
          )}
        </>
      )}

      {cartes && (
        <ApercuCartes cartes={cartes} ecoleNom={user.ecole_nom} onClose={() => setCartes(null)} />
      )}
    </div>
  );
};

export default Cartes;
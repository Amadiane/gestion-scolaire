import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, GraduationCap, Search } from 'lucide-react';
import api from '../../services/api.js';
import CONFIG from '../../config/config.js';
import styles from '../../theme/pages/admin/RosterClasse.module.css';
import listes from '../../theme/pages/admin/Listes.module.css';

const norm = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const comparer = (a, b) =>
  String(a || '').localeCompare(String(b || ''), 'fr', { numeric: true, sensitivity: 'base' });

const RosterClasse = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [eleves, setEleves] = useState([]);
  const [classe, setClasse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState('');
  const [recherche, setRecherche] = useState('');
  const [tri, setTri] = useState('matricule');

  useEffect(() => {
    const charger = async () => {
      try {
        const [resClasse, resEleves] = await Promise.all([
          api.get(`${CONFIG.API_CLASSES}${id}/`),
          api.get(CONFIG.API_CLASSE_ELEVES(id)),
        ]);
        setClasse(resClasse.data);
        setEleves(resEleves.data);
        setErreur('');
      } catch {
        setErreur('Impossible de charger cette classe.');
      } finally {
        setLoading(false);
      }
    };
    charger();
  }, [id]);

  const tries = [...eleves].sort(
    tri === 'nom'
      ? (a, b) => comparer(`${a.nom} ${a.prenom}`, `${b.nom} ${b.prenom}`)
      : (a, b) => comparer(a.matricule, b.matricule)
  );

  const texte = norm(recherche.trim());
  const affiches = tries.filter((e) => norm(`${e.nom} ${e.prenom} ${e.matricule}`).includes(texte));

  const garcons = eleves.filter((e) => e.sexe === 'M').length;
  const filles = eleves.filter((e) => e.sexe === 'F').length;

  return (
    <div className={styles.wrapper}>
      <button className={styles.backButton} onClick={() => navigate('/dashboardAdmin/classes')}>
        <ArrowLeft size={16} /> Retour aux classes
      </button>

      {loading ? (
        <p className={styles.stateMsg}>Chargement...</p>
      ) : erreur ? (
        <p className={styles.stateMsg}>{erreur}</p>
      ) : (
        <>
          <h1 className={styles.title}>{classe?.nom}</h1>
          <p className={styles.subtitle}>{eleves.length} élève(s)</p>

          {eleves.length > 0 && (
            <>
              <div className={listes.stats}>
                <span className={listes.stat}>{garcons} garçon(s)</span>
                <span className={listes.stat}>{filles} fille(s)</span>
                {classe?.effectif_max ? (
                  <span className={listes.stat}>Capacité : {classe.effectif_max}</span>
                ) : null}
              </div>

              <div className={listes.barre}>
                <div className={listes.recherche}>
                  <Search size={16} color="var(--color-text-dim)" />
                  <input
                    type="text"
                    placeholder="Rechercher un élève ou un matricule..."
                    value={recherche}
                    onChange={(e) => setRecherche(e.target.value)}
                  />
                </div>
                <button
                  type="button"
                  className={listes.bouton}
                  onClick={() => setTri((t) => (t === 'nom' ? 'matricule' : 'nom'))}
                >
                  {tri === 'nom' ? 'Trier par matricule' : 'Trier A → Z'}
                </button>
              </div>
            </>
          )}

          {eleves.length === 0 ? (
            <div className={styles.emptyState}>
              <GraduationCap size={40} color="var(--color-text-dim)" />
              <p>Aucun élève inscrit dans cette classe.</p>
            </div>
          ) : affiches.length === 0 ? (
            <p className={styles.stateMsg}>Aucun élève ne correspond à cette recherche.</p>
          ) : (
            <div className={styles.list}>
              {affiches.map((eleve, i) => (
                <div
                  key={eleve.id}
                  className={styles.row}
                  onClick={() => navigate(`/dashboardAdmin/eleves/${eleve.id}`)}
                >
                  <span className={listes.numero}>{i + 1}</span>
                  <div className={styles.avatar}>
                    {eleve.photo ? (
                      <img src={eleve.photo} alt="" />
                    ) : (
                      <span>{eleve.prenom?.[0]}{eleve.nom?.[0]}</span>
                    )}
                  </div>
                  <div className={styles.info}>
                    <span className={styles.name}>{eleve.nom} {eleve.prenom}</span>
                    <span className={styles.matricule}>{eleve.matricule}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default RosterClasse;
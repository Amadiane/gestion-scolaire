import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Users, School, Wallet, AlertCircle, BarChart3, KeyRound, LogOut, AlertTriangle } from 'lucide-react';
import api from '../../services/api.js';
import CONFIG from '../../config/config.js';
import { formatGNF } from '../../utils/finance.js';
import styles from '../../theme/pages/fondateur/DashboardFondateur.module.css';

const TRIMESTRE = { t1: '1er trimestre', t2: '2ème trimestre', t3: '3ème trimestre' };
const URL_FONDATEUR =
  CONFIG.API_FONDATEUR || String(CONFIG.API_DASHBOARD || '').replace('/dashboard/', '/fondateur/');

const DashboardFondateur = () => {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const charger = async () => {
      try {
        const res = await api.get(URL_FONDATEUR);
        setData(res.data);
      } catch (err) {
        setError(err.response?.data?.detail || 'Impossible de charger le tableau de bord.');
      } finally {
        setLoading(false);
      }
    };
    charger();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('access');
    localStorage.removeItem('refresh');
    localStorage.removeItem('user');
    window.location.href = '/login';
  };

  const classes = data?.classes || [];
  const maxEffectif = Math.max(1, ...classes.map((c) => c.effectif));
  const totalSexe = data ? data.garcons + data.filles : 0;
  const pctGarcons = totalSexe ? Math.round((data.garcons / totalSexe) * 100) : 0;
  const res = data?.resultats;

  const cartes = data && [
    { label: 'Élèves', value: data.total_eleves, icon: Users },
    { label: 'Classes', value: classes.length, icon: School },
    ...(data.finance ? [
      { label: 'Encaissé ce mois (GNF)', value: formatGNF(data.finance.encaisse_mois), icon: Wallet },
      { label: "Encaissé sur l'année (GNF)", value: formatGNF(data.finance.encaisse_annee), icon: Wallet },
      { label: 'Reste à recouvrer (GNF)', value: formatGNF(data.finance.reste_a_recouvrer), icon: AlertCircle },
    ] : []),
    ...(res ? [{ label: `Moyenne de l'école /20`, value: res.moyenne_ecole, icon: BarChart3 }] : []),
  ];

  return (
    <div className={styles.page}>
      <header className={styles.topbar}>
        <div className={styles.brand}>
          <img src="/logo-ecolia-192.png" alt="" />
          <div>
            <strong>Ecolia</strong>
            <span>{data?.ecole || 'Espace fondateur'}</span>
          </div>
        </div>
        <nav className={styles.actions}>
          <NavLink to="/changer-mot-de-passe" className={styles.lien}>
            <KeyRound size={15} /> Mon mot de passe
          </NavLink>
          <button type="button" className={styles.deconnexion} onClick={handleLogout}>
            <LogOut size={15} /> Déconnexion
          </button>
        </nav>
      </header>

      <main className={styles.contenu}>
        <h1 className={styles.titre}>Vue d'ensemble</h1>
        <p className={styles.sousTitre}>
          Bienvenue, {user.first_name || user.username}
          {data?.annee_active && <> · Année {data.annee_active}</>} · lecture seule
        </p>

        {loading && <p className={styles.etat}>Chargement...</p>}
        {error && <div className={styles.erreur}><AlertTriangle size={16} /> {error}</div>}

        {data && !data.annee_active && (
          <div className={styles.erreur}>
            <AlertTriangle size={16} /> Aucune année scolaire active : la direction doit en activer une.
          </div>
        )}

        {data && (
          <>
            <div className={styles.cartes}>
              {cartes.map(({ label, value, icon: Icon }) => (
                <div key={label} className={styles.carte}>
                  <div className={styles.icone}><Icon size={18} color="#fff" /></div>
                  <div>
                    <span className={styles.valeur}>{value}</span>
                    <span className={styles.libelle}>{label}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className={styles.deuxCol}>
              <section className={styles.bloc}>
                <h2>Élèves par classe{classes.length > 0 && ` (${classes.reduce((s, c) => s + c.effectif, 0)})`}</h2>
                {classes.length === 0 ? (
                  <p className={styles.vide}>Aucune classe pour cette année.</p>
                ) : (
                  <div className={styles.barres}>
                    {classes.map((c) => (
                      <div key={c.id} className={styles.ligne}>
                        <span className={styles.nom}>{c.nom}</span>
                        <div className={styles.piste}>
                          <div className={styles.remplissage} style={{ width: `${(c.effectif / maxEffectif) * 100}%` }} />
                        </div>
                        <span className={styles.nombre}>{c.effectif}</span>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className={styles.bloc}>
                <h2>Garçons / filles</h2>
                {totalSexe === 0 ? (
                  <p className={styles.vide}>Aucun élève enregistré.</p>
                ) : (
                  <>
                    <div className={styles.repartition}>
                      <div className={styles.garcons} style={{ width: `${pctGarcons}%` }} />
                      <div className={styles.filles} style={{ width: `${100 - pctGarcons}%` }} />
                    </div>
                    <p className={styles.legende}>
                      Garçons : {data.garcons} ({pctGarcons} %) · Filles : {data.filles} ({100 - pctGarcons} %)
                    </p>
                  </>
                )}
              </section>
            </div>

            <section className={styles.bloc}>
              <h2>Résultats{res && ` · ${TRIMESTRE[res.trimestre] || res.trimestre}`}</h2>
              {!res ? (
                <p className={styles.vide}>Aucun bulletin validé pour le moment.</p>
              ) : (
                <>
                  <p className={styles.legende}>
                    Taux de réussite : <strong>{res.taux_reussite} %</strong> (moyenne d'au moins 10/20) ·{' '}
                    {res.bulletins} bulletins validés
                  </p>
                  <div className={styles.tableWrapper}>
                    <table className={styles.table}>
                      <thead>
                        <tr><th>Classe</th><th>Moyenne /20</th><th>Bulletins</th></tr>
                      </thead>
                      <tbody>
                        {res.par_classe.map((c) => (
                          <tr key={c.classe}>
                            <td>{c.classe}</td>
                            <td>{c.moyenne}</td>
                            <td>{c.bulletins}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
};

export default DashboardFondateur;
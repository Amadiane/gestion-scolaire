import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, School, UserCog, BookOpen, Wallet, AlertCircle, AlertTriangle } from 'lucide-react';
import api from '../../services/api.js';
import CONFIG from '../../config/config.js';
import { formatGNF } from '../../utils/finance.js';
import TableauAnalyses from '../../components/Graphiques/TableauAnalyses.jsx';
import styles from '../../theme/pages/admin/DashboardAdmin.module.css';
import grille from '../../theme/pages/admin/DashboardAdminGrille.module.css';

const TRIMESTRE = { t1: '1er trim.', t2: '2ème trim.', t3: '3ème trim.' };

const comparer = (a, b) =>
  String(a || '').localeCompare(String(b || ''), 'fr', { numeric: true, sensitivity: 'base' });

const DashboardAdmin = () => {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const charger = async () => {
      try {
        const res = await api.get(CONFIG.API_DASHBOARD);
        setStats(res.data);
      } catch (err) {
        setError(err.response?.data?.detail || 'Impossible de charger le tableau de bord.');
      } finally {
        setLoading(false);
      }
    };
    charger();
  }, []);

  const cartes = stats && [
    { label: 'Élèves', value: stats.total_eleves, icon: Users, vers: '/dashboardAdmin/eleves' },
    { label: 'Classes', value: stats.total_classes, icon: School, vers: '/dashboardAdmin/classes' },
    { label: 'Parents', value: stats.total_parents, icon: UserCog, vers: '/dashboardAdmin/parents' },
    { label: 'Notes saisies', value: stats.total_notes, icon: BookOpen, vers: '/dashboardAdmin/notes' },
    ...(stats.finance ? [
      { label: 'Encaissé ce mois (GNF)', value: formatGNF(stats.finance.encaisse_mois), icon: Wallet, vers: '/dashboardAdmin/finance' },
      { label: 'Reste à recouvrer (GNF)', value: formatGNF(stats.finance.reste_a_recouvrer), icon: AlertCircle, vers: '/dashboardAdmin/finance' },
    ] : []),
  ];

  const classes = stats
    ? [...stats.classes].sort(
        (a, b) => (a.niveau_ordre ?? 9999) - (b.niveau_ordre ?? 9999) || comparer(a.nom, b.nom)
      )
    : [];
  const maxEffectif = Math.max(1, ...classes.map((c) => c.effectif));
  const totalSexe = stats ? stats.garcons + stats.filles : 0;
  const pctGarcons = totalSexe ? Math.round((stats.garcons / totalSexe) * 100) : 0;

  const ouvrir = (vers) => (e) => {
    if (e.type === 'click' || e.key === 'Enter' || e.key === ' ') navigate(vers);
  };

  return (
    <div className={styles.wrapper}>
      <h1 className={styles.title}>Tableau de bord</h1>
      <p className={styles.subtitle}>
        Bienvenue, {user.first_name || user.username}
        {stats?.annee_active && <> · Année {stats.annee_active}</>}
      </p>

      {loading && <p className={styles.stateMsg}>Chargement...</p>}
      {error && (
        <div className={styles.errorBanner}>
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      {stats && (
        <>
          {!stats.annee_active && (
            <div className={styles.errorBanner}>
              <AlertTriangle size={16} /> Aucune année scolaire active : activez-en une dans « Années scolaires ».
            </div>
          )}

          {/* Une seule ligne sur grand écran, 3 + 3 (ou 2 + 2…) sur écran moyen, 2 colonnes sur téléphone. */}
          <div className={grille.zone}>
            <div
              className={`${styles.statsGrid} ${grille.grille}`}
              style={{ '--n': cartes.length, '--c-moyen': cartes.length % 3 === 0 ? 3 : 2 }}
            >
              {cartes.map(({ label, value, icon: Icon, vers }) => (
                <div
                  key={label}
                  className={styles.statCard}
                  style={{ cursor: 'pointer' }}
                  role="link"
                  tabIndex={0}
                  onClick={ouvrir(vers)}
                  onKeyDown={ouvrir(vers)}
                >
                  <div className={styles.statIcon}><Icon size={20} color="#fff" /></div>
                  <div>
                    <span className={styles.statValue}>{value}</span>
                    <span className={styles.statLabel}>{label}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <TableauAnalyses role={user.role} />

          <div className={styles.twoCols}>
            <div className={styles.card}>
              <h2 className={styles.cardTitle}>
                Élèves par classe
                {classes.length > 0 && ` (${classes.reduce((s, c) => s + c.effectif, 0)})`}
              </h2>
              {classes.length === 0 ? (
                <p className={styles.emptyMsg}>Aucune classe pour cette année.</p>
              ) : (
                <div className={styles.bars}>
                  {classes.map((c) => (
                    <div
                      key={c.id}
                      className={styles.barRow}
                      style={{ cursor: 'pointer' }}
                      onClick={() => navigate(`/dashboardAdmin/classes/${c.id}`)}
                    >
                      <span className={styles.barLabel}>{c.nom}</span>
                      <div className={styles.barTrack}>
                        <div
                          className={styles.barFill}
                          style={{ width: `${(c.effectif / maxEffectif) * 100}%` }}
                        />
                      </div>
                      <span className={styles.barValue}>{c.effectif}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className={styles.card}>
              <h2 className={styles.cardTitle}>Répartition garçons / filles</h2>
              {totalSexe === 0 ? (
                <p className={styles.emptyMsg}>Aucun élève enregistré.</p>
              ) : (
                <>
                  <div className={styles.splitBar}>
                    <div className={styles.splitBoys} style={{ width: `${pctGarcons}%` }} />
                    <div className={styles.splitGirls} style={{ width: `${100 - pctGarcons}%` }} />
                  </div>
                  <div className={styles.legend}>
                    <span><i className={styles.dotBoys} /> Garçons : {stats.garcons} ({pctGarcons}%)</span>
                    <span><i className={styles.dotGirls} /> Filles : {stats.filles} ({100 - pctGarcons}%)</span>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className={styles.card}>
            <h2 className={styles.cardTitle}>Derniers bulletins</h2>
            {stats.derniers_bulletins.length === 0 ? (
              <p className={styles.emptyMsg}>Aucun bulletin pour le moment.</p>
            ) : (
              <div className={styles.tableWrapper}>
                <table className={`${styles.table} stack`}>
                  <thead>
                    <tr>
                      <th>Élève</th>
                      <th>Classe</th>
                      <th>Période</th>
                      <th>Moyenne</th>
                      <th>Rang</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.derniers_bulletins.map((b) => (
                      <tr
                        key={b.id}
                        className={styles.clickableRow}
                        onClick={() => navigate(`/dashboardAdmin/eleves/${b.eleve_id}`)}
                      >
                        <td data-label="Élève">{b.eleve_nom}</td>
                        <td data-label="Classe">{b.classe_nom}</td>
                        <td data-label="Période">
                          {TRIMESTRE[b.trimestre] || b.trimestre}
                          {b.statut === 'brouillon' && ' · brouillon'}
                        </td>
                        <td data-label="Moyenne">{b.moyenne != null ? `${b.moyenne}/${b.bareme}` : '—'}</td>
                        <td data-label="Rang">{b.rang || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default DashboardAdmin;
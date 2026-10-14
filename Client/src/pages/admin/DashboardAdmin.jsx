import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, School, UserCog, BookOpen, Wallet, AlertCircle, AlertTriangle } from 'lucide-react';
import api from '../../services/api.js';
import CONFIG from '../../config/config.js';
import { formatGNF } from '../../utils/finance.js';
import styles from '../../theme/pages/admin/DashboardAdmin.module.css';

const TRIMESTRE = { t1: '1er trim.', t2: '2ème trim.', t3: '3ème trim.' };

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
    { label: 'Élèves', value: stats.total_eleves, icon: Users },
    { label: 'Classes', value: stats.total_classes, icon: School },
    { label: 'Parents', value: stats.total_parents, icon: UserCog },
    { label: 'Notes saisies', value: stats.total_notes, icon: BookOpen },
    ...(stats.finance ? [
      { label: 'Encaissé ce mois (GNF)', value: formatGNF(stats.finance.encaisse_mois), icon: Wallet },
      { label: 'Reste à recouvrer (GNF)', value: formatGNF(stats.finance.reste_a_recouvrer), icon: AlertCircle },
    ] : []),
  ];

  const maxEffectif = stats ? Math.max(1, ...stats.classes.map((c) => c.effectif)) : 1;
  const totalSexe = stats ? stats.garcons + stats.filles : 0;
  const pctGarcons = totalSexe ? Math.round((stats.garcons / totalSexe) * 100) : 0;

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

          <div className={styles.statsGrid}>
            {cartes.map(({ label, value, icon: Icon }) => (
              <div key={label} className={styles.statCard}>
                <div className={styles.statIcon}><Icon size={20} color="#fff" /></div>
                <div>
                  <span className={styles.statValue}>{value}</span>
                  <span className={styles.statLabel}>{label}</span>
                </div>
              </div>
            ))}
          </div>

          <div className={styles.twoCols}>
            <div className={styles.card}>
              <h2 className={styles.cardTitle}>Élèves par classe</h2>
              {stats.classes.length === 0 ? (
                <p className={styles.emptyMsg}>Aucune classe pour cette année.</p>
              ) : (
                <div className={styles.bars}>
                  {stats.classes.map((c) => (
                    <div key={c.id} className={styles.barRow}>
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
                        <td data-label="Période">{TRIMESTRE[b.trimestre]}</td>
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
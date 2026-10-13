import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Download, Wallet, Trash2, AlertTriangle } from 'lucide-react';
import api from '../../services/api.js';
import CONFIG from '../../config/config.js';
import PaiementModal from './PaiementModal.jsx';
import { formatGNF, MODES, telechargerRecu } from '../../utils/finance.js';
import styles from '../../theme/pages/admin/Finance.module.css';

const Finance = () => {
  const navigate = useNavigate();
  const [onglet, setOnglet] = useState('paiements');
  const [paiements, setPaiements] = useState([]);
  const [arrieres, setArrieres] = useState({ eleves: [], nb_eleves: 0, total_reste: 0, total_paye: 0, total_a_payer: 0 });
  const [frais, setFrais] = useState([]);
  const [niveaux, setNiveaux] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [recherche, setRecherche] = useState('');
  const [modal, setModal] = useState(null); // null | { eleve: {id, nom} | null }
  const [recuId, setRecuId] = useState(null);
  const [nouveauFrais, setNouveauFrais] = useState({ niveau: '', libelle: 'Scolarité', montant: '' });
  const [fraisError, setFraisError] = useState('');

  const charger = useCallback(async () => {
    setLoading(true);
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
  }, []);

  useEffect(() => { charger(); }, [charger]);

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
      setFraisError(Array.isArray(premier) ? premier[0] : 'Impossible d\'ajouter ce frais.');
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

  const paiementsFiltres = paiements.filter((p) =>
    `${p.eleve_nom} ${p.numero_recu}`.toLowerCase().includes(recherche.toLowerCase())
  );

  const tauxRecouvrement = arrieres.total_a_payer
    ? Math.round((arrieres.total_paye / arrieres.total_a_payer) * 100)
    : 0;

  return (
    <div className={styles.wrapper}>
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

          <div className={styles.tabs}>
            {[
              ['paiements', 'Paiements'],
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

          {onglet === 'paiements' && (
            <>
              <input
                className={styles.searchInput}
                placeholder="Rechercher par élève ou n° de reçu..."
                value={recherche}
                onChange={(e) => setRecherche(e.target.value)}
              />
              {paiementsFiltres.length === 0 ? (
                <div className={styles.emptyState}><Wallet size={36} color="var(--color-text-dim)" /><p>Aucun paiement enregistré.</p></div>
              ) : (
                <div className={styles.tableWrapper}>
                  <table className={styles.table}>
                    <thead>
                      <tr><th>Reçu</th><th>Date</th><th>Élève</th><th>Montant</th><th>Mode</th><th></th></tr>
                    </thead>
                    <tbody>
                      {paiementsFiltres.slice(0, 100).map((p) => (
                        <tr key={p.id}>
                          <td>{p.numero_recu}</td>
                          <td>{new Date(p.date_paiement).toLocaleDateString('fr-FR')}</td>
                          <td className={styles.link} onClick={() => navigate(`/dashboardAdmin/eleves/${p.eleve}`)}>{p.eleve_nom}</td>
                          <td className={styles.montant}>{formatGNF(p.montant)}</td>
                          <td>{MODES[p.mode] || p.mode}</td>
                          <td>
                            <button className={styles.iconButton} onClick={() => handleRecu(p)} disabled={recuId === p.id} title="Télécharger le reçu">
                              <Download size={15} />
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

          {onglet === 'arrieres' && (
            arrieres.eleves.length === 0 ? (
              <div className={styles.emptyState}><p>Aucun arriéré : tous les élèves sont à jour, ou aucun frais n'est encore défini.</p></div>
            ) : (
              <div className={styles.tableWrapper}>
                <table className={styles.table}>
                  <thead>
                    <tr><th>Élève</th><th>Classe</th><th>À payer</th><th>Payé</th><th>Reste</th><th></th></tr>
                  </thead>
                  <tbody>
                    {arrieres.eleves.map((s) => (
                      <tr key={s.eleve_id}>
                        <td className={styles.link} onClick={() => navigate(`/dashboardAdmin/eleves/${s.eleve_id}`)}>{s.eleve_nom}</td>
                        <td>{s.classe_nom}</td>
                        <td>{formatGNF(s.a_payer)}</td>
                        <td>{formatGNF(s.paye)}</td>
                        <td className={styles.reste}>{formatGNF(s.reste)}</td>
                        <td>
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
            )
          )}

          {onglet === 'frais' && (
            <>
              <form className={styles.fraisForm} onSubmit={ajouterFrais}>
                <select value={nouveauFrais.niveau} onChange={(e) => setNouveauFrais({ ...nouveauFrais, niveau: e.target.value })} required>
                  <option value="">— Niveau —</option>
                  {niveaux.map((n) => <option key={n.id} value={n.id}>{n.nom}</option>)}
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

              {frais.length === 0 ? (
                <div className={styles.emptyState}><p>Définissez les frais de chaque niveau : les restes à payer en dépendent.</p></div>
              ) : (
                <div className={styles.tableWrapper}>
                  <table className={styles.table}>
                    <thead><tr><th>Niveau</th><th>Libellé</th><th>Montant</th><th></th></tr></thead>
                    <tbody>
                      {frais.map((f) => (
                        <tr key={f.id}>
                          <td>{f.niveau_nom}</td>
                          <td>{f.libelle}</td>
                          <td className={styles.montant}>{formatGNF(f.montant)}</td>
                          <td>
                            <button className={styles.iconButton} onClick={() => supprimerFrais(f)} title="Supprimer"><Trash2 size={15} /></button>
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
        />
      )}
    </div>
  );
};

export default Finance;
import { useState, useEffect } from 'react';
import { X, WifiOff, AlertTriangle } from 'lucide-react';
import api from '../../services/api.js';
import CONFIG from '../../config/config.js';
import useOnlineStatus from '../../hooks/useOnlineStatus';
import { MODES } from '../../utils/finance.js';
import { ajouterOperation } from '../../offline/file.js';
import { prochainNumeroProvisoire, imprimerRecuProvisoire } from '../../offline/recu.js';
import styles from '../../theme/pages/admin/AjouterEleveModal.module.css';

// Date locale (et non UTC) : un encaissement du soir ne doit pas passer au lendemain.
const aujourdhui = () => new Date().toLocaleDateString('en-CA');

// Sans accents ni majuscules : « Aïssatou » se trouve en tapant « aissatou ».
const norm = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

const MAX_RESULTATS = 30;

// onSuccess(paiement) : paiement enregistré en ligne.
// onEnAttente() : paiement rangé sur l'appareil (sans réseau). Si absent, la fenêtre se ferme simplement.
const PaiementModal = ({ eleveInitial, onClose, onSuccess, onEnAttente }) => {
  const enLigne = useOnlineStatus();
  const [eleves, setEleves] = useState([]);
  const [listeChargee, setListeChargee] = useState(false);
  const [recherche, setRecherche] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    eleve: eleveInitial?.id || '',
    montant: '',
    date_paiement: aujourdhui(),
    mode: 'especes',
    reference: '',
  });

  useEffect(() => {
    if (eleveInitial) return;
    api.get(CONFIG.API_ELEVES)
      .then((res) => {
        setEleves(res.data);
        setListeChargee(true);
      })
      .catch(() => setError('Impossible de charger la liste des élèves.'));
  }, [eleveInitial]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  // Chaque mot tapé doit se retrouver dans « prénom nom matricule », dans n'importe quel ordre.
  const mots = norm(recherche).split(/\s+/).filter(Boolean);
  const correspondants = eleves.filter((e) => {
    const texte = norm(`${e.prenom} ${e.nom} ${e.matricule}`);
    return mots.every((m) => texte.includes(m));
  });
  const affiches = correspondants.slice(0, MAX_RESULTATS);

  const eleveChoisi = eleves.find((x) => String(x.id) === String(form.eleve));

  const libelleEleve = () => {
    if (eleveInitial) return eleveInitial.nom;
    return eleveChoisi ? `${eleveChoisi.prenom} ${eleveChoisi.nom} (${eleveChoisi.matricule})` : '';
  };

  const choisirEleve = (el) => {
    setForm((prev) => ({ ...prev, eleve: el.id }));
    setError('');
  };

  // Range l'encaissement sur l'appareil et remet un reçu provisoire.
  const mettreEnFile = async (uuidClient) => {
    const numeroProvisoire = prochainNumeroProvisoire();
    const charge = {
      uuid_client: uuidClient,
      eleve: Number(form.eleve),
      montant: String(form.montant),
      date_paiement: form.date_paiement,
      mode: form.mode,
      reference: form.reference,
      note: `Reçu provisoire ${numeroProvisoire}`,
      numeroProvisoire,
      eleveLabel: libelleEleve(),
    };
    await ajouterOperation({ type: 'paiement', cleNat: `paiement|${uuidClient}`, charge });
    imprimerRecuProvisoire(charge);
    (onEnAttente || onClose)();
  };

  const messageEchecLocal =
    "Impossible d'enregistrer sur cet appareil. Reconnectez-vous avec internet puis réessayez.";

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;
    if (!form.eleve) {
      setError('Choisissez un élève dans la liste.');
      return;
    }
    setSaving(true);
    setError('');

    // Même référence pour la tentative en ligne et l'éventuelle mise en file : jamais de double encaissement.
    const uuidClient = crypto.randomUUID();

    if (!navigator.onLine) {
      try {
        await mettreEnFile(uuidClient);
      } catch {
        setError(messageEchecLocal);
      } finally {
        setSaving(false);
      }
      return;
    }

    try {
      const res = await api.post(CONFIG.API_PAIEMENTS, { ...form, uuid_client: uuidClient });
      onSuccess(res.data);
    } catch (err) {
      if (!err.response) {
        try {
          await mettreEnFile(uuidClient);
        } catch {
          setError(messageEchecLocal);
        }
      } else {
        const data = err.response.data;
        if (data && typeof data === 'object') {
          const premier = Object.values(data)[0];
          setError(Array.isArray(premier) ? premier[0] : String(premier));
        } else {
          setError("Erreur lors de l'enregistrement du paiement.");
        }
      }
    } finally {
      setSaving(false);
    }
  };

  const sansClasse = eleveChoisi && !eleveChoisi.classe_actuelle_nom;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>Enregistrer un paiement</h2>
          <button className={styles.closeButton} onClick={onClose} aria-label="Fermer"><X size={20} /></button>
        </div>

        {!enLigne && (
          <div className={styles.errorBox} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <WifiOff size={16} />
            <span>
              Hors ligne : le paiement sera enregistré sur cet appareil et un reçu provisoire sera imprimé.
              Le reçu officiel sera attribué à l'envoi.
            </span>
          </div>
        )}

        {error && <div className={styles.errorBox}>{error}</div>}

        <form onSubmit={handleSubmit} className={styles.form}>
          {eleveInitial ? (
            <div className={styles.field}>
              <label>Élève</label>
              <input value={eleveInitial.nom} disabled />
            </div>
          ) : (
            <div className={styles.field}>
              <label htmlFor="paiement-recherche">Élève *</label>
              <input
                id="paiement-recherche"
                placeholder="Tapez un nom, un prénom ou un matricule..."
                value={recherche}
                onChange={(e) => setRecherche(e.target.value)}
                autoComplete="off"
              />

              {eleveChoisi && (
                <div className={styles.eleveChoisi}>
                  <strong>{eleveChoisi.prenom} {eleveChoisi.nom}</strong>
                  <span>{eleveChoisi.matricule} · {eleveChoisi.classe_actuelle_nom || 'Sans classe'}</span>
                </div>
              )}

              {sansClasse && (
                <div className={styles.alerteMontant} role="alert">
                  <AlertTriangle size={13} style={{ verticalAlign: '-2px' }} /> Cet élève n'est inscrit dans
                  aucune classe : son paiement ne comptera pas dans les arriérés tant qu'il n'est pas inscrit.
                </div>
              )}

              {listeChargee && eleves.length === 0 && (
                <p className={styles.aideChamp}>Aucun élève n'est enregistré. Ajoutez d'abord un élève dans « Élèves ».</p>
              )}

              {eleves.length > 0 && (
                <>
                  <ul className={styles.resultats} role="listbox" aria-label="Résultats de la recherche">
                    {affiches.map((el) => (
                      <li key={el.id}>
                        <button
                          type="button"
                          role="option"
                          aria-selected={String(el.id) === String(form.eleve)}
                          className={`${styles.resultat} ${String(el.id) === String(form.eleve) ? styles.resultatActif : ''}`}
                          onClick={() => choisirEleve(el)}
                        >
                          <span>{el.prenom} {el.nom}</span>
                          <small>
                            {el.matricule} · {el.classe_actuelle_nom || 'Sans classe'}
                          </small>
                        </button>
                      </li>
                    ))}
                    {affiches.length === 0 && (
                      <li className={styles.aucunResultat}>Aucun élève ne correspond à « {recherche} ».</li>
                    )}
                  </ul>
                  {correspondants.length > MAX_RESULTATS && (
                    <p className={styles.aideChamp}>
                      {correspondants.length} résultats : affinez la recherche pour voir les autres.
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          <div className={styles.row}>
            <div className={styles.field}>
              <label>Montant (GNF) *</label>
              <input type="number" name="montant" min="1" value={form.montant} onChange={handleChange} required />
            </div>
            <div className={styles.field}>
              <label>Date *</label>
              <input type="date" name="date_paiement" value={form.date_paiement} onChange={handleChange} required />
            </div>
          </div>

          <div className={styles.row}>
            <div className={styles.field}>
              <label>Mode *</label>
              <select name="mode" value={form.mode} onChange={handleChange}>
                {Object.entries(MODES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div className={styles.field}>
              <label>Référence</label>
              <input name="reference" value={form.reference} onChange={handleChange} placeholder="N° transaction" />
            </div>
          </div>

          <div className={styles.actions}>
            <button type="button" className={styles.cancelButton} onClick={onClose}>Annuler</button>
            <button type="submit" className={styles.submitButton} disabled={saving}>
              {saving
                ? 'Enregistrement...'
                : enLigne ? 'Enregistrer et éditer le reçu' : 'Enregistrer et imprimer le reçu provisoire'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PaiementModal;
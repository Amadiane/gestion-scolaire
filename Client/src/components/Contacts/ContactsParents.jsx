import { useState, useEffect, useCallback, useMemo } from 'react';
import { Pencil, Plus, Star } from 'lucide-react';
import api from '../../services/api.js';
import CONFIG from '../../config/config.js';
import ModifierParentModal from './ModifierParentModal.jsx';
import styles from '../../theme/components/Contacts.module.css';

const LIENS = [
  ['pere', 'Père'],
  ['mere', 'Mère'],
  ['tuteur', 'Tuteur légal'],
  ['autre', 'Autre'],
];

const norm = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const normaliserBase = (u) => String(u).replace(/\/?$/, '/');
const messageErreur = (err) => {
  const d = err.response?.data;
  const premier = d && typeof d === 'object' ? Object.values(d)[0] : null;
  return (Array.isArray(premier) ? premier[0] : premier) || d?.detail || 'Opération impossible. Vérifiez votre connexion.';
};

const VIDE = { prenom: '', nom: '', telephone: '', telephone_secondaire: '' };

const ContactsParents = ({ eleveId }) => {
  const baseEleve = normaliserBase(CONFIG.API_ELEVE_DETAIL(eleveId));
  const baseParents = normaliserBase(CONFIG.API_PARENTS);

  const [liens, setLiens] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [interdit, setInterdit] = useState(false);
  const [erreur, setErreur] = useState('');
  const [aModifier, setAModifier] = useState(null);

  const [mode, setMode] = useState(null); // null | 'existant' | 'nouveau'
  const [typeLien, setTypeLien] = useState('autre');
  const [principal, setPrincipal] = useState(false);
  const [tousParents, setTousParents] = useState([]);
  const [recherche, setRecherche] = useState('');
  const [choisi, setChoisi] = useState(null);
  const [nouveau, setNouveau] = useState(VIDE);
  const [envoi, setEnvoi] = useState(false);

  const charger = useCallback(async () => {
    setErreur('');
    try {
      const res = await api.get(`${baseEleve}parents/`);
      setLiens(res.data);
      setInterdit(false);
    } catch (err) {
      if (err.response?.status === 403) setInterdit(true);
      else setErreur('Impossible de charger les parents.');
    } finally {
      setChargement(false);
    }
  }, [baseEleve]);

  useEffect(() => {
    charger();
  }, [charger]);

  const ouvrirAjout = async (m) => {
    setMode(m);
    setChoisi(null);
    setRecherche('');
    setNouveau(VIDE);
    setPrincipal(liens.length === 0);
    setErreur('');
    if (m === 'existant' && tousParents.length === 0) {
      try {
        const res = await api.get(CONFIG.API_PARENTS);
        setTousParents(res.data);
      } catch {
        setErreur('Impossible de charger la liste des parents.');
      }
    }
  };

  const idsLies = useMemo(() => new Set(liens.map((l) => l.parent.id)), [liens]);
  const propositions = useMemo(() => {
    const q = norm(recherche.trim());
    return tousParents
      .filter((p) => !idsLies.has(p.id))
      .filter((p) => !q || norm(`${p.prenom} ${p.nom} ${p.telephone} ${p.telephone_secondaire || ''}`).includes(q))
      .slice(0, 8);
  }, [tousParents, idsLies, recherche]);

  const lier = async (parentId) => {
    await api.post(`${baseEleve}lier_parent/`, {
      parent: parentId,
      type_lien: typeLien,
      contact_principal: principal,
    });
  };

  const ajouter = async (e) => {
    e.preventDefault();
    setErreur('');
    setEnvoi(true);
    try {
      if (mode === 'existant') {
        if (!choisi) {
          setErreur('Choisissez un parent dans la liste.');
          return;
        }
        await lier(choisi.id);
      } else {
        if (!nouveau.prenom.trim() || !nouveau.nom.trim() || !nouveau.telephone.trim()) {
          setErreur('Prénom, nom et téléphone principal sont obligatoires.');
          return;
        }
        const res = await api.post(CONFIG.API_PARENTS, {
          prenom: nouveau.prenom.trim(),
          nom: nouveau.nom.trim(),
          telephone: nouveau.telephone.trim(),
          telephone_secondaire: nouveau.telephone_secondaire.trim(),
        });
        try {
          await lier(res.data.id);
        } catch (err) {
          setErreur(`Parent créé, mais non lié à l'élève : ${messageErreur(err)}`);
          setTousParents([]);
          return;
        }
        setTousParents([]);
      }
      setMode(null);
      await charger();
    } catch (err) {
      setErreur(messageErreur(err));
    } finally {
      setEnvoi(false);
    }
  };

  const action = async (chemin, charge) => {
    setErreur('');
    try {
      await api.post(`${baseEleve}${chemin}/`, charge);
      await charger();
    } catch (err) {
      setErreur(messageErreur(err));
    }
  };

  const retirer = (l) => {
    if (window.confirm(`Retirer ${l.parent.prenom} ${l.parent.nom} de cet élève ? Le parent n'est pas supprimé.`)) {
      action('delier_parent', { parent: l.parent.id });
    }
  };

  if (interdit) return null;

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Parents et contacts ({liens.length})</h2>
      <p style={{ color: '#64748b', fontSize: '.85rem', margin: '0 0 10px' }}>
        Le contact principal est joint en premier ; les autres servent si le premier est injoignable.
      </p>

      {erreur && <div className={styles.erreur}>{erreur}</div>}
      {chargement && <p>Chargement…</p>}
      {!chargement && liens.length === 0 && <p>Aucun parent enregistré pour cet élève.</p>}

      <ul className={styles.liste}>
        {liens.map((l) => (
          <li key={l.relation_id} className={styles.ligne}>
            <div className={styles.ligneTete}>
              <strong>{l.parent.prenom} {l.parent.nom}</strong>
              {l.contact_principal && <span className={styles.principal}>★ Contact principal</span>}
            </div>
            <div className={styles.tels}>
              {l.parent.telephone}
              {l.parent.telephone_secondaire && <> · {l.parent.telephone_secondaire}</>}
              {l.parent.email && <> · {l.parent.email}</>}
            </div>
            <div className={styles.actionsLigne}>
              <select
                className={styles.petit}
                value={l.type_lien}
                onChange={(e) => action('modifier_lien', { parent: l.parent.id, type_lien: e.target.value })}
                aria-label="Type de lien"
              >
                {LIENS.map(([v, lib]) => <option key={v} value={v}>{lib}</option>)}
              </select>
              {!l.contact_principal && (
                <button
                  type="button"
                  className={styles.petit}
                  onClick={() => action('modifier_lien', { parent: l.parent.id, contact_principal: true })}
                >
                  <Star size={12} /> Définir comme principal
                </button>
              )}
              <button type="button" className={styles.petit} onClick={() => setAModifier(l.parent)}>
                <Pencil size={12} /> Modifier
              </button>
              <button
                type="button"
                className={`${styles.petit} ${styles.petitDanger}`}
                onClick={() => retirer(l)}
              >
                Retirer
              </button>
            </div>
          </li>
        ))}
      </ul>

      {!mode && (
        <div className={styles.choix} style={{ marginTop: 12 }}>
          <button type="button" className={styles.btn} onClick={() => ouvrirAjout('existant')}>
            <Plus size={14} /> Ajouter un parent existant
          </button>
          <button type="button" className={styles.btn} onClick={() => ouvrirAjout('nouveau')}>
            <Plus size={14} /> Créer un nouveau parent
          </button>
        </div>
      )}

      {mode && (
        <form className={styles.ajout} onSubmit={ajouter}>
          {mode === 'existant' ? (
            <>
              <label className={styles.champ}>Rechercher un parent (nom ou téléphone)
                <input value={recherche} onChange={(e) => setRecherche(e.target.value)} />
              </label>
              <div className={styles.resultats}>
                {propositions.length === 0 && <small>Aucun parent disponible.</small>}
                {propositions.map((p) => (
                  <button
                    type="button"
                    key={p.id}
                    className={`${styles.resultat} ${choisi?.id === p.id ? styles.resultatActif : ''}`}
                    onClick={() => setChoisi(p)}
                  >
                    {p.prenom} {p.nom} · {p.telephone}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className={styles.deux}>
                <label className={styles.champ}>Prénom
                  <input value={nouveau.prenom} onChange={(e) => setNouveau({ ...nouveau, prenom: e.target.value })} />
                </label>
                <label className={styles.champ}>Nom
                  <input value={nouveau.nom} onChange={(e) => setNouveau({ ...nouveau, nom: e.target.value })} />
                </label>
              </div>
              <div className={styles.deux}>
                <label className={styles.champ}>Téléphone principal
                  <input type="tel" value={nouveau.telephone} onChange={(e) => setNouveau({ ...nouveau, telephone: e.target.value })} />
                </label>
                <label className={styles.champ}>Téléphone secondaire
                  <input type="tel" value={nouveau.telephone_secondaire} onChange={(e) => setNouveau({ ...nouveau, telephone_secondaire: e.target.value })} />
                </label>
              </div>
            </>
          )}

          <label className={styles.champ}>Lien avec l'élève
            <select value={typeLien} onChange={(e) => setTypeLien(e.target.value)}>
              {LIENS.map(([v, lib]) => <option key={v} value={v}>{lib}</option>)}
            </select>
          </label>
          <label className={styles.coche}>
            <input type="checkbox" checked={principal} onChange={(e) => setPrincipal(e.target.checked)} />
            Définir comme contact principal
          </label>

          <div className={styles.pied}>
            <button type="button" className={styles.btn} onClick={() => setMode(null)}>Annuler</button>
            <button type="submit" className={styles.btnPrimaire} disabled={envoi}>
              {envoi ? 'Ajout…' : 'Ajouter'}
            </button>
          </div>
        </form>
      )}

      {aModifier && (
        <ModifierParentModal
          parent={aModifier}
          onClose={() => setAModifier(null)}
          onSaved={() => {
            setAModifier(null);
            setTousParents([]);
            charger();
          }}
        />
      )}
    </div>
  );
};

export default ContactsParents;
// src/pages/admin/AjouterEleveModal.jsx
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Camera, Plus, Trash2, WifiOff, Wallet } from 'lucide-react';
import api from '../../services/api.js';
import CONFIG from '../../config/config.js';
import useOnlineStatus from '../../hooks/useOnlineStatus';
import { ajouterOperation } from '../../offline/file.js';
import { redimensionnerPhoto } from '../../offline/photo.js';
import { formatGNF, MODES, telechargerRecu } from '../../utils/finance.js';
import styles from '../../theme/pages/admin/AjouterEleveModal.module.css';

// Seuls ces rôles encaissent (le serveur le vérifie aussi).
const ROLES_ENCAISSEMENT = ['directeur', 'comptable'];

const aujourdhui = () => new Date().toLocaleDateString('en-CA'); // AAAA-MM-JJ, heure locale

const urlSynchro = () => {
  const base = CONFIG.API_ELEVES.endsWith('/') ? CONFIG.API_ELEVES : `${CONFIG.API_ELEVES}/`;
  return `${base}synchroniser/`;
};

const messageServeur = (err) => {
  const data = err.response?.data;
  if (data && typeof data === 'object') {
    const premier = data.detail || Object.values(data)[0];
    return Array.isArray(premier) ? premier[0] : String(premier);
  }
  return "Erreur lors de la création de l'élève.";
};

const paiementVide = () => ({ montant: '', mode: 'especes', reference: '', note: '', date: aujourdhui() });

const AjouterEleveModal = ({ onClose, onSuccess }) => {
  const navigate = useNavigate();
  const enLigne = useOnlineStatus();
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const peutEncaisser = ROLES_ENCAISSEMENT.includes(user.role);

  const [classes, setClasses] = useState([]);
  const [anneeActive, setAnneeActive] = useState(null);
  const [parentsDisponibles, setParentsDisponibles] = useState([]);
  const [fraisListe, setFraisListe] = useState([]);
  const [liensParents, setLiensParents] = useState([]);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [chargementOk, setChargementOk] = useState(false);

  const [payer, setPayer] = useState(false);
  const [paiement, setPaiement] = useState(paiementVide());
  // Même référence à chaque tentative : un nouvel essai après une coupure ne peut pas encaisser deux fois.
  const referenceOp = useRef(crypto.randomUUID());

  const [form, setForm] = useState({
    nom: '', prenom: '', date_naissance: '', lieu_naissance: '',
    sexe: 'M', classe: '', photo: null,
  });

  useEffect(() => {
    const chargerDonnees = async () => {
      try {
        const [resClasses, resAnnees, resParents] = await Promise.all([
          api.get(CONFIG.API_CLASSES),
          api.get(CONFIG.API_ANNEES_SCOLAIRES),
          api.get(CONFIG.API_PARENTS_CHOIX),
        ]);
        setClasses(resClasses.data);
        const active = resAnnees.data.find((a) => a.est_active);
        setAnneeActive(active || null);
        setParentsDisponibles(resParents.data);
        setChargementOk(true);
      } catch {
        setError("Impossible de charger les données du formulaire.");
      }

      // Les frais ne sont lisibles que par la finance : un échec ici ne bloque jamais l'inscription.
      if (peutEncaisser) {
        try {
          const resFrais = await api.get(CONFIG.API_FRAIS);
          setFraisListe(resFrais.data);
        } catch {
          setFraisListe([]);
        }
      }
    };
    chargerDonnees();
  }, [peutEncaisser]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    // Changer de classe change les frais proposés : on repart d'un montant vide.
    if (name === 'classe') setPaiement((p) => ({ ...p, montant: '', note: '' }));
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setForm((prev) => ({ ...prev, photo: file }));
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const majPaiement = (champ, valeur) => setPaiement((p) => ({ ...p, [champ]: valeur }));

  const ajouterLienParent = () => {
    setLiensParents((prev) => [
      ...prev,
      {
        mode: 'existant', // 'existant' ou 'nouveau'
        parent: '',
        nouveauNom: '',
        nouveauPrenom: '',
        nouveauTelephone: '',
        type_lien: 'pere',
        contact_principal: prev.length === 0,
      },
    ]);
  };

  const modifierLienParent = (index, champ, valeur) => {
    setLiensParents((prev) => {
      const copie = [...prev];
      copie[index] = { ...copie[index], [champ]: valeur };
      return copie;
    });
  };

  const supprimerLienParent = (index) => {
    setLiensParents((prev) => prev.filter((_, i) => i !== index));
  };

  const parentsValides = () =>
    liensParents.filter((l) => (l.mode === 'nouveau' ? l.nouveauNom && l.nouveauTelephone : l.parent));

  // ---------- Premier paiement : frais proposés pour la classe choisie ----------
  const classeChoisie = classes.find((c) => String(c.id) === String(form.classe));
  const fraisDuNiveau = classeChoisie
    ? fraisListe.filter(
        (f) =>
          f.niveau_nom === classeChoisie.niveau_nom &&
          (!anneeActive || String(f.annee_scolaire) === String(anneeActive.id))
      )
    : [];
  const totalFrais = fraisDuNiveau.reduce((s, f) => s + Number(f.montant || 0), 0);

  const montantNombre = Number(String(paiement.montant).replace(/\s/g, ''));
  const montantValide = Number.isInteger(montantNombre) && montantNombre > 0;
  const resteApres = totalFrais - (montantValide ? montantNombre : 0);
  const sectionPaiementPossible = peutEncaisser && Boolean(form.classe) && Boolean(anneeActive);

  // Range toute la saisie (élève + classe + parents + photo) dans la file de l'appareil.
  // Le serveur créera le tout d'un bloc au retour du réseau.
  const mettreEnFile = async () => {
    const avecClasse = form.classe && anneeActive;
    const charge = {
      reference: crypto.randomUUID(),
      nom: form.nom.trim(),
      prenom: form.prenom.trim(),
      date_naissance: form.date_naissance,
      lieu_naissance: form.lieu_naissance,
      sexe: form.sexe,
      classe: avecClasse ? Number(form.classe) : null,
      annee_scolaire: avecClasse ? anneeActive.id : null,
      photo: form.photo ? await redimensionnerPhoto(form.photo) : null,
      parents: parentsValides(),
    };
    await ajouterOperation({ type: 'eleve', cleNat: `eleve|${charge.reference}`, charge });
    onSuccess({ enAttente: true });
  };

  const messageEchecLocal =
    "Impossible d'enregistrer sur cet appareil. Reconnectez-vous avec internet puis réessayez.";

  // Élève + inscription + parents + premier paiement : un seul bloc côté serveur (tout ou rien).
  const enregistrerAvecPaiement = async () => {
    const operation = {
      client_id: referenceOp.current,
      reference: referenceOp.current,
      nom: form.nom.trim(),
      prenom: form.prenom.trim(),
      date_naissance: form.date_naissance,
      lieu_naissance: form.lieu_naissance,
      sexe: form.sexe,
      classe: Number(form.classe),
      annee_scolaire: anneeActive.id,
      photo: form.photo ? await redimensionnerPhoto(form.photo) : null,
      parents: parentsValides(),
      paiement: {
        montant: montantNombre,
        date_paiement: paiement.date,
        mode: paiement.mode,
        reference: paiement.reference.trim(),
        note: paiement.note.trim(),
      },
    };

    const res = await api.post(urlSynchro(), { operations: [operation] });
    const resultat = res.data?.resultats?.[0];
    if (!resultat || resultat.statut === 'erreur') {
      setError(resultat?.detail || "Enregistrement impossible. Rien n'a été créé.");
      return;
    }

    let recu = null;
    if (resultat.paiement_id) {
      recu = { id: resultat.paiement_id, numero_recu: resultat.numero_recu };
      try {
        await telechargerRecu(recu);
      } catch {
        /* le reçu reste téléchargeable depuis Finance */
      }
    }
    onSuccess({ paiement: recu });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;
    setError('');

    const avecPaiement = payer && sectionPaiementPossible;
    if (avecPaiement) {
      if (!montantValide) {
        setError('Saisissez un montant entier supérieur à zéro, ou décochez le premier paiement.');
        return;
      }
      if (!navigator.onLine) {
        setError("Le premier paiement nécessite internet. Décochez-le pour enregistrer l'élève hors ligne.");
        return;
      }
    }

    setSaving(true);

    if (avecPaiement) {
      try {
        await enregistrerAvecPaiement();
      } catch (err) {
        setError(
          err.response
            ? messageServeur(err)
            : "Connexion perdue : vérifiez la liste des élèves avant de réessayer. " +
              'Un nouvel essai ne crée jamais de doublon.'
        );
      } finally {
        setSaving(false);
      }
      return;
    }

    // Pas de réseau : enregistrement sur l'appareil.
    if (!navigator.onLine) {
      try {
        await mettreEnFile();
      } catch {
        setError(messageEchecLocal);
      } finally {
        setSaving(false);
      }
      return;
    }

    let eleveCree = false;
    try {
      // multipart/form-data obligatoire car on envoie un fichier (photo).
      const data = new FormData();
      data.append('nom', form.nom);
      data.append('prenom', form.prenom);
      data.append('date_naissance', form.date_naissance);
      data.append('lieu_naissance', form.lieu_naissance);
      data.append('sexe', form.sexe);
      if (form.photo) data.append('photo', form.photo);

      const resEleve = await api.post(CONFIG.API_ELEVES, data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      eleveCree = true;

      if (form.classe && anneeActive) {
        await api.post(CONFIG.API_INSCRIPTIONS, {
          eleve: resEleve.data.id,
          classe: form.classe,
          annee_scolaire: anneeActive.id,
        });
      }

      // Boucle séquentielle : chaque lien dépend de la création préalable du parent.
      for (const lien of liensParents) {
        let parentId = lien.parent;

        if (lien.mode === 'nouveau') {
          if (!lien.nouveauNom || !lien.nouveauTelephone) continue;
          const resParent = await api.post(CONFIG.API_PARENTS, {
            nom: lien.nouveauNom,
            prenom: lien.nouveauPrenom,
            telephone: lien.nouveauTelephone,
          });
          parentId = resParent.data.id;
        }

        if (!parentId) continue;

        await api.post(CONFIG.API_ELEVE_LIER_PARENT(resEleve.data.id), {
          parent: parentId,
          type_lien: lien.type_lien,
          contact_principal: lien.contact_principal,
        });
      }

      onSuccess({});
    } catch (err) {
      if (!err.response && !eleveCree) {
        // Le réseau a lâché avant la création : rien n'existe encore, on garde tout sur l'appareil.
        try {
          await mettreEnFile();
        } catch {
          setError(messageEchecLocal);
        }
      } else if (!err.response) {
        setError(
          "Connexion perdue pendant l'enregistrement : l'élève est créé mais l'inscription ou les parents " +
          "sont peut-être incomplets. Ouvrez sa fiche pour vérifier."
        );
      } else {
        setError(messageServeur(err));
      }
    } finally {
      setSaving(false);
    }
  };

  const allerCreerClasse = () => {
    onClose();
    navigate('/dashboardAdmin/classes');
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>Ajouter un élève</h2>
          <button className={styles.closeButton} onClick={onClose} aria-label="Fermer">
            <X size={20} />
          </button>
        </div>

        {!enLigne && (
          <div className={styles.errorBox} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <WifiOff size={16} />
            <span>Hors ligne : l'élève sera enregistré sur cet appareil puis créé automatiquement au retour du réseau.</span>
          </div>
        )}

        {error && <div className={styles.errorBox}>{error}</div>}

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.photoSection}>
            <label htmlFor="photo-input" className={styles.photoUpload}>
              {photoPreview ? (
                <img src={photoPreview} alt="Aperçu" className={styles.photoPreview} />
              ) : (
                <div className={styles.photoPlaceholder}>
                  <Camera size={22} color="var(--color-text-dim)" />
                </div>
              )}
            </label>
            <input
              id="photo-input"
              type="file"
              accept="image/*"
              onChange={handlePhotoChange}
              className={styles.hiddenInput}
            />
            <span className={styles.photoHint}>Photo (optionnel)</span>
          </div>

          <div className={styles.row}>
            <div className={styles.field}>
              <label>Nom *</label>
              <input name="nom" value={form.nom} onChange={handleChange} required />
            </div>
            <div className={styles.field}>
              <label>Prénom *</label>
              <input name="prenom" value={form.prenom} onChange={handleChange} required />
            </div>
          </div>

          <div className={styles.row}>
            <div className={styles.field}>
              <label>Date de naissance *</label>
              <input type="date" name="date_naissance" value={form.date_naissance} onChange={handleChange} required />
            </div>
            <div className={styles.field}>
              <label>Sexe *</label>
              <select name="sexe" value={form.sexe} onChange={handleChange} required>
                <option value="M">Masculin</option>
                <option value="F">Féminin</option>
              </select>
            </div>
          </div>

          <div className={styles.field}>
            <label>Lieu de naissance</label>
            <input name="lieu_naissance" value={form.lieu_naissance} onChange={handleChange} />
          </div>

          <div className={styles.field}>
            <label>Classe {!anneeActive && chargementOk && '(aucune année scolaire active définie)'}</label>
            <select name="classe" value={form.classe} onChange={handleChange} disabled={!anneeActive}>
              <option value="">— Non assigné —</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.nom}</option>
              ))}
            </select>
            {chargementOk && classes.length === 0 && (
              <span className={styles.aideChamp}>
                Aucune classe n'existe encore.{' '}
                <button type="button" className={styles.lienAide} onClick={allerCreerClasse}>
                  Créer une classe
                </button>
              </span>
            )}
            {chargementOk && !anneeActive && (
              <span className={styles.aideChamp}>
                Activez d'abord une année scolaire dans « Années scolaires ».
              </span>
            )}
          </div>

          <div className={styles.parentsSection}>
            <div className={styles.parentsSectionHeader}>
              <label>Parents / Responsables</label>
              <button type="button" className={styles.addParentButton} onClick={ajouterLienParent}>
                <Plus size={14} /> Ajouter
              </button>
            </div>

            {liensParents.length === 0 && (
              <p className={styles.noParentMsg}>Aucun parent lié — optionnel, ajoutable plus tard.</p>
            )}

            {liensParents.map((lien, index) => (
              <div key={index} className={styles.parentRow}>
                <div className={styles.parentRowTop}>
                  <div className={styles.modeToggle}>
                    <button
                      type="button"
                      className={`${styles.modeButton} ${lien.mode === 'existant' ? styles.modeButtonActive : ''}`}
                      onClick={() => modifierLienParent(index, 'mode', 'existant')}
                    >
                      Existant
                    </button>
                    <button
                      type="button"
                      className={`${styles.modeButton} ${lien.mode === 'nouveau' ? styles.modeButtonActive : ''}`}
                      onClick={() => modifierLienParent(index, 'mode', 'nouveau')}
                    >
                      Nouveau
                    </button>
                  </div>
                  <button
                    type="button"
                    className={styles.removeParentButton}
                    onClick={() => supprimerLienParent(index)}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                {lien.mode === 'existant' ? (
                  <select
                    value={lien.parent}
                    onChange={(e) => modifierLienParent(index, 'parent', e.target.value)}
                    className={styles.parentSelect}
                  >
                    <option value="">— Choisir un parent —</option>
                    {parentsDisponibles.map((p) => (
                      <option key={p.id} value={p.id}>{p.prenom} {p.nom} ({p.telephone})</option>
                    ))}
                  </select>
                ) : (
                  <div className={styles.nouveauParentFields}>
                    <input
                      placeholder="Nom *"
                      value={lien.nouveauNom}
                      onChange={(e) => modifierLienParent(index, 'nouveauNom', e.target.value)}
                    />
                    <input
                      placeholder="Prénom"
                      value={lien.nouveauPrenom}
                      onChange={(e) => modifierLienParent(index, 'nouveauPrenom', e.target.value)}
                    />
                    <input
                      placeholder="Téléphone *"
                      value={lien.nouveauTelephone}
                      onChange={(e) => modifierLienParent(index, 'nouveauTelephone', e.target.value)}
                    />
                  </div>
                )}

                <div className={styles.parentRowBottom}>
                  <select
                    value={lien.type_lien}
                    onChange={(e) => modifierLienParent(index, 'type_lien', e.target.value)}
                    className={styles.typeLienSelect}
                  >
                    <option value="pere">Père</option>
                    <option value="mere">Mère</option>
                    <option value="tuteur">Tuteur</option>
                    <option value="autre">Autre</option>
                  </select>

                  <label className={styles.contactPrincipalLabel}>
                    <input
                      type="checkbox"
                      checked={lien.contact_principal}
                      onChange={(e) => modifierLienParent(index, 'contact_principal', e.target.checked)}
                    />
                    Contact principal
                  </label>
                </div>
              </div>
            ))}
          </div>

          {/* ===== Premier paiement (facultatif, direction et comptabilité) ===== */}
          {peutEncaisser && (
            <div className={styles.paiementSection}>
              <label className={styles.paiementToggle}>
                <input
                  type="checkbox"
                  checked={payer && sectionPaiementPossible}
                  disabled={!sectionPaiementPossible || !enLigne}
                  onChange={(e) => setPayer(e.target.checked)}
                />
                <Wallet size={16} />
                <span>Enregistrer un premier paiement</span>
              </label>

              {!form.classe && (
                <p className={styles.noParentMsg}>
                  Choisissez d'abord une classe : le paiement est rattaché à l'inscription de l'élève.
                </p>
              )}
              {form.classe && !enLigne && (
                <p className={styles.noParentMsg}>Disponible uniquement avec internet.</p>
              )}

              {payer && sectionPaiementPossible && enLigne && (
                <div className={styles.paiementCorps}>
                  {fraisDuNiveau.length > 0 ? (
                    <div>
                      <span className={styles.paiementLabel}>Frais de {classeChoisie?.niveau_nom} (touchez pour préremplir)</span>
                      <div className={styles.chips}>
                        {fraisDuNiveau.map((f) => (
                          <button
                            key={f.id}
                            type="button"
                            className={`${styles.chip} ${paiement.note === f.libelle && Number(paiement.montant) === Number(f.montant) ? styles.chipActif : ''}`}
                            onClick={() => setPaiement((p) => ({ ...p, montant: String(Number(f.montant)), note: f.libelle }))}
                          >
                            {f.libelle} · {formatGNF(f.montant)}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className={styles.noParentMsg}>
                      Aucun frais défini pour ce niveau : saisissez le montant librement
                      (les frais se définissent dans Finance).
                    </p>
                  )}

                  <div className={styles.row}>
                    <div className={styles.field}>
                      <label>Montant (GNF) *</label>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        inputMode="numeric"
                        value={paiement.montant}
                        onChange={(e) => majPaiement('montant', e.target.value)}
                      />
                    </div>
                    <div className={styles.field}>
                      <label>Date *</label>
                      <input
                        type="date"
                        value={paiement.date}
                        max={aujourdhui()}
                        onChange={(e) => majPaiement('date', e.target.value)}
                      />
                    </div>
                  </div>

                  <div className={styles.row}>
                    <div className={styles.field}>
                      <label>Mode *</label>
                      <select value={paiement.mode} onChange={(e) => majPaiement('mode', e.target.value)}>
                        {Object.entries(MODES).map(([cle, label]) => (
                          <option key={cle} value={cle}>{label}</option>
                        ))}
                      </select>
                    </div>
                    <div className={styles.field}>
                      <label>Référence</label>
                      <input
                        value={paiement.reference}
                        maxLength={100}
                        placeholder={paiement.mode === 'especes' ? 'Facultatif' : 'N° de transaction'}
                        onChange={(e) => majPaiement('reference', e.target.value)}
                      />
                    </div>
                  </div>

                  <div className={styles.field}>
                    <label>Note</label>
                    <input
                      value={paiement.note}
                      maxLength={200}
                      placeholder="Ex. Frais d'inscription"
                      onChange={(e) => majPaiement('note', e.target.value)}
                    />
                  </div>

                  {montantValide && (
                    <div className={styles.recap}>
                      <div><span>Ce paiement</span><strong>{formatGNF(montantNombre)} GNF</strong></div>
                      {totalFrais > 0 && (
                        <>
                          <div><span>Total des frais du niveau</span><strong>{formatGNF(totalFrais)} GNF</strong></div>
                          <div>
                            <span>Reste après ce paiement</span>
                            <strong>{formatGNF(Math.max(resteApres, 0))} GNF</strong>
                          </div>
                        </>
                      )}
                      {totalFrais > 0 && resteApres < 0 && (
                        <p className={styles.alerteMontant}>
                          Ce montant dépasse le total des frais du niveau. Vérifiez avant d'enregistrer.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className={styles.actions}>
            <button type="button" className={styles.cancelButton} onClick={onClose}>
              Annuler
            </button>
            <button type="submit" className={styles.submitButton} disabled={saving}>
              {saving
                ? 'Enregistrement...'
                : payer && sectionPaiementPossible
                  ? 'Enregistrer et éditer le reçu'
                  : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AjouterEleveModal;
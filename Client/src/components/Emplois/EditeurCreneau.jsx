import { useState } from 'react';
import { X } from 'lucide-react';
import { JOURS, hhmm } from '../../utils/exportEmploi.js';
import styles from '../../theme/components/Emplois.module.css';

/**
 * Formulaire d'un créneau.
 * mode 'direction'  : choix de la classe, matière ou libellé libre, enseignant, salle.
 * mode 'enseignant' : l'enseignant choisit parmi ses affectations (`choix`).
 * onSave(payloads, id) : un payload par jour coché (création) ; id renseigné en cas de modification.
 */
const EditeurCreneau = ({
  initial, mode, classes = [], matieres = [], enseignants = [], choix = [],
  envoi, erreur, onClose, onSave, onDelete,
}) => {
  const edition = Boolean(initial?.id);
  const [jours, setJours] = useState(initial?.jour != null ? [initial.jour] : [0]);
  const [debut, setDebut] = useState(hhmm(initial?.debut) || '08:00');
  const [fin, setFin] = useState(hhmm(initial?.fin) || '09:00');
  const [classe, setClasse] = useState(
    initial?.classe ? String(initial.classe) : classes[0] ? String(classes[0].id) : ''
  );
  const [matiere, setMatiere] = useState(initial?.matiere ? String(initial.matiere) : '');
  const [libelle, setLibelle] = useState(initial?.libelle || '');
  const [enseignant, setEnseignant] = useState(initial?.enseignant ? String(initial.enseignant) : '');
  const [salle, setSalle] = useState(initial?.salle || '');
  const [cle, setCle] = useState(
    initial?.classe && initial?.matiere
      ? `${initial.classe}|${initial.matiere}`
      : choix[0] ? `${choix[0].classe}|${choix[0].matiere}` : ''
  );

  const basculerJour = (j) =>
    setJours((js) => (js.includes(j) ? js.filter((x) => x !== j) : [...js, j]));

  const soumettre = (e) => {
    e.preventDefault();
    const base = { debut, fin, salle: salle.trim() };
    let commun;
    if (mode === 'enseignant') {
      const [cl, mat] = cle.split('|');
      commun = { ...base, classe: Number(cl), matiere: Number(mat) };
    } else {
      commun = {
        ...base,
        classe: Number(classe),
        matiere: matiere ? Number(matiere) : null,
        libelle: matiere ? '' : libelle.trim(),
        enseignant: enseignant ? Number(enseignant) : null,
      };
    }
    onSave(
      [...jours].sort().map((j) => ({ ...commun, jour: j })),
      edition ? initial.id : null
    );
  };

  return (
    <div className={styles.fond} onClick={onClose}>
      <form className={styles.fenetre} onClick={(e) => e.stopPropagation()} onSubmit={soumettre}>
        <div className={styles.fenetreTitre}>
          <h3>{edition ? 'Modifier le créneau' : 'Ajouter un créneau'}</h3>
          <button type="button" className={styles.fermer} onClick={onClose} aria-label="Fermer">
            <X size={18} />
          </button>
        </div>

        {erreur && <div className={styles.erreur}>{erreur}</div>}

        {mode === 'enseignant' ? (
          <label className={styles.champ}>Classe et matière
            <select value={cle} onChange={(e) => setCle(e.target.value)} disabled={edition} required>
              {choix.map((c) => (
                <option key={`${c.classe}|${c.matiere}`} value={`${c.classe}|${c.matiere}`}>
                  {c.classe_nom} — {c.matiere_nom}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <>
            <label className={styles.champ}>Classe
              <select value={classe} onChange={(e) => setClasse(e.target.value)} required>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
              </select>
            </label>
            <label className={styles.champ}>Matière
              <select value={matiere} onChange={(e) => setMatiere(e.target.value)}>
                <option value="">— Autre activité (libellé libre) —</option>
                {matieres.map((m) => <option key={m.id} value={m.id}>{m.nom}</option>)}
              </select>
            </label>
            {!matiere && (
              <label className={styles.champ}>Libellé (ex. Récréation, Étude, Sport)
                <input value={libelle} maxLength={60} onChange={(e) => setLibelle(e.target.value)} required />
              </label>
            )}
            {enseignants.length > 0 && (
              <label className={styles.champ}>Enseignant (facultatif)
                <select value={enseignant} onChange={(e) => setEnseignant(e.target.value)}>
                  <option value="">— Aucun —</option>
                  {enseignants.map((u) => <option key={u.id} value={u.id}>{u.nom}</option>)}
                </select>
              </label>
            )}
          </>
        )}

        {edition ? (
          <label className={styles.champ}>Jour
            <select value={jours[0]} onChange={(e) => setJours([Number(e.target.value)])}>
              {JOURS.map((nom, j) => <option key={j} value={j}>{nom}</option>)}
            </select>
          </label>
        ) : (
          <>
            <span className={styles.champ}>Jour(s) — vous pouvez en cocher plusieurs</span>
            <div className={styles.joursChoix}>
              {JOURS.map((nom, j) => (
                <label key={j} className={`${styles.jourCase} ${jours.includes(j) ? styles.jourCaseActif : ''}`}>
                  <input type="checkbox" checked={jours.includes(j)} onChange={() => basculerJour(j)} />
                  {nom}
                </label>
              ))}
            </div>
          </>
        )}

        <div className={styles.deux}>
          <label className={styles.champ}>Début
            <input type="time" value={debut} onChange={(e) => setDebut(e.target.value)} required />
          </label>
          <label className={styles.champ}>Fin
            <input type="time" value={fin} onChange={(e) => setFin(e.target.value)} required />
          </label>
        </div>

        <label className={styles.champ}>Salle (facultatif)
          <input value={salle} maxLength={40} onChange={(e) => setSalle(e.target.value)} />
        </label>

        <div className={styles.pied}>
          {edition && (
            <button type="button" className={`${styles.btn} ${styles.btnDanger}`} onClick={() => onDelete(initial)} disabled={envoi}>
              Supprimer
            </button>
          )}
          <div className={styles.piedDroite}>
            <button type="button" className={styles.btn} onClick={onClose}>Annuler</button>
            <button type="submit" className={styles.btnPrimaire} disabled={envoi || jours.length === 0}>
              {envoi ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default EditeurCreneau;
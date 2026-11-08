import { useMemo, useState } from 'react';
import { JOURS, hhmm, construireGrille, titreCreneau, detailCreneau } from '../../utils/exportEmploi.js';
import styles from '../../theme/components/Emplois.module.css';

const Carte = ({ c, mode, onSelect }) => {
  const contenu = (
    <>
      <strong>{titreCreneau(c)}</strong>
      <small>{detailCreneau(c, mode)}</small>
    </>
  );
  return onSelect && c.modifiable ? (
    <button type="button" className={styles.carteBtn} onClick={() => onSelect(c)} title="Modifier">
      {contenu}
    </button>
  ) : (
    <div className={styles.carte}>{contenu}</div>
  );
};

/**
 * Emploi du temps : grille (jours en colonnes) ou liste par jour (plus lisible sur téléphone).
 * `mode` = 'classe' (affiche l'enseignant) ou 'enseignant' (affiche la classe).
 * `onSelect(creneau)` n'est appelé que pour les créneaux que l'utilisateur peut modifier.
 */
const GrilleEmploi = ({ creneaux, mode = 'classe', onSelect }) => {
  const [vue, setVue] = useState(() => (window.innerWidth < 700 ? 'jours' : 'grille'));
  const { jours, plages, cellule } = useMemo(() => construireGrille(creneaux), [creneaux]);

  if (creneaux.length === 0) return <p className={styles.vide}>Aucun créneau pour le moment.</p>;

  return (
    <div>
      <div className={styles.vues}>
        <button type="button" className={vue === 'grille' ? styles.ongletActif : styles.onglet} onClick={() => setVue('grille')}>
          Grille
        </button>
        <button type="button" className={vue === 'jours' ? styles.ongletActif : styles.onglet} onClick={() => setVue('jours')}>
          Par jour
        </button>
      </div>

      {vue === 'grille' ? (
        <div className={styles.tableWrap}>
          <table className={styles.grille}>
            <thead>
              <tr>
                <th>Horaire</th>
                {jours.map((j) => <th key={j}>{JOURS[j]}</th>)}
              </tr>
            </thead>
            <tbody>
              {plages.map((p) => (
                <tr key={`${p.debut}-${p.fin}`}>
                  <th scope="row">{p.debut} – {p.fin}</th>
                  {jours.map((j) => (
                    <td key={j}>
                      {cellule(j, p).map((c) => (
                        <Carte key={c.id} c={c} mode={mode} onSelect={onSelect} />
                      ))}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        jours.map((j) => {
          const duJour = creneaux
            .filter((c) => c.jour === j)
            .sort((a, b) => hhmm(a.debut).localeCompare(hhmm(b.debut)));
          if (duJour.length === 0) return null;
          return (
            <div key={j} className={styles.jour}>
              <p className={styles.jourTitre}>{JOURS[j]}</p>
              {duJour.map((c) => (
                <div key={c.id} className={styles.ligneJour}>
                  <span className={styles.heure}>{hhmm(c.debut)} – {hhmm(c.fin)}</span>
                  <Carte c={c} mode={mode} onSelect={onSelect} />
                </div>
              ))}
            </div>
          );
        })
      )}
    </div>
  );
};

export default GrilleEmploi;
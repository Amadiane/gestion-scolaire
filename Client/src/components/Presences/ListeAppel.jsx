import { Save } from 'lucide-react';
import styles from '../../theme/pages/admin/Presences.module.css';

export const STATUTS = [
  { valeur: 'present', label: 'Présent' },
  { valeur: 'absent', label: 'Absent' },
  { valeur: 'retard', label: 'Retard' },
  { valeur: 'excuse', label: 'Excusé' },
];

// lignes : [{ id, titre, sous }] · statuts : { [id]: 'present' | … } · onChange(id, valeur | null)
const ListeAppel = ({ lignes, statuts, onChange, onToutPresent, onEnregistrer, enregistrement }) => {
  const compte = (v) => lignes.filter((l) => statuts[l.id] === v).length;
  const appeles = lignes.filter((l) => statuts[l.id]).length;

  return (
    <>
      <div className={styles.resume}>
        <span>{appeles}/{lignes.length} appelé(s)</span>
        {STATUTS.map((s) => (
          <span key={s.valeur} className={styles[`pastille_${s.valeur}`]}>
            {compte(s.valeur)} {s.label.toLowerCase()}
          </span>
        ))}
      </div>

      <div className={styles.barre}>
        <button type="button" className={styles.bouton} onClick={onToutPresent}>
          {/* Marquer tous les non-appelés présents */}
          Tout le monde présent
        </button>
      </div>

      <div className={styles.liste}>
        {lignes.map((l, i) => (
          <div key={l.id} className={styles.ligne}>
            <div className={styles.identite}>
              <span className={styles.numero}>{i + 1}</span>
              <div>
                <div className={styles.nom}>{l.titre}</div>
                {l.sous && <div className={styles.sous}>{l.sous}</div>}
              </div>
            </div>
            <div className={styles.choix} role="group" aria-label={`Présence de ${l.titre}`}>
              {STATUTS.map((s) => {
                const actif = statuts[l.id] === s.valeur;
                return (
                  <button
                    key={s.valeur}
                    type="button"
                    aria-pressed={actif}
                    className={`${styles.choixBtn} ${actif ? styles[`actif_${s.valeur}`] : ''}`}
                    onClick={() => onChange(l.id, actif ? null : s.valeur)}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <button type="button" className={styles.sauver} onClick={onEnregistrer} disabled={enregistrement || appeles === 0}>
        <Save size={16} /> {enregistrement ? 'Enregistrement…' : "Enregistrer l'appel"}
      </button>
    </>
  );
};

export default ListeAppel;
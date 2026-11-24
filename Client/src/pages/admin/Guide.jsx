import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ChevronDown, Printer, ArrowLeft, Lightbulb, LifeBuoy, X } from 'lucide-react';
import { SECTIONS, ROLES_LIBELLES, SUPPORT } from './guideContenu.js';
import styles from '../../theme/pages/admin/Guide.module.css';

const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const lireRole = () => {
  try {
    return JSON.parse(localStorage.getItem('user') || '{}').role || '';
  } catch {
    return '';
  }
};

const Guide = () => {
  const navigate = useNavigate();
  const role = lireRole();
  const [recherche, setRecherche] = useState('');
  const [ouverts, setOuverts] = useState(() => new Set());

  const visibles = useMemo(
    () =>
      SECTIONS.filter(
        (s) => role === 'directeur' || s.roles.includes('tous') || s.roles.includes(role) || !ROLES_LIBELLES[role]
      ),
    [role]
  );

  const q = norm(recherche.trim());
  const sections = useMemo(
    () =>
      !q
        ? visibles
        : visibles.filter((s) => norm([s.titre, s.resume, ...s.etapes, ...s.astuces].join(' ')).includes(q)),
    [visibles, q]
  );

  const basculer = (id) =>
    setOuverts((prev) => {
      const suivant = new Set(prev);
      if (suivant.has(id)) suivant.delete(id);
      else suivant.add(id);
      return suivant;
    });

  const toutOuvrir = () => setOuverts(new Set(sections.map((s) => s.id)));
  const toutFermer = () => setOuverts(new Set());

  const aSupport = SUPPORT.nom || SUPPORT.telephone || SUPPORT.whatsapp;

  return (
    <div className={styles.wrapper}>
      <div className={styles.cacheImpression}>
        <button type="button" className={styles.retour} onClick={() => navigate(-1)}>
          <ArrowLeft size={16} /> Retour
        </button>
      </div>

      <div className={styles.entete}>
        <div>
          <h1 className={styles.title}>Guide d'utilisation</h1>
          <p className={styles.subtitle}>
            {ROLES_LIBELLES[role]
              ? `Adapté à votre rôle : ${ROLES_LIBELLES[role]}`
              : "Toutes les rubriques d'Ecolia"}
          </p>
        </div>
        <button type="button" className={`${styles.bouton} ${styles.cacheImpression}`} onClick={() => window.print()}>
          <Printer size={16} /> Imprimer le guide
        </button>
      </div>

      <div className={`${styles.barre} ${styles.cacheImpression}`}>
        <div className={styles.recherche}>
          <Search size={16} color="var(--color-text-dim)" />
          <input
            type="text"
            placeholder="Rechercher dans le guide (ex. absence, paiement, note)…"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
          />
          {recherche && (
            <button type="button" className={styles.effacer} onClick={() => setRecherche('')} aria-label="Effacer">
              <X size={14} />
            </button>
          )}
        </div>
        <div className={styles.outils}>
          <button type="button" className={styles.lien} onClick={toutOuvrir}>Tout ouvrir</button>
          <button type="button" className={styles.lien} onClick={toutFermer}>Tout fermer</button>
        </div>
      </div>

      {sections.length === 0 && (
        <div className={styles.vide}>Aucune rubrique ne correspond à « {recherche} ».</div>
      )}

      <div className={styles.liste}>
        {sections.map((s, i) => {
          const ouvert = ouverts.has(s.id);
          return (
            <section key={s.id} className={`${styles.carte} ${ouvert ? styles.ouverte : ''}`}>
              <button
                type="button"
                className={styles.carteEntete}
                onClick={() => basculer(s.id)}
                aria-expanded={ouvert}
                aria-controls={`guide-${s.id}`}
              >
                <span className={styles.numero}>{i + 1}</span>
                <span className={styles.carteTexte}>
                  <span className={styles.carteTitre}>{s.titre}</span>
                  <span className={styles.carteResume}>{s.resume}</span>
                </span>
                <ChevronDown size={18} className={styles.fleche} />
              </button>

              <div id={`guide-${s.id}`} className={styles.contenu}>
                <ol className={styles.etapes}>
                  {s.etapes.map((e, k) => <li key={k}>{e}</li>)}
                </ol>
                {s.astuces.length > 0 && (
                  <div className={styles.astuces}>
                    <div className={styles.astucesTitre}><Lightbulb size={15} /> À savoir</div>
                    <ul>{s.astuces.map((a, k) => <li key={k}>{a}</li>)}</ul>
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>

      {aSupport && (
        <div className={styles.support}>
          <LifeBuoy size={20} />
          <div>
            <strong>Besoin d'aide ?</strong>
            <p>
              {SUPPORT.nom && <>{SUPPORT.nom}. </>}
              {SUPPORT.telephone && <>Téléphone : {SUPPORT.telephone}. </>}
              {SUPPORT.whatsapp && (
                <a href={`https://wa.me/${SUPPORT.whatsapp}`} target="_blank" rel="noreferrer">
                  Écrire sur WhatsApp
                </a>
              )}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Guide;
import { useLayoutEffect, useRef, useState } from 'react';
import styles from '../../theme/components/TableauAnalyses.module.css';

export const COULEURS = { present: '#1f9d6b', absent: '#d64550', retard: '#e0912f', excuse: '#4a7bd0' };
export const NOMS = { present: 'Présent', absent: 'Absent', retard: 'Retard', excuse: 'Excusé' };

const G = 46; // marge gauche (graduations)
const B = 28; // marge basse (étiquettes)
const T = 12; // marge haute
const identite = (v) => v;

// Mesure la largeur réelle de la carte : le diagramme est dessiné à cette taille,
// donc les textes gardent toujours leur taille normale, même sur téléphone.
const useLargeur = () => {
  const ref = useRef(null);
  const [largeur, setLargeur] = useState(560);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const maj = () => setLargeur(Math.max(240, Math.round(el.clientWidth)));
    maj();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const obs = new ResizeObserver(maj);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return [ref, largeur];
};

const hauteurPour = (L) => Math.round(Math.min(280, Math.max(190, L * 0.42)));
// Une étiquette tous les ~56 px, pour qu'elles ne se chevauchent jamais.
const pasEtiquettes = (n, L) => Math.max(1, Math.ceil(n / Math.max(2, Math.floor((L - G) / 56))));

const Grille = ({ max, format, L, H }) =>
  [0, 0.25, 0.5, 0.75, 1].map((f) => {
    const v = Math.round(max * f);
    const y = H - B - ((H - B - T) * v) / max;
    return (
      <g key={f}>
        <line x1={G} x2={L} y1={y} y2={y} className={styles.grilleLigne} />
        <text x={G - 6} y={y + 4} textAnchor="end" className={styles.axe}>{format(v)}</text>
      </g>
    );
  });

// donnees : [{ label, valeurs: { cle: nombre } }] · cles : ordre d'empilement (du bas vers le haut)
export const BarresEmpilees = ({ donnees, cles, couleurs, format = identite }) => {
  const [ref, L] = useLargeur();
  const H = hauteurPour(L);
  const totaux = donnees.map((d) => cles.reduce((s, k) => s + (d.valeurs[k] || 0), 0));
  const max = Math.max(1, ...totaux);
  const n = donnees.length;
  const w = (L - G) / Math.max(n, 1);
  const bw = Math.min(46, Math.max(4, w * 0.72));
  const pas = pasEtiquettes(n, L);
  const hauteur = (v) => ((H - B - T) * v) / max;

  return (
    <div ref={ref} className={styles.zoneGraphique}>
      <svg width={L} height={H} viewBox={`0 0 ${L} ${H}`} className={styles.svg} role="img">
        <Grille max={max} format={format} L={L} H={H} />
        {donnees.map((d, i) => {
          const x = G + i * w + (w - bw) / 2;
          let y = H - B;
          return (
            <g key={d.label + i}>
              {cles.map((k) => {
                const v = d.valeurs[k] || 0;
                if (!v) return null;
                const h = hauteur(v);
                y -= h;
                return (
                  <rect key={k} x={x} y={y} width={bw} height={h} rx="2" fill={couleurs[k]}>
                    <title>{`${d.label} · ${NOMS[k] || k} : ${format(v)}`}</title>
                  </rect>
                );
              })}
              {i % pas === 0 && (
                <text x={x + bw / 2} y={H - 8} textAnchor="middle" className={styles.axe}>{d.label}</text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
};

// series : [{ nom, couleur, valeurs: [nombre | null] }] alignées sur labels
export const Courbes = ({ labels, series, max, suffixe = '', aire = false, format = identite }) => {
  const [ref, L] = useLargeur();
  const H = hauteurPour(L);
  const n = labels.length;
  const m = max ?? Math.max(1, ...series.flatMap((s) => s.valeurs.filter((v) => v != null)));
  const pas = pasEtiquettes(n, L);
  const x = (i) => (n <= 1 ? G + (L - G) / 2 : G + (i * (L - G - 14)) / (n - 1));
  const y = (v) => H - B - ((H - B - T) * v) / m;
  const f = (v) => `${format(v)}${suffixe}`;

  return (
    <div ref={ref} className={styles.zoneGraphique}>
      <svg width={L} height={H} viewBox={`0 0 ${L} ${H}`} className={styles.svg} role="img">
        <Grille max={m} format={f} L={L} H={H} />
        {series.map((s) => {
          const pts = s.valeurs.map((v, i) => (v == null ? null : [x(i), y(v)])).filter(Boolean);
          if (pts.length === 0) return null;
          const ligne = pts.map(([px, py], i) => `${i ? 'L' : 'M'}${px},${py}`).join(' ');
          const base = H - B;
          return (
            <g key={s.nom}>
              {aire && pts.length > 1 && (
                <path d={`${ligne} L${pts[pts.length - 1][0]},${base} L${pts[0][0]},${base} Z`} fill={s.couleur} opacity="0.18" />
              )}
              <path d={ligne} fill="none" stroke={s.couleur} strokeWidth="2.5" strokeLinejoin="round" />
              {s.valeurs.map((v, i) => (v == null ? null : (
                <circle key={i} cx={x(i)} cy={y(v)} r="3.5" fill={s.couleur}>
                  <title>{`${labels[i]} · ${s.nom} : ${f(v)}`}</title>
                </circle>
              )))}
            </g>
          );
        })}
        {labels.map((lab, i) => i % pas === 0 && (
          <text key={lab + i} x={x(i)} y={H - 8} textAnchor="middle" className={styles.axe}>{lab}</text>
        ))}
      </svg>
    </div>
  );
};

// parts : [{ label, valeur, couleur }]
export const Anneau = ({ parts, centre }) => {
  const total = parts.reduce((s, p) => s + p.valeur, 0);
  const c = 90, R = 78, r = 50;
  const pt = (rayon, a) => [c + rayon * Math.cos(a), c + rayon * Math.sin(a)];
  let angle = -Math.PI / 2;

  return (
    <div className={styles.anneauZone}>
      <svg viewBox="0 0 180 180" className={styles.anneau} role="img">
        {total === 0 && <circle cx={c} cy={c} r={(R + r) / 2} fill="none" stroke="rgba(127,127,127,0.25)" strokeWidth={R - r} />}
        {parts.filter((p) => p.valeur > 0).map((p) => {
          const frac = p.valeur / total;
          if (frac >= 0.9999) {
            return <circle key={p.label} cx={c} cy={c} r={(R + r) / 2} fill="none" stroke={p.couleur} strokeWidth={R - r} />;
          }
          const a1 = angle;
          const a2 = angle + frac * 2 * Math.PI;
          angle = a2;
          const [x1, y1] = pt(R, a1);
          const [x2, y2] = pt(R, a2);
          const [x3, y3] = pt(r, a2);
          const [x4, y4] = pt(r, a1);
          const grand = frac > 0.5 ? 1 : 0;
          return (
            <path
              key={p.label}
              fill={p.couleur}
              d={`M${x1} ${y1} A${R} ${R} 0 ${grand} 1 ${x2} ${y2} L${x3} ${y3} A${r} ${r} 0 ${grand} 0 ${x4} ${y4} Z`}
            >
              <title>{`${p.label} : ${p.valeur}`}</title>
            </path>
          );
        })}
        <text x={c} y={c + 8} className={styles.anneauCentre}>{centre}</text>
      </svg>
      <div className={styles.legende}>
        {parts.map((p) => (
          <span key={p.label}>
            <i style={{ background: p.couleur }} />
            {p.label} : {p.valeur}{total ? ` (${Math.round((p.valeur / total) * 100)}%)` : ''}
          </span>
        ))}
      </div>
    </div>
  );
};

// lignes : [{ label, valeur, texte, couleur, onClick? }]
export const BarresHorizontales = ({ lignes, max }) => (
  <div className={styles.hbars}>
    {lignes.map((l) => (
      <div
        key={l.label}
        className={`${styles.hrow} ${l.onClick ? styles.cliquable : ''}`}
        onClick={l.onClick}
      >
        <span className={styles.hlabel} title={l.label}>{l.label}</span>
        <div className={styles.htrack}>
          <div
            className={styles.hfill}
            style={{ width: `${max ? Math.min(100, (l.valeur / max) * 100) : 0}%`, background: l.couleur }}
          />
        </div>
        <span className={styles.hval}>{l.texte}</span>
      </div>
    ))}
  </div>
);
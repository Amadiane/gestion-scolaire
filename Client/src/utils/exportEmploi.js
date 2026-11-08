export const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

export const hhmm = (t) => String(t || '').slice(0, 5);

export const titreCreneau = (c) => c.matiere_nom || c.libelle || '—';

// Sous-titre d'un créneau : enseignant et salle (vue classe), ou classe et salle (vue enseignant).
export const detailCreneau = (c, mode) =>
  (mode === 'enseignant' ? [c.classe_nom, c.salle] : [c.enseignant_nom, c.salle])
    .filter(Boolean)
    .join(' · ');

// Lignes = plages horaires distinctes ; colonnes = jours (lundi–samedi, dimanche seulement s'il est utilisé).
export const construireGrille = (creneaux) => {
  const utilises = new Set(creneaux.map((c) => c.jour));
  const jours = [0, 1, 2, 3, 4, 5, ...(utilises.has(6) ? [6] : [])];
  const plages = [
    ...new Map(
      creneaux.map((c) => [
        `${hhmm(c.debut)}-${hhmm(c.fin)}`,
        { debut: hhmm(c.debut), fin: hhmm(c.fin) },
      ])
    ).values(),
  ].sort((a, b) => a.debut.localeCompare(b.debut) || a.fin.localeCompare(b.fin));
  const cellule = (jour, plage) =>
    creneaux.filter(
      (c) => c.jour === jour && hhmm(c.debut) === plage.debut && hhmm(c.fin) === plage.fin
    );
  return { jours, plages, cellule };
};

const echapper = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const htmlDocument = ({ titre, sousTitre, creneaux, mode }, dernier) => {
  const { jours, plages, cellule } = construireGrille(creneaux);
  const corps = plages
    .map(
      (p) =>
        `<tr><th>${p.debut} – ${p.fin}</th>${jours
          .map(
            (j) =>
              `<td>${cellule(j, p)
                .map(
                  (c) =>
                    `<div class="c"><b>${echapper(titreCreneau(c))}</b><small>${echapper(
                      detailCreneau(c, mode)
                    )}</small></div>`
                )
                .join('')}</td>`
          )
          .join('')}</tr>`
    )
    .join('');
  return `<section class="doc"${dernier ? '' : ' style="page-break-after:always"'}>
    <h1>${echapper(titre)}</h1>${sousTitre ? `<p>${echapper(sousTitre)}</p>` : ''}
    ${
      creneaux.length === 0
        ? '<p>Aucun créneau enregistré.</p>'
        : `<table><thead><tr><th>Horaire</th>${jours
            .map((j) => `<th>${JOURS[j]}</th>`)
            .join('')}</tr></thead><tbody>${corps}</tbody></table>`
    }
  </section>`;
};

const STYLE = `
  @page { size: A4 landscape; margin: 12mm; }
  body { font-family: Arial, sans-serif; color: #111; margin: 0; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  p { margin: 0 0 10px; color: #444; font-size: 12px; }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  th, td { border: 1px solid #888; padding: 5px; vertical-align: top; font-size: 11px; }
  thead th { background: #e5e7eb; }
  tbody th { background: #f3f4f6; width: 90px; white-space: nowrap; }
  .c { margin-bottom: 4px; }
  .c b { display: block; }
  .c small { color: #444; }
`;

/** Ouvre la fenêtre d'impression (on peut y choisir « Enregistrer au format PDF »). */
export const imprimerEmplois = (documents) => {
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Emploi du temps</title>
    <style>${STYLE}</style></head><body>${documents
      .map((d, i) => htmlDocument(d, i === documents.length - 1))
      .join('')}</body></html>`;

  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
  document.body.appendChild(iframe);
  const doc = iframe.contentWindow.document;
  doc.open();
  doc.write(html);
  doc.close();
  setTimeout(() => {
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
    setTimeout(() => iframe.remove(), 2000);
  }, 300);
};

/** Fichier Excel (CSV avec séparateur « ; » et accents corrects). */
export const telechargerEmploiCsv = (nomFichier, creneaux) => {
  const cellule = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lignes = [['Classe', 'Jour', 'Début', 'Fin', 'Matière / activité', 'Enseignant', 'Salle']];
  [...creneaux]
    .sort(
      (a, b) =>
        String(a.classe_nom).localeCompare(String(b.classe_nom), 'fr', { numeric: true }) ||
        a.jour - b.jour ||
        hhmm(a.debut).localeCompare(hhmm(b.debut))
    )
    .forEach((c) =>
      lignes.push([
        c.classe_nom,
        JOURS[c.jour],
        hhmm(c.debut),
        hhmm(c.fin),
        titreCreneau(c),
        c.enseignant_nom || '',
        c.salle || '',
      ])
    );
  const contenu = '\uFEFF' + lignes.map((l) => l.map(cellule).join(';')).join('\r\n');
  const url = URL.createObjectURL(new Blob([contenu], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `${nomFichier}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
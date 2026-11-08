const echapper = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Séparateur « ; » et BOM : le fichier s'ouvre correctement dans Excel en français.
export function telechargerCsv(nomFichier, entetes, lignes) {
  const toutes = [entetes, ...lignes];
  const texte = toutes.map((l) => l.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';')).join('\r\n');
  const blob = new Blob(['\ufeff' + texte], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const lien = document.createElement('a');
  lien.href = url;
  lien.download = nomFichier;
  document.body.appendChild(lien);
  lien.click();
  document.body.removeChild(lien);
  URL.revokeObjectURL(url);
}

// Ouvre la fenêtre d'impression : « Enregistrer en PDF » permet d'obtenir un fichier.
export function imprimerTableau(titre, sousTitre, entetes, lignes) {
  const tete = entetes.map((h) => `<th>${echapper(h)}</th>`).join('');
  const corps = lignes
    .map((l) => `<tr>${l.map((c) => `<td>${echapper(c)}</td>`).join('')}</tr>`)
    .join('');
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${echapper(titre)}</title>
<style>
@page { size: A4 landscape; margin: 12mm; }
body{font-family:Arial,sans-serif;color:#111}
h1{font-size:17px;margin:0 0 4px} p{margin:0 0 12px;font-size:12px;color:#444}
table{width:100%;border-collapse:collapse;font-size:11px}
th,td{border:1px solid #bbb;padding:4px 6px;text-align:left} th{background:#eee}
</style></head><body><h1>${echapper(titre)}</h1><p>${echapper(sousTitre)}</p>
<table><thead><tr>${tete}</tr></thead><tbody>${corps}</tbody></table></body></html>`;

  const cadre = document.createElement('iframe');
  cadre.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
  document.body.appendChild(cadre);
  cadre.contentDocument.open();
  cadre.contentDocument.write(html);
  cadre.contentDocument.close();
  setTimeout(() => {
    cadre.contentWindow.focus();
    cadre.contentWindow.print();
    setTimeout(() => document.body.removeChild(cadre), 1500);
  }, 300);
}
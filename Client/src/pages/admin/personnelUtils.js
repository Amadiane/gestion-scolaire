export const POSTES = {
  direction: 'Direction',
  enseignant: 'Enseignant',
  administratif: 'Administratif',
  comptable: 'Comptable',
  surveillant: 'Surveillant',
  entretien: 'Entretien',
  securite: 'Sécurité',
  autre: 'Autre',
};

export const STATUTS = {
  actif: 'Actif',
  conge: 'En congé',
  parti: 'Parti',
};

export const norm = (s) =>
  String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export const comparer = (a, b) =>
  String(a || '').localeCompare(String(b || ''), 'fr', { numeric: true, sensitivity: 'base' });

export const chiffres = (s) => String(s || '').replace(/\D/g, '');

export const carteEleve = (e) => ({
  cle: `e${e.id}`,
  type: 'eleve',
  nom: e.nom,
  prenom: e.prenom,
  matricule: e.matricule,
  ligne: e.classe_actuelle_nom || 'Sans classe',
  photo: e.photo,
});

export const cartePersonnel = (m) => ({
  cle: `p${m.id}`,
  type: 'personnel',
  nom: m.nom,
  prenom: m.prenom,
  matricule: m.matricule,
  ligne: m.fonction || POSTES[m.poste] || m.poste,
  photo: m.photo,
});
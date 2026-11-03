import Dexie from 'dexie';

export const db = new Dexie('sylium_offline');

db.version(1).stores({
  comptes: 'username',
  cache: 'cle, username',
  file: '++id, username, creeLe',
});

// v2 : la file d'attente remplace une note déjà en attente (clé naturelle).
db.version(2).stores({
  comptes: 'username',
  cache: 'cle, username',
  file: '++id, username, creeLe, cleNat',
});
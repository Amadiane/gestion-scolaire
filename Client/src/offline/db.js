import Dexie from 'dexie';

// Les tables `cache` et `file` serviront à l'étape 2b (données et opérations en attente).
export const db = new Dexie('sylium_offline');

db.version(1).stores({
  comptes: 'username',
  cache: 'cle, username',
  file: '++id, username, creeLe',
});
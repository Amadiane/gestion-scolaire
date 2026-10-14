import { useState, useEffect } from 'react';

// `cle` : valeur qui, en changeant (recherche, filtre), ramène à la page 1.
export default function usePagination(items, parPage = 25, cle = '') {
  const [page, setPage] = useState(1);

  useEffect(() => { setPage(1); }, [cle]);

  const totalPages = Math.max(1, Math.ceil(items.length / parPage));
  const courante = Math.min(page, totalPages);
  const debut = (courante - 1) * parPage;

  return {
    pageItems: items.slice(debut, debut + parPage),
    page: courante,
    setPage,
    totalPages,
    total: items.length,
    debut,
    parPage,
  };
}
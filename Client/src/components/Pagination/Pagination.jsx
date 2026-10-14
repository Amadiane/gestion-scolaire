import styles from '../../theme/components/Pagination.module.css';

// Reçoit directement le résultat de usePagination.
const Pagination = ({ page, setPage, totalPages, total, debut, parPage, unite = 'résultats' }) => {
  if (total <= parPage) return null;

  return (
    <div className={styles.pagination}>
      <span className={styles.info}>
        {debut + 1}–{Math.min(debut + parPage, total)} sur {total} {unite}
      </span>
      <div className={styles.controls}>
        <button onClick={() => setPage(page - 1)} disabled={page === 1}>Précédent</button>
        <span className={styles.pageNum}>Page {page} / {totalPages}</span>
        <button onClick={() => setPage(page + 1)} disabled={page === totalPages}>Suivant</button>
      </div>
    </div>
  );
};

export default Pagination;
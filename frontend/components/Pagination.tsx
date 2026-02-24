interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

/**
 * Page-number controls: ← Prev · 1 2 3 … N · Next →
 * Shows at most 7 page buttons; collapses to ellipsis for large ranges.
 */
export default function Pagination({
  page,
  totalPages,
  onPageChange,
  className = '',
}: PaginationProps) {
  if (totalPages <= 1) return null;

  // Build the list of page numbers to display, with null = ellipsis
  const pages: (number | null)[] = [];

  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push(null);
    const start = Math.max(2, page - 1);
    const end = Math.min(totalPages - 1, page + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    if (page < totalPages - 2) pages.push(null);
    pages.push(totalPages);
  }

  const btnBase =
    'inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-md transition-colors';
  const btnActive =
    'bg-indigo-600 text-white';
  const btnInactive =
    'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700';
  const btnDisabled =
    'text-gray-300 bg-white border border-gray-200 cursor-not-allowed dark:bg-gray-800 dark:text-gray-600 dark:border-gray-700';

  return (
    <nav
      className={`flex items-center justify-between pt-4 ${className}`}
      aria-label="Pagination"
    >
      {/* Mobile: simple prev/next */}
      <div className="flex flex-1 justify-between sm:hidden">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          className={`${btnBase} ${page === 1 ? btnDisabled : btnInactive}`}
        >
          Previous
        </button>
        <span className="text-sm text-gray-700 dark:text-gray-400 self-center">
          {page} / {totalPages}
        </span>
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          className={`${btnBase} ${page === totalPages ? btnDisabled : btnInactive}`}
        >
          Next
        </button>
      </div>

      {/* Desktop: full controls */}
      <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
        <p className="text-sm text-gray-700 dark:text-gray-400">
          Page <span className="font-medium">{page}</span> of{' '}
          <span className="font-medium">{totalPages}</span>
        </p>

        <div className="flex items-center space-x-1">
          {/* Prev */}
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page === 1}
            className={`${btnBase} ${page === 1 ? btnDisabled : btnInactive}`}
            aria-label="Previous page"
          >
            ←
          </button>

          {/* Page numbers */}
          {pages.map((p, i) =>
            p === null ? (
              <span key={`ellipsis-${i}`} className="px-2 text-gray-400 select-none">
                …
              </span>
            ) : (
              <button
                key={p}
                onClick={() => onPageChange(p)}
                className={`${btnBase} ${p === page ? btnActive : btnInactive}`}
                aria-current={p === page ? 'page' : undefined}
              >
                {p}
              </button>
            )
          )}

          {/* Next */}
          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page === totalPages}
            className={`${btnBase} ${page === totalPages ? btnDisabled : btnInactive}`}
            aria-label="Next page"
          >
            →
          </button>
        </div>
      </div>
    </nav>
  );
}

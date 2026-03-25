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
    'bg-primary text-on-primary';
  const btnInactive =
    'text-on-surface bg-surface-container-lowest border border-outline hover:bg-surface-container-low';
  const btnDisabled =
    'text-on-surface-variant bg-surface-container-lowest border border-outline-variant cursor-not-allowed opacity-50';

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
        <span className="text-sm text-on-surface-variant self-center">
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
        <p className="text-sm text-on-surface-variant">
          Page <span className="font-medium text-on-surface">{page}</span> of{' '}
          <span className="font-medium text-on-surface">{totalPages}</span>
        </p>

        <div className="flex items-center space-x-1">
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page === 1}
            className={`${btnBase} ${page === 1 ? btnDisabled : btnInactive}`}
            aria-label="Previous page"
          >
            ←
          </button>

          {pages.map((p, i) =>
            p === null ? (
              <span key={`ellipsis-${i}`} className="px-2 text-on-surface-variant select-none">
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

/**
 * Skeleton placeholder for a stat card (icon + label + value).
 * Matches the card pattern used on the admin dashboard and employees pages.
 */
export default function SkeletonCard() {
  return (
    <div className="bg-surface-container-lowest overflow-hidden shadow rounded-lg animate-pulse">
      <div className="p-5">
        <div className="flex items-center">
          <div className="flex-shrink-0 h-6 w-6 bg-surface-container-high rounded" />
          <div className="ml-5 w-0 flex-1 space-y-2">
            <div className="h-3 bg-surface-container-high rounded w-24" />
            <div className="h-5 bg-surface-container-high rounded w-12" />
          </div>
        </div>
      </div>
    </div>
  );
}

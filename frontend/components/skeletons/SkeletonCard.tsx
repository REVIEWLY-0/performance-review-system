/**
 * Skeleton placeholder for a stat card (icon + label + value).
 * Matches the `bg-white overflow-hidden shadow rounded-lg p-5` pattern
 * used on the admin dashboard and employees pages.
 */
export default function SkeletonCard() {
  return (
    <div className="bg-white overflow-hidden shadow rounded-lg animate-pulse">
      <div className="p-5">
        <div className="flex items-center">
          {/* Icon placeholder */}
          <div className="flex-shrink-0 h-6 w-6 bg-gray-200 rounded" />
          <div className="ml-5 w-0 flex-1 space-y-2">
            {/* Label */}
            <div className="h-3 bg-gray-200 rounded w-24" />
            {/* Value */}
            <div className="h-5 bg-gray-200 rounded w-12" />
          </div>
        </div>
      </div>
    </div>
  );
}

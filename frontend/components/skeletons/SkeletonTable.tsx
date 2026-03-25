/**
 * Skeleton placeholder for a list/table of rows.
 * Matches the divide-y list pattern in EmployeeList.
 */
interface SkeletonTableProps {
  rows?: number;
}

export default function SkeletonTable({ rows = 6 }: SkeletonTableProps) {
  return (
    <div className="bg-surface-container-lowest shadow overflow-hidden sm:rounded-md animate-pulse">
      <ul className="divide-y divide-outline-variant">
        {Array.from({ length: rows }).map((_, i) => (
          <li key={i}>
            <div className="px-4 py-4 flex items-center sm:px-6">
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex items-center space-x-2">
                  <div className="h-4 bg-surface-container-high rounded w-36" />
                  <div className="h-4 bg-surface-container-high rounded w-16" />
                </div>
                <div className="h-3 bg-surface-container-high rounded w-48" />
                {i % 2 === 0 && (
                  <div className="h-3 bg-surface-container-high rounded w-40" />
                )}
              </div>
              <div className="ml-5 flex-shrink-0 flex space-x-2">
                <div className="h-8 w-12 bg-surface-container-high rounded-md" />
                <div className="h-8 w-14 bg-surface-container-high rounded-md" />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

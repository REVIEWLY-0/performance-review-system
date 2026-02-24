/**
 * Skeleton placeholder for a list/table of rows.
 * Matches the `divide-y divide-gray-200` list pattern in EmployeeList.
 */
interface SkeletonTableProps {
  rows?: number;
}

export default function SkeletonTable({ rows = 6 }: SkeletonTableProps) {
  return (
    <div className="bg-white shadow overflow-hidden sm:rounded-md animate-pulse">
      <ul className="divide-y divide-gray-200">
        {Array.from({ length: rows }).map((_, i) => (
          <li key={i}>
            <div className="px-4 py-4 flex items-center sm:px-6">
              <div className="min-w-0 flex-1 space-y-2">
                {/* Name + badge row */}
                <div className="flex items-center space-x-2">
                  <div className="h-4 bg-gray-200 rounded w-36" />
                  <div className="h-4 bg-gray-200 rounded w-16" />
                </div>
                {/* Email row */}
                <div className="h-3 bg-gray-200 rounded w-48" />
                {/* Manager row (every other row) */}
                {i % 2 === 0 && (
                  <div className="h-3 bg-gray-200 rounded w-40" />
                )}
              </div>
              {/* Action buttons placeholder */}
              <div className="ml-5 flex-shrink-0 flex space-x-2">
                <div className="h-8 w-12 bg-gray-200 rounded-md" />
                <div className="h-8 w-14 bg-gray-200 rounded-md" />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

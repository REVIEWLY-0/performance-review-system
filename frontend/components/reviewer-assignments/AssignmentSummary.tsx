interface AssignmentSummaryProps {
  totalEmployees: number;
  assignedEmployees: number;
}

export default function AssignmentSummary({
  totalEmployees,
  assignedEmployees,
}: AssignmentSummaryProps) {
  const percentage =
    totalEmployees > 0
      ? Math.round((assignedEmployees / totalEmployees) * 100)
      : 0;

  return (
    <div className="bg-surface-container-lowest shadow rounded-lg p-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>
          <p className="text-sm font-medium text-on-surface-variant">Total Employees</p>
          <p className="mt-1 text-3xl font-semibold text-on-surface">
            {totalEmployees}
          </p>
        </div>
        <div>
          <p className="text-sm font-medium text-on-surface-variant">
            Employees with Assignments
          </p>
          <p className="mt-1 text-3xl font-semibold text-on-surface">
            {assignedEmployees}
          </p>
        </div>
        <div>
          <p className="text-sm font-medium text-on-surface-variant">
            Completion Progress
          </p>
          <div className="mt-1 flex items-center gap-3">
            <div className="flex-1 bg-surface-container-high rounded-full h-2">
              <div
                className="bg-primary h-2 rounded-full transition-all"
                style={{ width: `${percentage}%` }}
              />
            </div>
            <span className="text-sm font-semibold text-on-surface">
              {percentage}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

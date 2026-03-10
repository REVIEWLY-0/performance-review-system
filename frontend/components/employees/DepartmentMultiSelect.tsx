'use client';

interface DepartmentOption {
  id: string;
  name: string;
}

interface DepartmentMultiSelectProps {
  value: string[];
  onChange: (ids: string[]) => void;
  departments: DepartmentOption[];
  error?: boolean;
}

export default function DepartmentMultiSelect({
  value,
  onChange,
  departments,
  error = false,
}: DepartmentMultiSelectProps) {
  const selected = departments.filter((d) => d && value.includes(d.id));
  const unselected = departments.filter((d) => d && !value.includes(d.id));

  const add = (id: string) => {
    if (!value.includes(id)) onChange([...value, id]);
  };

  const remove = (id: string) => {
    onChange(value.filter((v) => v !== id));
  };

  return (
    <div>
      {/* Selected pills */}
      <div
        className={`min-h-[42px] flex flex-wrap gap-1.5 p-2 border rounded-md ${
          error ? 'border-red-300 bg-red-50' : 'border-gray-300 bg-white'
        }`}
      >
        {selected.map((d) => (
          <span
            key={d.id}
            className="inline-flex items-center gap-1 pl-2.5 pr-1.5 py-0.5 bg-indigo-100 text-indigo-800 rounded-full text-xs font-medium"
          >
            {d.name}
            <button
              type="button"
              onClick={() => remove(d.id)}
              className="flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center hover:bg-indigo-200 text-indigo-600"
              aria-label={`Remove ${d.name}`}
            >
              <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </span>
        ))}
        {selected.length === 0 && (
          <span className="text-sm text-gray-400 py-0.5">No departments selected</span>
        )}
      </div>

      {/* Dropdown to add more */}
      {unselected.length > 0 && (
        <select
          value=""
          onChange={(e) => {
            if (e.target.value) add(e.target.value);
          }}
          className="mt-1.5 block w-full text-sm border border-gray-300 rounded-md py-1.5 px-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-gray-700"
        >
          <option value="">+ Add department…</option>
          {unselected.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

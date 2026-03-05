'use client'

import { useState } from 'react'
import {
  Combobox,
  ComboboxButton,
  ComboboxInput,
  ComboboxOption,
  ComboboxOptions,
} from '@headlessui/react'

interface DepartmentComboboxProps {
  value: string
  onChange: (value: string) => void
  departments: string[]
  error?: boolean
  placeholder?: string
}

export default function DepartmentCombobox({
  value,
  onChange,
  departments,
  error = false,
  placeholder = 'Select or type a department…',
}: DepartmentComboboxProps) {
  const [query, setQuery] = useState('')

  const filtered =
    query === ''
      ? departments
      : departments.filter((d) =>
          d.toLowerCase().includes(query.toLowerCase()),
        )

  // Show a "Create new" option when the typed value isn't in the list
  const showCreate =
    query.trim().length > 0 &&
    !departments.some(
      (d) => d.toLowerCase() === query.trim().toLowerCase(),
    )

  const borderClass = error
    ? 'border-red-300 focus:ring-red-300 focus:border-red-400'
    : 'border-gray-300 focus:ring-indigo-500 focus:border-indigo-500'

  return (
    <Combobox
      as="div"
      value={value}
      onChange={(val: string | null) => {
        onChange(val ?? '')
        setQuery('')
      }}
    >
      <div className="relative">
        <ComboboxInput
          className={`block w-full border ${borderClass} rounded-md shadow-sm py-2 pl-3 pr-10 text-sm focus:outline-none focus:ring-1`}
          placeholder={placeholder}
          displayValue={(v: string) => v}
          onChange={(e) => {
            setQuery(e.target.value)
            onChange(e.target.value)
          }}
          autoComplete="off"
        />
        <ComboboxButton className="absolute inset-y-0 right-0 flex items-center px-2 text-gray-400 hover:text-gray-600">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </ComboboxButton>

        <ComboboxOptions className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-md bg-white shadow-lg border border-gray-200 py-1 text-sm focus:outline-none">
          {filtered.map((dept) => (
            <ComboboxOption
              key={dept}
              value={dept}
              className={({ active }: { active: boolean }) =>
                `cursor-pointer select-none py-2 px-3 ${
                  active ? 'bg-indigo-50 text-indigo-900' : 'text-gray-900'
                }`
              }
            >
              {dept}
            </ComboboxOption>
          ))}

          {showCreate && (
            <ComboboxOption
              value={query.trim()}
              className={({ active }: { active: boolean }) =>
                `cursor-pointer select-none py-2 px-3 ${
                  active ? 'bg-indigo-50' : ''
                }`
              }
            >
              <span className="text-indigo-600 font-medium">Create: </span>
              <span className="text-gray-900">"{query.trim()}"</span>
            </ComboboxOption>
          )}

          {filtered.length === 0 && !showCreate && (
            <div className="py-2 px-3 text-gray-400">No departments found</div>
          )}
        </ComboboxOptions>
      </div>
    </Combobox>
  )
}

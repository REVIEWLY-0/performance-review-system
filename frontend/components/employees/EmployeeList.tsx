'use client'

import { useState, useEffect } from 'react'
import type { User } from '@/lib/api'
import EditEmployeeModal from './EditEmployeeModal'
import DeleteEmployeeModal from './DeleteEmployeeModal'
import { useToast } from '@/components/ToastProvider'
import Avatar from '@/components/Avatar'

interface EmployeeListProps {
  employees: User[]
}

const ROLE_BADGE: Record<string, string> = {
  ADMIN:    'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  MANAGER:  'bg-blue-100   text-blue-700   dark:bg-blue-900/40   dark:text-blue-300',
  EMPLOYEE: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
}

const ROLE_LABEL: Record<string, string> = {
  ADMIN: 'Admin', MANAGER: 'Manager', EMPLOYEE: 'Employee',
}


export default function EmployeeList({ employees: initialEmployees }: EmployeeListProps) {
  const [employees, setEmployees] = useState(initialEmployees)
  const [editingEmployee, setEditingEmployee]   = useState<User | null>(null)
  const [deletingEmployee, setDeletingEmployee] = useState<User | null>(null)
  const toast = useToast()

  useEffect(() => { setEmployees(initialEmployees) }, [initialEmployees])

  const handleEmployeeUpdated = (updated: User) => {
    setEmployees(employees.map(e => e.id === updated.id ? updated : e))
    setEditingEmployee(null)
    toast.success('Employee updated successfully')
  }

  const handleEmployeeDeleted = (id: string) => {
    setEmployees(employees.filter(e => e.id !== id))
    setDeletingEmployee(null)
    toast.success('Employee deleted')
  }

  if (employees.length === 0) {
    return (
      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-16 flex flex-col items-center justify-center text-center">
        <div className="w-14 h-14 mb-4 bg-surface-container rounded-full flex items-center justify-center">
          <svg className="h-7 w-7 text-on-surface-variant" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
        </div>
        <p className="font-bold text-on-surface">No employees found</p>
        <p className="text-sm text-on-surface-variant mt-1">Add employees to get started.</p>
      </div>
    )
  }

  return (
    <>
      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant overflow-hidden">

        {/* ── Header row (lg+) ──────────────────────────────────────────────── */}
        <div className="hidden lg:grid lg:grid-cols-12 px-5 py-3 border-b border-outline-variant bg-surface-container">
          <span className="col-span-4 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">Employee</span>
          <span className="col-span-2 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">Role</span>
          <span className="col-span-2 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">Employee ID</span>
          <span className="col-span-2 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">Department</span>
          <span className="col-span-2 text-xs font-semibold uppercase tracking-wide text-on-surface-variant text-right">Actions</span>
        </div>

        {/* ── Rows ─────────────────────────────────────────────────────────── */}
        <ul className="divide-y divide-outline-variant">
          {employees.map((emp) => {
            const depts = emp.departments ?? []
            const visibleDepts = depts.slice(0, 2)
            const extraDepts   = depts.length - 2

            return (
              <li key={emp.id}>
                {/* Mobile: stacked card-style */}
                <div className="lg:hidden px-5 py-4 flex items-start gap-3 hover:bg-surface-container-low transition-colors">
                  <Avatar name={emp.name} avatarUrl={emp.avatarUrl} size="md" className="shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <p className="font-semibold text-on-surface leading-tight">{emp.name}</p>
                    <p className="text-sm text-on-surface-variant truncate">{emp.email}</p>
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${ROLE_BADGE[emp.role] ?? ROLE_BADGE.EMPLOYEE}`}>
                        {ROLE_LABEL[emp.role] ?? emp.role}
                      </span>
                      {emp.employeeId && (
                        <span className="px-2 py-0.5 text-xs font-mono rounded bg-surface-container text-on-surface-variant border border-outline-variant">
                          {emp.employeeId}
                        </span>
                      )}
                      {visibleDepts.map(d => (
                        <span key={d.id} className="px-2 py-0.5 text-xs font-medium rounded-full bg-secondary-container text-on-secondary-container">
                          {d.name}
                        </span>
                      ))}
                      {extraDepts > 0 && (
                        <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-surface-container text-on-surface-variant">
                          +{extraDepts}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 flex items-center gap-1">
                    <button
                      onClick={() => setEditingEmployee(emp)}
                      className="p-2 rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors"
                      aria-label="Edit employee"
                    >
                      <PencilIcon />
                    </button>
                    <button
                      onClick={() => setDeletingEmployee(emp)}
                      className="p-2 rounded-lg text-on-surface-variant hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400 transition-colors"
                      aria-label="Delete employee"
                    >
                      <TrashIcon />
                    </button>
                  </div>
                </div>

                {/* Desktop: 12-col grid */}
                <div className="hidden lg:grid lg:grid-cols-12 items-center px-5 py-4 hover:bg-surface-container-low transition-colors">

                  {/* col 1–4: Avatar + name + email */}
                  <div className="col-span-4 flex items-center gap-3 min-w-0">
                    <Avatar name={emp.name} avatarUrl={emp.avatarUrl} size="md" className="shrink-0" />
                    <div className="min-w-0">
                      <p className="font-semibold text-on-surface truncate leading-snug">{emp.name}</p>
                      <p className="text-sm text-on-surface-variant truncate">{emp.email}</p>
                    </div>
                  </div>

                  {/* col 5–6: Role badge */}
                  <div className="col-span-2">
                    <span className={`inline-flex px-2.5 py-1 text-xs font-semibold rounded-full ${ROLE_BADGE[emp.role] ?? ROLE_BADGE.EMPLOYEE}`}>
                      {ROLE_LABEL[emp.role] ?? emp.role}
                    </span>
                  </div>

                  {/* col 7–8: Employee ID */}
                  <div className="col-span-2">
                    {emp.employeeId ? (
                      <span className="inline-flex px-2.5 py-1 text-xs font-mono rounded-lg bg-surface-container text-on-surface-variant border border-outline-variant">
                        {emp.employeeId}
                      </span>
                    ) : (
                      <span className="text-xs text-on-surface-variant opacity-40">—</span>
                    )}
                  </div>

                  {/* col 9–10: Departments */}
                  <div className="col-span-2 flex flex-wrap gap-1">
                    {depts.length === 0 ? (
                      <span className="text-xs text-on-surface-variant opacity-40">—</span>
                    ) : (
                      <>
                        {visibleDepts.map(d => (
                          <span key={d.id} className="px-2 py-0.5 text-xs font-medium rounded-full bg-secondary-container text-on-secondary-container">
                            {d.name}
                          </span>
                        ))}
                        {extraDepts > 0 && (
                          <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-surface-container text-on-surface-variant border border-outline-variant">
                            +{extraDepts}
                          </span>
                        )}
                      </>
                    )}
                  </div>

                  {/* col 11–12: Actions */}
                  <div className="col-span-2 flex items-center justify-end gap-1">
                    <button
                      onClick={() => setEditingEmployee(emp)}
                      className="p-2 rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors"
                      title="Edit employee"
                    >
                      <PencilIcon />
                    </button>
                    <button
                      onClick={() => setDeletingEmployee(emp)}
                      className="p-2 rounded-lg text-on-surface-variant hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400 transition-colors"
                      title="Delete employee"
                    >
                      <TrashIcon />
                    </button>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      </div>

      {editingEmployee && (
        <EditEmployeeModal
          employee={editingEmployee}
          onClose={() => setEditingEmployee(null)}
          onSuccess={handleEmployeeUpdated}
        />
      )}

      {deletingEmployee && (
        <DeleteEmployeeModal
          employee={deletingEmployee}
          onClose={() => setDeletingEmployee(null)}
          onSuccess={handleEmployeeDeleted}
        />
      )}
    </>
  )
}

// ── Shared icon components ────────────────────────────────────────────────────
const PencilIcon = () => (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 13l6.768-6.768a2 2 0 112.828 2.828L11.828 15.828a2 2 0 01-1.414.586H8v-2.414a2 2 0 01.586-1.414z" />
  </svg>
)

const TrashIcon = () => (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
)


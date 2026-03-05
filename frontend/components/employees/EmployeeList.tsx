'use client'

import { useState, useEffect } from 'react'
import type { User } from '@/lib/api'
import EditEmployeeModal from './EditEmployeeModal'
import DeleteEmployeeModal from './DeleteEmployeeModal'
import { useToast } from '@/components/ToastProvider'

interface EmployeeListProps {
  employees: User[]
}

export default function EmployeeList({ employees: initialEmployees }: EmployeeListProps) {
  const [employees, setEmployees] = useState(initialEmployees)
  const [editingEmployee, setEditingEmployee] = useState<User | null>(null)

  // Sync when parent passes updated or filtered list
  useEffect(() => {
    setEmployees(initialEmployees)
  }, [initialEmployees])
  const [deletingEmployee, setDeletingEmployee] = useState<User | null>(null)
  const toast = useToast()

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return 'bg-purple-100 text-purple-800'
      case 'MANAGER':
        return 'bg-blue-100 text-blue-800'
      case 'EMPLOYEE':
        return 'bg-green-100 text-green-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const handleEmployeeUpdated = (updatedEmployee: User) => {
    setEmployees(employees.map(emp => emp.id === updatedEmployee.id ? updatedEmployee : emp))
    setEditingEmployee(null)
    toast.success('Employee updated successfully')
  }

  const handleEmployeeDeleted = (deletedId: string) => {
    setEmployees(employees.filter(emp => emp.id !== deletedId))
    setDeletingEmployee(null)
    toast.success('Employee deleted')
  }

  if (employees.length === 0) {
    return (
      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <div className="px-6 py-12 text-center">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No employees</h3>
          <p className="mt-1 text-sm text-gray-500">
            Get started by creating a new employee.
          </p>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <ul className="divide-y divide-gray-200">
          {employees.map((employee) => (
            <li key={employee.id}>
              <div className="px-4 py-4 flex items-center sm:px-6 hover:bg-gray-50">
                <div className="min-w-0 flex-1 sm:flex sm:items-center sm:justify-between">
                  <div className="flex-1">
                    <div className="flex items-center flex-wrap gap-1.5">
                      <p className="font-medium text-indigo-600 truncate">{employee.name}</p>
                      <span
                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getRoleBadgeColor(
                          employee.role
                        )}`}
                      >
                        {employee.role}
                      </span>
                      {employee.employeeId && (
                        <span className="px-2 py-0.5 text-xs font-mono font-medium rounded bg-gray-100 text-gray-600 border border-gray-200">
                          {employee.employeeId}
                        </span>
                      )}
                    </div>
                    <div className="mt-2 flex">
                      <div className="flex items-center text-sm text-gray-500">
                        <svg
                          className="flex-shrink-0 mr-1.5 h-5 w-5 text-gray-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                          />
                        </svg>
                        <p className="truncate">{employee.email}</p>
                      </div>
                    </div>
                    {employee.manager && (
                      <div className="mt-1 flex">
                        <div className="flex items-center text-sm text-gray-500">
                          <svg
                            className="flex-shrink-0 mr-1.5 h-5 w-5 text-gray-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                            />
                          </svg>
                          <p className="truncate">Manager: {employee.manager.name}</p>
                        </div>
                      </div>
                    )}
                    {employee.directReports && employee.directReports.length > 0 && (
                      <div className="mt-1 flex">
                        <div className="flex items-center text-sm text-gray-500">
                          <svg
                            className="flex-shrink-0 mr-1.5 h-5 w-5 text-gray-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                            />
                          </svg>
                          <p className="truncate">
                            {employee.directReports.length} direct report
                            {employee.directReports.length !== 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="ml-5 flex-shrink-0 flex space-x-2">
                  <button
                    onClick={() => setEditingEmployee(employee)}
                    className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => setDeletingEmployee(employee)}
                    className="inline-flex items-center px-3 py-2 border border-red-300 shadow-sm text-sm leading-4 font-medium rounded-md text-red-700 bg-white hover:bg-red-50"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </li>
          ))}
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

'use client'

import { useState } from 'react'
import { usersApi } from '@/lib/api'
import type { User } from '@/lib/api'

interface DeleteEmployeeModalProps {
  employee: User
  onClose: () => void
  onSuccess: (deletedId: string) => void
}

export default function DeleteEmployeeModal({
  employee,
  onClose,
  onSuccess,
}: DeleteEmployeeModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleDelete = async () => {
    setLoading(true)
    setError('')

    try {
      await usersApi.delete(employee.id)
      onSuccess(employee.id)
    } catch (err: any) {
      setError(err.message || 'Failed to delete employee')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed z-50 inset-0 overflow-y-auto">
      <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-on-surface/50 transition-opacity" onClick={onClose} />

        <div className="inline-block align-bottom bg-surface-container-lowest rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
          <div className="bg-surface-container-lowest px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="sm:flex sm:items-start">
              <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                <svg
                  className="h-6 w-6 text-red-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                <h3 className="text-lg leading-6 font-medium text-on-surface">
                  Delete Employee
                </h3>
                <div className="mt-2">
                  <p className="text-sm text-on-surface-variant">
                    Are you sure you want to delete <strong>{employee.name}</strong>? This action
                    cannot be undone.
                  </p>
                  {employee.directReports && employee.directReports.length > 0 && (
                    <p className="mt-2 text-sm text-red-600">
                      ⚠️ This employee has {employee.directReports.length} direct report
                      {employee.directReports.length !== 1 ? 's' : ''}. Reassign them before
                      deleting.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {error && (
              <div className="mt-4 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded">
                {error}
              </div>
            )}
          </div>

          <div className="bg-surface-container-low px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
            <button
              type="button"
              onClick={handleDelete}
              disabled={loading}
              className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
            >
              {loading ? 'Deleting...' : 'Delete'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="mt-3 w-full inline-flex justify-center rounded-md border border-outline shadow-sm px-4 py-2 bg-surface-container-lowest text-base font-medium text-on-surface-variant hover:bg-surface-container-low focus:outline-none sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

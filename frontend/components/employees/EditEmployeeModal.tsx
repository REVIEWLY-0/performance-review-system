'use client'

import { useState, useEffect } from 'react'
import { usersApi, departmentsApi } from '@/lib/api'
import type { User, Department } from '@/lib/api'
import DepartmentMultiSelect from './DepartmentMultiSelect'

interface EditEmployeeModalProps {
  employee: User
  onClose: () => void
  onSuccess: (updatedEmployee: User) => void
}

export default function EditEmployeeModal({ employee, onClose, onSuccess }: EditEmployeeModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [managers, setManagers] = useState<User[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [deptError, setDeptError] = useState('')
  const [formData, setFormData] = useState({
    name: employee.name,
    email: employee.email,
    role: employee.role,
    managerId: employee.managerId || '',
    departmentIds: employee.departments?.map((d) => d.id) ?? [],
  })

  useEffect(() => {
    usersApi.getManagers().then(setManagers).catch(console.error)
    departmentsApi.getAll().then(setDepartments).catch(console.error)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (formData.departmentIds.length === 0) {
      setDeptError('At least one department is required')
      return
    }

    setLoading(true)
    try {
      const updated = await usersApi.update(employee.id, {
        name: formData.name,
        email: formData.email,
        role: formData.role,
        managerId: formData.managerId || undefined,
        departmentIds: formData.departmentIds,
      })
      onSuccess(updated)
    } catch (err: any) {
      setError(err.message || 'Failed to update employee')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed z-10 inset-0 overflow-y-auto">
      <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-on-surface/50 transition-opacity" onClick={onClose} />

        <div className="inline-block align-bottom bg-surface-container-lowest rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
          <form onSubmit={handleSubmit}>
            <div className="bg-surface-container-lowest px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
              <h3 className="text-lg leading-6 font-medium text-on-surface mb-4">
                Edit Employee
              </h3>

              {error && (
                <div className="mb-4 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded">
                  {error}
                </div>
              )}

              <div className="space-y-4">
                {employee.employeeId && (
                  <div className="px-3 py-2 bg-surface-container-low rounded-md border border-outline-variant flex items-center gap-2">
                    <span className="text-xs text-on-surface-variant font-medium">Employee ID</span>
                    <span className="font-mono text-sm font-semibold text-on-surface-variant">{employee.employeeId}</span>
                  </div>
                )}
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-on-surface-variant">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    id="name"
                    required
                    className="mt-1 block w-full border border-outline rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary focus:border-primary"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-on-surface-variant">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    id="email"
                    required
                    className="mt-1 block w-full border border-outline rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary focus:border-primary"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>

                <div>
                  <label htmlFor="role" className="block text-sm font-medium text-on-surface-variant">
                    Role *
                  </label>
                  <select
                    id="role"
                    className="mt-1 block w-full border border-outline rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary focus:border-primary"
                    value={formData.role}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        role: e.target.value as 'ADMIN' | 'MANAGER' | 'EMPLOYEE',
                      })
                    }
                  >
                    <option value="EMPLOYEE">Employee</option>
                    <option value="MANAGER">Manager</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="manager" className="block text-sm font-medium text-on-surface-variant">
                    Manager (Optional)
                  </label>
                  <select
                    id="manager"
                    className="mt-1 block w-full border border-outline rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary focus:border-primary"
                    value={formData.managerId}
                    onChange={(e) => setFormData({ ...formData, managerId: e.target.value })}
                  >
                    <option value="">No Manager</option>
                    {managers
                      .filter((m) => m.id !== employee.id)
                      .map((manager) => (
                        <option key={manager.id} value={manager.id}>
                          {manager.name} ({manager.role})
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-on-surface-variant">
                    Department(s) <span className="text-red-500">*</span>
                  </label>
                  <div className="mt-1">
                    <DepartmentMultiSelect
                      value={formData.departmentIds}
                      onChange={(ids) => {
                        setFormData({ ...formData, departmentIds: ids })
                        if (ids.length > 0) setDeptError('')
                      }}
                      departments={departments}
                      error={!!deptError}
                    />
                  </div>
                  {deptError && (
                    <p className="mt-1 text-sm text-red-600">{deptError}</p>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-surface-container-low px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
              <button
                type="submit"
                disabled={loading}
                className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-primary text-base font-medium text-white hover:bg-primary-dim focus:outline-none sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
              >
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="mt-3 w-full inline-flex justify-center rounded-md border border-outline shadow-sm px-4 py-2 bg-surface-container-lowest text-base font-medium text-on-surface-variant hover:bg-surface-container-low focus:outline-none sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

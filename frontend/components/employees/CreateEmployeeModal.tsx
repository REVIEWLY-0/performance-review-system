'use client'

import { useState, useEffect } from 'react'
import { usersApi, departmentsApi } from '@/lib/api'
import type { User, Department } from '@/lib/api'
import {
  validateEmail,
  validateName,
  getInputClassName,
} from '@/lib/validation'
import DepartmentMultiSelect from './DepartmentMultiSelect'

interface CreateEmployeeModalProps {
  onClose: () => void
  onSuccess: () => void
}

export default function CreateEmployeeModal({ onClose, onSuccess }: CreateEmployeeModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [managers, setManagers] = useState<User[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'EMPLOYEE' as 'ADMIN' | 'MANAGER' | 'EMPLOYEE',
    managerId: '',
    departmentIds: [] as string[],
  })

  const [fieldErrors, setFieldErrors] = useState({
    name: '',
    email: '',
    departmentIds: '',
  })

  const [touched, setTouched] = useState({
    name: false,
    email: false,
    departmentIds: false,
  })

  useEffect(() => {
    usersApi.getManagers().then(setManagers).catch(console.error)
    departmentsApi.getAll().then(setDepartments).catch(console.error)
  }, [])

  const validateField = (field: string, value: any): string => {
    switch (field) {
      case 'name':
        return validateName(value as string, 'Full Name') || ''
      case 'email':
        return validateEmail(value as string) || ''
      case 'departmentIds':
        return (value as string[]).length === 0 ? 'At least one department is required' : ''
      default:
        return ''
    }
  }

  const handleBlur = (field: string) => {
    setTouched({ ...touched, [field]: true })
    const err = validateField(field, formData[field as keyof typeof formData])
    setFieldErrors({ ...fieldErrors, [field]: err })
  }

  const handleChange = (field: string, value: any) => {
    setFormData({ ...formData, [field]: value })
    if (touched[field as keyof typeof touched]) {
      const err = validateField(field, value)
      setFieldErrors({ ...fieldErrors, [field]: err })
    }
  }

  const validateForm = (): boolean => {
    const errors = {
      name: validateField('name', formData.name),
      email: validateField('email', formData.email),
      departmentIds: validateField('departmentIds', formData.departmentIds),
    }
    setFieldErrors(errors)
    setTouched({ name: true, email: true, departmentIds: true })
    return !Object.values(errors).some((e) => e !== '')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!validateForm()) {
      setError('Please fix the errors above')
      return
    }
    setLoading(true)
    try {
      await usersApi.create({
        name: formData.name,
        email: formData.email,
        role: formData.role,
        managerId: formData.managerId || undefined,
        departmentIds: formData.departmentIds,
      })
      onSuccess()
    } catch (err: any) {
      setError(err.message || 'Failed to create employee')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed z-50 inset-0 overflow-y-auto">
      <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-on-surface/50 transition-opacity" onClick={onClose} />

        <div className="inline-block align-bottom bg-surface-container-lowest rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
          <form onSubmit={handleSubmit}>
            <div className="bg-surface-container-lowest px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
              <h3 className="text-lg leading-6 font-medium text-on-surface mb-4">
                Add New Employee
              </h3>

              {error && (
                <div className="mb-4 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded">
                  {error}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-on-surface-variant">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="name"
                    className={`mt-1 ${getInputClassName(
                      touched.name && !!fieldErrors.name,
                      touched.name && !fieldErrors.name && formData.name.length > 0
                    )}`}
                    placeholder="Enter employee's full name"
                    value={formData.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                    onBlur={() => handleBlur('name')}
                  />
                  {touched.name && fieldErrors.name && (
                    <p className="mt-1 text-sm text-red-600">{fieldErrors.name}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-on-surface-variant">
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    id="email"
                    className={`mt-1 ${getInputClassName(
                      touched.email && !!fieldErrors.email,
                      touched.email && !fieldErrors.email && formData.email.length > 0
                    )}`}
                    placeholder="employee@company.com"
                    value={formData.email}
                    onChange={(e) => handleChange('email', e.target.value)}
                    onBlur={() => handleBlur('email')}
                  />
                  {touched.email && fieldErrors.email && (
                    <p className="mt-1 text-sm text-red-600">{fieldErrors.email}</p>
                  )}
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
                    {managers.map((manager) => (
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
                      onChange={(ids) => handleChange('departmentIds', ids)}
                      departments={departments}
                      error={touched.departmentIds && !!fieldErrors.departmentIds}
                    />
                  </div>
                  {touched.departmentIds && fieldErrors.departmentIds && (
                    <p className="mt-1 text-sm text-red-600">{fieldErrors.departmentIds}</p>
                  )}
                  {departments.length === 0 && (
                    <p className="mt-1 text-xs text-on-surface-variant">
                      No departments yet.{' '}
                      <a href="/admin/departments" className="text-primary hover:underline">
                        Create departments
                      </a>{' '}
                      first.
                    </p>
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
                {loading ? 'Creating...' : 'Create Employee'}
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

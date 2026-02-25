'use client'

import { useState, useEffect } from 'react'
import { usersApi } from '@/lib/api'
import type { User } from '@/lib/api'
import {
  validateEmail,
  validateName,
  getInputClassName,
} from '@/lib/validation'

interface CreateEmployeeModalProps {
  onClose: () => void
  onSuccess: () => void
}

export default function CreateEmployeeModal({ onClose, onSuccess }: CreateEmployeeModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [managers, setManagers] = useState<User[]>([])
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'EMPLOYEE' as 'ADMIN' | 'MANAGER' | 'EMPLOYEE',
    managerId: '',
    department: '',
  })

  const [fieldErrors, setFieldErrors] = useState({
    name: '',
    email: '',
  })

  const [touched, setTouched] = useState({
    name: false,
    email: false,
  })

  useEffect(() => {
    // Fetch managers for dropdown
    usersApi.getManagers().then(setManagers).catch(console.error)
  }, [])

  // Validate individual field
  const validateField = (field: string, value: string): string => {
    switch (field) {
      case 'name':
        return validateName(value, 'Full Name') || ''
      case 'email':
        return validateEmail(value) || ''
      default:
        return ''
    }
  }

  // Handle field blur (show validation)
  const handleBlur = (field: string) => {
    setTouched({ ...touched, [field]: true })
    const error = validateField(field, formData[field as keyof typeof formData])
    setFieldErrors({ ...fieldErrors, [field]: error })
  }

  // Handle field change
  const handleChange = (field: string, value: string) => {
    setFormData({ ...formData, [field]: value })

    // Real-time validation if field was touched
    if (touched[field as keyof typeof touched]) {
      const error = validateField(field, value)
      setFieldErrors({ ...fieldErrors, [field]: error })
    }
  }

  // Validate all fields before submit
  const validateForm = (): boolean => {
    const errors = {
      name: validateField('name', formData.name),
      email: validateField('email', formData.email),
    }

    setFieldErrors(errors)
    setTouched({
      name: true,
      email: true,
    })

    return !Object.values(errors).some((err) => err !== '')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Validate form
    if (!validateForm()) {
      setError('Please fix the errors above')
      return
    }

    setLoading(true)

    try {
      await usersApi.create({
        ...formData,
        managerId: formData.managerId || undefined,
        department: formData.department || undefined,
      })
      onSuccess()
    } catch (err: any) {
      setError(err.message || 'Failed to create employee')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed z-10 inset-0 overflow-y-auto">
      <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose} />

        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
          <form onSubmit={handleSubmit}>
            <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
              <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                Add New Employee
              </h3>

              {error && (
                <div className="mb-4 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded">
                  {error}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700">
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
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700">
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
                  <label htmlFor="role" className="block text-sm font-medium text-gray-700">
                    Role *
                  </label>
                  <select
                    id="role"
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
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
                  <label htmlFor="manager" className="block text-sm font-medium text-gray-700">
                    Manager (Optional)
                  </label>
                  <select
                    id="manager"
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
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
                  <label htmlFor="department" className="block text-sm font-medium text-gray-700">
                    Department (Optional)
                  </label>
                  <input
                    type="text"
                    id="department"
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="e.g. Engineering, Sales, Marketing"
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
              <button
                type="submit"
                disabled={loading}
                className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
              >
                {loading ? 'Creating...' : 'Create Employee'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
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

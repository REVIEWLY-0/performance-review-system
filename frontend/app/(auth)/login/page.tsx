'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signIn, signUp } from '@/lib/auth'
import {
  validateEmail,
  validatePassword,
  validatePasswordStrength,
  validatePasswordConfirm,
  validateName,
  getInputClassName,
  getPasswordStrengthColor,
  getPasswordStrengthLabel,
} from '@/lib/validation'

export default function LoginPage() {
  const router = useRouter()
  const [isSignUp, setIsSignUp] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    name: '',
    companyName: '',
  })

  const [fieldErrors, setFieldErrors] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    name: '',
    companyName: '',
  })

  const [touched, setTouched] = useState({
    email: false,
    password: false,
    confirmPassword: false,
    name: false,
    companyName: false,
  })

  // Validate individual field
  const validateField = (field: string, value: string): string => {
    switch (field) {
      case 'email':
        return validateEmail(value) || ''
      case 'password':
        if (isSignUp) {
          const strength = validatePasswordStrength(value)
          return strength.isValid ? '' : strength.feedback.join(', ')
        }
        return validatePassword(value) || ''
      case 'confirmPassword':
        if (isSignUp) {
          return validatePasswordConfirm(formData.password, value) || ''
        }
        return ''
      case 'name':
        if (isSignUp) {
          return validateName(value, 'Full Name') || ''
        }
        return ''
      case 'companyName':
        if (isSignUp) {
          return validateName(value, 'Company Name') || ''
        }
        return ''
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
      email: validateField('email', formData.email),
      password: validateField('password', formData.password),
      confirmPassword: isSignUp ? validateField('confirmPassword', formData.confirmPassword) : '',
      name: isSignUp ? validateField('name', formData.name) : '',
      companyName: isSignUp ? validateField('companyName', formData.companyName) : '',
    }

    setFieldErrors(errors)
    setTouched({
      email: true,
      password: true,
      confirmPassword: isSignUp,
      name: isSignUp,
      companyName: isSignUp,
    })

    return !Object.values(errors).some((err) => err !== '')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    // Validate form
    if (!validateForm()) {
      setError('Please fix the errors above')
      return
    }

    setLoading(true)

    try {
      if (isSignUp) {
        const result = await signUp(
          formData.email,
          formData.password,
          formData.name,
          formData.companyName
        )
        console.log('✅ Signup successful:', result)
        setSuccess(result.message || 'Account created successfully! Redirecting...')

        // Show success message briefly before redirecting
        setTimeout(() => {
          const dashboardPath = getRoleDashboard(result.user.role)
          router.push(dashboardPath)
        }, 1500)
      } else {
        const result = await signIn(formData.email, formData.password)
        console.log('✅ Signin successful:', result)
        setSuccess('Sign in successful! Redirecting...')

        // Show success message briefly before redirecting
        setTimeout(() => {
          const dashboardPath = getRoleDashboard(result.user.role)
          router.push(dashboardPath)
        }, 1000)
      }
    } catch (err: any) {
      console.error('❌ Authentication error:', err)
      setError(err.message || 'Authentication failed')
    } finally {
      setLoading(false)
    }
  }

  const getRoleDashboard = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return '/admin'
      case 'MANAGER':
        return '/manager'
      case 'EMPLOYEE':
        return '/employee'
      default:
        return '/employee'
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <div className="flex flex-col items-center mb-4">
            <div className="h-12 w-12 rounded-xl bg-indigo-600 flex items-center justify-center mb-3">
              <svg className="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-indigo-600">Reviewly</h1>
          </div>
          <h2 className="text-center text-xl font-semibold text-gray-900">
            {isSignUp ? 'Create your company account' : 'Sign in to your account'}
          </h2>
          <p className="mt-1 text-center text-sm text-gray-500">
            Performance review platform
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            {isSignUp && (
              <>
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    className={getInputClassName(
                      touched.name && !!fieldErrors.name,
                      touched.name && !fieldErrors.name && formData.name.length > 0
                    )}
                    placeholder="Enter your full name"
                    value={formData.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                    onBlur={() => handleBlur('name')}
                  />
                  {touched.name && fieldErrors.name && (
                    <p className="mt-1 text-sm text-red-600">{fieldErrors.name}</p>
                  )}
                </div>
                <div>
                  <label htmlFor="company" className="block text-sm font-medium text-gray-700 mb-1">
                    Company Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="company"
                    name="company"
                    type="text"
                    className={getInputClassName(
                      touched.companyName && !!fieldErrors.companyName,
                      touched.companyName && !fieldErrors.companyName && formData.companyName.length > 0
                    )}
                    placeholder="Enter your company name"
                    value={formData.companyName}
                    onChange={(e) => handleChange('companyName', e.target.value)}
                    onBlur={() => handleBlur('companyName')}
                  />
                  {touched.companyName && fieldErrors.companyName && (
                    <p className="mt-1 text-sm text-red-600">{fieldErrors.companyName}</p>
                  )}
                </div>
              </>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email Address <span className="text-red-500">*</span>
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                className={getInputClassName(
                  touched.email && !!fieldErrors.email,
                  touched.email && !fieldErrors.email && formData.email.length > 0
                )}
                placeholder="you@company.com"
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
                onBlur={() => handleBlur('email')}
              />
              {touched.email && fieldErrors.email && (
                <p className="mt-1 text-sm text-red-600">{fieldErrors.email}</p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Password <span className="text-red-500">*</span>
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete={isSignUp ? 'new-password' : 'current-password'}
                className={getInputClassName(
                  touched.password && !!fieldErrors.password,
                  touched.password && !fieldErrors.password && formData.password.length >= 8
                )}
                placeholder={isSignUp ? 'Minimum 8 characters' : 'Enter your password'}
                value={formData.password}
                onChange={(e) => handleChange('password', e.target.value)}
                onBlur={() => handleBlur('password')}
              />
              {touched.password && fieldErrors.password && (
                <p className="mt-1 text-sm text-red-600">{fieldErrors.password}</p>
              )}

              {/* Password strength indicator for signup */}
              {isSignUp && formData.password.length > 0 && (
                <div className="mt-2">
                  {(() => {
                    const strength = validatePasswordStrength(formData.password)
                    return (
                      <>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className={`h-full transition-all ${getPasswordStrengthColor(strength.score)}`}
                              style={{ width: `${(strength.score / 4) * 100}%` }}
                            />
                          </div>
                          <span className="text-xs font-medium text-gray-600">
                            {getPasswordStrengthLabel(strength.score)}
                          </span>
                        </div>
                        {strength.feedback.length > 0 && (
                          <p className="mt-1 text-xs text-gray-500">{strength.feedback.join(', ')}</p>
                        )}
                      </>
                    )
                  })()}
                </div>
              )}
            </div>

            {isSignUp && (
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                  Confirm Password <span className="text-red-500">*</span>
                </label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  className={getInputClassName(
                    touched.confirmPassword && !!fieldErrors.confirmPassword,
                    touched.confirmPassword && !fieldErrors.confirmPassword && formData.confirmPassword.length > 0
                  )}
                  placeholder="Re-enter your password"
                  value={formData.confirmPassword}
                  onChange={(e) => handleChange('confirmPassword', e.target.value)}
                  onBlur={() => handleBlur('confirmPassword')}
                />
                {touched.confirmPassword && fieldErrors.confirmPassword && (
                  <p className="mt-1 text-sm text-red-600">{fieldErrors.confirmPassword}</p>
                )}
              </div>
            )}
          </div>

          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              </div>
            </div>
          )}

          {success && (
            <div className="rounded-md bg-green-50 p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-green-700">{success}</p>
                </div>
              </div>
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {loading ? 'Loading...' : isSignUp ? 'Sign up' : 'Sign in'}
            </button>
          </div>

          <div className="text-center">
            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp)
                setError('')
                setSuccess('')
                setFieldErrors({
                  email: '',
                  password: '',
                  confirmPassword: '',
                  name: '',
                  companyName: '',
                })
                setTouched({
                  email: false,
                  password: false,
                  confirmPassword: false,
                  name: false,
                  companyName: false,
                })
              }}
              className="text-sm text-indigo-600 hover:text-indigo-500"
            >
              {isSignUp
                ? 'Already have an account? Sign in'
                : "Don't have an account? Sign up"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

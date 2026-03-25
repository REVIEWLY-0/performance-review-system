'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { signUp } from '@/lib/auth'
import {
  validateEmail,
  validatePasswordStrength,
  validatePasswordConfirm,
  validateName,
  getPasswordStrengthColor,
  getPasswordStrengthLabel,
} from '@/lib/validation'

const inputCls = (hasError: boolean) =>
  `w-full bg-surface-container-lowest border-none ring-1 ${
    hasError ? 'ring-red-400 focus:ring-red-500' : 'ring-outline-variant focus:ring-primary'
  } focus:ring-2 rounded-xl px-4 py-3 text-on-surface placeholder:text-on-surface-variant transition-all focus:outline-none`

export default function SignUpPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [formData, setFormData] = useState({
    name: '', companyName: '', email: '', password: '', confirmPassword: '',
  })
  const [fieldErrors, setFieldErrors] = useState({
    name: '', companyName: '', email: '', password: '', confirmPassword: '',
  })
  const [touched, setTouched] = useState({
    name: false, companyName: false, email: false, password: false, confirmPassword: false,
  })

  const validateField = (field: string, value: string): string => {
    switch (field) {
      case 'email': return validateEmail(value) || ''
      case 'password': {
        const s = validatePasswordStrength(value)
        return s.isValid ? '' : s.feedback.join(', ')
      }
      case 'confirmPassword': return validatePasswordConfirm(formData.password, value) || ''
      case 'name': return validateName(value, 'Full Name') || ''
      case 'companyName': return validateName(value, 'Company Name') || ''
      default: return ''
    }
  }

  const handleBlur = (field: string) => {
    setTouched({ ...touched, [field]: true })
    setFieldErrors({ ...fieldErrors, [field]: validateField(field, formData[field as keyof typeof formData]) })
  }

  const handleChange = (field: string, value: string) => {
    setFormData({ ...formData, [field]: value })
    if (touched[field as keyof typeof touched]) {
      setFieldErrors({ ...fieldErrors, [field]: validateField(field, value) })
    }
  }

  const validateForm = (): boolean => {
    const errors = {
      name: validateField('name', formData.name),
      companyName: validateField('companyName', formData.companyName),
      email: validateField('email', formData.email),
      password: validateField('password', formData.password),
      confirmPassword: validateField('confirmPassword', formData.confirmPassword),
    }
    setFieldErrors(errors)
    setTouched({ name: true, companyName: true, email: true, password: true, confirmPassword: true })
    return !Object.values(errors).some((e) => e !== '')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    if (!validateForm()) { setError('Please fix the errors above'); return }
    setLoading(true)
    try {
      const result = await signUp(formData.email, formData.password, formData.name, formData.companyName)
      setSuccess(result.message || 'Account created successfully! Redirecting…')
      setTimeout(() => {
        const role = result.user.role
        router.push(role === 'ADMIN' ? '/admin' : role === 'MANAGER' ? '/manager' : '/employee')
      }, 1500)
    } catch (err: any) {
      setError(err.message || 'Sign up failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-surface text-on-surface">

      {/* ── Left: Brand Panel (narrower — ~40%) ───────────────────────────── */}
      <aside className="hidden md:flex md:w-1/2 lg:w-3/5 bg-surface-container-high relative overflow-hidden flex-col justify-between p-12">
        {/* Logo */}
        <div className="z-10 flex items-center gap-3">
          <div className="bg-primary p-2 rounded-xl shadow-lg">
            <svg className="h-7 w-7 text-on-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
            </svg>
          </div>
          <span className="text-xl font-extrabold tracking-tight text-on-surface font-display">Reviewly</span>
        </div>

        {/* Editorial content */}
        <div className="z-10">
          <h2 className="text-5xl font-extrabold font-display leading-tight tracking-tight text-on-surface mb-6">
            Redefining the{' '}
            <span className="text-primary">Standard</span>{' '}
            of Performance.
          </h2>
          <p className="text-lg text-on-surface-variant leading-relaxed mb-8">
            Join forward-thinking companies using Reviewly to cultivate a culture of radical transparency and high-performance growth.
          </p>

          {/* Feature cards — 2-column square grid matching Stitch */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-surface-container-lowest p-6 rounded-xl shadow-sm">
              <svg className="h-6 w-6 text-primary mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <h4 className="font-display font-bold text-on-surface">Data-Driven</h4>
              <p className="text-xs text-on-surface-variant mt-1">Advanced metrics for talent mapping.</p>
            </div>
            <div className="bg-surface-container-lowest p-6 rounded-xl shadow-sm">
              <svg className="h-6 w-6 text-primary mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <h4 className="font-display font-bold text-on-surface">Secure</h4>
              <p className="text-xs text-on-surface-variant mt-1">Enterprise-grade privacy controls.</p>
            </div>
          </div>
        </div>

        {/* Decorative blobs */}
        <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-1/3 -right-16 w-56 h-56 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

        <footer className="z-10 text-xs text-on-surface-variant font-medium opacity-60">
          © {new Date().getFullYear()} Reviewly Performance Platform. All rights reserved.
        </footer>
      </aside>

      {/* ── Right: Signup Form (60%) ───────────────────────────────────────── */}
      <main className="flex-1 bg-surface flex flex-col items-center justify-center p-6 md:p-12 lg:p-24 overflow-y-auto">
        {/* Mobile logo */}
        <div className="md:hidden flex items-center gap-2 mb-10">
          <div className="bg-primary p-1.5 rounded-xl">
            <svg className="h-6 w-6 text-on-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
            </svg>
          </div>
          <span className="text-xl font-extrabold tracking-tight text-on-surface font-display">Reviewly</span>
        </div>

        <div className="w-full max-w-md">
          <header className="mb-10">
            <h1 className="text-3xl font-extrabold font-display text-on-surface tracking-tight mb-2">
              Create your company account
            </h1>
            <p className="text-on-surface-variant font-medium">Performance review platform</p>
          </header>

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 gap-5">

              {/* Full Name */}
              <div className="space-y-1.5">
                <label htmlFor="name" className="block text-sm font-semibold text-on-surface-variant">
                  Full Name <span className="text-error">*</span>
                </label>
                <input
                  id="name" type="text" autoComplete="name" placeholder="John Doe"
                  className={inputCls(touched.name && !!fieldErrors.name)}
                  value={formData.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  onBlur={() => handleBlur('name')}
                />
                {touched.name && fieldErrors.name && <p className="text-sm text-red-600">{fieldErrors.name}</p>}
              </div>

              {/* Company Name */}
              <div className="space-y-1.5">
                <label htmlFor="companyName" className="block text-sm font-semibold text-on-surface-variant">
                  Company Name <span className="text-error">*</span>
                </label>
                <input
                  id="companyName" type="text" autoComplete="organization" placeholder="Acme Corp"
                  className={inputCls(touched.companyName && !!fieldErrors.companyName)}
                  value={formData.companyName}
                  onChange={(e) => handleChange('companyName', e.target.value)}
                  onBlur={() => handleBlur('companyName')}
                />
                {touched.companyName && fieldErrors.companyName && <p className="text-sm text-red-600">{fieldErrors.companyName}</p>}
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <label htmlFor="email" className="block text-sm font-semibold text-on-surface-variant">
                  Email Address <span className="text-error">*</span>
                </label>
                <input
                  id="email" type="email" autoComplete="email" placeholder="you@company.com"
                  className={inputCls(touched.email && !!fieldErrors.email)}
                  value={formData.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  onBlur={() => handleBlur('email')}
                />
                {touched.email && fieldErrors.email && <p className="text-sm text-red-600">{fieldErrors.email}</p>}
              </div>

              {/* Password + Confirm side by side */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="password" className="block text-sm font-semibold text-on-surface-variant">
                    Password <span className="text-error">*</span>
                  </label>
                  <input
                    id="password" type="password" autoComplete="new-password" placeholder="••••••••"
                    className={inputCls(touched.password && !!fieldErrors.password)}
                    value={formData.password}
                    onChange={(e) => handleChange('password', e.target.value)}
                    onBlur={() => handleBlur('password')}
                  />
                  {touched.password && fieldErrors.password && <p className="text-sm text-red-600">{fieldErrors.password}</p>}
                  {formData.password.length > 0 && (() => {
                    const s = validatePasswordStrength(formData.password)
                    return (
                      <div className="mt-2 flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-surface-container-high rounded-full overflow-hidden">
                          <div className={`h-full transition-all ${getPasswordStrengthColor(s.score)}`} style={{ width: `${(s.score / 4) * 100}%` }} />
                        </div>
                        <span className="text-xs font-medium text-on-surface-variant whitespace-nowrap">
                          {getPasswordStrengthLabel(s.score)}
                        </span>
                      </div>
                    )
                  })()}
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="confirmPassword" className="block text-sm font-semibold text-on-surface-variant">
                    Confirm Password <span className="text-error">*</span>
                  </label>
                  <input
                    id="confirmPassword" type="password" autoComplete="new-password" placeholder="••••••••"
                    className={inputCls(touched.confirmPassword && !!fieldErrors.confirmPassword)}
                    value={formData.confirmPassword}
                    onChange={(e) => handleChange('confirmPassword', e.target.value)}
                    onBlur={() => handleBlur('confirmPassword')}
                  />
                  {touched.confirmPassword && fieldErrors.confirmPassword && <p className="text-sm text-red-600">{fieldErrors.confirmPassword}</p>}
                </div>
              </div>
            </div>

            {/* ── Banners ── */}
            {error && (
              <div className="rounded-xl bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 px-4 py-3 flex items-start gap-3">
                <svg className="h-5 w-5 text-red-500 shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
              </div>
            )}
            {success && (
              <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 px-4 py-3 flex items-start gap-3">
                <svg className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <p className="text-sm text-emerald-700 dark:text-emerald-400">{success}</p>
              </div>
            )}

            {/* Submit */}
            <div className="pt-1">
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary hover:bg-primary-dim text-on-primary font-display font-bold py-4 rounded-xl shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? 'Creating account…' : (
                  <>
                    Create account
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </>
                )}
              </button>
            </div>

            {/* Divider */}
            <div className="flex items-center gap-4 opacity-50">
              <div className="h-px flex-1 bg-outline-variant" />
              <span className="text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">Trusted Deployment</span>
              <div className="h-px flex-1 bg-outline-variant" />
            </div>

            {/* Sign in link */}
            <p className="text-center text-on-surface-variant text-sm">
              Already have an account?{' '}
              <Link href="/login" className="text-primary font-bold hover:underline underline-offset-4 ml-1">
                Sign in
              </Link>
            </p>
          </form>
        </div>
      </main>
    </div>
  )
}

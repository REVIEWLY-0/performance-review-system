'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { signIn } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { validateEmail, validatePassword } from '@/lib/validation'

const inputCls = (hasError: boolean) =>
  `w-full bg-surface-container-lowest border-none ring-1 ${
    hasError ? 'ring-red-400 focus:ring-red-500' : 'ring-outline-variant focus:ring-primary'
  } focus:ring-2 rounded-xl px-4 py-3 text-on-surface placeholder:text-on-surface-variant transition-all focus:outline-none`

// ── Stacked centred logo — sits above the card ────────────────────────────
function TopLogo() {
  return (
    <div className="flex flex-col items-center gap-3 mb-8">
      <div className="bg-primary p-3 rounded-2xl shadow-lg shadow-primary/20">
        <svg className="h-8 w-8 text-on-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
        </svg>
      </div>
      <span className="text-2xl font-extrabold tracking-tight text-on-surface font-display">Reviewly</span>
    </div>
  )
}

export default function LoginPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // ── Set-password mode (employee invite link) ───────────────────────────
  const [isSetPassword, setIsSetPassword] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')

  useEffect(() => {
    const hash = window.location.hash.substring(1)
    const params = new URLSearchParams(hash)
    if (params.get('type') === 'recovery' && params.get('access_token')) {
      const accessToken = params.get('access_token')!
      const refreshToken = params.get('refresh_token') ?? ''
      supabase.auth
        .setSession({ access_token: accessToken, refresh_token: refreshToken })
        .then(() => {
          window.history.replaceState(null, '', window.location.pathname)
          setIsSetPassword(true)
        })
        .catch(() => setError('Invalid or expired setup link. Please ask your admin to resend the invite.'))
    }
  }, [])

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (newPassword.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (newPassword !== confirmNewPassword) { setError('Passwords do not match.'); return }
    setLoading(true)
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
      if (updateError) throw new Error(updateError.message)
      setSuccess('Password set! Signing you in…')
      setTimeout(() => router.push('/employee'), 1500)
    } catch (err: any) {
      setError(err.message || 'Failed to set password.')
    } finally {
      setLoading(false)
    }
  }

  // ── Login form state ───────────────────────────────────────────────────
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [emailTouched, setEmailTouched] = useState(false)
  const [passwordTouched, setPasswordTouched] = useState(false)
  const emailError = emailTouched ? validateEmail(email) || '' : ''
  const passwordError = passwordTouched ? validatePassword(password) || '' : ''

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    const eErr = validateEmail(email) || ''
    const pErr = validatePassword(password) || ''
    setEmailTouched(true)
    setPasswordTouched(true)
    if (eErr || pErr) { setError('Please fix the errors above'); return }
    setLoading(true)
    try {
      const result = await signIn(email, password)
      setSuccess('Sign in successful! Redirecting…')
      setTimeout(() => {
        const role = result.user.role
        router.push(role === 'ADMIN' ? '/admin' : role === 'MANAGER' ? '/manager' : '/employee')
      }, 1000)
    } catch (err: any) {
      setError(err.message || 'Authentication failed')
    } finally {
      setLoading(false)
    }
  }

  // ── Shared banner components ───────────────────────────────────────────
  const ErrorBanner = ({ msg }: { msg: string }) => (
    <div className="rounded-xl bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 px-4 py-3 flex items-start gap-3">
      <svg className="h-5 w-5 text-red-500 shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
      </svg>
      <p className="text-sm text-red-700 dark:text-red-400">{msg}</p>
    </div>
  )

  const SuccessBanner = ({ msg }: { msg: string }) => (
    <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 px-4 py-3 flex items-start gap-3">
      <svg className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
      </svg>
      <p className="text-sm text-emerald-700 dark:text-emerald-400">{msg}</p>
    </div>
  )

  // ── Set-password view ──────────────────────────────────────────────────
  if (isSetPassword) {
    return (
      <div className="min-h-screen bg-surface-container-low flex flex-col">
        <div className="flex-1 flex items-center justify-center px-4 py-12">
          <div className="w-full max-w-lg">
            <TopLogo />
            <div className="bg-surface rounded-2xl ring-1 ring-outline-variant shadow-sm p-10">
              <h1 className="text-2xl font-extrabold font-display text-on-surface tracking-tight mb-1">
                Set your password
              </h1>
              <p className="text-on-surface-variant text-sm mb-8">Choose a password to activate your account</p>

              <form className="space-y-5" onSubmit={handleSetPassword}>
                <div className="space-y-1.5">
                  <label htmlFor="new-password" className="block text-sm font-semibold text-on-surface-variant">
                    New Password <span className="text-error">*</span>
                  </label>
                  <input
                    id="new-password" type="password" required autoComplete="new-password"
                    placeholder="Minimum 8 characters"
                    className={inputCls(false)}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="confirm-new-password" className="block text-sm font-semibold text-on-surface-variant">
                    Confirm Password <span className="text-error">*</span>
                  </label>
                  <input
                    id="confirm-new-password" type="password" required autoComplete="new-password"
                    placeholder="Re-enter your password"
                    className={inputCls(false)}
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                  />
                </div>
                {error && <ErrorBanner msg={error} />}
                {success && <SuccessBanner msg={success} />}
                <button
                  type="submit" disabled={loading}
                  className="w-full bg-primary hover:bg-primary-dim text-on-primary font-display font-bold py-4 rounded-xl shadow-lg active:scale-[0.98] transition-all disabled:opacity-50"
                >
                  {loading ? 'Saving…' : 'Set Password & Sign In'}
                </button>
              </form>
            </div>
          </div>
        </div>
        <p className="pb-8 text-center text-xs text-on-surface-variant opacity-60">
          © {new Date().getFullYear()} Reviewly Performance Platform. All rights reserved.
        </p>
      </div>
    )
  }

  // ── Login view ─────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-surface-container-low flex flex-col">
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-lg">
          <TopLogo />
          <div className="bg-surface rounded-2xl ring-1 ring-outline-variant shadow-sm p-10 md:p-12">
            <h1 className="text-3xl font-extrabold font-display text-on-surface tracking-tight mb-1">
              Sign in to your account
            </h1>
            <p className="text-on-surface-variant mb-10">Performance review platform</p>

            <form className="space-y-6" onSubmit={handleSubmit}>
              {/* Email */}
              <div className="space-y-1.5">
                <label htmlFor="email" className="block text-sm font-semibold text-on-surface-variant">
                  Email Address <span className="text-error">*</span>
                </label>
                <input
                  id="email" type="email" autoComplete="email" placeholder="you@company.com"
                  className={inputCls(!!emailError)}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onBlur={() => setEmailTouched(true)}
                />
                {emailError && <p className="text-sm text-red-600">{emailError}</p>}
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <label htmlFor="password" className="block text-sm font-semibold text-on-surface-variant">
                  Password <span className="text-error">*</span>
                </label>
                <input
                  id="password" type="password" autoComplete="current-password" placeholder="Enter your password"
                  className={inputCls(!!passwordError)}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onBlur={() => setPasswordTouched(true)}
                />
                {passwordError && <p className="text-sm text-red-600">{passwordError}</p>}
              </div>

              {error && <ErrorBanner msg={error} />}
              {success && <SuccessBanner msg={success} />}

              {/* Submit */}
              <button
                type="submit" disabled={loading}
                className="w-full bg-primary hover:bg-primary-dim text-on-primary font-display font-bold py-4 rounded-xl shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? 'Signing in…' : (
                  <>
                    Sign in
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </>
                )}
              </button>

              {/* Divider */}
              <div className="flex items-center gap-4 opacity-50">
                <div className="h-px flex-1 bg-outline-variant" />
                <span className="text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">Secure Login</span>
                <div className="h-px flex-1 bg-outline-variant" />
              </div>

              {/* Sign up link */}
              <p className="text-center text-on-surface-variant text-sm">
                Don&apos;t have an account?{' '}
                <Link href="/signup" className="text-primary font-bold hover:underline underline-offset-4 ml-1">
                  Sign up
                </Link>
              </p>
            </form>
          </div>
        </div>
      </div>

      <p className="pb-8 text-center text-xs text-on-surface-variant opacity-60">
        © {new Date().getFullYear()} Reviewly Performance Platform. All rights reserved.
      </p>
    </div>
  )
}

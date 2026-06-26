'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function AuthCallback() {
  const router = useRouter()
  const [flowType, setFlowType] = useState<'recovery' | 'invite' | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const hash = window.location.hash.substring(1)
    const params = new URLSearchParams(hash)
    const type = params.get('type') as 'recovery' | 'invite' | null
    const accessToken = params.get('access_token')
    const refreshToken = params.get('refresh_token') || ''

    if ((type === 'recovery' || type === 'invite') && accessToken) {
      supabase.auth
        .setSession({ access_token: accessToken, refresh_token: refreshToken })
        .then(() => {
          // Clear the hash before storing type so tokens aren't left in the URL
          window.history.replaceState(null, '', window.location.pathname)
          setFlowType(type)
        })
        .catch(() => {
          setError('Invalid or expired link. Please request a new one.')
        })
    } else {
      router.push('/login')
    }
  }, [router])

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (newPassword.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (newPassword !== confirmPassword) { setError('Passwords do not match.'); return }
    setLoading(true)
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
      if (updateError) throw new Error(updateError.message)
      if (flowType === 'recovery') {
        setSuccess('Password updated! Redirecting to your dashboard…')
        // Redirect to root so role-based routing sends admin/manager/employee to their page
        setTimeout(() => router.push('/'), 1500)
      } else {
        setSuccess('Password set! Redirecting to your dashboard…')
        setTimeout(() => router.push('/employee'), 1500)
      }
    } catch (err: any) {
      setError(err.message || 'Failed to update password.')
    } finally {
      setLoading(false)
    }
  }

  if (!flowType) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        {error ? (
          <div className="text-center space-y-3">
            <p className="text-red-500">{error}</p>
            <a href="/login" className="text-sm text-primary hover:underline">← Back to sign in</a>
          </div>
        ) : (
          <p className="text-on-surface-variant">Verifying link…</p>
        )}
      </div>
    )
  }

  const isReset = flowType === 'recovery'

  return (
    <div className="min-h-screen bg-surface-container-low flex items-center justify-center px-4">
      <div className="w-full max-w-lg bg-surface rounded-2xl ring-1 ring-outline-variant shadow-sm p-10">
        <h1 className="text-2xl font-extrabold text-on-surface mb-2">
          {isReset ? 'Reset your password' : 'Set your password'}
        </h1>
        <p className="text-on-surface-variant text-sm mb-8">
          {isReset
            ? 'Choose a new password for your account.'
            : 'Choose a password to activate your account.'}
        </p>
        <form className="space-y-5" onSubmit={handleSetPassword}>
          <input
            type="password"
            placeholder="New password (min 8 characters)"
            required
            autoComplete="new-password"
            className="w-full border border-outline rounded-xl px-4 py-3 bg-surface-container-lowest text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <input
            type="password"
            placeholder="Confirm password"
            required
            autoComplete="new-password"
            className="w-full border border-outline rounded-xl px-4 py-3 bg-surface-container-lowest text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
          {error && <p className="text-red-500 text-sm">{error}</p>}
          {success && <p className="text-emerald-600 text-sm">{success}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-on-primary font-bold py-4 rounded-xl disabled:opacity-50 hover:opacity-90 transition-opacity"
          >
            {loading ? 'Saving…' : isReset ? 'Update Password' : 'Set Password & Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}

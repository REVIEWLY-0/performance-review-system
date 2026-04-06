'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function AuthCallback() {
  const router = useRouter()
  const [isSetPassword, setIsSetPassword] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const hash = window.location.hash.substring(1)
    const params = new URLSearchParams(hash)
    const type = params.get('type')
    const accessToken = params.get('access_token')
    const refreshToken = params.get('refresh_token') || ''

    if ((type === 'recovery' || type === 'invite') && accessToken) {
      supabase.auth
        .setSession({ access_token: accessToken, refresh_token: refreshToken })
        .then(() => {
          window.history.replaceState(null, '', window.location.pathname)
          setIsSetPassword(true)
        })
        .catch(() => {
          setError('Invalid or expired link. Please ask your admin to resend the invite.')
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
      setSuccess('Password set! Redirecting to your dashboard…')
      setTimeout(() => router.push('/employee'), 1500)
    } catch (err: any) {
      setError(err.message || 'Failed to set password.')
    } finally {
      setLoading(false)
    }
  }

  if (!isSetPassword) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        {error ? (
          <p className="text-red-500">{error}</p>
        ) : (
          <p className="text-on-surface-variant">Setting up your account…</p>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface-container-low flex items-center justify-center px-4">
      <div className="w-full max-w-lg bg-surface rounded-2xl ring-1 ring-outline-variant shadow-sm p-10">
        <h1 className="text-2xl font-extrabold text-on-surface mb-2">Set your password</h1>
        <p className="text-on-surface-variant text-sm mb-8">Choose a password to activate your account</p>
        <form className="space-y-5" onSubmit={handleSetPassword}>
          <input
            type="password" placeholder="New password (min 8 characters)" required
            className="w-full border rounded-xl px-4 py-3"
            value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
          />
          <input
            type="password" placeholder="Confirm password" required
            className="w-full border rounded-xl px-4 py-3"
            value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
          />
          {error && <p className="text-red-500 text-sm">{error}</p>}
          {success && <p className="text-green-500 text-sm">{success}</p>}
          <button
            type="submit" disabled={loading}
            className="w-full bg-primary text-on-primary font-bold py-4 rounded-xl disabled:opacity-50"
          >
            {loading ? 'Saving…' : 'Set Password & Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}
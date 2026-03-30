import { supabase } from './supabase'

export interface User {
  id: string
  email: string
  name: string
  role: 'ADMIN' | 'MANAGER' | 'EMPLOYEE'
  companyId: string
  companyName: string
  avatarUrl?: string | null
}

// Module-level caches — survive re-renders, cleared on sign-out
let _sessionCache: { session: any; expires: number } | null = null
let _userCache: { user: User; expires: number } | null = null
// In-flight deduplication: concurrent calls share one fetch instead of firing N
let _userFetchInFlight: Promise<User | null> | null = null

export async function getSession() {
  // Return cached session if still valid (avoids repeated Supabase storage reads)
  if (_sessionCache && Date.now() < _sessionCache.expires) {
    return _sessionCache.session
  }

  try {
    const { data: { session }, error } = await supabase.auth.getSession()

    if (error) {
      console.error('❌ Error getting session:', error.message)
      return null
    }

    if (session) {
      _sessionCache = { session, expires: Date.now() + 30_000 } // 30s cache
    } else {
      _sessionCache = null
    }

    return session
  } catch (error) {
    console.error('❌ Exception getting session:', error)
    return null
  }
}

export async function getCurrentUser(retries = 2): Promise<User | null> {
  // Return cached user if still valid (avoids /auth/me round-trip on every navigation)
  if (_userCache && Date.now() < _userCache.expires) {
    return _userCache.user
  }

  // Deduplicate concurrent calls — layout + page both call this on every navigation.
  // Without this, StrictMode + concurrent renders fire N requests before _userCache is set.
  if (_userFetchInFlight) {
    return _userFetchInFlight
  }

  _userFetchInFlight = _fetchUser(retries).finally(() => {
    _userFetchInFlight = null
  })

  return _userFetchInFlight
}

async function _fetchUser(retries: number): Promise<User | null> {
  const session = await getSession()
  if (!session) {
    return null
  }

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      if (attempt > 0) {
        await new Promise(resolve => setTimeout(resolve, 500 * attempt))
      }

      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 8_000)
      let response: Response
      try {
        response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/me`, {
          headers: { 'Authorization': `Bearer ${session.access_token}` },
          signal: controller.signal,
        })
      } finally {
        clearTimeout(timeout)
      }

      if (!response.ok) {
        if (response.status === 401) {
          // Clear our local caches so the next navigation fetches fresh tokens.
          // Do NOT call supabase.auth.signOut() here — a transient 401 (backend
          // hiccup, clock skew, first-request race) must not destroy the Supabase
          // session. Layouts will redirect to /login naturally when this returns null.
          console.warn('⚠️ /auth/me returned 401 — clearing caches (session may be expired or backend not ready)')
          _sessionCache = null
          _userCache = null
          return null
        }

        if (response.status >= 500 && attempt < retries) {
          console.warn(`⚠️ /auth/me returned ${response.status} — retrying (attempt ${attempt + 1}/${retries})`)
          continue
        }
        return null
      }

      const user = await response.json()
      _userCache = { user, expires: Date.now() + 60_000 } // 60s cache
      return user
    } catch (error) {
      console.error(`❌ Error fetching user (attempt ${attempt + 1}):`, error)
      if (attempt === retries) {
        return null
      }
    }
  }

  return null
}

export async function signIn(email: string, password: string) {
  console.log('🔑 Signing in:', email)

  // Sign in directly via Supabase — session is stored in localStorage automatically,
  // no setSession() call needed (which internally calls _getUser() — an extra network
  // round-trip — and can stall indefinitely on lock acquisition).
  const { data: authData, error: authError } = await Promise.race([
    supabase.auth.signInWithPassword({ email, password }),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Cannot reach the server — please check your connection and try again.')), 10_000)
    ),
  ])

  if (authError || !authData?.session) {
    console.error('❌ Sign in failed:', authError?.message)
    throw new Error(authError?.message || 'Sign in failed')
  }

  console.log('✅ Supabase sign-in successful')
  _sessionCache = { session: authData.session, expires: Date.now() + 30_000 }

  // Fetch user profile from our backend (role, companyId, companyName, etc.)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 8_000)
  let response: Response
  try {
    response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/me`, {
      headers: { 'Authorization': `Bearer ${authData.session.access_token}` },
      signal: controller.signal,
    })
  } catch (err: any) {
    clearTimeout(timer)
    if (err.name === 'AbortError') throw new Error('Cannot reach the server — please check the backend is running and try again.')
    throw err
  }
  clearTimeout(timer)

  if (!response.ok) {
    const err = await response.json().catch(() => ({ message: 'Sign in failed' }))
    throw new Error(err.message || 'Sign in failed')
  }

  const user = await response.json()
  console.log('✅ Sign in complete for:', user.email)
  return { session: authData.session, user }
}

export async function signUp(email: string, password: string, name: string, companyName: string) {
  console.log('📝 Signing up:', email)

  // 1. Create the account via our backend (creates company, DB record, etc.)
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name, companyName }),
  })

  if (!response.ok) {
    const error = await response.json()
    console.error('❌ Sign up failed:', error.message)
    throw new Error(error.message || 'Sign up failed')
  }

  const data = await response.json()
  console.log('✅ Account created, signing in...')

  // 2. Sign in via Supabase directly to store the session — avoids setSession()
  //    which makes an extra _getUser network call and can stall on lock acquisition.
  const { data: authData, error: authError } = await Promise.race([
    supabase.auth.signInWithPassword({ email, password }),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Session setup timed out — please try signing in manually.')), 10_000)
    ),
  ])

  if (authError || !authData?.session) {
    console.warn('⚠️ Post-signup sign-in failed:', authError?.message)
    // Account was created — return data so caller can redirect to login
    return data
  }

  _sessionCache = { session: authData.session, expires: Date.now() + 30_000 }
  console.log('✅ Sign up complete')
  return data
}

export async function signOut() {
  _sessionCache = null
  _userCache = null
  _userFetchInFlight = null
  await supabase.auth.signOut()
}

/** Clear the user cache so the next getCurrentUser() call fetches fresh data */
export function invalidateUserCache() {
  _userCache = null
  _userFetchInFlight = null
}

/**
 * Clear both session and user caches without signing out of Supabase.
 * Use this when an API call returns 401 — it forces re-verification on the
 * next navigation without destroying the underlying Supabase session.
 */
export function invalidateSession() {
  _sessionCache = null
  _userCache = null
  _userFetchInFlight = null
}

/**
 * Request a password reset email for the currently authenticated user.
 * The backend generates a Supabase recovery link and sends it via the
 * notifications service.
 */
export async function requestPasswordReset(): Promise<{ message: string }> {
  const session = await getSession()
  if (!session) throw new Error('Not authenticated')

  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/auth/request-password-reset`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
    },
  )

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }))
    throw new Error(error.message || `HTTP ${response.status}`)
  }

  return response.json()
}

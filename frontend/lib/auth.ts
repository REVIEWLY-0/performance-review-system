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
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8_000)
  let response: Response
  try {
    response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/signin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      signal: controller.signal,
    })
  } catch (err: any) {
    clearTimeout(timeout)
    if (err.name === 'AbortError') throw new Error('Cannot reach the server — please check the backend is running and try again.')
    throw err
  }
  clearTimeout(timeout)

  if (!response.ok) {
    const error = await response.json()
    console.error('❌ Sign in failed:', error.message)
    throw new Error(error.message || 'Sign in failed')
  }

  const data = await response.json()
  console.log('✅ Sign in response received')

  // Set the session in Supabase client
  if (data.session) {
    console.log('💾 Setting session in Supabase client...')
    const timeout8s = <T>(promise: Promise<T>): Promise<T> =>
      Promise.race([
        promise,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Session setup timed out — please try again.')), 8_000)
        ),
      ])

    const { error } = await timeout8s(supabase.auth.setSession({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    }))
    if (error) {
      console.error('❌ Error setting session:', error)
      throw new Error('Failed to persist session')
    }

    // Verify session was persisted (also guarded by the same timeout helper)
    const { data: { session: verifySession } } = await timeout8s(supabase.auth.getSession())
    if (!verifySession) {
      console.error('❌ Session not persisted correctly')
      throw new Error('Session persistence failed')
    }

    console.log('✅ Session set and verified successfully')
  } else {
    console.warn('⚠️  No session in response')
  }

  return data
}

export async function signUp(email: string, password: string, name: string, companyName: string) {
  console.log('📝 Signing up:', email)
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/signup`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password, name, companyName }),
  })

  if (!response.ok) {
    const error = await response.json()
    console.error('❌ Sign up failed:', error.message)
    throw new Error(error.message || 'Sign up failed')
  }

  const data = await response.json()
  console.log('✅ Sign up response received')

  // Set the session in Supabase client
  if (data.session) {
    console.log('💾 Setting session in Supabase client...')
    const timeout8s = <T>(promise: Promise<T>): Promise<T> =>
      Promise.race([
        promise,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Session setup timed out — please try again.')), 8_000)
        ),
      ])

    const { error } = await timeout8s(supabase.auth.setSession({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    }))
    if (error) {
      console.error('❌ Error setting session:', error)
      throw new Error('Failed to persist session')
    }

    const { data: { session: verifySession } } = await timeout8s(supabase.auth.getSession())
    if (!verifySession) {
      console.error('❌ Session not persisted correctly')
      throw new Error('Session persistence failed')
    }

    console.log('✅ Session set and verified successfully')
  } else {
    console.warn('⚠️  No session in response')
  }

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

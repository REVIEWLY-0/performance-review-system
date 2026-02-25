import { supabase } from './supabase'

export interface User {
  id: string
  email: string
  name: string
  role: 'ADMIN' | 'MANAGER' | 'EMPLOYEE'
  companyId: string
  companyName: string
}

// Module-level caches — survive re-renders, cleared on sign-out
let _sessionCache: { session: any; expires: number } | null = null
let _userCache: { user: User; expires: number } | null = null

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

  const session = await getSession()
  if (!session) {
    return null
  }

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      if (attempt > 0) {
        await new Promise(resolve => setTimeout(resolve, 500 * attempt))
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      })

      if (!response.ok) {
        if (response.status === 401) {
          console.error('❌ Unauthorized - session invalid')
          await supabase.auth.signOut()
          _sessionCache = null
          _userCache = null
          return null
        }

        if (response.status >= 500 && attempt < retries) {
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
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/signin`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  })

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
    const { error } = await supabase.auth.setSession({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    })
    if (error) {
      console.error('❌ Error setting session:', error)
      throw new Error('Failed to persist session')
    }

    // Wait longer to ensure session is fully persisted
    console.log('⏳ Waiting for session persistence...')
    await new Promise(resolve => setTimeout(resolve, 500))

    // Verify session was persisted
    const { data: { session: verifySession } } = await supabase.auth.getSession()
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
    const { error } = await supabase.auth.setSession({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    })
    if (error) {
      console.error('❌ Error setting session:', error)
      throw new Error('Failed to persist session')
    }

    // Wait longer to ensure session is fully persisted
    console.log('⏳ Waiting for session persistence...')
    await new Promise(resolve => setTimeout(resolve, 500))

    // Verify session was persisted
    const { data: { session: verifySession } } = await supabase.auth.getSession()
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
  await supabase.auth.signOut()
}

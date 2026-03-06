import { getSession } from './auth'
import { getCached, setCache, invalidateCache } from './cache'

export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export interface User {
  id: string
  email: string
  name: string
  role: 'ADMIN' | 'MANAGER' | 'EMPLOYEE'
  companyId: string
  managerId?: string
  department?: string
  employeeId?: string
  manager?: {
    id: string
    name: string
    email: string
  }
  directReports?: {
    id: string
    name: string
    email: string
  }[]
  createdAt: string
  updatedAt: string
}

export interface CreateUserDto {
  email: string
  name: string
  role: 'ADMIN' | 'MANAGER' | 'EMPLOYEE'
  managerId?: string
  department?: string
}

export interface UpdateUserDto {
  name?: string
  email?: string
  role?: 'ADMIN' | 'MANAGER' | 'EMPLOYEE'
  managerId?: string
  department?: string
}

export interface UserStats {
  total: number
  byRole: {
    admins: number
    managers: number
    employees: number
  }
}

export async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const session = await getSession()
  if (!session) {
    throw new Error('Not authenticated')
  }

  const response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
  })

  // Handle 401 by signing out
  if (response.status === 401) {
    console.error('❌ 401 Unauthorized - signing out')
    const { signOut } = await import('./auth')
    await signOut()
    if (typeof window !== 'undefined') {
      window.location.href = '/login'
    }
    throw new Error('Session expired')
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }))
    throw new Error(error.message || `HTTP ${response.status}`)
  }

  return response.json()
}

// User API
export const usersApi = {
  getAll: async (page = 1, limit = 50): Promise<PaginatedResponse<User>> => {
    return fetchWithAuth(
      `${process.env.NEXT_PUBLIC_API_URL}/users?page=${page}&limit=${limit}`,
    )
  },

  getOne: async (id: string): Promise<User> => {
    return fetchWithAuth(`${process.env.NEXT_PUBLIC_API_URL}/users/${id}`)
  },

  create: async (data: CreateUserDto): Promise<User> => {
    const result = await fetchWithAuth(`${process.env.NEXT_PUBLIC_API_URL}/users`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
    invalidateCache('users:')
    return result
  },

  update: async (id: string, data: UpdateUserDto): Promise<User> => {
    const result = await fetchWithAuth(`${process.env.NEXT_PUBLIC_API_URL}/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
    invalidateCache('users:')
    return result
  },

  delete: async (id: string): Promise<void> => {
    const result = await fetchWithAuth(`${process.env.NEXT_PUBLIC_API_URL}/users/${id}`, {
      method: 'DELETE',
    })
    invalidateCache('users:')
    return result
  },

  getManagers: async (): Promise<User[]> => {
    const key = 'users:managers'
    const cached = getCached<User[]>(key)
    if (cached) return cached
    const data = await fetchWithAuth(`${process.env.NEXT_PUBLIC_API_URL}/users/managers`)
    setCache(key, data, 120_000) // 2 min — managers list rarely changes
    return data
  },

  getStats: async (): Promise<UserStats> => {
    const key = 'users:stats'
    const cached = getCached<UserStats>(key)
    if (cached) return cached
    const data = await fetchWithAuth(`${process.env.NEXT_PUBLIC_API_URL}/users/stats`)
    setCache(key, data, 60_000) // 1 min TTL
    return data
  },

  importUsers: async (users: any[]): Promise<{ successful: number; failed: number; errors: string[] }> => {
    const result = await fetchWithAuth(`${process.env.NEXT_PUBLIC_API_URL}/users/import`, {
      method: 'POST',
      body: JSON.stringify({ users }),
    })
    invalidateCache('users:')
    return result
  },

  updateProfile: async (name: string): Promise<{ id: string; name: string; email: string; role: string; companyId: string }> => {
    return fetchWithAuth(`${process.env.NEXT_PUBLIC_API_URL}/users/profile`, {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    })
  },

  getDepartments: async (): Promise<string[]> => {
    const key = 'users:departments'
    const cached = getCached<string[]>(key)
    if (cached) return cached
    const data = await fetchWithAuth(`${process.env.NEXT_PUBLIC_API_URL}/users/departments`)
    setCache(key, data, 60_000) // 1 min TTL
    return data
  },
}

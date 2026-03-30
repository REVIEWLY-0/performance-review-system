import { getSession, invalidateSession } from './auth'
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

export interface Department {
  id: string
  companyId: string
  name: string
  archivedAt: string | null
  createdAt: string
  updatedAt: string
  _count?: { userDepts: number }
}

export interface User {
  id: string
  email: string
  name: string
  role: 'ADMIN' | 'MANAGER' | 'EMPLOYEE'
  companyId: string
  managerId?: string
  department?: string
  departments?: { id: string; name: string }[]
  employeeId?: string
  avatarUrl?: string | null
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

export interface ImportUserPayload {
  email: string
  name: string
  role: 'ADMIN' | 'MANAGER' | 'EMPLOYEE'
  department?: string
  employeeId?: string
  managerEmail?: string
}

export interface CreateUserDto {
  email: string
  name: string
  role: 'ADMIN' | 'MANAGER' | 'EMPLOYEE'
  managerId?: string
  department?: string      // Legacy
  departmentIds?: string[] // New: multi-department
}

export interface UpdateUserDto {
  name?: string
  email?: string
  role?: 'ADMIN' | 'MANAGER' | 'EMPLOYEE'
  managerId?: string
  department?: string      // Legacy
  departmentIds?: string[] // New: multi-department
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
      'X-Requested-With': 'XMLHttpRequest',
    },
  })

  // On 401, clear local caches and throw — the calling layout will redirect to
  // /login naturally. Do NOT call signOut() or window.location.href here:
  // multiple concurrent API calls can all hit 401 simultaneously and a hard
  // redirect race causes the login loop + rate limit exhaustion.
  if (response.status === 401) {
    console.warn('⚠️ API 401 — invalidating session cache, throwing for caller to handle')
    invalidateSession()
    throw new Error('Session expired')
  }

  // 429 — rate limit hit. Session is fine; just surface a human-readable message.
  // Do NOT invalidate session on rate-limit — it would cause an unnecessary logout loop.
  if (response.status === 429) {
    console.warn('⚠️ API 429 — rate limit hit, please try again shortly')
    throw new Error('Too many requests — please wait a moment and try again.')
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }))
    throw new Error(error.message || `HTTP ${response.status}`)
  }

  return response.json()
}

// User API
export const usersApi = {
  getAll: async (page = 1, limit = 20, search = '', role = ''): Promise<PaginatedResponse<User>> => {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (search) params.set('search', search);
    if (role) params.set('role', role);
    return fetchWithAuth(`${process.env.NEXT_PUBLIC_API_URL}/users?${params}`);
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

  importUsers: async (users: ImportUserPayload[]): Promise<{ successful: number; failed: number; errors: string[] }> => {
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

  uploadAvatar: async (file: File): Promise<User> => {
    const session = await getSession()
    if (!session) throw new Error('Not authenticated')
    const formData = new FormData()
    formData.append('avatar', file)
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/me/avatar`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}` },
      body: formData,
    })
    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      throw new Error(err.message || 'Upload failed')
    }
    return response.json()
  },

  deleteAvatar: async (): Promise<User> => {
    return fetchWithAuth(`${process.env.NEXT_PUBLIC_API_URL}/users/me/avatar`, { method: 'DELETE' })
  },
}

// Departments API
export const departmentsApi = {
  getAll: async (): Promise<Department[]> => {
    const key = 'departments:active'
    const cached = getCached<Department[]>(key)
    if (cached) return cached
    const data = await fetchWithAuth(`${process.env.NEXT_PUBLIC_API_URL}/departments`)
    setCache(key, data, 60_000)
    return data
  },

  getArchived: async (): Promise<Department[]> => {
    return fetchWithAuth(`${process.env.NEXT_PUBLIC_API_URL}/departments/archived`)
  },

  create: async (name: string): Promise<Department> => {
    const result = await fetchWithAuth(`${process.env.NEXT_PUBLIC_API_URL}/departments`, {
      method: 'POST',
      body: JSON.stringify({ name }),
    })
    invalidateCache('departments:')
    return result
  },

  update: async (id: string, name: string): Promise<Department> => {
    const result = await fetchWithAuth(`${process.env.NEXT_PUBLIC_API_URL}/departments/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    })
    invalidateCache('departments:')
    return result
  },

  archive: async (id: string): Promise<Department> => {
    const result = await fetchWithAuth(`${process.env.NEXT_PUBLIC_API_URL}/departments/${id}/archive`, {
      method: 'PATCH',
    })
    invalidateCache('departments:')
    return result
  },

  restore: async (id: string): Promise<Department> => {
    const result = await fetchWithAuth(`${process.env.NEXT_PUBLIC_API_URL}/departments/${id}/restore`, {
      method: 'PATCH',
    })
    invalidateCache('departments:')
    return result
  },
}

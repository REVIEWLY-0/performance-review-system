import { getSession } from './auth'

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
}

export interface UpdateUserDto {
  name?: string
  email?: string
  role?: 'ADMIN' | 'MANAGER' | 'EMPLOYEE'
  managerId?: string
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
  getAll: async (): Promise<PaginatedResponse<User>> => {
    return fetchWithAuth(`${process.env.NEXT_PUBLIC_API_URL}/users`)
  },

  getOne: async (id: string): Promise<User> => {
    return fetchWithAuth(`${process.env.NEXT_PUBLIC_API_URL}/users/${id}`)
  },

  create: async (data: CreateUserDto): Promise<User> => {
    return fetchWithAuth(`${process.env.NEXT_PUBLIC_API_URL}/users`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  update: async (id: string, data: UpdateUserDto): Promise<User> => {
    return fetchWithAuth(`${process.env.NEXT_PUBLIC_API_URL}/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  },

  delete: async (id: string): Promise<void> => {
    return fetchWithAuth(`${process.env.NEXT_PUBLIC_API_URL}/users/${id}`, {
      method: 'DELETE',
    })
  },

  getManagers: async (): Promise<User[]> => {
    return fetchWithAuth(`${process.env.NEXT_PUBLIC_API_URL}/users/managers`)
  },

  getStats: async (): Promise<UserStats> => {
    return fetchWithAuth(`${process.env.NEXT_PUBLIC_API_URL}/users/stats`)
  },

  importUsers: async (users: any[]): Promise<{ successful: number; failed: number; errors: string[] }> => {
    return fetchWithAuth(`${process.env.NEXT_PUBLIC_API_URL}/users/import`, {
      method: 'POST',
      body: JSON.stringify({ users }),
    })
  },
}

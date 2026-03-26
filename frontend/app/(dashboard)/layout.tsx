'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { getCurrentUser, User } from '@/lib/auth'
import DashboardNav from '@/components/DashboardNav'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    async function checkAuth() {
      try {
        const currentUser = await getCurrentUser()

        if (!mounted) return

        if (!currentUser) {
          router.push('/login')
          return
        }

        setUser(currentUser)
      } catch (error) {
        console.error('❌ Layout auth check failed:', error)
        if (mounted) {
          router.push('/login')
        }
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    checkAuth()

    return () => {
      mounted = false
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-container">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-on-surface-variant">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  // Admin routes use their own layout shell (AdminSidebar)
  if (pathname?.startsWith('/admin')) {
    return <>{children}</>
  }

  return (
    <div className="min-h-screen bg-surface-container">
      <DashboardNav user={user} />
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  )
}

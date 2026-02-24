'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getCurrentUser, User } from '@/lib/auth'
import DashboardNav from '@/components/DashboardNav'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    async function checkAuth() {
      try {
        console.log('🔍 Dashboard layout: checking auth...')
        const currentUser = await getCurrentUser()

        if (!mounted) return

        if (!currentUser) {
          console.log('⚠️  No user in layout, redirecting to login')
          router.push('/login')
          return
        }

        console.log('✅ User authenticated in layout:', currentUser.email)
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
  }, [router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      <DashboardNav user={user} />
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  )
}

'use client'

import { useRouter } from 'next/navigation'
import { signOut } from '@/lib/auth'
import Logo from '@/components/Logo'
import { useTheme } from '@/components/ThemeProvider'

interface User {
  id: string
  email: string
  name: string
  role: string
  companyName: string
}

export default function DashboardNav({ user }: { user: User }) {
  const router = useRouter()
  const { theme, toggle } = useTheme()

  const handleSignOut = async () => {
    await signOut()
    router.push('/login')
  }

  return (
    <nav className="sticky top-0 z-50 bg-surface shadow-sm border-b border-outline-variant/40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center space-x-2">
            <Logo size={32} />
            <span className="text-xl font-bold font-display text-on-surface">Reviewly</span>
            {user.companyName && (
              <>
                <span className="text-outline select-none">|</span>
                <span className="text-sm font-semibold text-on-surface-variant truncate max-w-[160px]">
                  {user.companyName}
                </span>
              </>
            )}
          </div>

          <div className="flex items-center space-x-4">
            <div className="text-sm">
              <p className="font-medium text-on-surface">{user.name}</p>
              <p className="text-on-surface-variant">{user.role} • {user.companyName}</p>
            </div>

            {/* Theme toggle */}
            <button
              onClick={toggle}
              className="inline-flex items-center p-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high rounded-md transition-colors"
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? (
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
                </svg>
              ) : (
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>

            <button
              onClick={() => router.push('/settings')}
              className="inline-flex items-center p-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high rounded-md transition-colors"
              title="Settings"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>

            <button
              onClick={handleSignOut}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-on-primary bg-primary hover:bg-primary-dim transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    </nav>
  )
}

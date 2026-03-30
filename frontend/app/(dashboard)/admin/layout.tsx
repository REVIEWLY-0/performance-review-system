'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { getCurrentUser, User } from '@/lib/auth'
import Link from 'next/link'
import AdminSidebar from '@/components/admin/AdminSidebar'
import Avatar from '@/components/Avatar'
import { useTheme } from '@/components/ThemeProvider'

// ── Icons ──────────────────────────────────────────────────────────────────
const MenuIcon = () => (
  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
  </svg>
)

const SunIcon = () => (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
  </svg>
)

const MoonIcon = () => (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
  </svg>
)

// ── Page title map ─────────────────────────────────────────────────────────
const PAGE_TITLE_MAP: { prefix: string; title: string }[] = [
  { prefix: '/admin/employees',    title: 'Employees'      },
  { prefix: '/admin/review-cycles', title: 'Review Cycles' },
  { prefix: '/admin/review-types', title: 'Review Types'  },
  { prefix: '/admin/questions',    title: 'Questions'      },
  { prefix: '/admin/departments',  title: 'Departments'   },
  { prefix: '/admin/reports',      title: 'Reports'       },
  { prefix: '/admin/cycles',       title: 'Reports'       },
  { prefix: '/admin/organogram',   title: 'Organogram'    },
  { prefix: '/admin',              title: 'Admin Dashboard'},
]

function getPageTitle(pathname: string) {
  for (const { prefix, title } of PAGE_TITLE_MAP) {
    if (pathname.startsWith(prefix)) return title
  }
  return 'Admin Dashboard'
}


export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { theme, toggle } = useTheme()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    let mounted = true
    async function checkAuth() {
      try {
        const currentUser = await getCurrentUser()
        if (!mounted) return
        if (!currentUser) { router.push('/login'); return }
        if (currentUser.role !== 'ADMIN') { router.push('/employee'); return }
        setUser(currentUser)
      } catch {
        if (mounted) router.push('/login')
      } finally {
        if (mounted) setLoading(false)
      }
    }
    checkAuth()
    return () => { mounted = false }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Listen for avatar/name updates dispatched by the settings page
  useEffect(() => {
    const handler = (e: Event) => setUser((e as CustomEvent).detail)
    window.addEventListener('user-updated', handler)
    return () => window.removeEventListener('user-updated', handler)
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-container">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    )
  }

  if (!user) return null

  const pageTitle = getPageTitle(pathname ?? '')
  const sidebarUser = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    companyName: user.companyName ?? '',
  }

  return (
    <div className="flex h-screen bg-surface-container overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <AdminSidebar
        user={sidebarUser}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main content area */}
      <div className="flex flex-col flex-1 min-h-0 md:ml-64">

        {/* ── Top App Bar ──────────────────────────────────────────────── */}
        <header className="bg-surface border-b border-outline-variant sticky top-0 z-40 shrink-0">
          <div className="flex justify-between items-center w-full px-4 md:px-8 py-5">

            {/* Left: hamburger (mobile) + page title */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSidebarOpen(true)}
                className="md:hidden text-on-surface-variant hover:text-on-surface p-1 -ml-1 transition-colors"
                aria-label="Open sidebar"
              >
                <MenuIcon />
              </button>

              <span className="text-2xl font-extrabold text-on-surface font-display tracking-tight">
                {pageTitle}
              </span>
            </div>

            {/* Right: user info + theme toggle + settings + avatar */}
            <div className="flex items-center gap-2">
              {/* User name + role */}
              <div className="hidden sm:flex flex-col items-end mr-1">
                <span className="text-sm font-bold text-on-surface leading-none">{user.name}</span>
                <span className="text-[11px] font-bold text-on-surface-variant uppercase opacity-70 mt-0.5">
                  ADMIN • {user.companyName}
                </span>
              </div>

              {/* Theme toggle */}
              <button
                onClick={toggle}
                className="p-1.5 text-on-surface-variant hover:bg-surface-container rounded-full transition-colors"
                aria-label="Toggle theme"
              >
                {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
              </button>

              {/* Divider */}
              <div className="h-8 w-px bg-outline-variant mx-1" />

              {/* Avatar — click to go to settings/avatar */}
              <Link href="/settings" title="Update your profile" className="rounded-full ring-2 ring-transparent hover:ring-primary transition-all">
                <Avatar name={user.name} avatarUrl={user.avatarUrl} size="sm" />
              </Link>
            </div>
          </div>
        </header>

        {/* ── Scrollable page content ───────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto bg-surface-container-low">
          <div className="p-8 max-w-[1440px] mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}

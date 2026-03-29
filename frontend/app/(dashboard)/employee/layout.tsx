'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { getCurrentUser, signOut, User } from '@/lib/auth'
import Link from 'next/link'
import Avatar from '@/components/Avatar'
import { useTheme } from '@/components/ThemeProvider'

function Icon({ name, fill = false, className = '' }: { name: string; fill?: boolean; className?: string }) {
  return (
    <span
      className={`material-symbols-outlined select-none leading-none ${className}`}
      style={{ fontVariationSettings: `'FILL' ${fill ? 1 : 0}, 'wght' 400, 'GRAD' 0, 'opsz' 24` }}
    >
      {name}
    </span>
  )
}

const EMPLOYEE_NAV_ITEMS = [
  { label: 'Dashboard',  href: '/employee',        icon: 'dashboard',   exact: true  },
  { label: 'My Reviews', href: '/employee/reviews', icon: 'rate_review', exact: false },
  { label: 'My Scores',  href: '/employee/scores',  icon: 'query_stats', exact: false },
]

const MANAGER_NAV_ITEMS = [
  { label: 'Dashboard',    href: '/manager',          icon: 'dashboard',   exact: true  },
  { label: 'Team Reviews', href: '/manager/reviews',  icon: 'group',       exact: false },
  { label: 'My Reviews',   href: '/employee/reviews', icon: 'rate_review', exact: false },
  { label: 'My Scores',    href: '/employee/scores',  icon: 'query_stats', exact: false },
]

const EMPLOYEE_BOTTOM_NAV = [
  { label: 'Dashboard', href: '/employee',         icon: 'dashboard',   exact: true  },
  { label: 'Reviews',   href: '/employee/reviews', icon: 'rate_review', exact: false },
  { label: 'Scores',    href: '/employee/scores',  icon: 'query_stats', exact: false },
  { label: 'Settings',  href: '/settings',         icon: 'settings',    exact: false },
]

const MANAGER_BOTTOM_NAV = [
  { label: 'Dashboard', href: '/manager',          icon: 'dashboard',   exact: true  },
  { label: 'Team',      href: '/manager/reviews',  icon: 'group',       exact: false },
  { label: 'Reviews',   href: '/employee/reviews', icon: 'rate_review', exact: false },
  { label: 'Scores',    href: '/employee/scores',  icon: 'query_stats', exact: false },
  { label: 'Settings',  href: '/settings',         icon: 'settings',    exact: false },
]

export default function EmployeeLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { theme, toggle } = useTheme()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    let mounted = true
    async function checkAuth() {
      try {
        const u = await getCurrentUser()
        if (!mounted) return
        if (!u) { router.push('/login'); return }
        setUser(u)
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

  const isManager = user?.role === 'MANAGER'
  const NAV_ITEMS = isManager ? MANAGER_NAV_ITEMS : EMPLOYEE_NAV_ITEMS
  const BOTTOM_NAV = isManager ? MANAGER_BOTTOM_NAV : EMPLOYEE_BOTTOM_NAV

  const isActive = (href: string, exact: boolean) =>
    exact ? pathname === href : pathname.startsWith(href)

  const handleSignOut = async () => {
    await signOut()
    router.push('/login')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-container-low">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-surface-container-low dark:bg-[#0b1326]">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside className={[
        'fixed left-0 top-0 h-screen w-64 flex flex-col z-50',
        'bg-surface-container-highest',
        'transition-transform duration-200 ease-in-out',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
      ].join(' ')}>

        {/* Logo */}
        <div className="px-6 pt-8 pb-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-md shadow-primary/25 shrink-0">
              <Icon name="assessment" fill className="text-on-primary text-[22px]" />
            </div>
            <div>
              <p className="text-xl font-black text-primary font-display leading-tight">Reviewly</p>
              <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold leading-tight mt-0.5">
                {user.companyName}
              </p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-4 space-y-1">
          {NAV_ITEMS.map(({ label, href, icon, exact }) => {
            const active = isActive(href, exact)
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setSidebarOpen(false)}
                className={[
                  'flex items-center gap-3.5 px-4 py-3.5 rounded-xl text-[15px] font-display font-semibold transition-all duration-150',
                  active
                    ? 'bg-primary/10 dark:bg-primary/15 text-primary'
                    : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high dark:hover:bg-white/5',
                ].join(' ')}
              >
                <Icon name={icon} fill={active} className="text-[22px] shrink-0" />
                {label}
              </Link>
            )
          })}
        </nav>

        {/* Bottom */}
        <div className="px-4 pb-8 pt-4 space-y-1">
          <Link
            href="/settings"
            onClick={() => setSidebarOpen(false)}
            className="flex items-center gap-3.5 px-4 py-3.5 rounded-xl text-[15px] font-display font-semibold text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high dark:hover:bg-white/5 transition-all"
          >
            <Icon name="settings" className="text-[22px] shrink-0" />
            Settings
          </Link>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-3.5 w-full px-4 py-3.5 rounded-xl text-[15px] font-display font-semibold text-on-surface-variant hover:text-error hover:bg-error/5 transition-all"
          >
            <Icon name="logout" className="text-[22px] shrink-0" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* ── Main ───────────────────────────────────────────────────────── */}
      <div className="md:ml-64 flex flex-col min-h-screen">

        {/* Top bar — fixed so it never moves during scroll bounce */}
        <header className="fixed top-0 left-0 md:left-64 right-0 z-40 h-16 flex items-center justify-between px-5 md:px-8 bg-surface dark:bg-[#0b1326] border-b border-transparent dark:border-white/[0.06]">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="md:hidden p-1.5 -ml-1 text-on-surface-variant hover:text-on-surface"
            >
              <Icon name="menu" className="text-[24px]" />
            </button>
            <span className="md:hidden text-lg font-black text-primary font-display">Reviewly</span>
          </div>

          <div className="flex items-center gap-2">
            {/* Theme toggle */}
            <button
              onClick={toggle}
              className="p-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-container rounded-full transition-colors"
              title="Toggle theme"
            >
              <Icon name={theme === 'dark' ? 'light_mode' : 'dark_mode'} className="text-[20px]" />
            </button>

            <div className="w-px h-5 bg-outline-variant/50 mx-1" />

            {/* User pill — less round, more natural */}
            <Link
              href="/settings"
              className="flex items-center gap-2.5 bg-surface-container dark:bg-[#1e293b]/60 px-3 py-1.5 rounded-xl border border-outline-variant/40 dark:border-white/5 hover:border-primary/30 transition-colors"
            >
              <div className="text-right hidden sm:block">
                <p className="text-xs font-bold text-on-surface leading-tight">{user.name}</p>
                <p className="text-[10px] text-on-surface-variant leading-tight uppercase font-semibold">{isManager ? 'Manager' : 'Employee'}</p>
              </div>
              <Avatar name={user.name} avatarUrl={user.avatarUrl} size="sm" />
            </Link>
          </div>
        </header>

        {/* Spacer for fixed header */}
        <div className="h-16 shrink-0" />

        {/* Content */}
        <main className="flex-1 p-5 md:p-10 pb-24 md:pb-10 max-w-7xl mx-auto w-full">
          {children}
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 w-full md:hidden z-50 flex justify-around items-center h-16 bg-surface dark:bg-[#0b1326]/95 backdrop-blur-xl border-t border-outline-variant/20">
        {BOTTOM_NAV.map(({ label, href, icon, exact }) => {
          const active = isActive(href, exact)
          return (
            <Link
              key={href}
              href={href}
              className={[
                'flex flex-col items-center gap-0.5 px-3 py-1',
                active ? 'text-primary' : 'text-on-surface-variant',
              ].join(' ')}
            >
              <Icon name={icon} fill={active} className="text-[22px]" />
              <span className="text-[9px] uppercase tracking-wider font-bold font-display">{label}</span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}

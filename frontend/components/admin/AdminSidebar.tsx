'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { signOut } from '@/lib/auth'
import Logo from '@/components/Logo'

interface User {
  id: string
  email: string
  name: string
  role: string
  companyName: string
}

interface Props {
  user: User
  open: boolean
  onClose: () => void
}

// ── Inline SVG icons ───────────────────────────────────────────────────────
const DashboardIcon = () => (
  <svg className="h-5 w-5 shrink-0" fill="currentColor" viewBox="0 0 24 24">
    <path fillRule="evenodd" clipRule="evenodd" d="M3 6a3 3 0 013-3h2.25a3 3 0 013 3v2.25a3 3 0 01-3 3H6a3 3 0 01-3-3V6zm9.75 0a3 3 0 013-3H18a3 3 0 013 3v2.25a3 3 0 01-3 3h-2.25a3 3 0 01-3-3V6zM3 15.75a3 3 0 013-3h2.25a3 3 0 013 3V18a3 3 0 01-3 3H6a3 3 0 01-3-3v-2.25zm9.75 0a3 3 0 013-3H18a3 3 0 013 3V18a3 3 0 01-3 3h-2.25a3 3 0 01-3-3v-2.25z" />
  </svg>
)

const UsersIcon = () => (
  <svg className="h-5 w-5 shrink-0" fill="currentColor" viewBox="0 0 24 24">
    <path d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
  </svg>
)

const ReviewIcon = () => (
  <svg className="h-5 w-5 shrink-0" fill="currentColor" viewBox="0 0 24 24">
    <path fillRule="evenodd" clipRule="evenodd" d="M20 2H4C2.9 2 2 2.9 2 4V22L6 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2ZM12 6L12.88 8.29L15.33 8.42L13.43 9.96L14.05 12.33L12 11L9.95 12.33L10.57 9.96L8.67 8.42L11.12 8.29Z" />
  </svg>
)

const ReportsIcon = () => (
  <svg className="h-5 w-5 shrink-0" fill="currentColor" viewBox="0 0 24 24">
    <path d="M9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4zm2.5 2.1h-15V5h15v14.1zm0-16.1h-15C3.1 3 2 4.1 2 5.5v13c0 1.4 1.1 2.5 2.5 2.5h15c1.4 0 2.5-1.1 2.5-2.5v-13C23 4.1 21.9 3 20.5 3z" />
  </svg>
)

const SettingsIcon = () => (
  <svg className="h-5 w-5 shrink-0" fill="currentColor" viewBox="0 0 24 24">
    <path fillRule="evenodd" clipRule="evenodd" d="M11.078 2.25c-.917 0-1.699.663-1.85 1.567L9.05 4.889c-.02.12-.115.26-.297.348a7.493 7.493 0 00-.986.57c-.166.115-.334.126-.45.083L6.3 5.508a1.875 1.875 0 00-2.282.819l-.922 1.597a1.875 1.875 0 00.432 2.385l.84.692c.095.078.17.229.154.43a7.598 7.598 0 000 1.139c.015.2-.059.352-.153.43l-.841.692a1.875 1.875 0 00-.432 2.385l.922 1.597a1.875 1.875 0 002.282.818l1.019-.382c.115-.043.283-.031.45.082.312.214.641.405.985.57.182.088.277.228.297.35l.178 1.071c.151.904.933 1.567 1.85 1.567h1.844c.916 0 1.699-.663 1.85-1.567l.178-1.072c.02-.12.114-.26.297-.349.344-.165.673-.356.985-.57.167-.114.335-.125.45-.082l1.02.382a1.875 1.875 0 002.28-.819l.923-1.597a1.875 1.875 0 00-.432-2.385l-.84-.692c-.095-.078-.17-.229-.154-.43a7.614 7.614 0 000-1.139c-.016-.2.059-.352.153-.43l.84-.692c.708-.582.891-1.59.433-2.385l-.922-1.597a1.875 1.875 0 00-2.282-.818l-1.02.382c-.114.043-.282.031-.449-.083a7.49 7.49 0 00-.985-.57c-.183-.087-.277-.227-.297-.348l-.179-1.072a1.875 1.875 0 00-1.85-1.567h-1.843zM12 15.75a3.75 3.75 0 100-7.5 3.75 3.75 0 000 7.5z" />
  </svg>
)

const SignOutIcon = () => (
  <svg className="h-5 w-5 shrink-0" fill="currentColor" viewBox="0 0 24 24">
    <path fillRule="evenodd" clipRule="evenodd" d="M7.5 3.75A1.5 1.5 0 006 5.25v13.5a1.5 1.5 0 001.5 1.5h6a1.5 1.5 0 001.5-1.5V15a.75.75 0 011.5 0v3.75a3 3 0 01-3 3h-6a3 3 0 01-3-3V5.25a3 3 0 013-3h6a3 3 0 013 3V9A.75.75 0 0115 9V5.25a1.5 1.5 0 00-1.5-1.5h-6zm5.78 4.72a.75.75 0 010 1.06L11.56 11.25H19.5a.75.75 0 010 1.5h-7.94l1.72 1.72a.75.75 0 11-1.06 1.06l-3-3a.75.75 0 010-1.06l3-3a.75.75 0 011.06 0z" />
  </svg>
)

// ── Nav items ──────────────────────────────────────────────────────────────
const QuestionsIcon = () => (
  <svg className="h-5 w-5 shrink-0" fill="currentColor" viewBox="0 0 24 24">
    <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-7 12h-2v-2h2v2zm0-4h-2V6h2v4z" />
  </svg>
)

const NAV_ITEMS = [
  { label: 'Dashboard', href: '/admin',               exact: true,  Icon: DashboardIcon },
  { label: 'Employees', href: '/admin/employees',      exact: false, Icon: UsersIcon },
  { label: 'Reviews',   href: '/admin/review-cycles',  exact: false, Icon: ReviewIcon },
  { label: 'Questions', href: '/admin/questions',      exact: false, Icon: QuestionsIcon },
  { label: 'Reports',   href: '/admin/reports',        exact: false, Icon: ReportsIcon },
]


export default function AdminSidebar({ user, open, onClose }: Props) {
  const pathname = usePathname()
  const router = useRouter()

  const isActive = (href: string, exact: boolean) =>
    exact ? pathname === href : pathname.startsWith(href)

  const handleSignOut = async () => {
    await signOut()
    router.push('/login')
  }

  return (
    <aside
      className={[
        'fixed left-0 top-0 h-screen w-64 bg-surface-container-highest flex flex-col py-6 z-50 overflow-y-auto',
        'transition-transform duration-200 ease-in-out',
        open ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
      ].join(' ')}
    >
      {/* ── Logo ────────────────────────────────────────────────────────── */}
      <div className="px-8 mb-6">
        <div className="flex items-center gap-3">
          <Logo size={40} />
          <div className="flex flex-col min-w-0">
            <h2 className="text-lg font-extrabold font-display text-on-surface leading-tight">Reviewly</h2>
            <span className="text-sm font-semibold text-primary leading-tight">
              {user.companyName}
            </span>
          </div>
        </div>
      </div>

      {/* ── Primary nav ─────────────────────────────────────────────────── */}
      <nav className="flex-1">
        <ul className="space-y-1 pt-2">
          {NAV_ITEMS.map(({ label, href, exact, Icon }) => {
            const active = isActive(href, exact)
            return (
              <li key={href}>
                <Link
                  href={href}
                  onClick={onClose}
                  className={
                    active
                      ? 'flex items-center gap-4 bg-surface text-primary font-display font-bold text-sm rounded-l-lg ml-4 pl-4 py-3 transition-all'
                      : 'flex items-center gap-4 text-on-surface-variant hover:text-on-surface font-display font-bold text-sm px-8 py-3 hover:bg-surface-container-low transition-all'
                  }
                >
                  <Icon />
                  {label}
                </Link>
              </li>
            )
          })}
        </ul>

        {/* CTA */}
        <div className="mt-8 px-6">
          <Link
            href="/admin/review-cycles/new"
            onClick={onClose}
            className="block w-full py-3 bg-primary text-on-primary rounded-xl font-display font-bold text-xs uppercase tracking-wider shadow-lg shadow-primary/20 text-center hover:bg-primary-dim transition-colors"
          >
            New Review Cycle
          </Link>
        </div>
      </nav>

      {/* ── Bottom section ───────────────────────────────────────────────── */}
      <div className="mt-auto border-t border-outline-variant pt-4">
        <ul className="space-y-0.5">
          {/* Help */}
          <li>
            <Link
              href="/help"
              onClick={onClose}
              className="flex items-center gap-4 text-on-surface-variant hover:text-on-surface font-display font-bold text-sm px-8 py-3 transition-all"
            >
              <svg className="h-5 w-5 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z" />
              </svg>
              Help
            </Link>
          </li>

          {/* Settings */}
          <li>
            <Link
              href="/settings"
              onClick={onClose}
              className="flex items-center gap-4 text-on-surface-variant hover:text-on-surface font-display font-bold text-sm px-8 py-3 transition-all"
            >
              <SettingsIcon />
              Settings
            </Link>
          </li>

          {/* Sign Out */}
          <li>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-4 w-full text-on-surface-variant hover:text-on-surface font-display font-bold text-sm px-8 py-3 transition-all"
            >
              <SignOutIcon />
              Sign Out
            </button>
          </li>
        </ul>
      </div>
    </aside>
  )
}

import type { Metadata } from 'next'
import { Inter, Manrope } from 'next/font/google'
import './globals.css'
import Providers from '@/components/Providers'
import ThemeProvider from '@/components/ThemeProvider'
import { ToastProvider } from '@/components/ToastProvider'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
})

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-manrope',
})

export const metadata: Metadata = {
  title: 'Reviewly - Performance Review System',
  description: 'Modern performance review platform with flexible workflows',
}

// Inline script runs synchronously before first paint to prevent flash of
// unstyled content (FOUC). Reads localStorage; falls back to system preference.
const themeScript = `
(function(){
  try {
    var s = localStorage.getItem('theme');
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (s === 'dark' || (!s && prefersDark)) {
      document.documentElement.classList.add('dark');
    }
  } catch(e){}
})();
`

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      {/* eslint-disable-next-line @next/next/no-before-interactive-script-component */}
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={`${inter.variable} ${manrope.variable} ${inter.className}`}>
        <ThemeProvider>
          <ToastProvider>
            <Providers>
              {children}
            </Providers>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}

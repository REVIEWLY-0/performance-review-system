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
// unstyled content (FOUC). Reads localStorage; defaults to light if no preference saved.
const themeScript = `
(function(){
  try {
    if (localStorage.getItem('theme') === 'dark') {
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
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
          rel="stylesheet"
        />
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

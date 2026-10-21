import type { Metadata, Viewport } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import './globals.css'
import { I18nProvider } from '@/lib/i18n/I18nProvider'
import { AuthProvider } from '@/lib/auth/AuthProvider'
import { ToastProvider } from '@/components/ui/Toast'
import { AppHeader } from '@/components/layout/AppHeader'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const mono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono-lab',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'DevLab — Laboratorio de algoritmos',
    template: '%s · DevLab',
  },
  description:
    'Laboratorio interactivo para ejecutar, depurar y comparar algoritmos en Python, con historial paso a paso y analisis del estado del programa.',
  applicationName: 'DevLab',
  robots: { index: true, follow: true },
}

export const viewport: Viewport = {
  themeColor: '#07080b',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${inter.variable} ${mono.variable}`}>
      <body className="font-sans antialiased">
        <I18nProvider>
          <AuthProvider>
            <ToastProvider>
              <div className="flex min-h-dvh flex-col">
                <AppHeader />
                <main id="main-content" className="flex-1">
                  {children}
                </main>
              </div>
            </ToastProvider>
          </AuthProvider>
        </I18nProvider>
      </body>
    </html>
  )
}

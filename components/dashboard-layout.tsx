'use client'

import { useEffect } from 'react'
import { Sidebar, toggleMobileSidebar, closeMobileSidebar } from './sidebar'
import { GuestSyncPrompt } from './guest-sync-prompt'
import { setupGuestCleanup } from '@/lib/guest-storage'
import { usePathname } from 'next/navigation'

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  useEffect(() => {
    // Setup guest cleanup listener
    // This ensures guest data is cleared if user closes the site without signing in
    const cleanup = setupGuestCleanup()
    return cleanup
  }, [])

  // Close mobile sidebar when route changes
  useEffect(() => {
    closeMobileSidebar()
  }, [pathname])

  return (
    <>
      <Sidebar />
      {/* Mobile header with hamburger menu */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-30 flex items-center justify-between px-4 py-3 border-b" style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-color)' }}>
        <button
          onClick={toggleMobileSidebar}
          className="p-2 rounded-lg"
          style={{ color: 'var(--text-primary)', cursor: 'pointer' }}
          aria-label="Open menu"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>WorkStack</h1>
      </header>
      <main className="md:ml-64 p-4 md:p-8 pt-20 md:pt-8 min-h-screen" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
        <div className="w-full max-w-4xl mx-auto md:max-w-none md:mx-0">
          {children}
        </div>
        <footer className="mt-16 text-center pb-4">
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            Made with ⚡ by WorkStack • Your personal productivity companion
          </p>
        </footer>
      </main>
      <GuestSyncPrompt />
    </>
  )
}

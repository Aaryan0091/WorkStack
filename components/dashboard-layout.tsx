'use client'

import { useEffect, useState } from 'react'
import { Sidebar, toggleMobileSidebar, closeMobileSidebar, getDesktopSidebarListeners } from './sidebar'
import { GuestSyncPrompt } from './guest-sync-prompt'
import { setupGuestCleanup } from '@/lib/guest-storage'
import { usePathname } from 'next/navigation'

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  useEffect(() => {
    const savedCollapsed = localStorage.getItem('workstack_sidebar_collapsed')
    const collapseFrame = window.requestAnimationFrame(() => {
      if (savedCollapsed === 'true') {
        setSidebarCollapsed(true)
      }
    })

    // Setup guest cleanup listener
    // This ensures guest data is cleared if user closes the site without signing in
    const cleanup = setupGuestCleanup()
    return () => {
      window.cancelAnimationFrame(collapseFrame)
      cleanup()
    }
  }, [])

  // Listen for sidebar collapse changes
  useEffect(() => {
    const handleCollapseChange = (collapsed: boolean) => setSidebarCollapsed(collapsed)

    const listeners = getDesktopSidebarListeners()
    if (listeners) {
      listeners.add(handleCollapseChange)
    }

    return () => {
      if (listeners) {
        listeners.delete(handleCollapseChange)
      }
    }
  }, [])

  // Close mobile sidebar when route changes
  useEffect(() => {
    closeMobileSidebar()
  }, [pathname])

  return (
    <>
      <Sidebar />
      {/* Mobile header with hamburger menu */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-30 flex items-center justify-between px-4 py-3 mobile-header">
        <button
          onClick={toggleMobileSidebar}
          className="p-2.5 rounded-xl transition-all duration-200"
          style={{ color: 'var(--text-primary)', cursor: 'pointer', background: 'transparent' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(var(--bg-secondary-rgb), 0.5)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent'
          }}
          aria-label="Open menu"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>WorkStack</h1>
      </header>
      <main className={`p-4 md:p-8 pt-20 md:pt-8 min-h-screen relative z-0 ${sidebarCollapsed ? 'md:ml-20' : 'md:ml-64'}`} style={{ color: 'var(--text-primary)' }}>
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

'use client'

import { useEffect } from 'react'
import { Sidebar } from './sidebar'
import { GuestSyncPrompt } from './guest-sync-prompt'
import { setupGuestCleanup } from '@/lib/guest-storage'

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Setup guest cleanup listener
    // This ensures guest data is cleared if user closes the site without signing in
    const cleanup = setupGuestCleanup()
    return cleanup
  }, [])

  return (
    <>
      <Sidebar />
      <main className="ml-64 p-8 min-h-screen" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
        {children}
      </main>
      <GuestSyncPrompt />
    </>
  )
}

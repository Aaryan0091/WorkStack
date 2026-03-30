'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Modal } from '@/components/ui/modal'
import {
  LayoutDashboard,
  Bookmark,
  BookOpen,
  FolderKanban,
  BarChart3,
  Sparkles,
  Tag,
  LogOut,
  Menu,
} from 'lucide-react'

interface NavItem {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  color: string
}

const navItems: NavItem[] = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard, color: 'var(--color-indigo)' },
  { href: '/bookmarks', label: 'Bookmarks', icon: Bookmark, color: 'var(--color-sky)' },
  { href: '/reading-list', label: 'Reading List', icon: BookOpen, color: 'var(--color-amber)' },
  { href: '/collections', label: 'Collections', icon: FolderKanban, color: 'var(--color-purple)' },
  { href: '/tracked-activity', label: 'Tracked Activity', icon: BarChart3, color: 'var(--color-emerald)' },
  { href: '/smart-search', label: 'AI Smart Search', icon: Sparkles, color: 'var(--color-pink)' },
  { href: '/tags', label: 'Tags', icon: Tag, color: 'var(--color-orange)' },
]

// Simple cache for user email to avoid repeated fetches
let cachedEmail: string | null = null
let emailFetchInProgress = false

async function getCachedEmail(): Promise<string | null> {
  if (cachedEmail) return cachedEmail
  if (emailFetchInProgress) return null

  emailFetchInProgress = true
  try {
    const { data: { user } } = await supabase.auth.getUser()
    cachedEmail = user?.email || null
    return cachedEmail
  } finally {
    emailFetchInProgress = false
  }
}

// Mobile sidebar state management (global so it can be controlled from outside)
let mobileSidebarOpen = false
const mobileSidebarListeners: Set<() => void> = new Set()

// Desktop sidebar collapse state management
let desktopSidebarCollapsed = false
const desktopSidebarListeners: Set<(collapsed: boolean) => void> = new Set()

export function toggleDesktopSidebar() {
  desktopSidebarCollapsed = !desktopSidebarCollapsed
  desktopSidebarListeners.forEach(listener => listener(desktopSidebarCollapsed))
  localStorage.setItem('workstack_sidebar_collapsed', String(desktopSidebarCollapsed))
}

export function closeDesktopSidebar() {
  desktopSidebarCollapsed = true
  desktopSidebarListeners.forEach(listener => listener(true))
  localStorage.setItem('workstack_sidebar_collapsed', String(true))
}

export function openDesktopSidebar() {
  desktopSidebarCollapsed = false
  desktopSidebarListeners.forEach(listener => listener(false))
  localStorage.setItem('workstack_sidebar_collapsed', String(false))
}

export function getDesktopSidebarListeners() {
  return desktopSidebarListeners
}

export function toggleMobileSidebar() {
  mobileSidebarOpen = !mobileSidebarOpen
  mobileSidebarListeners.forEach(listener => listener())
}

export function closeMobileSidebar() {
  mobileSidebarOpen = false
  mobileSidebarListeners.forEach(listener => listener())
}

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [showLogoutModal, setShowLogoutModal] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(false)

  useEffect(() => {
    // Load collapsed state from localStorage
    const savedCollapsed = localStorage.getItem('workstack_sidebar_collapsed')
    if (savedCollapsed === 'true') {
      desktopSidebarCollapsed = true
      setIsCollapsed(true)
    }

    // Use cached email to avoid repeated fetches
    getCachedEmail().then(e => {
      if (e) setEmail(e)
    }).catch(() => {})

    // Prefetch all routes on mount for instant navigation
    navItems.forEach((item) => {
      router.prefetch(item.href)
    })

    // Listen for mobile sidebar toggle events
    const handleMobileToggle = () => setIsMobileOpen(mobileSidebarOpen)
    mobileSidebarListeners.add(handleMobileToggle)

    // Listen for desktop sidebar collapse events
    const handleDesktopCollapse = (collapsed: boolean) => setIsCollapsed(collapsed)
    desktopSidebarListeners.add(handleDesktopCollapse)

    return () => {
      mobileSidebarListeners.delete(handleMobileToggle)
      desktopSidebarListeners.delete(handleDesktopCollapse)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleLogout = async () => {
    setShowLogoutModal(true)
  }

  const confirmLogout = async () => {
    setLoggingOut(true)
    await supabase.auth.signOut()
    // Clear guest data flag to allow sync prompt again if they sign back in
    localStorage.removeItem('workstack_sync_prompt_shown')
    window.location.href = '/login'
  }

  return (
    <>
      {/* Mobile backdrop overlay */}
      <div
        className={`fixed inset-0 bg-black/50 z-40 md:hidden transition-opacity duration-300 ${
          isMobileOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={closeMobileSidebar}
      />
      <aside
        className={`${isCollapsed ? 'w-20' : 'w-64'} h-screen fixed left-0 top-0 flex flex-col z-50 transition-all duration-300 sidebar-glass ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        } md:translate-x-0`}
      >
      {isCollapsed ? (
        <div className="p-6 border-b sidebar-border flex justify-center">
          <button
            type="button"
            onClick={openDesktopSidebar}
            className="p-2.5 rounded-xl transition-all duration-200 shrink-0 relative z-10"
            style={{
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              background: 'transparent'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(var(--bg-secondary-rgb), 0.5)'
              e.currentTarget.style.color = 'var(--text-primary)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.color = 'var(--text-secondary)'
            }}
            aria-label="Open sidebar"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>
      ) : (
        <div className="p-6 border-b sidebar-border">
          <div className="flex items-center justify-between w-full shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{
                background: 'linear-gradient(135deg, var(--color-primary) 0%, #8b5cf6 100%)',
                boxShadow: '0 4px 16px rgba(59, 130, 246, 0.4)'
              }}>
                <span className="text-sm font-bold text-white">W</span>
              </div>
              <h1 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
                WorkStack
              </h1>
            </div>
            <button
              type="button"
              onClick={toggleDesktopSidebar}
              className="p-2.5 rounded-xl transition-all duration-200 shrink-0"
              style={{
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                background: 'transparent'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(var(--bg-secondary-rgb), 0.5)'
                e.currentTarget.style.color = 'var(--text-primary)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
                e.currentTarget.style.color = 'var(--text-secondary)'
              }}
              aria-label="Collapse sidebar"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center ${isCollapsed ? 'justify-center px-3' : 'gap-3 px-3'} py-3 rounded-xl transition-all duration-200 nav-item`}
              style={{
                background: isActive
                  ? `linear-gradient(135deg, ${item.color}dd, ${item.color})`
                  : 'transparent',
                color: isActive ? 'white' : 'var(--text-primary)',
                transform: isActive ? 'translateX(4px)' : 'translateX(0)',
                boxShadow: isActive ? `0 4px 12px ${item.color}40` : 'none',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  router.prefetch(item.href)
                  e.currentTarget.style.background = 'rgba(var(--bg-secondary-rgb), 0.5)'
                  e.currentTarget.style.transform = 'translateX(2px)'
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.transform = 'translateX(0)'
                }
              }}
              title={isCollapsed ? item.label : ''}
            >
              <span style={{ color: isActive ? 'white' : item.color, transition: 'color 0.2s' }}>
                <Icon className="w-6 h-6 shrink-0" />
              </span>
              {!isCollapsed && (
                <>
                  <span className="text-base font-semibold">{item.label}</span>
                  {isActive && (
                    <span className="ml-auto w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                  )}
                </>
              )}
            </Link>
          )
        })}
      </nav>

      <div className={`p-4 border-t sidebar-border ${isCollapsed ? 'justify-center' : ''}`}>
        {email && (
          <p className={`text-xs truncate mb-3 px-3 py-2 rounded-lg ${isCollapsed ? 'hidden' : ''}`} style={{
            color: 'var(--text-secondary)',
            background: 'rgba(var(--bg-secondary-rgb), 0.4)'
          }}>{email}</p>
        )}
        {email ? (
          <button
            onClick={handleLogout}
            className={`flex items-center gap-3 px-4 py-2.5 rounded-xl w-full transition-all duration-200 ${isCollapsed ? 'justify-center' : ''}`}
            style={{
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              background: 'transparent'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(var(--bg-secondary-rgb), 0.6)'
              e.currentTarget.style.color = 'var(--text-primary)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.color = 'var(--text-secondary)'
            }}
            title="Logout"
          >
            <LogOut className="w-5 h-5 shrink-0" />
            {!isCollapsed && (
              <span className="text-sm font-medium">Logout</span>
            )}
          </button>
        ) : (
          <Link
            href="/login"
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl w-full text-sm font-medium transition-all duration-200"
            style={{
              background: 'linear-gradient(135deg, var(--color-teal) 0%, #0d9488 100%)',
              color: 'white',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(13, 148, 136, 0.3)'
            }}
          >
            <span>Sign up</span>
          </Link>
        )}
      </div>

      {/* Logout Confirmation Modal */}
      <Modal isOpen={showLogoutModal} onClose={() => setShowLogoutModal(false)} title="Confirm Logout">
        <div className="space-y-5">
          {/* Header with icon */}
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full mb-3" style={{
              backgroundColor: 'rgba(249, 115, 22, 0.15)'
            }}>
              <LogOut className="w-6 h-6" style={{ color: 'var(--color-orange)' }} />
            </div>
            <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Are you sure you want to logout?</h2>
          </div>

          {/* Warning about guest data */}
          <div className="p-4 rounded-lg" style={{ backgroundColor: 'var(--bg-warm)', border: '1px solid var(--border-color)' }}>
            <div className="flex gap-3">
              <div className="flex-shrink-0">
                <span className="text-xl" style={{ color: 'var(--color-amber)' }}>⚠️</span>
              </div>
              <div>
                <p className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>Important Notice</p>
                <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                  After logging out, any activity you do <strong>without being logged in</strong> will be stored temporarily and <strong>lost when you close the browser</strong>.
                </p>
                <p className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>
                  Sign in to keep your data saved permanently in the cloud.
                </p>
              </div>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={() => setShowLogoutModal(false)}
              disabled={loggingOut}
              className="flex-1 px-4 py-2.5 rounded-lg font-medium transition-colors"
              style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              onClick={confirmLogout}
              disabled={loggingOut}
              className="flex-1 px-4 py-2.5 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
              style={{ backgroundColor: 'var(--color-danger)', color: 'white', cursor: 'pointer' }}
            >
              {loggingOut ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Logging out...
                </>
              ) : (
                <>
                  <span>Yes, Logout</span>
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>
    </aside>
    </>
  )
}

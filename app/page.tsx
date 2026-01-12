'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { DashboardLayout } from '@/components/dashboard-layout'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import type { Bookmark, Collection } from '@/lib/types'

const EXTENSION_ID = 'llahljdmcglglkcaadldnbpcpnkdinco'

export default function HomePage() {
  const router = useRouter()
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([])
  const [collections, setCollections] = useState<Collection[]>([])
  const [loading, setLoading] = useState(true)
  const [isTracking, setIsTracking] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [hasPreviousActivity, setHasPreviousActivity] = useState(false)
  const [extensionInstalled, setExtensionInstalled] = useState<boolean | null>(null)
  const [showExtensionModal, setShowExtensionModal] = useState(false)
  const [showPermissionModal, setShowPermissionModal] = useState(false)
  const [currentTab, setCurrentTab] = useState<{ url: string; title: string } | null>(null)
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    fetchData()
    checkExtensionInstalled()
    return () => {
      if (checkIntervalRef.current) clearInterval(checkIntervalRef.current)
    }
  }, [])

  const fetchData = async () => {
    const [bookmarksRes, collectionsRes] = await Promise.all([
      supabase.from('bookmarks').select('*'),
      supabase.from('collections').select('*'),
    ])
    if (!bookmarksRes.error && bookmarksRes.data) setBookmarks(bookmarksRes.data)
    if (!collectionsRes.error && collectionsRes.data) setCollections(collectionsRes.data)
    setLoading(false)
  }

  // Check if extension is installed
  const checkExtensionInstalled = () => {
    if (typeof window === 'undefined' || !(window as any).chrome?.runtime) {
      setExtensionInstalled(false)
      return
    }

    const chrome = (window as any).chrome

    // Try to ping the extension
    chrome.runtime.sendMessage(EXTENSION_ID, { action: 'ping' }, (response: any) => {
      if (chrome.runtime.lastError) {
        setExtensionInstalled(false)
      } else if (response?.success) {
        setExtensionInstalled(true)
        checkExtensionStatus()
        // Poll status every 2 seconds when tracking
        checkIntervalRef.current = setInterval(checkExtensionStatus, 2000)
      } else {
        setExtensionInstalled(false)
      }
    })
  }

  // Check extension tracking status
  const checkExtensionStatus = () => {
    const chrome = (window as any).chrome
    if (!chrome?.runtime) return

    chrome.runtime.sendMessage(EXTENSION_ID, { action: 'getStatus' }, (response: any) => {
      if (response && !chrome.runtime.lastError) {
        setIsTracking(response.isTracking)
        if (response.currentTab) {
          setCurrentTab(response.currentTab)
        } else {
          setCurrentTab(null)
        }
      }
    })
  }

  const startTracking = async () => {
    if (extensionInstalled === false) {
      setShowExtensionModal(true)
      return
    }

    // Show permission modal first
    setShowPermissionModal(true)
  }

  const confirmStartTracking = async () => {
    setShowPermissionModal(false)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }

    const { data: { session } } = await supabase.auth.getSession()
    const apiBaseUrl = window.location.origin
    const chrome = (window as any).chrome

    chrome.runtime.sendMessage(EXTENSION_ID, {
      action: 'startTracking',
      userId: user.id,
      authToken: session?.access_token,
      apiBaseUrl
    }, (response: any) => {
      if (response?.success) {
        setIsTracking(true)
        setIsPaused(false)
      }
    })
  }

  const stopTracking = () => {
    const chrome = (window as any).chrome
    if (!chrome?.runtime) return

    chrome.runtime.sendMessage(EXTENSION_ID, { action: 'stopTracking' }, (response: any) => {
      if (response?.success) {
        setIsTracking(false)
        setHasPreviousActivity(true)
        setCurrentTab(null)
      }
    })
  }

  const stats = {
    total: bookmarks.length,
    unread: bookmarks.filter(b => !b.is_read).length,
    favorites: bookmarks.filter(b => b.is_favorite).length,
    collections: collections.length,
  }

  const recentBookmarks = bookmarks.slice(0, 5)

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>
            Welcome to WorkStack
          </h1>
          <p className="mt-1" style={{ color: 'var(--text-secondary)' }}>
            Your personal bookmark manager
          </p>
        </div>

        {/* Track Activity Section */}
        <div>
          <div className="flex items-center gap-2">
            {/* Track Activity / Stop Tracking Button */}
            <button
              onClick={isTracking ? stopTracking : startTracking}
              className="px-4 py-2 rounded-lg font-medium transition-all duration-75 active:scale-90 flex items-center gap-2"
              style={{
                backgroundColor: isTracking ? '#ef4444' : 'var(--bg-secondary)',
                color: isTracking ? 'white' : 'var(--text-primary)',
                cursor: 'pointer'
              }}
            >
              {isTracking ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-white animate-pulse"></span>
                  Stop Tracking
                </>
              ) : (
                'Track Activity'
              )}
            </button>

            {/* Extension status indicator */}
            {extensionInstalled === false && (
              <span className="text-sm" style={{ color: '#f59e0b' }}>⚠️ Extension not installed</span>
            )}
            {extensionInstalled === true && !isTracking && (
              <span className="text-sm" style={{ color: '#22c55e' }}>✓ Extension ready</span>
            )}

            {/* View Tracked Activity Link */}
            {isTracking && (
              <button
                onClick={() => router.push('/tracked-activity')}
                className="px-3 py-2 rounded-lg text-sm transition-all duration-75 active:scale-90"
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  cursor: 'pointer'
                }}
              >
                View Activity
              </button>
            )}
          </div>

          {/* Current Tab Display - Shows when tracking is active */}
          {isTracking && currentTab && (
            <div className="mt-4 p-4 rounded-lg" style={{ backgroundColor: 'rgba(34, 197, 94, 0.1)', border: '1px solid #22c55e' }}>
              <p className="text-xs font-medium text-green-600 mb-1">Currently Tracking:</p>
              <p className="font-medium truncate" style={{ color: 'var(--text-primary)' }}>{currentTab.title}</p>
              <p className="text-sm truncate" style={{ color: 'var(--text-secondary)' }}>{currentTab.url}</p>
            </div>
          )}

          {/* Tracking Active Indicator */}
          {isTracking && !currentTab && (
            <div className="mt-4 p-4 rounded-lg" style={{ backgroundColor: 'rgba(34, 197, 94, 0.1)', border: '1px solid #22c55e' }}>
              <p className="text-center text-green-600">🟢 Tracking active - open some tabs!</p>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <p className="text-3xl font-bold text-blue-600">{loading ? '...' : stats.total}</p>
              <p style={{ color: 'var(--text-secondary)' }}>Total Bookmarks</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <p className="text-3xl font-bold text-orange-600">{loading ? '...' : stats.unread}</p>
              <p style={{ color: 'var(--text-secondary)' }}>To Read</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <p className="text-3xl font-bold text-yellow-600">{loading ? '...' : stats.favorites}</p>
              <p style={{ color: 'var(--text-secondary)' }}>Favorites</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <p className="text-3xl font-bold text-purple-600">{loading ? '...' : stats.collections}</p>
              <p style={{ color: 'var(--text-secondary)' }}>Collections</p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div>
          <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={() => router.push('/bookmarks')}
              className="p-6 rounded-lg text-left hover:shadow-md transition-all duration-75 hover:scale-105 active:scale-95"
              style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', cursor: 'pointer' }}
            >
              <span className="text-3xl">🔖</span>
              <h3 className="font-semibold mt-2" style={{ color: 'var(--text-primary)' }}>Add Bookmark</h3>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Save a new link</p>
            </button>
            <button
              onClick={() => router.push('/reading-list')}
              className="p-6 rounded-lg text-left hover:shadow-md transition-all duration-75 hover:scale-105 active:scale-95"
              style={{ backgroundColor: 'rgba(249, 115, 22, 0.1)', cursor: 'pointer' }}
            >
              <span className="text-3xl">📚</span>
              <h3 className="font-semibold mt-2" style={{ color: 'var(--text-primary)' }}>Reading List</h3>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{stats.unread} unread items</p>
            </button>
            <button
              onClick={() => router.push('/collections')}
              className="p-6 rounded-lg text-left hover:shadow-md transition-all duration-75 hover:scale-105 active:scale-95"
              style={{ backgroundColor: 'rgba(168, 85, 247, 0.1)', cursor: 'pointer' }}
            >
              <span className="text-3xl">📦</span>
              <h3 className="font-semibold mt-2" style={{ color: 'var(--text-primary)' }}>Collections</h3>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Organize & share</p>
            </button>
          </div>
        </div>

        {/* Recent Bookmarks */}
        <div>
          <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Recent Bookmarks</h2>
          {recentBookmarks.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center" style={{ color: 'var(--text-secondary)' }}>
                No bookmarks yet. Start by adding your first one!
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {recentBookmarks.map(bookmark => (
                <Card key={bookmark.id} className="hover:shadow-md transition-all duration-75 hover:scale-[1.02] active:scale-100" style={{ cursor: 'pointer' }}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <img
                        src={`https://www.google.com/s2/favicons?domain=${new URL(bookmark.url).hostname}&sz=32`}
                        className="w-8 h-8 rounded"
                        alt=""
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                      />
                      <div className="flex-1 min-w-0">
                        <a
                          href={bookmark.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium hover:text-blue-600 truncate block"
                          style={{ color: 'var(--text-primary)' }}
                        >
                          {bookmark.title}
                        </a>
                        <p className="text-sm truncate" style={{ color: 'var(--text-secondary)' }}>{bookmark.url}</p>
                      </div>
                      {bookmark.is_favorite && <span className="text-yellow-500">⭐</span>}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Extension Installation Modal */}
      <Modal isOpen={showExtensionModal} onClose={() => setShowExtensionModal(false)} title="Install Extension">
        <div className="space-y-4">
          <p style={{ color: 'var(--text-secondary)' }}>
            To track your browsing activity, you need to install the WorkStack Tab Tracker extension.
          </p>

          <div className="p-4 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }}>
            <h3 className="font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Installation Steps:</h3>
            <ol className="list-decimal list-inside space-y-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
              <li>Open Chrome and go to <code className="bg-gray-200 px-1 rounded">chrome://extensions/</code></li>
              <li>Enable "Developer mode" (top right toggle)</li>
              <li>Click "Load unpacked" button</li>
              <li>Select the <code className="bg-gray-200 px-1 rounded">workstack-extension</code> folder</li>
              <li>Come back and click "Track Activity" again</li>
            </ol>
          </div>

          <div className="p-4 rounded-lg" style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)' }}>
            <p className="text-sm" style={{ color: '#1e40af' }}>
              <strong>Note:</strong> The extension folder is at <code className="bg-white px-1 rounded">/Users/aaryangupta/Desktop/workstack-extension/</code>
            </p>
          </div>

          <div className="flex gap-3">
            <Button onClick={() => setShowExtensionModal(false)} className="flex-1">Got it</Button>
            <Button variant="secondary" onClick={() => {
              setShowExtensionModal(false)
              checkExtensionInstalled()
            }} className="flex-1">I've Installed It</Button>
          </div>
        </div>
      </Modal>

      {/* Permission Modal */}
      <Modal isOpen={showPermissionModal} onClose={() => setShowPermissionModal(false)} title="Allow Activity Tracking?">
        <div className="space-y-4">
          <div className="p-4 rounded-lg" style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)' }}>
            <p className="text-sm" style={{ color: '#1e40af' }}>
              <strong>🔒 Privacy Notice</strong>
            </p>
          </div>

          <p style={{ color: 'var(--text-secondary)' }}>
            WorkStack wants permission to track your browsing activity. This allows us to:
          </p>

          <ul className="space-y-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
            <li className="flex items-start gap-2">
              <span style={{ color: '#22c55e' }}>✓</span>
              <span>Track which tabs you visit and for how long</span>
            </li>
            <li className="flex items-start gap-2">
              <span style={{ color: '#22c55e' }}>✓</span>
              <span>Help you understand your browsing habits</span>
            </li>
            <li className="flex items-start gap-2">
              <span style={{ color: '#22c55e' }}>✓</span>
              <span>All data is stored privately in your account</span>
            </li>
          </ul>

          <div className="p-4 rounded-lg border" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: '#f59e0b' }}>
            <p className="text-sm" style={{ color: '#b45309' }}>
              <strong>⚠️ Important:</strong> The extension will track ALL websites you visit while tracking is enabled. You can stop tracking at any time.
            </p>
          </div>

          <div className="p-4 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }}>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              <strong>Data we collect:</strong> Website URL, page title, domain, time spent, and timestamps.<br/>
              <strong>Data we do NOT collect:</strong> Passwords, form inputs, or any personal information you type.
            </p>
          </div>

          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setShowPermissionModal(false)} className="flex-1">Cancel</Button>
            <Button onClick={confirmStartTracking} className="flex-1">Allow Tracking</Button>
          </div>
        </div>
      </Modal>
    </DashboardLayout>
  )
}

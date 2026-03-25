'use client'

import { useEffect, useState } from 'react'
import { BookmarksList } from './bookmarks-list'
import { BookmarksHeader } from './bookmarks-header'
import { DashboardLayout } from '@/components/dashboard-layout'
import { Toast } from '@/components/ui/toast'
import { supabase } from '@/lib/supabase'
import type { Bookmark, Tag } from '@/lib/types'
import {
  guestStoreGet,
  GUEST_KEYS,
  markGuestMode
} from '@/lib/guest-storage'

export default function BookmarksPage() {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [bookmarkTags, setBookmarkTags] = useState<Record<string, Tag[]>>({})
  const [loading, setLoading] = useState(true)
  const [isGuest, setIsGuest] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)
  const [importing, setImporting] = useState(false)

  const handleImport = async (data: { bookmarks: Array<{ url: string; title?: string; description?: string; notes?: string; is_favorite?: boolean; is_read?: boolean }> }) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    setImporting(true)
    let imported = 0
    let skipped = 0
    const importedUrls: string[] = []

    for (const importedBookmark of data.bookmarks) {
      // Check if URL already exists
      const { data: existing } = await supabase
        .from('bookmarks')
        .select('id')
        .eq('user_id', user.id)
        .eq('url', importedBookmark.url)
        .single()

      if (existing) {
        skipped++
        continue
      }

      // Track URL for AI tagging
      importedUrls.push(importedBookmark.url)

      // Create bookmark
      const { error } = await supabase
        .from('bookmarks')
        .insert({
          user_id: user.id,
          url: importedBookmark.url,
          title: importedBookmark.title || importedBookmark.url,
          description: importedBookmark.description || null,
          notes: importedBookmark.notes || null,
          is_favorite: importedBookmark.is_favorite || false,
          is_read: importedBookmark.is_read || false
        })

      if (!error) {
        imported++
      }
    }

    // Refresh bookmarks list
    const bookmarksRes = await supabase
      .from('bookmarks')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (bookmarksRes && bookmarksRes.data) {
      setBookmarks(bookmarksRes.data)
    }

    setImporting(false)

    // Trigger AI tagging for newly imported bookmarks
    if (imported > 0 && bookmarksRes.data) {
      const baseUrl = window.location.origin
      const newBookmarks = bookmarksRes.data.filter(b => importedUrls.includes(b.url)) || []
      await Promise.all(
        newBookmarks.map(async (b) => {
          fetch(`${baseUrl}/api/ai/auto-tag`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
            },
            body: JSON.stringify({ bookmark_id: b.id })
          }).catch((err) => {
            console.error('[Import AI Tag] Failed:', err)
          })
        })
      )
    }

    // Show toast notification
    if (imported > 0 || skipped > 0) {
      setToast({
        message: `Import complete! ${imported} imported, ${skipped} skipped (already exist)`,
        type: 'success'
      })
    } else {
      setToast({
        message: 'No bookmarks found in file',
        type: 'error'
      })
    }
  }

  useEffect(() => {
    async function fetchData() {
      // Check if user is logged in
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        // Logged in - fetch from Supabase cloud
        const [bookmarksRes, tagsRes, bookmarkTagsRes] = await Promise.all([
          supabase.from('bookmarks').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
          supabase.from('tags').select('*').eq('user_id', user.id).order('name', { ascending: true }),
          supabase.from('bookmark_tags').select('bookmark_id, tags(*)'),
        ])

        if (bookmarksRes.data) setBookmarks(bookmarksRes.data)
        if (tagsRes.data) setTags(tagsRes.data)

        const tagMap: Record<string, Tag[]> = {}
        bookmarkTagsRes.data?.forEach((bt: { bookmark_id: string; tags: Tag[] }) => {
          if (bt.tags && bt.tags.length > 0) {
            if (!tagMap[bt.bookmark_id]) tagMap[bt.bookmark_id] = []
            tagMap[bt.bookmark_id].push(...bt.tags)
          }
        })
        setBookmarkTags(tagMap)
      } else {
        // Guest mode - load from localStorage
        markGuestMode()
        try {
          const storedBookmarks = guestStoreGet<Bookmark[]>(GUEST_KEYS.BOOKMARKS)
          if (storedBookmarks) {
            setBookmarks(storedBookmarks)
          }
        } catch {
          setBookmarks([])
        }
        setIsGuest(true)
      }

      setLoading(false)
    }

    fetchData()
  }, [])

  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <BookmarksHeader isGuest={false} bookmarks={[]} />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="p-4 rounded-lg animate-pulse" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded bg-gray-300" />
                  <div className="flex-1">
                    <div className="h-4 bg-gray-300 rounded mb-2 w-3/4" />
                    <div className="h-3 bg-gray-300 rounded w-1/2" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <BookmarksHeader
          isGuest={isGuest}
          bookmarks={bookmarks}
          onImport={handleImport}
          importing={importing}
          onError={(message) => setToast({ message, type: 'error' })}
        />

        {/* Guest Mode Warning */}
        {isGuest && (
          <div className="p-3 rounded-lg text-sm flex items-center justify-between" style={{ backgroundColor: 'rgba(251, 146, 60, 0.1)', border: '1px solid rgba(251, 146, 60, 0.3)' }}>
            <span style={{ color: '#ea580c' }}>⚠️ Guest mode: Your bookmarks will be lost when you close the tab.</span>
            <a href="/login" className="px-3 py-1 rounded bg-blue-600 text-white text-sm hover:bg-blue-700 transition-colors">Sign in to save</a>
          </div>
        )}

        <BookmarksList
          initialBookmarks={bookmarks}
          initialTags={tags}
          initialBookmarkTags={bookmarkTags}
          isGuest={isGuest}
        />
      </div>

      {/* Toast Notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </DashboardLayout>
  )
}

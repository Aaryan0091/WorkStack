'use client'

import { useEffect, useState, useTransition, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import type { Bookmark, Tag } from '@/lib/types'

// In-memory cache for faster loads (30 second TTL)
const bookmarksCache = {
  data: null as { bookmarks: Bookmark[]; tags: Tag[]; bookmarkTags: Record<string, Tag[]> } | null,
  timestamp: 0,
  CACHE_TTL: 30000
}

export function BookmarksList() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const [bookmarks, setBookmarks] = useState<Bookmark[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [bookmarkTags, setBookmarkTags] = useState<Record<string, Tag[]>>({})
  const [loading, setLoading] = useState(true)

  const [modalOpen, setModalOpen] = useState(false)
  const [editingBookmark, setEditingBookmark] = useState<Bookmark | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const [formData, setFormData] = useState({
    url: '',
    title: '',
    description: '',
    notes: '',
    folder_id: '',
    tag_ids: [] as string[],
  })
  const [tagInput, setTagInput] = useState('')
  const processedUrlParams = useRef(false)

  // Tag context menu state
  const [tagContextMenu, setTagContextMenu] = useState<{ x: number; y: number; tagId: string } | null>(null)
  const [tagAdded, setTagAdded] = useState(false)

  // AI Tags state
  const [aiTags, setAiTags] = useState<Array<{ id: string; name: string; color: string; isNew: boolean }>>([])
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState('')
  const [aiFeatureEnabled, setAiFeatureEnabled] = useState(true)
  const [showAiTags, setShowAiTags] = useState(true)

  // Dead link checker state
  const [checkingLinks, setCheckingLinks] = useState(false)
  const [deadLinks, setDeadLinks] = useState<Set<string>>(new Set())
  const [linkCheckProgress, setLinkCheckProgress] = useState({ current: 0, total: 0 })

  // Handle URL parameters from extension popup or edit requests
  useEffect(() => {
    const addUrl = searchParams.get('addUrl')
    const addTitle = searchParams.get('addTitle')
    const editId = searchParams.get('edit')

    // Handle adding new bookmark from extension
    if (addUrl && !processedUrlParams.current) {
      processedUrlParams.current = true
      setFormData({
        url: decodeURIComponent(addUrl),
        title: addTitle ? decodeURIComponent(addTitle) : '',
        description: '',
        notes: '',
        folder_id: '',
        tag_ids: [],
      })
      setModalOpen(true)
      window.history.replaceState({}, '', '/bookmarks')
    }

    // Handle editing existing bookmark
    if (editId && bookmarks.length > 0 && !processedUrlParams.current) {
      processedUrlParams.current = true
      const bookmarkToEdit = bookmarks.find(b => b.id === editId)
      if (bookmarkToEdit) {
        openModal(bookmarkToEdit)
        window.history.replaceState({}, '', '/bookmarks')
      }
    }
  }, [searchParams, bookmarks])

  // Fetch all data in parallel on mount (with cache)
  useEffect(() => {
    const fetchData = async () => {
      // Check cache first
      const now = Date.now()
      if (bookmarksCache.data && now - bookmarksCache.timestamp < bookmarksCache.CACHE_TTL) {
        setBookmarks(bookmarksCache.data.bookmarks)
        setTags(bookmarksCache.data.tags)
        setBookmarkTags(bookmarksCache.data.bookmarkTags)
        setLoading(false)
        return
      }

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const [bookmarksRes, tagsRes, bookmarkTagsRes] = await Promise.all([
        supabase.from('bookmarks').select('*').order('created_at', { ascending: false }),
        supabase.from('tags').select('*').order('name', { ascending: true }),
        supabase.from('bookmark_tags').select('bookmark_id, tags(*)'),
      ])

      const newBookmarks = bookmarksRes.data || []
      const newTags = tagsRes.data || []

      const tagMap: Record<string, Tag[]> = {}
      bookmarkTagsRes.data?.forEach((bt: any) => {
        if (bt.tags) {
          if (!tagMap[bt.bookmark_id]) tagMap[bt.bookmark_id] = []
          tagMap[bt.bookmark_id].push(bt.tags)
        }
      })

      // Update cache
      bookmarksCache.data = {
        bookmarks: newBookmarks,
        tags: newTags,
        bookmarkTags: tagMap
      }
      bookmarksCache.timestamp = now

      setBookmarks(newBookmarks)
      setTags(newTags)
      setBookmarkTags(tagMap)
      setLoading(false)
    }

    fetchData()

    // Set up realtime subscription for instant updates
    let channel: any = null
    const setupRealtime = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      channel = supabase
        .channel('bookmarks-realtime', {
          config: {
            broadcast: { self: true }
          }
        })
        // Listen for bookmark changes
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'bookmarks',
            filter: `user_id=eq.${user.id}`
          },
          (payload: unknown) => {
            console.log('Bookmark change detected:', payload)
            // Invalidate cache and refresh
            bookmarksCache.data = null
            bookmarksCache.timestamp = 0
            fetchData()
          }
        )
        // Listen for bookmark_tags changes (for AI auto-tagging)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'bookmark_tags',
          },
          (payload: unknown) => {
            console.log('Bookmark tags change detected:', payload)
            bookmarksCache.data = null
            bookmarksCache.timestamp = 0
            fetchData()
          }
        )
        // Listen for tags changes (for new tags created by AI)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'tags',
            filter: `user_id=eq.${user.id}`
          },
          (payload: unknown) => {
            console.log('Tags change detected:', payload)
            bookmarksCache.data = null
            bookmarksCache.timestamp = 0
            fetchData()
          }
        )
        .subscribe((status: string) => {
          if (status === 'SUBSCRIBED') {
            console.log('Realtime: Successfully subscribed to bookmarks changes')
          }
          // Silently ignore other states - polling will handle updates
        })
    }

    setupRealtime()

    return () => {
      // Cleanup: unsubscribe when component unmounts
      if (channel) {
        supabase.removeChannel(channel)
      }
    }
  }, [])

  // Fallback: Poll for new bookmarks every 1 second (in case realtime fails)
  useEffect(() => {
    const pollInterval = setInterval(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Get latest bookmark timestamp from current state
      const latestTimestamp = bookmarks.length > 0
        ? new Date(bookmarks[0].created_at).getTime()
        : 0

      // Fetch only the most recent bookmark to check if there's something new
      const { data: latestBookmark } = await supabase
        .from('bookmarks')
        .select('id, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (latestBookmark && new Date(latestBookmark.created_at).getTime() > latestTimestamp) {
        // New bookmark detected! Wait for AI tagging to complete (1 second)
        console.log('Poll: New bookmark detected, waiting for AI tags...')
        await new Promise(resolve => setTimeout(resolve, 1000))

        console.log('Poll: Refreshing with tags...')
        bookmarksCache.data = null
        bookmarksCache.timestamp = 0
        // Fetch full data
        const [bookmarksRes, tagsRes, bookmarkTagsRes] = await Promise.all([
          supabase.from('bookmarks').select('*').order('created_at', { ascending: false }),
          supabase.from('tags').select('*').order('name', { ascending: true }),
          supabase.from('bookmark_tags').select('bookmark_id, tags(*)'),
        ])

        const newBookmarks = bookmarksRes.data || []
        const newTags = tagsRes.data || []

        const tagMap: Record<string, Tag[]> = {}
        bookmarkTagsRes.data?.forEach((bt: any) => {
          if (bt.tags) {
            if (!tagMap[bt.bookmark_id]) tagMap[bt.bookmark_id] = []
            tagMap[bt.bookmark_id].push(bt.tags)
          }
        })

        bookmarksCache.data = {
          bookmarks: newBookmarks,
          tags: newTags,
          bookmarkTags: tagMap
        }
        bookmarksCache.timestamp = Date.now()

        setBookmarks(newBookmarks)
        setTags(newTags)
        setBookmarkTags(tagMap)
      }
    }, 1000) // Check every 1 second

    return () => clearInterval(pollInterval)
  }, [bookmarks])

  // Check AI feature availability on mount
  useEffect(() => {
    const checkAiStatus = async () => {
      try {
        const res = await fetch('/api/ai/suggest-tags')
        const data = await res.json()
        setAiFeatureEnabled(data.enabled)
      } catch {
        setAiFeatureEnabled(false)
      }
    }
    checkAiStatus()
  }, [])

  // Generate AI tags when URL or title changes (for new bookmarks only)
  useEffect(() => {
    const generateAiTags = async () => {
      // Clear previous error when starting new request
      setAiError('')

      if (!editingBookmark && formData.url && aiFeatureEnabled && (formData.title || formData.url)) {
        setAiLoading(true)

        try {
          const { data: { session } } = await supabase.auth.getSession()
          const token = session?.session?.access_token

          const res = await fetch('/api/ai/suggest-tags', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
              url: formData.url,
              title: formData.title,
              description: formData.description,
            }),
          })

          if (!res.ok) {
            const error = await res.json()
            throw new Error(error.error || 'Failed to get suggestions')
          }

          const data = await res.json()
          setAiTags(data.suggested || [])

          // Auto-add AI tags to selected tags
          if (data.suggested && data.suggested.length > 0) {
            const newTagIds = data.suggested.map((t: any) => t.id)
            setFormData((prev) => ({
              ...prev,
              tag_ids: [...new Set([...prev.tag_ids, ...newTagIds])],
            }))
          }
        } catch (err) {
          console.error('AI tag error:', err)
          // Show error to user
          setAiError(err instanceof Error ? err.message : 'Failed to generate AI tags')
          setAiTags([])
        } finally {
          setAiLoading(false)
        }
      }
    }

    // Debounce the AI tag generation
    const timer = setTimeout(() => {
      generateAiTags()
    }, 800)

    return () => clearTimeout(timer)
  }, [formData.url, formData.title, formData.description, editingBookmark, aiFeatureEnabled])

  const filteredBookmarks = bookmarks.filter(b => {
    const matchesSearch =
      !searchQuery ||
      b.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.url.toLowerCase().includes(searchQuery.toLowerCase())

    const favoriteFilter = searchParams.get('favorite')
    const matchesFavorite = favoriteFilter !== 'true' || b.is_favorite

    const readingListFilter = searchParams.get('readingList')
    const matchesReadingList = readingListFilter !== 'true' || !b.is_read

    const deadLinksFilter = searchParams.get('deadLinks')
    const matchesDeadLinks = deadLinksFilter !== 'true' || deadLinks.has(b.id)

    return matchesSearch && matchesFavorite && matchesReadingList && matchesDeadLinks
  })

  const updateCache = () => {
    // Invalidate cache when data changes
    bookmarksCache.data = null
    bookmarksCache.timestamp = 0
  }

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value) params.set(key, value)
    else params.delete(key)
    startTransition(() => router.push(`/bookmarks?${params.toString()}`))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const bookmarkData = {
      url: formData.url,
      title: formData.title || new URL(formData.url).hostname,
      description: formData.description || null,
      notes: formData.notes || null,
      folder_id: formData.folder_id || null,
    }

    if (editingBookmark) {
      const { data } = await supabase.from('bookmarks').update(bookmarkData).eq('id', editingBookmark.id).select()
      if (data) {
        const updatedBookmarks = bookmarks.map(b => b.id === editingBookmark.id ? { ...b, ...data[0] } : b)
        setBookmarks(updatedBookmarks)
        // Update cache
        if (bookmarksCache.data) {
          bookmarksCache.data.bookmarks = updatedBookmarks
        }
      }
      // Update UI immediately (optimistic update)
      const updatedTags = formData.tag_ids.map(tagId => tags.find(t => t.id === tagId)).filter((t): t is Tag => !!t)
      setBookmarkTags(prev => ({ ...prev, [editingBookmark.id]: updatedTags }))
      // Update cache
      if (bookmarksCache.data) {
        bookmarksCache.data.bookmarkTags = { ...bookmarksCache.data.bookmarkTags, [editingBookmark.id]: updatedTags }
      }
      // Fire and forget - don't wait for DB operations
      supabase.from('bookmark_tags').delete().eq('bookmark_id', editingBookmark.id).then(() => {
        if (formData.tag_ids.length > 0) {
          return supabase.from('bookmark_tags').insert(
            formData.tag_ids.map(tagId => ({ bookmark_id: editingBookmark.id, tag_id: tagId }))
          )
        }
      }).catch((err: unknown) => console.error('Tag update error:', err))
    } else {
      const { data } = await supabase.from('bookmarks').insert({ ...bookmarkData, user_id: user.id }).select()
      if (data) {
        const bookmarkId = data[0].id
        const updatedBookmarks = [data[0], ...bookmarks]
        setBookmarks(updatedBookmarks)
        // Update cache
        if (bookmarksCache.data) {
          bookmarksCache.data.bookmarks = updatedBookmarks
        }
        // Update UI immediately (optimistic update)
        const newTags = formData.tag_ids.map(tagId => tags.find(t => t.id === tagId)).filter((t): t is Tag => !!t)
        setBookmarkTags(prev => ({ ...prev, [bookmarkId]: newTags }))
        // Fire and forget - don't wait for DB operations
        if (formData.tag_ids.length > 0) {
          supabase.from('bookmark_tags').insert(
            formData.tag_ids.map(tagId => ({ bookmark_id: bookmarkId, tag_id: tagId }))
          ).catch((err: unknown) => console.error('Tag insert error:', err))
        }
      }
    }
    closeModal()
  }

  const toggleFavorite = async (bookmark: Bookmark) => {
    await supabase.from('bookmarks').update({ is_favorite: !bookmark.is_favorite }).eq('id', bookmark.id)
    const updatedBookmarks = bookmarks.map(b => b.id === bookmark.id ? { ...b, is_favorite: !b.is_favorite } : b)
    setBookmarks(updatedBookmarks)
    // Update cache
    if (bookmarksCache.data) {
      bookmarksCache.data.bookmarks = updatedBookmarks
    }
  }

  const toggleRead = async (bookmark: Bookmark) => {
    await supabase.from('bookmarks').update({ is_read: !bookmark.is_read }).eq('id', bookmark.id)
    const updatedBookmarks = bookmarks.map(b => b.id === bookmark.id ? { ...b, is_read: !b.is_read } : b)
    setBookmarks(updatedBookmarks)
    // Update cache
    if (bookmarksCache.data) {
      bookmarksCache.data.bookmarks = updatedBookmarks
    }
  }

  const deleteBookmark = async (id: string) => {
    await supabase.from('bookmarks').delete().eq('id', id)
    const updatedBookmarks = bookmarks.filter(b => b.id !== id)
    setBookmarks(updatedBookmarks)
    // Update cache
    if (bookmarksCache.data) {
      bookmarksCache.data.bookmarks = updatedBookmarks
    }
  }

  const openModal = async (bookmark?: Bookmark) => {
    if (bookmark) {
      setEditingBookmark(bookmark)
      const { data } = await supabase.from('bookmark_tags').select('tag_id').eq('bookmark_id', bookmark.id)
      const tagIds = data?.map((bt: any) => bt.tag_id) || []
      setFormData({
        url: bookmark.url,
        title: bookmark.title,
        description: bookmark.description || '',
        notes: bookmark.notes || '',
        folder_id: bookmark.folder_id || '',
        tag_ids: tagIds,
      })
    } else {
      setEditingBookmark(null)
      setFormData({ url: '', title: '', description: '', notes: '', folder_id: '', tag_ids: [] })
    }
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setEditingBookmark(null)
    setAiTags([])
    setAiError('')
    setShowAiTags(true)
  }

  const addTag = async () => {
    if (!tagInput.trim()) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase.from('tags').insert({ name: tagInput.trim(), user_id: user.id }).select()
    if (data) {
      setTags([...tags, data[0]])
      setFormData({ ...formData, tag_ids: [...formData.tag_ids, data[0].id] })
      setTagInput('')
      setTagAdded(true)
      setTimeout(() => setTagAdded(false), 300)
    }
  }

  const deleteTag = async (tagId: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase.from('tags').delete().eq('id', tagId).eq('user_id', user.id)
    setTags(tags.filter(t => t.id !== tagId))
    setFormData({ ...formData, tag_ids: formData.tag_ids.filter(id => id !== tagId) })
    setTagContextMenu(null)
  }

  const handleTagRightClick = (e: React.MouseEvent, tagId: string) => {
    e.preventDefault()
    setTagContextMenu({ x: e.clientX, y: e.clientY, tagId })
  }

  // Check all links for dead bookmarks
  const checkAllLinks = async () => {
    setCheckingLinks(true)
    setDeadLinks(new Set())
    setLinkCheckProgress({ current: 0, total: bookmarks.length })

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.session?.access_token

      const response = await fetch('/api/check-links', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        throw new Error('Failed to check links')
      }

      const data = await response.json()

      // Update progress as we process results
      const dead = new Set<string>()
      data.results?.forEach((result: any) => {
        setLinkCheckProgress(prev => ({ ...prev, current: prev.current + 1 }))
        if (!result.alive) {
          dead.add(result.id)
        }
      })

      setDeadLinks(dead)
    } catch (error) {
      console.error('Link check error:', error)
    } finally {
      setCheckingLinks(false)
      setLinkCheckProgress({ current: 0, total: 0 })
    }
  }

  // Check a single link
  const checkSingleLink = async (bookmark: Bookmark) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.session?.access_token

      const response = await fetch('/api/check-links', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ bookmarkId: bookmark.id }),
      })

      if (!response.ok) return

      const data = await response.json()

      if (!data.alive) {
        setDeadLinks(prev => new Set(prev).add(bookmark.id))
      } else {
        setDeadLinks(prev => {
          const newSet = new Set(prev)
          newSet.delete(bookmark.id)
          return newSet
        })
      }
    } catch (error) {
      console.error('Single link check error:', error)
    }
  }

  // Delete all dead links
  const deleteAllDeadLinks = async () => {
    if (deadLinks.size === 0) return

    if (!confirm(`Delete ${deadLinks.size} dead bookmark${deadLinks.size > 1 ? 's' : ''}?`)) {
      return
    }

    for (const id of deadLinks) {
      await supabase.from('bookmarks').delete().eq('id', id)
    }

    const updatedBookmarks = bookmarks.filter(b => !deadLinks.has(b.id))
    setBookmarks(updatedBookmarks)

    // Update cache
    if (bookmarksCache.data) {
      bookmarksCache.data.bookmarks = updatedBookmarks
    }

    setDeadLinks(new Set())
  }

  return (
    <>
      {/* Show loading skeleton while fetching */}
      {loading ? (
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
      ) : (
        <>
          {/* Filters */}
          <div className="flex gap-4 flex-wrap items-center">
            <Input
              placeholder="Search bookmarks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-64"
            />
            <button
              onClick={() => {
                const current = searchParams.get('favorite')
                updateFilter('favorite', current === 'true' ? '' : 'true')
              }}
              className={`px-4 py-2 rounded-lg font-medium transition-all duration-75 active:scale-90 ${searchParams.get('favorite') === 'true' ? 'bg-yellow-100 text-yellow-800' : ''}`}
              style={{ cursor: 'pointer', backgroundColor: searchParams.get('favorite') === 'true' ? undefined : 'var(--bg-secondary)', color: searchParams.get('favorite') === 'true' ? undefined : 'var(--text-primary)' }}
            >
              {searchParams.get('favorite') === 'true' ? '⭐ Favorites' : 'Favorites'}
            </button>
            <button
              onClick={() => {
                const current = searchParams.get('readingList')
                updateFilter('readingList', current === 'true' ? '' : 'true')
              }}
              className={`px-4 py-2 rounded-lg font-medium transition-all duration-75 active:scale-90 ${searchParams.get('readingList') === 'true' ? 'bg-blue-100 text-blue-800' : ''}`}
              style={{ cursor: 'pointer', backgroundColor: searchParams.get('readingList') === 'true' ? undefined : 'var(--bg-secondary)', color: searchParams.get('readingList') === 'true' ? undefined : 'var(--text-primary)' }}
            >
              {searchParams.get('readingList') === 'true' ? '📚 Reading List' : 'Reading List'}
            </button>

            {/* Dead Links Checker */}
            <div className="flex gap-2 items-center border-l pl-4" style={{ borderColor: 'var(--border-color)' }}>
              {deadLinks.size > 0 && (
                <button
                  onClick={deleteAllDeadLinks}
                  className="px-3 py-2 rounded-lg font-medium text-red-600 hover:bg-red-50 transition-all duration-75 active:scale-90"
                  style={{ cursor: 'pointer' }}
                  title={`Delete ${deadLinks.size} dead bookmark${deadLinks.size > 1 ? 's' : ''}`}
                >
                  🗑️ Delete ({deadLinks.size})
                </button>
              )}
              <button
                onClick={() => {
                  const current = searchParams.get('deadLinks')
                  updateFilter('deadLinks', current === 'true' ? '' : 'true')
                }}
                className={`px-4 py-2 rounded-lg font-medium transition-all duration-75 active:scale-90 ${searchParams.get('deadLinks') === 'true' ? 'bg-red-100 text-red-800' : ''}`}
                style={{ cursor: 'pointer', backgroundColor: searchParams.get('deadLinks') === 'true' ? undefined : 'var(--bg-secondary)', color: searchParams.get('deadLinks') === 'true' ? undefined : 'var(--text-primary)' }}
                disabled={deadLinks.size === 0}
              >
                {searchParams.get('deadLinks') === 'true' ? `❌ Dead Links (${deadLinks.size})` : `Dead Links${deadLinks.size > 0 ? ` (${deadLinks.size})` : ''}`}
              </button>
              <button
                onClick={checkAllLinks}
                disabled={checkingLinks}
                className="px-4 py-2 rounded-lg font-medium transition-all duration-75 active:scale-90 disabled:opacity-50"
                style={{ cursor: checkingLinks ? 'not-allowed' : 'pointer', backgroundColor: 'var(--accent)', color: 'white' }}
              >
                {checkingLinks
                  ? `Checking... ${linkCheckProgress.current > 0 ? `${linkCheckProgress.current}/${linkCheckProgress.total}` : ''}`
                  : '🔍 Check Links'
                }
              </button>
            </div>
          </div>

          {/* Dead links warning banner */}
          {deadLinks.size > 0 && searchParams.get('deadLinks') !== 'true' && (
            <div className="px-4 py-3 rounded-lg flex items-center justify-between" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
              <span style={{ color: 'var(--text-primary)' }}>
                ⚠️ Found <strong>{deadLinks.size}</strong> dead link{deadLinks.size > 1 ? 's' : ''}. Some bookmarks may be broken.
              </span>
              <button
                onClick={() => updateFilter('deadLinks', 'true')}
                className="px-3 py-1 rounded text-sm font-medium"
                style={{ backgroundColor: 'rgba(239, 68, 68, 0.2)', color: '#dc2626', cursor: 'pointer' }}
              >
                View Dead Links
              </button>
            </div>
          )}

      {/* Bookmarks Grid */}
      {filteredBookmarks.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center" style={{ color: 'var(--text-secondary)' }}>
            No bookmarks found. Add your first bookmark!
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredBookmarks.map(bookmark => {
            const isDead = deadLinks.has(bookmark.id)
            return (
              <Card
                key={bookmark.id}
                style={{
                  border: isDead ? '2px solid #ef4444' : undefined,
                  opacity: isDead ? 0.8 : 1
                }}
              >
                <CardContent className="p-4">
                  {/* Dead Link Badge */}
                  {isDead && (
                    <div className="flex items-center justify-center mb-2 py-1 rounded text-xs font-medium" style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#dc2626' }}>
                      ❌ Link is dead or broken
                    </div>
                  )}
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded flex items-center justify-center text-sm font-semibold" style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)', minWidth: '32px' }}>
                      <img
                        src={`https://www.google.com/s2/favicons?domain=${new URL(bookmark.url).hostname}&sz=32`}
                        className="w-8 h-8 rounded"
                        alt=""
                        style={{ display: 'block' }}
                        onError={(e) => {
                          const img = e.target as HTMLImageElement
                          img.style.display = 'none'
                          // Show first letter fallback
                          const parent = img.parentElement as HTMLElement
                          if (parent && parent.dataset.fallback !== 'true') {
                            parent.textContent = bookmark.title?.charAt(0).toUpperCase() || new URL(bookmark.url).hostname.charAt(0).toUpperCase()
                            parent.dataset.fallback = 'true'
                          }
                        }}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <a
                        href={bookmark.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium hover:text-blue-600 truncate block"
                        style={{ color: 'var(--text-primary)' }}
                        onClick={() => !bookmark.is_read && toggleRead(bookmark)}
                      >
                        {bookmark.title}
                      </a>
                      <p className="text-sm truncate" style={{ color: 'var(--text-secondary)' }}>{bookmark.url}</p>
                      {bookmark.description && (
                        <p className="text-sm mt-2 line-clamp-2" style={{ color: 'var(--text-secondary)' }}>{bookmark.description}</p>
                      )}
                      <div className="flex gap-2 mt-2 flex-wrap">
                        {bookmarkTags[bookmark.id]?.map(tag => (
                          <span key={tag.id} className="text-xs px-2 py-1 rounded-full" style={{ backgroundColor: tag.color + '20', color: tag.color }}>
                            {tag.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4 pt-4 border-t" style={{ borderColor: 'var(--border-color)' }}>
                    <button
                      onClick={() => toggleFavorite(bookmark)}
                      className={`p-2 rounded transition-all duration-75 active:scale-90 ${bookmark.is_favorite ? 'text-yellow-500' : 'text-gray-400 hover:text-yellow-500'}`}
                      style={{ cursor: 'pointer' }}
                      title="Toggle favorite"
                    >
                      <svg className="w-5 h-5" fill={bookmark.is_favorite ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => toggleRead(bookmark)}
                      className={`p-2 rounded-lg transition-all duration-75 active:scale-90 ${
                        !bookmark.is_read
                          ? 'text-blue-600'
                          : 'text-gray-400 hover:text-blue-600'
                      }`}
                      style={{ cursor: 'pointer' }}
                      title={!bookmark.is_read ? 'In Reading List' : 'Add to Reading List'}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                      </svg>
                    </button>
                    <button
                      onClick={() => checkSingleLink(bookmark)}
                      className="p-2 text-gray-400 hover:text-green-600 rounded transition-all duration-75 active:scale-90"
                      style={{ cursor: 'pointer' }}
                      title="Check if link is alive"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => openModal(bookmark)}
                      className="p-2 text-gray-400 hover:text-blue-600 rounded transition-all duration-75 active:scale-90"
                      style={{ cursor: 'pointer' }}
                      title="Edit bookmark"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => deleteBookmark(bookmark.id)}
                      className="p-2 text-gray-400 hover:text-red-600 rounded transition-all duration-75 active:scale-90"
                      style={{ cursor: 'pointer' }}
                      title="Delete bookmark"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal isOpen={modalOpen} onClose={closeModal} title={editingBookmark ? 'Edit Bookmark' : 'Add Bookmark'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="URL"
            placeholder="https://example.com"
            value={formData.url}
            onChange={(e) => setFormData({ ...formData, url: e.target.value })}
            required
          />
          <Input
            label="Title"
            placeholder="Bookmark title"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          />
          <Textarea
            label="Description"
            placeholder="Brief description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows={2}
          />
          <Textarea
            label="Notes"
            placeholder="Your notes"
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            rows={3}
          />
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Tags</label>
            <div className="flex gap-2 mb-2">
              <Input
                placeholder="New tag name"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                className="flex-1"
              />
              <Button
                type="button"
                onClick={addTag}
                variant="secondary"
                className="!active:scale-100 !focus:ring-0 !focus:ring-offset-0"
                style={{
                  backgroundColor: tagAdded ? 'rgba(34, 197, 94, 0.3)' : undefined,
                  transition: 'background-color 0.2s ease'
                }}
              >
                Add
              </Button>
            </div>
            <div
              className="flex flex-wrap gap-2 overflow-y-auto pr-1 tags-scroll-container"
              style={{
                maxHeight: '5.5rem',
                scrollbarWidth: 'thin',
                scrollbarColor: 'rgba(156, 163, 175, 0.5) transparent'
              }}
            >
              {tags
                .filter(tag => tag.name.toLowerCase().includes(tagInput.toLowerCase()))
                .sort((a, b) => {
                  const aSelected = formData.tag_ids.includes(a.id)
                  const bSelected = formData.tag_ids.includes(b.id)
                  if (aSelected && !bSelected) return -1
                  if (!aSelected && bSelected) return 1
                  return 0
                })
                .map(tag => (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => {
                      if (formData.tag_ids.includes(tag.id)) {
                        setFormData({ ...formData, tag_ids: formData.tag_ids.filter(id => id !== tag.id) })
                      } else {
                        setFormData({ ...formData, tag_ids: [...formData.tag_ids, tag.id] })
                      }
                    }}
                    onContextMenu={(e) => handleTagRightClick(e, tag.id)}
                    className={`px-3 py-1 rounded-full text-sm transition-all duration-75 active:scale-90 ${formData.tag_ids.includes(tag.id) ? 'ring-2 ring-offset-2' : ''}`}
                    style={{ backgroundColor: tag.color + '20', color: tag.color, cursor: 'pointer' }}
                  >
                    {tag.name}
                  </button>
                ))}
            </div>
          </div>

          {/* AI Tags Section */}
          {!editingBookmark && aiFeatureEnabled && (
            <div className="border-t pt-4" style={{ borderColor: 'var(--border-color)' }}>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                  <span className="flex items-center gap-2">
                    <span>🤖</span>
                    <span>AI Tags</span>
                    {aiLoading && <span className="text-xs opacity-60">(generating...)</span>}
                  </span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowAiTags(!showAiTags)}
                  className="text-xs px-2 py-1 rounded"
                  style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)', cursor: 'pointer' }}
                >
                  {showAiTags ? 'Hide' : 'Show'}
                </button>
              </div>

              {showAiTags && (
                <>
                  {aiError && (
                    <p className="text-xs py-2 text-red-500">
                      {aiError}
                    </p>
                  )}

                  {aiLoading && !aiError && (
                    <div className="flex items-center gap-2 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      AI is generating tags...
                    </div>
                  )}

                  {!aiLoading && !aiError && aiTags.length > 0 && (
                    <div className="mb-3">
                      <p className="text-xs mb-2" style={{ color: 'var(--text-secondary)' }}>
                        AI suggested {aiTags.length} tag{aiTags.length !== 1 ? 's' : ''} (auto-selected):
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {aiTags.map(tag => (
                          <button
                            key={tag.id}
                            type="button"
                            onClick={() => {
                              if (formData.tag_ids.includes(tag.id)) {
                                setFormData({ ...formData, tag_ids: formData.tag_ids.filter(id => id !== tag.id) })
                              } else {
                                setFormData({ ...formData, tag_ids: [...formData.tag_ids, tag.id] })
                              }
                            }}
                            className="flex items-center gap-1 px-2 py-1 rounded-full text-xs transition-all duration-75 active:scale-90"
                            style={{
                              backgroundColor: tag.color + '20',
                              color: tag.color,
                              border: formData.tag_ids.includes(tag.id) ? `2px solid ${tag.color}` : '1px solid transparent',
                              cursor: 'pointer',
                            }}
                          >
                            <span>{tag.name}</span>
                            {tag.isNew && (
                              <span className="text-[10px] opacity-60">new</span>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {!aiLoading && !aiError && aiTags.length === 0 && (
                    <p className="text-xs py-2" style={{ color: 'var(--text-secondary)' }}>
                      {formData.url
                        ? 'AI is analyzing the URL to suggest tags...'
                        : 'Enter a URL above and AI will suggest tags automatically'}
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={closeModal} className="flex-1">Cancel</Button>
            <Button type="submit" className="flex-1">{editingBookmark ? 'Update' : 'Add'} Bookmark</Button>
          </div>
        </form>
      </Modal>

      {/* Hidden button for programmatic clicks */}
      <button
        id="add-bookmark-btn"
        onClick={() => openModal()}
        style={{ display: 'none' }}
      />

      {/* Tag Context Menu */}
      {tagContextMenu && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setTagContextMenu(null)}
          />
          <div
            className="fixed z-50 p-2 rounded-lg shadow-lg"
            style={{
              left: `${tagContextMenu.x}px`,
              top: `${tagContextMenu.y}px`,
              backgroundColor: 'var(--bg-primary)',
              border: '1px solid var(--border-color)',
              minWidth: '120px'
            }}
          >
            <button
              type="button"
              onClick={() => deleteTag(tagContextMenu.tagId)}
              className="w-full px-3 py-2 text-left text-sm rounded transition-colors"
              style={{ color: 'var(--text-primary)', cursor: 'pointer' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#fecaca'
                e.currentTarget.style.color = '#dc2626'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent'
                e.currentTarget.style.color = 'var(--text-primary)'
              }}
            >
              Delete Tag
            </button>
          </div>
        </>
      )}
        </>
      )}
    </>
  )
}

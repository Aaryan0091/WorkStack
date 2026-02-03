'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import type { Collection, Bookmark } from '@/lib/types'
import {
  guestStoreGet,
  guestStoreSet,
  guestStoreRemove,
  GUEST_KEYS,
  markGuestMode
} from '@/lib/guest-storage'

// Cache for faster loads
const collectionsCache = {
  data: null as { collections: Collection[]; collectionBookmarks: Record<string, Bookmark[]> } | null,
  timestamp: 0,
  CACHE_TTL: 5000 // 5 seconds - reduced for fresher data
}

interface CollectionsContentProps {
  searchQuery: string
  setSearchQuery: (query: string) => void
}

export function CollectionsContent({ searchQuery, setSearchQuery }: CollectionsContentProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [collections, setCollections] = useState<Collection[]>([])
  const [collectionBookmarks, setCollectionBookmarks] = useState<Record<string, Bookmark[]>>({})
  const [loading, setLoading] = useState(true)
  const [availableBookmarks, setAvailableBookmarks] = useState<Bookmark[]>([])
  const [isGuest, setIsGuest] = useState(false)
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'count'>('date')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  const [modalOpen, setModalOpen] = useState(false)
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [mergeModalOpen, setMergeModalOpen] = useState(false)
  const [selectCollectionModalOpen, setSelectCollectionModalOpen] = useState(false)
  const [selectedCollection, setSelectedCollection] = useState<Collection | null>(null)
  const [collectionToDelete, setCollectionToDelete] = useState<Collection | null>(null)
  const [collectionToMerge, setCollectionToMerge] = useState<Collection | null>(null)
  const [mergeTargetCollectionId, setMergeTargetCollectionId] = useState('')
  const [editingCollection, setEditingCollection] = useState<Collection | null>(null)
  const [pendingBookmark, setPendingBookmark] = useState<{ url: string; title: string } | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    is_public: false,
  })

  // New bookmark form state for adding to collection
  const [newBookmarkUrl, setNewBookmarkUrl] = useState('')
  const [newBookmarkTitle, setNewBookmarkTitle] = useState('')
  const [showNewBookmarkForm, setShowNewBookmarkForm] = useState(false)

  // Multi-select state for adding bookmarks to collection
  const [selectedBookmarkIds, setSelectedBookmarkIds] = useState<Set<string>>(new Set())
  const [bookmarkFilterType, setBookmarkFilterType] = useState<'all' | 'favorites' | 'reading-list'>('all')
  const [bookmarkSearchQuery, setBookmarkSearchQuery] = useState('')

  // Toast notification state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)

  // Import collection modal state
  const [importModalOpen, setImportModalOpen] = useState(false)
  const [importUrl, setImportUrl] = useState('')
  const [importLoading, setImportLoading] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      // Check if user is logged in
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        // Guest mode - load from localStorage
        setIsGuest(true)
        markGuestMode() // Mark user as guest mode
        try {
          let storedCollections = guestStoreGet(GUEST_KEYS.COLLECTIONS)
          const storedBookmarks = guestStoreGet(GUEST_KEYS.BOOKMARKS)
          if (storedCollections) {
            const parsedCollections = storedCollections
            setCollections(parsedCollections)
            // Build collectionBookmarks from guest bookmarks
            if (storedBookmarks) {
              const parsedBookmarks: Bookmark[] = storedBookmarks
              const bookmarksMap: Record<string, Bookmark[]> = {}
              parsedCollections.forEach((c: Collection) => {
                bookmarksMap[c.id] = parsedBookmarks
                  .filter((b: Bookmark) => b.collection_id === c.id)
                  .slice(0, 3)
              })
              setCollectionBookmarks(bookmarksMap)
            }
          } else {
            // Create default collection for guest
            const defaultCollection: Collection = {
              id: crypto.randomUUID(),
              user_id: '',
              name: 'My Collection',
              description: 'Your first collection',
              is_public: false,
              share_slug: 'my-collection-' + crypto.randomUUID().substr(0, 8),
              created_at: new Date().toISOString()
            }
            guestStoreSet(GUEST_KEYS.COLLECTIONS, [defaultCollection])
            setCollections([defaultCollection])
            setCollectionBookmarks({ [defaultCollection.id]: [] })
          }
        } catch (e) {
          console.error('Error loading guest data:', e)
        }
        setLoading(false)
        return
      }

      // Check cache first for logged-in users
      const now = Date.now()
      if (collectionsCache.data && now - collectionsCache.timestamp < collectionsCache.CACHE_TTL) {
        setCollections(collectionsCache.data.collections)
        setCollectionBookmarks(collectionsCache.data.collectionBookmarks)
        setLoading(false)
        return
      }

      // Only fetch collections first (fast)
      const { data: collectionsData } = await supabase
        .from('collections')
        .select('*')
        .order('created_at', { ascending: false })

      if (collectionsData) {
        // Create default collection if none exists
        if (collectionsData.length === 0) {
          const { data: newCollection } = await supabase
            .from('collections')
            .insert({
              name: 'My Collection',
              description: 'Your first collection',
              is_public: false,
              share_slug: `my-collection-${crypto.randomUUID().substr(0, 8)}`,
            })
            .select()
            .single()

          if (newCollection) {
            collectionsData.unshift(newCollection)
          }
        }
        setCollections(collectionsData)

        // Then fetch only first 3 bookmarks per collection for preview (in parallel)
        // Use junction table for many-to-many relationship
        const bookmarkPromises = collectionsData.map(async (collection: Collection) => {
          const { data } = await supabase
            .from('collection_bookmarks')
            .select('bookmark_id, bookmarks(*)')
            .eq('collection_id', collection.id)
            .limit(3)

          const bookmarks = data?.map((jb: any) => jb.bookmarks).filter(Boolean) || []
          return { collectionId: collection.id, bookmarks }
        })

        const results = await Promise.all(bookmarkPromises)
        const bookmarksMap: Record<string, Bookmark[]> = {}
        results.forEach(({ collectionId, bookmarks }) => {
          bookmarksMap[collectionId] = bookmarks
        })

        setCollectionBookmarks(bookmarksMap)

        // Cache the results
        collectionsCache.data = {
          collections: collectionsData,
          collectionBookmarks: bookmarksMap
        }
        collectionsCache.timestamp = now
      }

      setLoading(false)
    }
    fetchData()
  }, [])

  // Real-time subscription for bookmark collection changes
  useEffect(() => {
    if (isGuest) return

    const refreshCollections = async () => {
      // Invalidate cache so we get fresh data
      collectionsCache.data = null
      collectionsCache.timestamp = 0

      // Refresh collection data when bookmark collection changes
      const { data: collectionsData } = await supabase
        .from('collections')
        .select('*')
        .order('created_at', { ascending: false })

      if (collectionsData) {
        setCollections(collectionsData)

        // Fetch sample bookmarks for each collection via junction table
        const bookmarkPromises = collectionsData.map(async (collection: Collection) => {
          const { data } = await supabase
            .from('collection_bookmarks')
            .select('bookmark_id, bookmarks(*)')
            .eq('collection_id', collection.id)
            .limit(3)

          const bookmarks = data?.map((jb: any) => jb.bookmarks).filter(Boolean) || []
          return { collectionId: collection.id, bookmarks }
        })

        const results = await Promise.all(bookmarkPromises)
        const bookmarksMap: Record<string, Bookmark[]> = {}
        results.forEach(({ collectionId, bookmarks }) => {
          bookmarksMap[collectionId] = bookmarks
        })

        setCollectionBookmarks(bookmarksMap)
      }
    }

    const channel = supabase
      .channel('bookmarks-collection-changes')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'bookmarks'
        },
        () => {
          refreshCollections()
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to INSERT, UPDATE, DELETE on junction table
          schema: 'public',
          table: 'collection_bookmarks'
        },
        () => {
          refreshCollections()
        }
      )
      .subscribe()

    // Polling as backup - refresh every 1 second for reliable updates across all users
    const pollInterval = setInterval(refreshCollections, 1000)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(pollInterval)
    }
  }, [isGuest])

  // Handle URL parameters from extension popup
  useEffect(() => {
    const addUrl = searchParams.get('addUrl')
    const addTitle = searchParams.get('addTitle')

    if (addUrl && collections.length > 0) {
      // Store the bookmark data and open collection selection modal
      setPendingBookmark({
        url: decodeURIComponent(addUrl),
        title: addTitle ? decodeURIComponent(addTitle) : ''
      })
      setSelectCollectionModalOpen(true)

      // Clear URL params
      window.history.replaceState({}, '', '/collections')
    }
  }, [collections.length])

  const createCollection = async (e: React.FormEvent) => {
    e.preventDefault()

    // Check for duplicate name (case-insensitive)
    const duplicateName = collections.find(c => c.name.toLowerCase() === formData.name.toLowerCase())
    if (duplicateName) {
      setErrorMessage(`A collection named "${formData.name}" already exists.`)
      return
    }

    if (isGuest) {
      // Guest mode - save to localStorage
      const newCollection: Collection = {
        id: crypto.randomUUID(),
        name: formData.name,
        description: formData.description || null,
        user_id: '',
        is_public: formData.is_public,
        share_slug: formData.name.toLowerCase().replace(/\s+/g, '-') + '-' + Math.random().toString(36).substr(2, 9),
        created_at: new Date().toISOString()
      }
      const updatedCollections = [...collections, newCollection]
      setCollections(updatedCollections)
      try {
        guestStoreSet(GUEST_KEYS.COLLECTIONS, updatedCollections)
      } catch (e) { console.error('Error saving to localStorage:', e) }
      setModalOpen(false)
      setFormData({ name: '', description: '', is_public: false })
      return
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const share_slug = formData.name.toLowerCase().replace(/\s+/g, '-') + '-' + Math.random().toString(36).substr(2, 9)

    const { data } = await supabase
      .from('collections')
      .insert({
        name: formData.name,
        description: formData.description || null,
        is_public: formData.is_public,
        share_slug,
        user_id: user.id,
      })
      .select()

    if (data) {
      // Invalidate cache
      collectionsCache.data = null
      collectionsCache.timestamp = 0

      setCollections([data[0], ...collections])
      setModalOpen(false)
      setFormData({ name: '', description: '', is_public: false })
    }
  }

  const deleteCollection = async (id: string) => {
    setActionLoading(true)

    if (isGuest) {
      const updatedCollections = collections.filter(c => c.id !== id)
      setCollections(updatedCollections)
      try {
        guestStoreSet(GUEST_KEYS.COLLECTIONS, updatedCollections)
      } catch (e) { console.error('Error saving to localStorage:', e) }
      setDeleteModalOpen(false)
      setCollectionToDelete(null)
      setActionLoading(false)
      return
    }

    await supabase.from('collections').delete().eq('id', id)

    // Invalidate cache
    collectionsCache.data = null
    collectionsCache.timestamp = 0

    setCollections(collections.filter(c => c.id !== id))
    setDeleteModalOpen(false)
    setCollectionToDelete(null)
    setActionLoading(false)
  }

  const openDeleteModal = (collection: Collection) => {
    setCollectionToDelete(collection)
    setDeleteModalOpen(true)
  }

  const togglePublic = async (collection: Collection) => {
    if (isGuest) {
      const updatedCollections = collections.map(c => c.id === collection.id ? { ...c, is_public: !c.is_public } : c)
      setCollections(updatedCollections)
      try {
        guestStoreSet(GUEST_KEYS.COLLECTIONS, updatedCollections)
      } catch (e) { console.error('Error saving to localStorage:', e) }
      return
    }
    await supabase.from('collections').update({ is_public: !collection.is_public }).eq('id', collection.id)

    // Invalidate cache
    collectionsCache.data = null
    collectionsCache.timestamp = 0

    setCollections(collections.map(c => c.id === collection.id ? { ...c, is_public: !c.is_public } : c))
  }

  const openEditModal = (collection: Collection) => {
    setEditingCollection(collection)
    setFormData({ name: collection.name, description: collection.description || '', is_public: collection.is_public })
    setEditModalOpen(true)
  }

  const updateCollection = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingCollection) return

    // Check for duplicate name (case-insensitive), excluding current collection
    const duplicateName = collections.find(c => c.id !== editingCollection.id && c.name.toLowerCase() === formData.name.toLowerCase())
    if (duplicateName) {
      setErrorMessage(`A collection named "${formData.name}" already exists.`)
      return
    }

    if (isGuest) {
      const updatedCollection = { ...editingCollection, name: formData.name, description: formData.description || null, is_public: formData.is_public }
      const updatedCollections = collections.map(c => c.id === editingCollection.id ? updatedCollection : c)
      setCollections(updatedCollections)
      try {
        guestStoreSet(GUEST_KEYS.COLLECTIONS, updatedCollections)
      } catch (e) { console.error('Error saving to localStorage:', e) }
      setEditModalOpen(false)
      setEditingCollection(null)
      setFormData({ name: '', description: '', is_public: false })
      return
    }

    const { data } = await supabase
      .from('collections')
      .update({
        name: formData.name,
        description: formData.description || null,
        is_public: formData.is_public,
      })
      .eq('id', editingCollection.id)
      .select()
      .single()

    if (data) {
      // Invalidate cache
      collectionsCache.data = null
      collectionsCache.timestamp = 0

      setCollections(collections.map(c => c.id === editingCollection.id ? data : c))
      setEditModalOpen(false)
      setEditingCollection(null)
      setFormData({ name: '', description: '', is_public: false })
    }
  }

  const duplicateCollection = async (collection: Collection) => {
    setActionLoading(true)

    if (isGuest) {
      // Guest mode - duplicate in localStorage
      const newCollection: Collection = {
        ...collection,
        id: crypto.randomUUID(),
        name: `${collection.name} (copy)`,
        share_slug: `${collection.name.toLowerCase().replace(/\s+/g, '-')}-copy-${Math.random().toString(36).substr(2, 9)}`,
        created_at: new Date().toISOString()
      }
      const updatedCollections = [newCollection, ...collections]
      setCollections(updatedCollections)
      try {
        guestStoreSet(GUEST_KEYS.COLLECTIONS, updatedCollections)
      } catch (e) { console.error('Error saving to localStorage:', e) }
      setActionLoading(false)
      return
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Create new collection with copied name
    const share_slug = `${collection.name.toLowerCase().replace(/\s+/g, '-')}-copy-${Math.random().toString(36).substr(2, 9)}`

    const { data: newCollection } = await supabase
      .from('collections')
      .insert({
        name: `${collection.name} (copy)`,
        description: collection.description,
        is_public: false, // Start as private
        share_slug,
        user_id: user.id,
      })
      .select()
      .single()

    if (newCollection) {
      // Copy all bookmarks from source collection to new collection via junction table
      const { data: existingBookmarks } = await supabase
        .from('collection_bookmarks')
        .select('bookmark_id')
        .eq('collection_id', collection.id)

      if (existingBookmarks && existingBookmarks.length > 0) {
        // Insert all relationships to new collection
        const newRelations = existingBookmarks.map((b: any) => ({
          collection_id: newCollection.id,
          bookmark_id: b.bookmark_id
        }))
        await supabase.from('collection_bookmarks').insert(newRelations)
      }

      // Invalidate cache
      collectionsCache.data = null
      collectionsCache.timestamp = 0

      setCollections([newCollection, ...collections])
    }

    setActionLoading(false)
  }

  const openMergeModal = (collection: Collection) => {
    setCollectionToMerge(collection)
    setMergeTargetCollectionId('')
    setMergeModalOpen(true)
  }

  const handleMerge = async () => {
    if (!collectionToMerge || !mergeTargetCollectionId || collectionToMerge.id === mergeTargetCollectionId) return

    setActionLoading(true)

    if (isGuest) {
      // Guest mode - merge in localStorage
      const targetCollection = collections.find(c => c.id === mergeTargetCollectionId)
      if (!targetCollection) {
        setActionLoading(false)
        return
      }

      // Update guest bookmarks to point to target collection
      try {
        const storedBookmarks = guestStoreGet(GUEST_KEYS.BOOKMARKS)
        if (storedBookmarks) {
          const allBookmarks: Bookmark[] = storedBookmarks
          const updatedBookmarks = allBookmarks.map(b =>
            b.collection_id === collectionToMerge.id ? { ...b, collection_id: targetCollection.id } : b
          )
          guestStoreSet(GUEST_KEYS.BOOKMARKS, updatedBookmarks)
        }
      } catch (e) { console.error('Error merging guest collections:', e) }

      // Remove source collection
      const updatedCollections = collections.filter(c => c.id !== collectionToMerge.id)
      setCollections(updatedCollections)
      try {
        guestStoreSet(GUEST_KEYS.COLLECTIONS, updatedCollections)
      } catch (e) { console.error('Error saving to localStorage:', e) }

      setMergeModalOpen(false)
      setCollectionToMerge(null)
      setMergeTargetCollectionId('')
      setActionLoading(false)
      return
    }

    // Copy all bookmarks from source to target collection via junction table
    const { data: existingBookmarks } = await supabase
      .from('collection_bookmarks')
      .select('bookmark_id')
      .eq('collection_id', collectionToMerge.id)

    if (existingBookmarks) {
      for (const bookmark of existingBookmarks) {
        // Check if target already has this bookmark
        const { data: existing } = await supabase
          .from('collection_bookmarks')
          .select('id')
          .eq('collection_id', mergeTargetCollectionId)
          .eq('bookmark_id', bookmark.bookmark_id)
          .single()

        if (!existing) {
          // Add bookmark to target collection
          await supabase
            .from('collection_bookmarks')
            .insert({
              collection_id: mergeTargetCollectionId,
              bookmark_id: bookmark.bookmark_id
            })
        }
      }
    }

    // Delete source collection
    await supabase.from('collections').delete().eq('id', collectionToMerge.id)

    // Invalidate cache
    collectionsCache.data = null
    collectionsCache.timestamp = 0

    setCollections(collections.filter(c => c.id !== collectionToMerge.id))
    setMergeModalOpen(false)
    setCollectionToMerge(null)
    setMergeTargetCollectionId('')
    setActionLoading(false)
  }

  const addToCollection = async (bookmarkIds: Set<string>, collectionId: string) => {
    if (isGuest) {
      // Update guest bookmarks in localStorage
      try {
        const storedBookmarks = guestStoreGet(GUEST_KEYS.BOOKMARKS)
        if (storedBookmarks) {
          const allBookmarks: Bookmark[] = storedBookmarks
          const updatedBookmarks = allBookmarks.map(b => bookmarkIds.has(b.id) ? { ...b, collection_id: collectionId } : b)
          guestStoreSet(GUEST_KEYS.BOOKMARKS, updatedBookmarks)
          setAvailableBookmarks(updatedBookmarks)
          // Update collection bookmarks cache
          const addedBookmarks = updatedBookmarks.filter(b => bookmarkIds.has(b.id))
          setCollectionBookmarks(prev => ({
            ...prev,
            [collectionId]: [...addedBookmarks, ...(prev[collectionId] || [])].slice(0, 3)
          }))
        }
      } catch (e) { console.error('Error saving to localStorage:', e) }
      setAddModalOpen(false)
      setSelectedCollection(null)
      setSelectedBookmarkIds(new Set())
      return
    }

    // Add all selected bookmarks to collection using junction table
    for (const bookmarkId of bookmarkIds) {
      await supabase.from('collection_bookmarks').insert({
        collection_id: collectionId,
        bookmark_id: bookmarkId
      })
    }

    // Invalidate cache
    collectionsCache.data = null
    collectionsCache.timestamp = 0

    // Refresh available bookmarks
    const { data } = await supabase.from('bookmarks').select('*').order('title', { ascending: true })
    if (data) setAvailableBookmarks(data)
    // Update collection bookmarks cache
    const addedBookmarks = data.filter((b: Bookmark) => bookmarkIds.has(b.id))
    setCollectionBookmarks(prev => ({
      ...prev,
      [collectionId]: [...addedBookmarks, ...(prev[collectionId] || [])].slice(0, 3)
    }))

    setAddModalOpen(false)
    setSelectedCollection(null)
    setSelectedBookmarkIds(new Set())
  }

  const addNewBookmarkToCollection = async (collection: Collection) => {
    if (!pendingBookmark) return

    if (isGuest) {
      // Guest mode - create bookmark in localStorage
      try {
        const storedBookmarks = guestStoreGet(GUEST_KEYS.BOOKMARKS)
        let allBookmarks: Bookmark[] = storedBookmarks || []

        // Check if bookmark already exists
        const existingBookmark = allBookmarks.find(b => b.url === pendingBookmark.url)

        if (existingBookmark) {
          // Update existing bookmark to this collection
          allBookmarks = allBookmarks.map(b => b.id === existingBookmark.id ? { ...b, collection_id: collection.id } : b)
        } else {
          // Create new bookmark in this collection
          const newBookmark: Bookmark = {
            id: crypto.randomUUID(),
            user_id: '',
            url: pendingBookmark.url,
            title: pendingBookmark.title || new URL(pendingBookmark.url).hostname,
            description: null,
            notes: null,
            is_read: true,
            is_favorite: false,
            collection_id: collection.id,
            folder_id: null,
            favicon_url: null,
            screenshot_url: null,
            last_opened_at: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
          allBookmarks = [newBookmark, ...allBookmarks]
        }

        guestStoreSet(GUEST_KEYS.BOOKMARKS, allBookmarks)
        // Refresh collection bookmarks
        const collectionBookmarks = allBookmarks.filter(b => b.collection_id === collection.id).slice(0, 3)
        setCollectionBookmarks(prev => ({ ...prev, [collection.id]: collectionBookmarks }))
      } catch (e) { console.error('Error saving to localStorage:', e) }

      setSelectCollectionModalOpen(false)
      setPendingBookmark(null)
      return
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Check if bookmark already exists
    const { data: existingBookmark } = await supabase
      .from('bookmarks')
      .select('id')
      .eq('user_id', user.id)
      .eq('url', pendingBookmark.url)
      .single()

    if (existingBookmark) {
      // Update existing bookmark to this collection
      await supabase.from('bookmarks').update({ collection_id: collection.id }).eq('id', existingBookmark.id)
      // Refresh collection bookmarks
      const { data } = await supabase
        .from('bookmarks')
        .select('*')
        .eq('collection_id', collection.id)
        .order('created_at', { ascending: false })
        .limit(3)
      if (data) {
        setCollectionBookmarks(prev => ({ ...prev, [collection.id]: data }))
      }
    } else {
      // Create new bookmark in this collection
      const { data } = await supabase.from('bookmarks').insert({
        user_id: user.id,
        url: pendingBookmark.url,
        title: pendingBookmark.title || new URL(pendingBookmark.url).hostname,
        collection_id: collection.id,
        is_read: true,
        is_favorite: false,
      }).select().single()
      // Refresh collection bookmarks
      if (data) {
        setCollectionBookmarks(prev => ({
          ...prev,
          [collection.id]: [data, ...(prev[collection.id] || [])].slice(0, 3)
        }))
      }
    }

    // Invalidate cache
    collectionsCache.data = null
    collectionsCache.timestamp = 0

    setSelectCollectionModalOpen(false)
    setPendingBookmark(null)
  }

  const shareUrl = (collection: Collection) => {
    if (typeof window !== 'undefined') {
      return `${window.location.origin}/shared/${collection.share_slug}`
    }
    return ''
  }

  const copyShareUrl = async (collection: Collection, e: React.MouseEvent) => {
    e.stopPropagation()
    const url = shareUrl(collection)
    try {
      await navigator.clipboard.writeText(url)
      setToast({ message: 'Link copied!', type: 'success' })
      setTimeout(() => setToast(null), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
      setToast({ message: 'Failed to copy', type: 'error' })
      setTimeout(() => setToast(null), 2000)
    }
  }

  const importCollection = async () => {
    // Extract slug from URL or use the input directly
    let slug = importUrl.trim()

    // If it's a full URL, extract the slug
    if (slug.includes('/shared/')) {
      const match = slug.match(/\/shared\/([^\/\s]+)/)
      if (match) {
        slug = match[1]
      } else {
        setToast({ message: 'Invalid collection URL', type: 'error' })
        setTimeout(() => setToast(null), 2000)
        return
      }
    }

    if (!slug) {
      setToast({ message: 'Please enter a collection URL or code', type: 'error' })
      setTimeout(() => setToast(null), 2000)
      return
    }

    setImportLoading(true)

    try {
      // Navigate to the shared collection page
      router.push(`/shared/${slug}`)
      setImportModalOpen(false)
      setImportUrl('')
    } catch (err) {
      console.error('Failed to import:', err)
      setToast({ message: 'Collection not found or not public', type: 'error' })
      setTimeout(() => setToast(null), 2000)
    } finally {
      setImportLoading(false)
    }
  }

  // Create new bookmark and add to selected collection
  const createAndAddBookmark = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedCollection || !newBookmarkUrl) return

    if (isGuest) {
      // Guest mode - create bookmark in localStorage
      try {
        const storedBookmarks = guestStoreGet(GUEST_KEYS.BOOKMARKS)
        let allBookmarks: Bookmark[] = storedBookmarks || []

        // Check if bookmark already exists
        const existingBookmark = allBookmarks.find(b => b.url === newBookmarkUrl)

        if (!existingBookmark) {
          const newBookmark: Bookmark = {
            id: crypto.randomUUID(),
            user_id: '',
            url: newBookmarkUrl,
            title: newBookmarkTitle || new URL(newBookmarkUrl).hostname,
            description: null,
            notes: null,
            is_read: true,
            is_favorite: false,
            collection_id: selectedCollection.id,
            folder_id: null,
            favicon_url: null,
            screenshot_url: null,
            last_opened_at: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
          allBookmarks = [newBookmark, ...allBookmarks]
          guestStoreSet(GUEST_KEYS.BOOKMARKS, allBookmarks)
          // Update collection bookmarks
          setCollectionBookmarks(prev => ({
            ...prev,
            [selectedCollection.id]: [newBookmark, ...(prev[selectedCollection.id] || [])].slice(0, 3)
          }))
          setAvailableBookmarks(allBookmarks)
        }
      } catch (e) { console.error('Error saving to localStorage:', e) }

      // Reset form and close
      setNewBookmarkUrl('')
      setNewBookmarkTitle('')
      setShowNewBookmarkForm(false)
      setAddModalOpen(false)
      setSelectedCollection(null)
      return
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Check if bookmark already exists
    const { data: existingBookmark } = await supabase
      .from('bookmarks')
      .select('id')
      .eq('user_id', user.id)
      .eq('url', newBookmarkUrl)
      .single()

    if (existingBookmark) {
      // Bookmark exists, just add to collection
      await supabase.from('collection_bookmarks').insert({
        collection_id: selectedCollection.id,
        bookmark_id: existingBookmark.id
      })
    } else {
      // Create new bookmark and add to collection
      const { data } = await supabase.from('bookmarks').insert({
        user_id: user.id,
        url: newBookmarkUrl,
        title: newBookmarkTitle || new URL(newBookmarkUrl).hostname,
        is_read: true,
        is_favorite: false,
      }).select().single()

      if (data) {
        await supabase.from('collection_bookmarks').insert({
          collection_id: selectedCollection.id,
          bookmark_id: data.id
        })
        // Update collection bookmarks
        setCollectionBookmarks(prev => ({
          ...prev,
          [selectedCollection.id]: [data, ...(prev[selectedCollection.id] || [])].slice(0, 3)
        }))
      }
    }

    // Invalidate cache
    collectionsCache.data = null
    collectionsCache.timestamp = 0

    // Refresh available bookmarks
    const { data: bookmarksData } = await supabase.from('bookmarks').select('*').order('title', { ascending: true })
    if (bookmarksData) setAvailableBookmarks(bookmarksData)

    // Reset form and close
    setNewBookmarkUrl('')
    setNewBookmarkTitle('')
    setShowNewBookmarkForm(false)
    setAddModalOpen(false)
    setSelectedCollection(null)
  }

  // Sort and filter collections
  const sortedCollections = [...collections].sort((a, b) => {
    if (sortBy === 'name') {
      return sortOrder === 'asc'
        ? a.name.localeCompare(b.name)
        : b.name.localeCompare(a.name)
    } else if (sortBy === 'date') {
      return sortOrder === 'asc'
        ? new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        : new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    } else { // count
      const aCount = (collectionBookmarks[a.id] || []).length
      const bCount = (collectionBookmarks[b.id] || []).length
      return sortOrder === 'asc' ? aCount - bCount : bCount - aCount
    }
  })

  const filteredCollections = sortedCollections.filter(collection =>
    collection.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (collection.description && collection.description.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  return (
    <>
      {/* Search Bar - Full Width */}
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: 'var(--text-secondary)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r={8} strokeWidth={2} />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35" />
          </svg>
          <Input
            placeholder="Search collections by name or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            style={{ paddingRight: '12px' }}
          />
        </div>

        {/* Sort Dropdown */}
        <div className="flex gap-2 items-center">
          <select
            value={`${sortBy}-${sortOrder}`}
            onChange={(e) => {
              const [newSortBy, newSortOrder] = e.target.value.split('-') as ['name' | 'date' | 'count', 'asc' | 'desc']
              setSortBy(newSortBy)
              setSortOrder(newSortOrder)
            }}
            className="px-3 py-2 rounded-lg text-sm cursor-pointer"
            style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
          >
            <option value="date-desc">Newest First</option>
            <option value="date-asc">Oldest First</option>
            <option value="name-asc">Name (A-Z)</option>
            <option value="name-desc">Name (Z-A)</option>
            <option value="count-desc">Most Bookmarks</option>
            <option value="count-asc">Least Bookmarks</option>
          </select>
          <button
            onClick={() => setImportModalOpen(true)}
            className="px-3 py-2 rounded-lg text-sm font-medium transition-all hover:scale-105 active:scale-95 flex items-center gap-1.5"
            style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', cursor: 'pointer', border: '1px solid var(--border-color)' }}
            title="Import a shared collection"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            <span className="hidden sm:inline">Import</span>
          </button>
        </div>
      </div>

      {/* Loading Skeleton */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="animate-pulse">
              <div className="h-2 mb-4 rounded" style={{ backgroundColor: 'var(--border-color)' }} />
              <div className="p-6 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                <div className="h-6 bg-gray-300 rounded mb-2 w-3/4" />
                <div className="h-4 bg-gray-300 rounded w-1/4 mb-4" />
                <div className="h-4 bg-gray-300 rounded w-1/2 mb-4" />
                <div className="flex gap-2">
                  <div className="h-8 bg-gray-300 rounded flex-1" />
                  <div className="h-8 bg-gray-300 rounded w-20" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : collections.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center" style={{ color: 'var(--text-secondary)' }}>
            No collections yet. Create your first collection!
          </CardContent>
        </Card>
      ) : filteredCollections.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center" style={{ color: 'var(--text-secondary)' }}>
            No collections found matching "{searchQuery}"
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCollections.map(collection => {
            const bookmarks = collectionBookmarks[collection.id] || []
            return (
              <Card
                key={collection.id}
                className="overflow-hidden cursor-pointer transition-all duration-200 hover:scale-105 hover:shadow-lg flex flex-col"
                onClick={() => router.push(`/collections/${collection.id}`)}
                onMouseEnter={() => router.prefetch(`/collections/${collection.id}`)}
              >
                <div className={`h-2 ${collection.is_public ? 'bg-green-500' : 'bg-gray-300'}`} />
                <CardContent className="p-6 flex flex-col flex-grow">
                  <div className="flex-grow">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h3 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
                          {collection.name}
                        </h3>
                        {collection.description && (
                          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{collection.description}</p>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); openEditModal(collection); }}
                          className="group/btn relative p-1 transition-all duration-75 active:scale-90"
                          style={{ cursor: 'pointer' }}
                        >
                          <svg className="w-5 h-5 text-gray-400 group-hover/btn:text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          <span className="absolute left-1/2 top-full mt-2 -translate-x-1/2 px-2 py-1 text-xs text-white rounded whitespace-nowrap opacity-0 transition-opacity duration-0 group-hover/btn:opacity-100 group-hover/btn:delay-300 pointer-events-none z-50" style={{ backgroundColor: '#1f2937' }}>
                            Edit
                          </span>
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); duplicateCollection(collection); }}
                          className="group/btn relative p-1 transition-all duration-75 active:scale-90"
                          style={{ cursor: 'pointer' }}
                        >
                          <svg className="w-5 h-5 text-gray-400 group-hover/btn:text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2zm0-10V6a2 2 0 012-2h8a2 2 0 012 2v2M10 12h4" />
                          </svg>
                          <span className="absolute left-1/2 top-full mt-2 -translate-x-1/2 px-2 py-1 text-xs text-white rounded whitespace-nowrap opacity-0 transition-opacity duration-0 group-hover/btn:opacity-100 group-hover/btn:delay-300 pointer-events-none z-50" style={{ backgroundColor: '#1f2937' }}>
                            Duplicate
                          </span>
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); openMergeModal(collection); }}
                          className="group/btn relative p-1 transition-all duration-75 active:scale-90"
                          style={{ cursor: 'pointer' }}
                        >
                          <svg className="w-5 h-5 text-gray-400 group-hover/btn:text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14v6m-3-3h6M6 10h2a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v2a2 2 0 002 2zm10 0V6a2 2 0 00-2-2H6a2 2 0 00-2 2v2a2 2 0 002 2z" />
                          </svg>
                          <span className="absolute left-1/2 top-full mt-2 -translate-x-1/2 px-2 py-1 text-xs text-white rounded whitespace-nowrap opacity-0 transition-opacity duration-0 group-hover/btn:opacity-100 group-hover/btn:delay-300 pointer-events-none z-50" style={{ backgroundColor: '#1f2937' }}>
                            Merge
                          </span>
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); openDeleteModal(collection); }}
                          className="group/btn relative p-1 transition-all duration-75 active:scale-90"
                          style={{ cursor: 'pointer' }}
                        >
                          <svg className="w-5 h-5 text-gray-400 group-hover/btn:text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          <span className="absolute left-1/2 top-full mt-2 -translate-x-1/2 px-2 py-1 text-xs text-white rounded whitespace-nowrap opacity-0 transition-opacity duration-0 group-hover/btn:opacity-100 group-hover/btn:delay-300 pointer-events-none z-50" style={{ backgroundColor: '#1f2937' }}>
                            Delete
                          </span>
                        </button>
                      </div>
                    </div>

                    <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
                      {bookmarks.length} bookmark{bookmarks.length !== 1 ? 's' : ''}
                    </p>

                    <div className="flex gap-2 flex-wrap mb-4">
                      {bookmarks.slice(0, 3).map(b => (
                        <a
                          key={b.id}
                          href={b.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-xs px-2 py-1 rounded truncate max-w-[120px] block transition-all duration-75 hover:scale-105 active:scale-100"
                          style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', cursor: 'pointer' }}
                          title={b.title}
                        >
                          {b.title}
                        </a>
                      ))}
                      {bookmarks.length > 3 && (
                        <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>+{bookmarks.length - 3} more</span>
                      )}
                    </div>
                  </div>

                  {collection.is_public && (
                    <div className="mb-3 p-3 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Share link:</p>
                          <code className="text-xs text-blue-600 break-all">{shareUrl(collection)}</code>
                        </div>
                        <button
                          onClick={(e) => copyShareUrl(collection, e)}
                          className="px-3 py-1 rounded text-xs font-medium transition-all hover:scale-105 active:scale-95"
                          style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', cursor: 'pointer' }}
                          title="Copy share link"
                        >
                          Copy
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2 mt-auto">
                    <button
                      onClick={(e) => { e.stopPropagation(); togglePublic(collection); }}
                      className="flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-75 active:scale-90"
                      style={{
                        backgroundColor: collection.is_public ? 'rgba(34, 197, 94, 0.2)' : 'var(--bg-secondary)',
                        color: collection.is_public ? '#15803d' : 'var(--text-primary)',
                        cursor: 'pointer'
                      }}
                    >
                      {collection.is_public ? '🌐 Public' : '🔒 Private'}
                    </button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={async (e) => {
                        e.stopPropagation()
                        setSelectedCollection(collection)
                        // Fetch available bookmarks on-demand
                        if (isGuest) {
                          try {
                            const storedBookmarks = guestStoreGet(GUEST_KEYS.BOOKMARKS)
                            if (storedBookmarks) {
                              // For guests, filter out bookmarks already in this collection
                              const filtered = storedBookmarks.filter((b: Bookmark) => b.collection_id !== collection.id)
                              setAvailableBookmarks(filtered)
                            }
                          } catch (e) { console.error('Error loading guest bookmarks:', e) }
                        } else {
                          // Fetch bookmarks that are already in this collection via junction table
                          const { data: existingInCollection } = await supabase
                            .from('collection_bookmarks')
                            .select('bookmark_id')
                            .eq('collection_id', collection.id)

                          const existingIds = new Set(existingInCollection?.map((c: any) => c.bookmark_id) || [])

                          // Fetch all user's bookmarks, then filter out the ones already in this collection
                          const { data } = await supabase
                            .from('bookmarks')
                            .select('*')
                            .order('title', { ascending: true })

                          // Filter out bookmarks already in this collection
                          const available = (data || []).filter((b: Bookmark) => !existingIds.has(b.id))
                          setAvailableBookmarks(available)
                        }
                        // Reset form state - start on "Select from Existing" tab
                        setNewBookmarkUrl('')
                        setNewBookmarkTitle('')
                        setShowNewBookmarkForm(false)
                        setSelectedBookmarkIds(new Set())
                        setBookmarkFilterType('all')
                        setBookmarkSearchQuery('')
                        setAddModalOpen(true)
                      }}
                    >
                      + Add
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Create Collection Modal */}
      <Modal isOpen={modalOpen} onClose={() => { setModalOpen(false); setErrorMessage(null); }} title="New Collection">
        <form onSubmit={createCollection} className="space-y-4">
          {errorMessage && (
            <div className="p-3 rounded-lg text-sm" style={{ backgroundColor: 'rgba(220, 38, 38, 0.1)', border: '1px solid #dc2626', color: '#dc2626' }}>
              {errorMessage}
            </div>
          )}
          <Input
            label="Collection Name"
            placeholder="My Favorite Articles"
            value={formData.name}
            onChange={(e) => { setFormData({ ...formData, name: e.target.value }); setErrorMessage(null); }}
            required
          />
          <Textarea
            label="Description (optional)"
            placeholder="A collection of useful resources"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows={3}
          />
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.is_public}
              onChange={(e) => setFormData({ ...formData, is_public: e.target.checked })}
              className="w-4 h-4 rounded"
            />
            <span className="text-sm text-gray-900 dark:text-gray-100">Make public (shareable)</span>
          </label>
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => { setModalOpen(false); setErrorMessage(null); }} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" className="flex-1">Create Collection</Button>
          </div>
        </form>
      </Modal>

      {/* Add to Collection Modal */}
      <Modal isOpen={addModalOpen} onClose={() => { setAddModalOpen(false); setShowNewBookmarkForm(false); setNewBookmarkUrl(''); setNewBookmarkTitle(''); setSelectedBookmarkIds(new Set()); setBookmarkFilterType('all'); setBookmarkSearchQuery(''); }} title="Add Bookmark">
        {selectedCollection && (
          <div className="space-y-4">
            {/* Main Tabs: Create New / Select from Existing */}
            <div className="flex gap-2 border-b" style={{ borderColor: 'var(--border-color)' }}>
              <button
                onClick={() => setShowNewBookmarkForm(true)}
                className={`flex-1 py-2 text-sm font-medium transition-all ${showNewBookmarkForm ? 'text-purple-600 border-b-2 border-purple-600' : 'text-gray-400'}`}
                style={{ color: showNewBookmarkForm ? '#8b5cf6' : 'var(--text-secondary)', cursor: 'pointer' }}
              >
                Create New
              </button>
              <button
                onClick={() => setShowNewBookmarkForm(false)}
                className={`flex-1 py-2 text-sm font-medium transition-all ${!showNewBookmarkForm ? 'text-purple-600 border-b-2 border-purple-600' : 'text-gray-400'}`}
                style={{ color: !showNewBookmarkForm ? '#8b5cf6' : 'var(--text-secondary)', cursor: 'pointer' }}
              >
                Select from Existing
              </button>
            </div>

            {!showNewBookmarkForm ? (
              <>
                {/* Filter Tabs: All / Favorites / Reading List */}
                <div className="flex gap-2 border-b" style={{ borderColor: 'var(--border-color)' }}>
                  <button
                    onClick={() => setBookmarkFilterType('all')}
                    className={`flex-1 py-2 text-sm font-medium transition-all ${bookmarkFilterType === 'all' ? 'text-purple-600 border-b-2 border-purple-600' : 'text-gray-400'}`}
                    style={{ color: bookmarkFilterType === 'all' ? '#8b5cf6' : 'var(--text-secondary)', cursor: 'pointer' }}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setBookmarkFilterType('favorites')}
                    className={`flex-1 py-2 text-sm font-medium transition-all ${bookmarkFilterType === 'favorites' ? 'text-purple-600 border-b-2 border-purple-600' : 'text-gray-400'}`}
                    style={{ color: bookmarkFilterType === 'favorites' ? '#8b5cf6' : 'var(--text-secondary)', cursor: 'pointer' }}
                  >
                    Favorites
                  </button>
                  <button
                    onClick={() => setBookmarkFilterType('reading-list')}
                    className={`flex-1 py-2 text-sm font-medium transition-all ${bookmarkFilterType === 'reading-list' ? 'text-purple-600 border-b-2 border-purple-600' : 'text-gray-400'}`}
                    style={{ color: bookmarkFilterType === 'reading-list' ? '#8b5cf6' : 'var(--text-secondary)', cursor: 'pointer' }}
                  >
                    Reading List
                  </button>
                </div>

                {/* Search Bar */}
                <div className="relative">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-secondary)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <circle cx="11" cy="11" r={8} strokeWidth={2} />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Search bookmarks..."
                    value={bookmarkSearchQuery}
                    onChange={(e) => setBookmarkSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 rounded-lg text-sm"
                    style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
                  />
                </div>

                {/* Filter and search bookmarks */}
                {(() => {
                  let filtered = availableBookmarks
                  if (bookmarkFilterType === 'favorites') {
                    filtered = filtered.filter(b => b.is_favorite)
                  } else if (bookmarkFilterType === 'reading-list') {
                    filtered = filtered.filter(b => !b.is_read)
                  }
                  if (bookmarkSearchQuery) {
                    const query = bookmarkSearchQuery.toLowerCase()
                    filtered = filtered.filter(b =>
                      b.title?.toLowerCase().includes(query) ||
                      b.url?.toLowerCase().includes(query)
                    )
                  }
                  return filtered
                })().map(bookmark => {
                  const isSelected = selectedBookmarkIds.has(bookmark.id)
                  const getDomain = (url: string) => {
                    try { return new URL(url).hostname }
                    catch { return url }
                  }
                  return (
                    <button
                      key={bookmark.id}
                      onClick={() => {
                        const newSelected = new Set(selectedBookmarkIds)
                        if (isSelected) {
                          newSelected.delete(bookmark.id)
                        } else {
                          newSelected.add(bookmark.id)
                        }
                        setSelectedBookmarkIds(newSelected)
                      }}
                      className="w-full p-3 rounded-lg text-left transition-all cursor-pointer flex items-center gap-3"
                      style={{
                        backgroundColor: isSelected ? 'rgba(139, 92, 246, 0.15)' : 'var(--bg-secondary)',
                        border: isSelected ? '2px solid #8b5cf6' : '2px solid transparent',
                        color: 'var(--text-primary)'
                      }}
                    >
                      {/* Checkbox */}
                      <div className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0" style={{
                        backgroundColor: isSelected ? '#8b5cf6' : 'var(--bg-primary)',
                        border: isSelected ? '2px solid #8b5cf6' : '2px solid var(--border-color)'
                      }}>
                        {isSelected && (
                          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 1.414z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>

                      {/* Favicon */}
                      <div className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0 overflow-hidden" style={{ backgroundColor: 'var(--bg-primary)' }}>
                        <img
                          src={`https://www.google.com/s2/favicons?domain=${getDomain(bookmark.url)}&sz=32`}
                          className="w-8 h-8"
                          alt=""
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                        />
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate" style={{ color: 'var(--text-primary)' }}>{bookmark.title}</p>
                        <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-secondary)' }}>{bookmark.url}</p>
                      </div>

                      {/* Favorite indicator */}
                      {bookmark.is_favorite && (
                        <svg className="w-4 h-4 text-yellow-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      )}
                      {/* Reading list indicator (book icon) */}
                      {!bookmark.is_read && (
                        <svg className="w-4 h-4 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                        </svg>
                      )}
                    </button>
                  )
                })}

                {/* Filter bookmarks for the list */}
                {(() => {
                  let filtered = availableBookmarks
                  if (bookmarkFilterType === 'favorites') {
                    filtered = filtered.filter(b => b.is_favorite)
                  } else if (bookmarkFilterType === 'reading-list') {
                    filtered = filtered.filter(b => !b.is_read)
                  }
                  if (bookmarkSearchQuery) {
                    const query = bookmarkSearchQuery.toLowerCase()
                    filtered = filtered.filter(b =>
                      b.title?.toLowerCase().includes(query) ||
                      b.url?.toLowerCase().includes(query)
                    )
                  }
                  return filtered.length === 0
                })() && (
                  <p style={{ color: 'var(--text-secondary)' }} className="text-center py-8">No bookmarks found</p>
                )}

                {selectedBookmarkIds.size > 0 && (
                  <p className="text-sm text-center" style={{ color: 'var(--text-secondary)' }}>
                    {selectedBookmarkIds.size} bookmark{selectedBookmarkIds.size > 1 ? 's' : ''} selected
                  </p>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setAddModalOpen(false)}
                    className="flex-1 px-4 py-2 rounded-lg font-medium transition-all"
                    style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => addToCollection(selectedBookmarkIds, selectedCollection.id)}
                    disabled={selectedBookmarkIds.size === 0}
                    className="flex-1 px-4 py-2 rounded-lg font-medium text-white transition-all"
                    style={{ backgroundColor: selectedBookmarkIds.size > 0 ? '#8b5cf6' : 'var(--bg-secondary)', color: selectedBookmarkIds.size > 0 ? 'white' : 'var(--text-secondary)', cursor: selectedBookmarkIds.size > 0 ? 'pointer' : 'not-allowed' }}
                  >
                    Save
                  </button>
                </div>
              </>
            ) : (
              <>
                <form onSubmit={createAndAddBookmark} className="space-y-3">
                  <Input
                    label="URL"
                    placeholder="https://example.com"
                    value={newBookmarkUrl}
                    onChange={(e) => setNewBookmarkUrl(e.target.value)}
                    required
                  />
                  <Input
                    label="Title (optional)"
                    placeholder="Bookmark title"
                    value={newBookmarkTitle}
                    onChange={(e) => setNewBookmarkTitle(e.target.value)}
                  />
                  <div className="flex gap-3 pt-2">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => { setAddModalOpen(false); setNewBookmarkUrl(''); setNewBookmarkTitle(''); }}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                    <Button type="submit" className="flex-1">
                      Add to Collection
                    </Button>
                  </div>
                </form>
              </>
            )}
          </div>
        )}
      </Modal>

      {/* Edit Collection Modal */}
      <Modal isOpen={editModalOpen} onClose={() => { setEditModalOpen(false); setErrorMessage(null); }} title="Edit Collection">
        <form onSubmit={updateCollection} className="space-y-4">
          {errorMessage && (
            <div className="p-3 rounded-lg text-sm" style={{ backgroundColor: 'rgba(220, 38, 38, 0.1)', border: '1px solid #dc2626', color: '#dc2626' }}>
              {errorMessage}
            </div>
          )}
          <Input
            label="Collection Name"
            placeholder="My Favorite Articles"
            value={formData.name}
            onChange={(e) => { setFormData({ ...formData, name: e.target.value }); setErrorMessage(null); }}
            required
          />
          <Textarea
            label="Description (optional)"
            placeholder="A collection of useful resources"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows={3}
          />
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.is_public}
              onChange={(e) => setFormData({ ...formData, is_public: e.target.checked })}
              className="w-4 h-4 rounded"
            />
            <span className="text-sm text-gray-900 dark:text-gray-100">Make public (shareable)</span>
          </label>
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => { setEditModalOpen(false); setErrorMessage(null); }} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" className="flex-1">Save Changes</Button>
          </div>
        </form>
      </Modal>

      {/* Select Collection Modal (for adding new bookmark from extension) */}
      <Modal isOpen={selectCollectionModalOpen} onClose={() => { setSelectCollectionModalOpen(false); setPendingBookmark(null); }} title="Select Collection">
        {pendingBookmark && (
          <div className="space-y-4">
            <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }}>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Adding:</p>
              <p className="font-medium truncate" style={{ color: 'var(--text-primary)' }}>{pendingBookmark.title || pendingBookmark.url}</p>
              <p className="text-sm truncate" style={{ color: 'var(--text-secondary)' }}>{pendingBookmark.url}</p>
            </div>
            <p style={{ color: 'var(--text-secondary)' }}>Select a collection to add this bookmark to:</p>
            <div className="max-h-64 overflow-y-auto space-y-2">
              {collections.map(collection => (
                <button
                  key={collection.id}
                  onClick={() => addNewBookmarkToCollection(collection)}
                  className="w-full text-left p-4 rounded-lg transition-all duration-75 active:scale-98 border"
                  style={{
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                    backgroundColor: collection.is_public ? 'rgba(34, 197, 94, 0.1)' : 'var(--bg-secondary)',
                    borderColor: collection.is_public ? '#22c55e' : 'var(--border-color)'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.02)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{collection.name}</p>
                      {collection.description && (
                        <p className="text-sm truncate" style={{ color: 'var(--text-secondary)' }}>{collection.description}</p>
                      )}
                    </div>
                    <span className="text-xs px-2 py-1 rounded-full" style={{
                      backgroundColor: collection.is_public ? 'rgba(34, 197, 94, 0.2)' : 'rgba(156, 163, 175, 0.2)',
                      color: collection.is_public ? '#15803d' : '#6b7280'
                    }}>
                      {collection.is_public ? '🌐 Public' : '🔒 Private' }
                    </span>
                  </div>
                </button>
              ))}
              {collections.length === 0 && (
                <p style={{ color: 'var(--text-secondary)' }} className="text-center py-4">No collections available. Create one first!</p>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Hidden button for programmatic clicks */}
      <button
        id="add-collection-btn"
        onClick={() => setModalOpen(true)}
        style={{ display: 'none' }}
      />

      {/* Delete Collection Confirmation Modal */}
      <Modal isOpen={deleteModalOpen} onClose={() => setDeleteModalOpen(false)} title="Delete Collection">
        <div className="space-y-4">
          <p style={{ color: 'var(--text-secondary)' }}>
            Are you sure you want to delete <strong>"{collectionToDelete?.name}"</strong>?
          </p>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Bookmarks in this collection will be unassigned but not deleted.
          </p>
          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setDeleteModalOpen(false)}
              className="flex-1"
              disabled={actionLoading}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => collectionToDelete && deleteCollection(collectionToDelete.id)}
              className="flex-1 bg-red-600 hover:bg-red-700"
              disabled={actionLoading}
            >
              {actionLoading ? 'Deleting...' : 'Delete Collection'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Merge Collection Modal */}
      <Modal isOpen={mergeModalOpen} onClose={() => setMergeModalOpen(false)} title="Merge Collection">
        <div className="space-y-4">
          <p style={{ color: 'var(--text-secondary)' }}>
            Merge <strong>"{collectionToMerge?.name}"</strong> into another collection.
            All bookmarks from this collection will be added to the target collection, and this collection will be deleted.
          </p>

          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>Select Target Collection</label>
            <select
              value={mergeTargetCollectionId}
              onChange={(e) => setMergeTargetCollectionId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg"
              style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
            >
              <option value="">Select a collection...</option>
              {collections
                .filter(c => c.id !== collectionToMerge?.id)
                .map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
            </select>
          </div>

          <div className="p-3 rounded-lg" style={{ backgroundColor: 'rgba(251, 146, 60, 0.1)', border: '1px solid rgba(251, 146, 60, 0.3)' }}>
            <div className="flex gap-2">
              <span className="text-xl">⚠️</span>
              <p className="text-sm" style={{ color: '#ea580c' }}>
                The source collection <strong>"{collectionToMerge?.name}"</strong> will be deleted after merging.
              </p>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setMergeModalOpen(false)}
              className="flex-1"
              disabled={actionLoading}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleMerge}
              disabled={!mergeTargetCollectionId || actionLoading}
              className="flex-1"
              style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)', color: 'white' }}
            >
              {actionLoading ? 'Merging...' : 'Merge Collections'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Import Collection Modal */}
      <Modal isOpen={importModalOpen} onClose={() => { setImportModalOpen(false); setImportUrl(''); }} title="Import Shared Collection">
        <div className="space-y-4">
          <p style={{ color: 'var(--text-secondary)' }}>
            Enter the share URL or code of a public collection to view it.
          </p>
          <Input
            label="Collection URL or Code"
            placeholder="e.g., my-collection-abc123 or https://example.com/shared/my-collection-abc123"
            value={importUrl}
            onChange={(e) => setImportUrl(e.target.value)}
            onKeyUp={(e) => {
              if (e.key === 'Enter') {
                importCollection()
              }
            }}
          />
          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => { setImportModalOpen(false); setImportUrl(''); }}
              className="flex-1"
              disabled={importLoading}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={importCollection}
              disabled={!importUrl.trim() || importLoading}
              className="flex-1"
              style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)', color: 'white' }}
            >
              {importLoading ? 'Loading...' : 'View Collection'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-4 right-4 z-50 animate-bounce">
          <div
            className={`px-4 py-3 rounded-lg shadow-lg text-sm font-medium ${
              toast.type === 'success'
                ? 'bg-green-500 text-white'
                : toast.type === 'error'
                ? 'bg-red-500 text-white'
                : 'bg-blue-500 text-white'
            }`}
          >
            {toast.message}
          </div>
        </div>
      )}
    </>
  )
}

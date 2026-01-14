'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/input'
import type { Bookmark, Collection } from '@/lib/types'

interface Props {
  collectionId: string
}

// Simple in-memory cache for faster loads
const collectionCache = new Map<string, { collection: Collection; bookmarks: Bookmark[]; timestamp: number }>()
const CACHE_TTL = 30000 // 30 seconds

export function CollectionDetailContent({ collectionId }: Props) {
  const router = useRouter()
  const [collection, setCollection] = useState<Collection | null>(null)
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editFormData, setEditFormData] = useState({ name: '', description: '', is_public: false })
  const [formData, setFormData] = useState({ url: '', title: '' })
  const [formError, setFormError] = useState('')

  useEffect(() => {
    fetchData()
  }, [collectionId])

  const fetchData = async () => {
    // Check cache first
    const cached = collectionCache.get(collectionId)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      setCollection(cached.collection)
      setBookmarks(cached.bookmarks)
      setLoading(false)
      return
    }

    setLoading(true)

    // Fetch collection and bookmarks in parallel with minimal fields
    const [collectionRes, bookmarksRes] = await Promise.all([
      supabase.from('collections').select('*').eq('id', collectionId).single(),
      supabase.from('bookmarks').select('*').eq('collection_id', collectionId).order('created_at', { ascending: false }),
    ])

    const newCollection = collectionRes.data
    const newBookmarks = bookmarksRes.data || []

    if (newCollection) {
      setCollection(newCollection)
      // Cache the results
      collectionCache.set(collectionId, {
        collection: newCollection,
        bookmarks: newBookmarks,
        timestamp: Date.now()
      })
    }
    setBookmarks(newBookmarks)
    setLoading(false)
  }

  const addBookmark = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')

    if (!formData.url.trim()) {
      setFormError('URL is required')
      return
    }

    try {
      new URL(formData.url) // Validate URL
    } catch {
      setFormError('Invalid URL')
      return
    }

    setActionLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }

    // Check if bookmark already exists globally (across all collections)
    const { data: existingBookmark } = await supabase
      .from('bookmarks')
      .select('id, collection_id, title')
      .eq('user_id', user.id)
      .eq('url', formData.url)
      .single()

    if (existingBookmark) {
      setActionLoading(false)
      if (existingBookmark.collection_id === collectionId) {
        setFormError('This bookmark is already in this collection')
      } else {
        setFormError('This URL is already bookmarked')
      }
      return
    }

    // Create new bookmark in this collection
    const { data: bookmark } = await supabase
      .from('bookmarks')
      .insert({
        user_id: user.id,
        url: formData.url,
        title: formData.title || new URL(formData.url).hostname,
        collection_id: collectionId,
        is_read: false,
        is_favorite: false,
      })
      .select()
      .single()

    if (bookmark) {
      setBookmarks([bookmark, ...bookmarks])
      // Update cache
      const cached = collectionCache.get(collectionId)
      if (cached) {
        collectionCache.set(collectionId, {
          ...cached,
          bookmarks: [bookmark, ...cached.bookmarks],
          timestamp: Date.now()
        })
      }
    }

    setFormData({ url: '', title: '' })
    setAddModalOpen(false)
    setActionLoading(false)
  }

  const removeFromCollection = async (bookmarkId: string) => {
    setActionLoading(true)
    await supabase.from('bookmarks').update({ collection_id: null }).eq('id', bookmarkId)

    const updatedBookmarks = bookmarks.filter(b => b.id !== bookmarkId)
    setBookmarks(updatedBookmarks)

    // Update cache
    const cached = collectionCache.get(collectionId)
    if (cached) {
      collectionCache.set(collectionId, {
        ...cached,
        bookmarks: updatedBookmarks,
        timestamp: Date.now()
      })
    }

    setActionLoading(false)
  }

  const toggleFavorite = async (bookmarkId: string, currentStatus: boolean) => {
    const newStatus = !currentStatus

    // Optimistically update UI immediately
    const updatedBookmarks = bookmarks.map(b =>
      b.id === bookmarkId ? { ...b, is_favorite: newStatus } : b
    )
    setBookmarks(updatedBookmarks)

    // Update cache immediately
    const cached = collectionCache.get(collectionId)
    if (cached) {
      collectionCache.set(collectionId, {
        ...cached,
        bookmarks: updatedBookmarks,
        timestamp: Date.now()
      })
    }

    // Update in background
    await supabase
      .from('bookmarks')
      .update({ is_favorite: newStatus })
      .eq('id', bookmarkId)
  }

  const openDeleteModal = () => {
    setDeleteModalOpen(true)
  }

  const confirmDelete = async () => {
    if (!collection) return

    setActionLoading(true)
    await supabase.from('collections').delete().eq('id', collection.id)
    collectionCache.delete(collectionId)
    setDeleteModalOpen(false)
    setActionLoading(false)
    router.push('/collections')
  }

  const togglePublic = async () => {
    if (!collection) return

    const newStatus = !collection.is_public
    const { data } = await supabase
      .from('collections')
      .update({ is_public: newStatus })
      .eq('id', collection.id)
      .select()
      .single()

    if (data) {
      setCollection(data)
      // Update cache
      const cached = collectionCache.get(collectionId)
      if (cached) {
        collectionCache.set(collectionId, {
          ...cached,
          collection: data,
          timestamp: Date.now()
        })
      }
    }
  }

  const openEditModal = () => {
    if (!collection) return
    setEditFormData({
      name: collection.name,
      description: collection.description || '',
      is_public: collection.is_public
    })
    setEditModalOpen(true)
  }

  const updateCollection = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!collection) return

    const { data } = await supabase
      .from('collections')
      .update({
        name: editFormData.name,
        description: editFormData.description || null,
        is_public: editFormData.is_public,
      })
      .eq('id', collection.id)
      .select()
      .single()

    if (data) {
      setCollection(data)
      // Update cache
      const cached = collectionCache.get(collectionId)
      if (cached) {
        collectionCache.set(collectionId, {
          ...cached,
          collection: data,
          timestamp: Date.now()
        })
      }
      setEditModalOpen(false)
    }
  }

  const getDomain = (url: string) => {
    try {
      return new URL(url).hostname
    } catch {
      return url
    }
  }

  if (loading) {
    return null // Suspense will show the loader
  }

  if (!collection) {
    return (
      <div className="text-center py-12" style={{ color: 'var(--text-secondary)' }}>
        Collection not found
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        {/* Back button row */}
        <div className="flex items-center justify-between gap-4 mb-4">
          <Button variant="secondary" onClick={() => router.push('/collections')}>
            ← Back
          </Button>

          <div className="flex gap-2 flex-shrink-0">
            <Button onClick={() => setAddModalOpen(true)}>+ Add Bookmark</Button>
            <Button
              variant="secondary"
              onClick={openEditModal}
            >
              Edit Collection
            </Button>
            <Button
              variant="secondary"
              onClick={openDeleteModal}
              disabled={actionLoading}
              style={{ backgroundColor: '#fecaca', color: '#dc2626' }}
            >
              Delete Collection
            </Button>
          </div>
        </div>

        {/* Collection info below */}
        <div className="ml-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>
              {collection.name}
            </h1>
            <button
              onClick={togglePublic}
              className={`px-2 py-1 rounded text-xs cursor-pointer hover:opacity-80 transition-opacity ${collection.is_public ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-700'}`}
              title={`Click to make ${collection.is_public ? 'private' : 'public'}`}
            >
              {collection.is_public ? '🌐 Public' : '🔒 Private'}
            </button>
          </div>

          {/* Description and count */}
          <div className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>
            {collection.description && (
              <p>{collection.description}</p>
            )}
            <p className="mt-1">
              {bookmarks.length} bookmark{bookmarks.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
      </div>

      {/* Bookmarks List */}
      {bookmarks.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center" style={{ color: 'var(--text-secondary)' }}>
            No bookmarks in this collection yet.
            <br />
            <Button onClick={() => setAddModalOpen(true)} className="mt-4">
              + Add Your First Bookmark
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {bookmarks.map(bookmark => (
            <a
              key={bookmark.id}
              href={bookmark.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block"
            >
              <Card
                className="transition-all duration-200 hover:scale-[1.02] hover:shadow-lg cursor-pointer group"
                style={{ backgroundColor: 'var(--bg-secondary)' }}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <img
                      src={`https://www.google.com/s2/favicons?domain=${getDomain(bookmark.url)}&sz=32`}
                      className="w-10 h-10 rounded flex-shrink-0"
                      alt=""
                      loading="lazy"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate group-hover:text-blue-600 transition-colors" style={{ color: 'var(--text-primary)' }}>
                        {bookmark.title}
                      </p>
                      <p className="text-sm truncate" style={{ color: 'var(--text-secondary)' }}>{bookmark.url}</p>
                      {bookmark.description && (
                        <p className="text-sm mt-1 line-clamp-2" style={{ color: 'var(--text-secondary)' }}>
                          {bookmark.description}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="w-4"></span>
                      <button
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          toggleFavorite(bookmark.id, bookmark.is_favorite)
                        }}
                        className="p-2 rounded-lg transition-all group/star cursor-pointer"
                        title={bookmark.is_favorite ? 'Remove from favorites' : 'Add to favorites'}
                      >
                        <svg
                          className={`w-5 h-5 ${bookmark.is_favorite ? 'text-yellow-500' : 'text-gray-400 group-hover/star:text-yellow-500'}`}
                          fill={bookmark.is_favorite ? "currentColor" : "none"}
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                        </svg>
                      </button>
                      <button
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          removeFromCollection(bookmark.id)
                        }}
                        className="p-2 text-gray-400 hover:text-red-600 rounded-lg transition-all cursor-pointer"
                        title="Remove from collection"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                      <svg className="w-5 h-5 text-gray-400 hover:text-blue-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </a>
          ))}
        </div>
      )}

      {/* Add Bookmark Modal */}
      <Modal isOpen={addModalOpen} onClose={() => { setAddModalOpen(false); setFormError('') }} title="Add to Collection">
        <form onSubmit={addBookmark} className="space-y-4">
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
          {formError && (
            <p className="text-red-500 text-sm">{formError}</p>
          )}
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => { setAddModalOpen(false); setFormError('') }} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" disabled={actionLoading} className="flex-1">
              {actionLoading ? 'Adding...' : 'Add Bookmark'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={deleteModalOpen} onClose={() => setDeleteModalOpen(false)} title="Delete Collection">
        <div className="space-y-4">
          <p style={{ color: 'var(--text-secondary)' }}>
            Are you sure you want to delete <strong>"{collection?.name}"</strong>?
          </p>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Bookmarks will be kept but removed from this collection.
          </p>
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" onClick={() => setDeleteModalOpen(false)} className="flex-1">
              Cancel
            </Button>
            <Button
              onClick={confirmDelete}
              disabled={actionLoading}
              className="flex-1"
              style={{ backgroundColor: '#dc2626', color: 'white' }}
            >
              {actionLoading ? 'Deleting...' : 'Delete Collection'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit Collection Modal */}
      <Modal isOpen={editModalOpen} onClose={() => setEditModalOpen(false)} title="Edit Collection">
        <form onSubmit={updateCollection} className="space-y-4">
          <Input
            label="Collection Name"
            placeholder="My Favorite Articles"
            value={editFormData.name}
            onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
            required
          />
          <Textarea
            label="Description (optional)"
            placeholder="A collection of useful resources"
            value={editFormData.description}
            onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
            rows={3}
          />
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={editFormData.is_public}
              onChange={(e) => setEditFormData({ ...editFormData, is_public: e.target.checked })}
              className="w-4 h-4 rounded"
            />
            <span className="text-sm text-gray-900 dark:text-gray-100">Make public (shareable)</span>
          </label>
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setEditModalOpen(false)} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" className="flex-1">Save Changes</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

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

export function CollectionsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [collections, setCollections] = useState<Collection[]>([])
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([])

  const [modalOpen, setModalOpen] = useState(false)
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [selectCollectionModalOpen, setSelectCollectionModalOpen] = useState(false)
  const [selectedCollection, setSelectedCollection] = useState<Collection | null>(null)
  const [editingCollection, setEditingCollection] = useState<Collection | null>(null)
  const [pendingBookmark, setPendingBookmark] = useState<{ url: string; title: string } | null>(null)

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    is_public: false,
  })

  useEffect(() => {
    const fetchData = async () => {
      const [collectionsRes, bookmarksRes] = await Promise.all([
        supabase.from('collections').select('*').order('created_at', { ascending: false }),
        supabase.from('bookmarks').select('*').order('title', { ascending: true }),
      ])
      if (collectionsRes.data) setCollections(collectionsRes.data)
      if (bookmarksRes.data) setBookmarks(bookmarksRes.data)
    }
    fetchData()
  }, [])

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
      setCollections([data[0], ...collections])
      setModalOpen(false)
      setFormData({ name: '', description: '', is_public: false })
    }
  }

  const deleteCollection = async (id: string) => {
    if (!confirm('Delete this collection? Bookmarks will be unassigned.')) return
    await supabase.from('collections').delete().eq('id', id)
    setCollections(collections.filter(c => c.id !== id))
  }

  const togglePublic = async (collection: Collection) => {
    await supabase.from('collections').update({ is_public: !collection.is_public }).eq('id', collection.id)
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
      setCollections(collections.map(c => c.id === editingCollection.id ? data : c))
      setEditModalOpen(false)
      setEditingCollection(null)
      setFormData({ name: '', description: '', is_public: false })
    }
  }

  const addToCollection = async (bookmarkId: string, collectionId: string) => {
    await supabase.from('bookmarks').update({ collection_id: collectionId }).eq('id', bookmarkId)
    const { data } = await supabase.from('bookmarks').select('*').order('title', { ascending: true })
    if (data) setBookmarks(data)
    setAddModalOpen(false)
    setSelectedCollection(null)
  }

  const addNewBookmarkToCollection = async (collection: Collection) => {
    if (!pendingBookmark) return

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
      // Refresh bookmarks
      const { data } = await supabase.from('bookmarks').select('*').order('title', { ascending: true })
      if (data) setBookmarks(data)
    } else {
      // Create new bookmark in this collection
      await supabase.from('bookmarks').insert({
        user_id: user.id,
        url: pendingBookmark.url,
        title: pendingBookmark.title || new URL(pendingBookmark.url).hostname,
        collection_id: collection.id,
        is_read: false,
        is_favorite: false,
      })
      // Refresh bookmarks
      const { data } = await supabase.from('bookmarks').select('*').order('title', { ascending: true })
      if (data) setBookmarks(data)
    }

    setSelectCollectionModalOpen(false)
    setPendingBookmark(null)
  }

  const getCollectionBookmarks = (collectionId: string) => {
    return bookmarks.filter(b => b.collection_id === collectionId)
  }

  const shareUrl = (collection: Collection) => {
    if (typeof window !== 'undefined') {
      return `${window.location.origin}/share/${collection.share_slug}`
    }
    return ''
  }

  return (
    <>
      {collections.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center" style={{ color: 'var(--text-secondary)' }}>
            No collections yet. Create your first collection!
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {collections.map(collection => {
            const collectionBookmarks = getCollectionBookmarks(collection.id)
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
                          className="p-1 text-gray-400 hover:text-blue-600 transition-all duration-75 active:scale-90"
                          style={{ cursor: 'pointer' }}
                          title="Edit collection"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteCollection(collection.id); }}
                          className="p-1 text-gray-400 hover:text-red-600 transition-all duration-75 active:scale-90"
                          style={{ cursor: 'pointer' }}
                          title="Delete collection"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
                      {collectionBookmarks.length} bookmark{collectionBookmarks.length !== 1 ? 's' : ''}
                    </p>

                    <div className="flex gap-2 flex-wrap mb-4">
                      {collectionBookmarks.slice(0, 3).map(b => (
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
                      {collectionBookmarks.length > 3 && (
                        <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>+{collectionBookmarks.length - 3} more</span>
                      )}
                    </div>
                  </div>

                  {collection.is_public && (
                    <div className="mb-4 p-3 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                      <p className="text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Share link:</p>
                      <code className="text-xs text-blue-600 break-all">{shareUrl(collection)}</code>
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
                      onClick={(e) => { e.stopPropagation(); setSelectedCollection(collection); setAddModalOpen(true); }}
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
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="New Collection">
        <form onSubmit={createCollection} className="space-y-4">
          <Input
            label="Collection Name"
            placeholder="My Favorite Articles"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
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
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" className="flex-1">Create Collection</Button>
          </div>
        </form>
      </Modal>

      {/* Add to Collection Modal */}
      <Modal isOpen={addModalOpen} onClose={() => setAddModalOpen(false)} title="Add Bookmark">
        {selectedCollection && (
          <div className="space-y-4">
            <p style={{ color: 'var(--text-secondary)' }}>
              Select a bookmark to add to <strong>{selectedCollection.name}</strong>
            </p>
            <div className="max-h-64 overflow-y-auto space-y-2">
              {bookmarks.filter(b => b.collection_id !== selectedCollection.id).map(bookmark => (
                <button
                  key={bookmark.id}
                  onClick={() => addToCollection(bookmark.id, selectedCollection.id)}
                  className="w-full text-left p-3 rounded-lg transition-all duration-75 active:scale-98"
                  style={{ color: 'var(--text-primary)', cursor: 'pointer' }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-secondary)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent' }}
                >
                  <p className="font-medium truncate" style={{ color: 'var(--text-primary)' }}>{bookmark.title}</p>
                  <p className="text-sm truncate" style={{ color: 'var(--text-secondary)' }}>{bookmark.url}</p>
                </button>
              ))}
              {bookmarks.filter(b => b.collection_id !== selectedCollection.id).length === 0 && (
                <p style={{ color: 'var(--text-secondary)' }} className="text-center py-4">No bookmarks available</p>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Edit Collection Modal */}
      <Modal isOpen={editModalOpen} onClose={() => setEditModalOpen(false)} title="Edit Collection">
        <form onSubmit={updateCollection} className="space-y-4">
          <Input
            label="Collection Name"
            placeholder="My Favorite Articles"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
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
            <Button type="button" variant="secondary" onClick={() => setEditModalOpen(false)} className="flex-1">
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
    </>
  )
}

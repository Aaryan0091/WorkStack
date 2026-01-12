'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import { Modal } from '@/components/ui/modal'
import { Textarea } from '@/components/ui/input'
import type { Bookmark } from '@/lib/types'

export function ReadingListContent() {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([])
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedBookmark, setSelectedBookmark] = useState<Bookmark | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      const { data } = await supabase.from('bookmarks').select('*').order('created_at', { ascending: false })
      if (data) setBookmarks(data)
    }
    fetchData()
  }, [])

  const toggleRead = async (bookmark: Bookmark) => {
    await supabase.from('bookmarks').update({ is_read: !bookmark.is_read }).eq('id', bookmark.id)
    setBookmarks(bookmarks.map(b => b.id === bookmark.id ? { ...b, is_read: !b.is_read } : b))
  }

  const updateNotes = async (bookmark: Bookmark, notes: string) => {
    await supabase.from('bookmarks').update({ notes }).eq('id', bookmark.id)
    setBookmarks(bookmarks.map(b => b.id === bookmark.id ? { ...b, notes } : b))
    setModalOpen(false)
  }

  const openNotesModal = (bookmark: Bookmark) => {
    setSelectedBookmark(bookmark)
    setModalOpen(true)
  }

  const filteredBookmarks = bookmarks.filter(b => {
    if (filter === 'unread') return !b.is_read
    if (filter === 'read') return b.is_read
    return true
  })

  const unreadCount = bookmarks.filter(b => !b.is_read).length
  const readCount = bookmarks.filter(b => b.is_read).length

  return (
    <>
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{bookmarks.length}</p>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Total</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-blue-600">{unreadCount}</p>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Unread</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{readCount}</p>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Read</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {(['all', 'unread', 'read'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="px-4 py-2 rounded-lg capitalize transition-all duration-75 active:scale-90"
            style={{
              backgroundColor: filter === f ? '#2563eb' : 'var(--bg-secondary)',
              color: filter === f ? 'white' : 'var(--text-primary)',
              cursor: 'pointer'
            }}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Reading List */}
      {filteredBookmarks.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center" style={{ color: 'var(--text-secondary)' }}>
            {filter === 'unread' ? "No unread items! 🎉" : "No bookmarks yet."}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredBookmarks.map(bookmark => (
            <Card key={bookmark.id} className={`${!bookmark.is_read ? 'border-l-4 border-l-blue-500' : ''}`}>
              <CardContent className="p-4">
                <div className="flex gap-4">
                  <button
                    onClick={() => toggleRead(bookmark)}
                    className={`mt-1 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-75 active:scale-90 flex-shrink-0 ${
                      bookmark.is_read
                        ? 'bg-green-500 border-green-500 text-white'
                        : 'border-gray-300 hover:border-green-500'
                    }`}
                    style={{ cursor: 'pointer' }}
                  >
                    {bookmark.is_read && (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>

                  <div className="flex-1 min-w-0">
                    <a
                      href={bookmark.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium hover:text-blue-600"
                      style={{ color: 'var(--text-primary)' }}
                      onClick={() => !bookmark.is_read && toggleRead(bookmark)}
                    >
                      {bookmark.title}
                    </a>
                    <p className="text-sm truncate" style={{ color: 'var(--text-secondary)' }}>{bookmark.url}</p>
                    {bookmark.description && (
                      <p className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>{bookmark.description}</p>
                    )}
                    {bookmark.notes && (
                      <div className="mt-2 p-2 rounded text-sm" style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>
                        📝 {bookmark.notes}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => openNotesModal(bookmark)}
                    className="p-2 text-gray-400 hover:text-blue-600 transition-all duration-75 active:scale-90"
                    title="Add notes"
                    style={{ cursor: 'pointer' }}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Notes Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Notes">
        {selectedBookmark && (
          <form onSubmit={(e) => { e.preventDefault(); updateNotes(selectedBookmark, selectedBookmark.notes || '') }}>
            <Textarea
              placeholder="Add your notes, highlights, or thoughts..."
              value={selectedBookmark.notes || ''}
              onChange={(e) => setSelectedBookmark({ ...selectedBookmark, notes: e.target.value })}
              rows={6}
            />
            <div className="flex gap-3 mt-4">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 rounded-lg flex-1"
                style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg flex-1 bg-blue-600 text-white"
                style={{ cursor: 'pointer' }}
              >
                Save Notes
              </button>
            </div>
          </form>
        )}
      </Modal>
    </>
  )
}

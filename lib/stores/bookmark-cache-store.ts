import { create } from 'zustand'

import type { Bookmark } from '@/lib/types'

interface BookmarkCacheStore {
  bookmarksById: Record<string, Bookmark>
  removedIds: Record<string, true>
  viewerId: string | null
  version: number
  hydrateBookmarks: (bookmarks: Bookmark[], viewerId?: string | null) => void
  upsertBookmark: (bookmark: Bookmark) => void
  removeBookmark: (bookmarkId: string) => void
  applyBookmarks: (bookmarks: Bookmark[]) => Bookmark[]
  clear: () => void
}

export const useBookmarkCacheStore = create<BookmarkCacheStore>((set, get) => ({
  bookmarksById: {},
  removedIds: {},
  viewerId: null,
  version: 0,

  hydrateBookmarks: (bookmarks, viewerId = null) => {
    set((state) => {
      const shouldResetViewer = state.viewerId !== null && viewerId !== null && state.viewerId !== viewerId
      const nextBookmarksById = shouldResetViewer ? {} : { ...state.bookmarksById }
      const nextRemovedIds = shouldResetViewer ? {} : { ...state.removedIds }

      for (const bookmark of bookmarks) {
        nextBookmarksById[bookmark.id] = bookmark
        delete nextRemovedIds[bookmark.id]
      }

      return {
        bookmarksById: nextBookmarksById,
        removedIds: nextRemovedIds,
        viewerId: viewerId ?? state.viewerId,
        version: state.version + 1,
      }
    })
  },

  upsertBookmark: (bookmark) => {
    set((state) => {
      const nextRemovedIds = { ...state.removedIds }
      delete nextRemovedIds[bookmark.id]

      return {
        bookmarksById: {
          ...state.bookmarksById,
          [bookmark.id]: bookmark,
        },
        removedIds: nextRemovedIds,
        version: state.version + 1,
      }
    })
  },

  removeBookmark: (bookmarkId) => {
    set((state) => {
      const nextBookmarksById = { ...state.bookmarksById }
      delete nextBookmarksById[bookmarkId]

      return {
        bookmarksById: nextBookmarksById,
        removedIds: {
          ...state.removedIds,
          [bookmarkId]: true,
        },
        version: state.version + 1,
      }
    })
  },

  applyBookmarks: (bookmarks) => {
    const { bookmarksById, removedIds } = get()

    return bookmarks
      .filter((bookmark) => !removedIds[bookmark.id])
      .map((bookmark) => bookmarksById[bookmark.id] || bookmark)
  },

  clear: () => {
    set({
      bookmarksById: {},
      removedIds: {},
      viewerId: null,
      version: 0,
    })
  },
}))

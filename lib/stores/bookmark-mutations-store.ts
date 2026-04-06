import { create } from 'zustand'

import {
  guestStoreGet,
  guestStoreSet,
  GUEST_KEYS,
} from '@/lib/guest-storage'
import { useBookmarkCacheStore } from '@/lib/stores/bookmark-cache-store'
import { supabase } from '@/lib/supabase'
import type { Bookmark } from '@/lib/types'

type BookmarkMutationKind = 'favorite' | 'read' | 'delete' | 'notes' | 'open'

interface BookmarkMutationStore {
  pendingById: Record<string, BookmarkMutationKind>
  isPending: (bookmarkId: string) => boolean
  setBookmarkFavorite: (bookmark: Bookmark, nextFavorite: boolean, options: { isGuest: boolean }) => Promise<Bookmark>
  setBookmarkRead: (bookmark: Bookmark, nextRead: boolean, options: { isGuest: boolean }) => Promise<Bookmark>
  updateBookmarkNotes: (bookmark: Bookmark, notes: string, options: { isGuest: boolean }) => Promise<Bookmark>
  deleteBookmark: (bookmarkId: string, options: { isGuest: boolean }) => Promise<void>
  markBookmarkOpened: (bookmarkId: string, token: string) => Promise<string | null>
}

function withGuestBookmarks(
  updateBookmarks: (bookmarks: Bookmark[]) => Bookmark[],
  getUpdatedBookmark?: (bookmarks: Bookmark[]) => Bookmark | null
) {
  const storedBookmarks = guestStoreGet<Bookmark[]>(GUEST_KEYS.BOOKMARKS) || []
  const nextBookmarks = updateBookmarks(storedBookmarks)
  guestStoreSet(GUEST_KEYS.BOOKMARKS, nextBookmarks)

  return {
    bookmarks: nextBookmarks,
    bookmark: getUpdatedBookmark ? getUpdatedBookmark(nextBookmarks) : null,
  }
}

export const useBookmarkMutationsStore = create<BookmarkMutationStore>((set, get) => {
  const runMutation = async <T>(
    bookmarkId: string,
    kind: BookmarkMutationKind,
    mutation: () => Promise<T>
  ): Promise<T> => {
    if (get().pendingById[bookmarkId]) {
      throw new Error(`Bookmark ${kind} mutation already in progress`)
    }

    set((state) => ({
      pendingById: {
        ...state.pendingById,
        [bookmarkId]: kind,
      },
    }))

    try {
      return await mutation()
    } finally {
      set((state) => {
        const nextPending = { ...state.pendingById }
        delete nextPending[bookmarkId]
        return { pendingById: nextPending }
      })
    }
  }

  return {
    pendingById: {},

    isPending: (bookmarkId) => Boolean(get().pendingById[bookmarkId]),

    setBookmarkFavorite: async (bookmark, nextFavorite, { isGuest }) => {
      return runMutation(bookmark.id, 'favorite', async () => {
        if (isGuest) {
          const { bookmark: updatedBookmark } = withGuestBookmarks(
            (bookmarks) => bookmarks.map((item) => (
              item.id === bookmark.id ? { ...item, is_favorite: nextFavorite } : item
            )),
            (bookmarks) => bookmarks.find((item) => item.id === bookmark.id) || null
          )

          const nextBookmark = updatedBookmark || { ...bookmark, is_favorite: nextFavorite }
          useBookmarkCacheStore.getState().upsertBookmark(nextBookmark)
          return nextBookmark
        }

        const { data } = await supabase
          .from('bookmarks')
          .update({ is_favorite: nextFavorite })
          .eq('id', bookmark.id)
          .select()
          .single()

        const updatedBookmark = (data as Bookmark | null) || { ...bookmark, is_favorite: nextFavorite }
        useBookmarkCacheStore.getState().upsertBookmark(updatedBookmark)
        return updatedBookmark
      })
    },

    setBookmarkRead: async (bookmark, nextRead, { isGuest }) => {
      return runMutation(bookmark.id, 'read', async () => {
        if (isGuest) {
          const { bookmark: updatedBookmark } = withGuestBookmarks(
            (bookmarks) => bookmarks.map((item) => (
              item.id === bookmark.id ? { ...item, is_read: nextRead } : item
            )),
            (bookmarks) => bookmarks.find((item) => item.id === bookmark.id) || null
          )

          const nextBookmark = updatedBookmark || { ...bookmark, is_read: nextRead }
          useBookmarkCacheStore.getState().upsertBookmark(nextBookmark)
          return nextBookmark
        }

        const { data } = await supabase
          .from('bookmarks')
          .update({ is_read: nextRead })
          .eq('id', bookmark.id)
          .select()
          .single()

        const updatedBookmark = (data as Bookmark | null) || { ...bookmark, is_read: nextRead }
        useBookmarkCacheStore.getState().upsertBookmark(updatedBookmark)
        return updatedBookmark
      })
    },

    updateBookmarkNotes: async (bookmark, notes, { isGuest }) => {
      return runMutation(bookmark.id, 'notes', async () => {
        if (isGuest) {
          const { bookmark: updatedBookmark } = withGuestBookmarks(
            (bookmarks) => bookmarks.map((item) => (
              item.id === bookmark.id ? { ...item, notes } : item
            )),
            (bookmarks) => bookmarks.find((item) => item.id === bookmark.id) || null
          )

          const nextBookmark = updatedBookmark || { ...bookmark, notes }
          useBookmarkCacheStore.getState().upsertBookmark(nextBookmark)
          return nextBookmark
        }

        const { data } = await supabase
          .from('bookmarks')
          .update({ notes })
          .eq('id', bookmark.id)
          .select()
          .single()

        const updatedBookmark = (data as Bookmark | null) || { ...bookmark, notes }
        useBookmarkCacheStore.getState().upsertBookmark(updatedBookmark)
        return updatedBookmark
      })
    },

    deleteBookmark: async (bookmarkId, { isGuest }) => {
      return runMutation(bookmarkId, 'delete', async () => {
        if (isGuest) {
          withGuestBookmarks((bookmarks) => bookmarks.filter((item) => item.id !== bookmarkId))
          useBookmarkCacheStore.getState().removeBookmark(bookmarkId)
          return
        }

        await supabase.from('bookmarks').delete().eq('id', bookmarkId)
        useBookmarkCacheStore.getState().removeBookmark(bookmarkId)
      })
    },

    markBookmarkOpened: async (bookmarkId, token) => {
      return runMutation(bookmarkId, 'open', async () => {
        const response = await fetch(`/api/bookmarks/${bookmarkId}/open`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        })

        if (!response.ok) {
          return null
        }

        const lastOpenedAt = new Date().toISOString()
        const cachedBookmark = useBookmarkCacheStore.getState().bookmarksById[bookmarkId]
        if (cachedBookmark) {
          useBookmarkCacheStore.getState().upsertBookmark({
            ...cachedBookmark,
            last_opened_at: lastOpenedAt,
          })
        }
        return lastOpenedAt
      })
    },
  }
})

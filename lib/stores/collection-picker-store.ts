import { create } from 'zustand'

import { supabase } from '@/lib/supabase'
import type { Collection } from '@/lib/types'

export interface CollectionPickerItem {
  id: string
  name: string
  description: string | null
  is_public: boolean
}

interface LoadCollectionsOptions {
  force?: boolean
}

interface CollectionPickerStore {
  collections: CollectionPickerItem[]
  loading: boolean
  loaded: boolean
  userId: string | null
  lastLoadedAt: number | null
  hydrateCollections: (collections: Array<Collection | CollectionPickerItem>) => void
  clearCollections: () => void
  addCollection: (collection: Collection | CollectionPickerItem) => void
  upsertCollection: (collection: Collection | CollectionPickerItem) => void
  removeCollection: (collectionId: string) => void
  invalidateCollections: () => void
  loadCollections: (options?: LoadCollectionsOptions) => Promise<CollectionPickerItem[]>
}

const COLLECTIONS_CACHE_TTL = 30_000
let inFlightCollectionsLoad: Promise<CollectionPickerItem[]> | null = null

function normalizeCollections(collections: Array<Collection | CollectionPickerItem>): CollectionPickerItem[] {
  return collections.map((collection) => ({
    id: collection.id,
    name: collection.name,
    description: collection.description ?? null,
    is_public: collection.is_public
  }))
}

function deriveCollectionUserId(collections: Array<Collection | CollectionPickerItem>): string | null {
  const firstCollection = collections.find((collection): collection is Collection => 'user_id' in collection)
  return firstCollection?.user_id || null
}

export const useCollectionPickerStore = create<CollectionPickerStore>((set, get) => ({
  collections: [],
  loading: false,
  loaded: false,
  userId: null,
  lastLoadedAt: null,

  hydrateCollections: (collections) => {
    set({
      collections: normalizeCollections(collections),
      loaded: true,
      loading: false,
      userId: deriveCollectionUserId(collections),
      lastLoadedAt: Date.now()
    })
  },

  clearCollections: () => {
    set({
      collections: [],
      loading: false,
      loaded: false,
      userId: null,
      lastLoadedAt: null
    })
  },

  addCollection: (collection) => {
    const normalizedCollection = normalizeCollections([collection])[0]
    set((state) => ({
      collections: [normalizedCollection, ...state.collections.filter((item) => item.id !== normalizedCollection.id)],
      loaded: true,
      lastLoadedAt: Date.now(),
      userId: deriveCollectionUserId([collection]) || state.userId
    }))
  },

  upsertCollection: (collection) => {
    const normalizedCollection = normalizeCollections([collection])[0]
    set((state) => {
      const existingIndex = state.collections.findIndex((item) => item.id === normalizedCollection.id)
      if (existingIndex === -1) {
        return {
          collections: [normalizedCollection, ...state.collections],
          loaded: true,
          lastLoadedAt: Date.now(),
          userId: deriveCollectionUserId([collection]) || state.userId
        }
      }

      const nextCollections = [...state.collections]
      nextCollections[existingIndex] = normalizedCollection

      return {
        collections: nextCollections,
        loaded: true,
        lastLoadedAt: Date.now(),
        userId: deriveCollectionUserId([collection]) || state.userId
      }
    })
  },

  removeCollection: (collectionId) => {
    set((state) => ({
      collections: state.collections.filter((collection) => collection.id !== collectionId),
      loaded: true,
      lastLoadedAt: Date.now()
    }))
  },

  invalidateCollections: () => {
    set((state) => ({
      ...state,
      loaded: false,
      lastLoadedAt: null
    }))
  },

  loadCollections: async ({ force = false } = {}) => {
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      get().clearCollections()
      return []
    }

    const state = get()
    const isFresh =
      state.loaded &&
      state.userId === user.id &&
      state.lastLoadedAt !== null &&
      Date.now() - state.lastLoadedAt < COLLECTIONS_CACHE_TTL

    if (!force && isFresh) {
      return state.collections
    }

    if (inFlightCollectionsLoad) {
      return inFlightCollectionsLoad
    }

    set({ loading: true, userId: user.id })

    inFlightCollectionsLoad = (async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      if (!token) {
        get().clearCollections()
        return []
      }

      const response = await fetch('/api/collections?all=true&minimal=true', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!response.ok) {
        throw new Error('Failed to load collections')
      }

      const result = await response.json()
      const collections = normalizeCollections(result.collections || [])

      set({
        collections,
        loading: false,
        loaded: true,
        userId: user.id,
        lastLoadedAt: Date.now()
      })

      return collections
    })()

    try {
      return await inFlightCollectionsLoad
    } catch (error) {
      set({ loading: false })
      throw error
    } finally {
      inFlightCollectionsLoad = null
    }
  }
}))

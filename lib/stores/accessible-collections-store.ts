import { create } from 'zustand'

import { supabase } from '@/lib/supabase'
import type { Collection } from '@/lib/types'

interface LoadAccessibleCollectionsOptions {
  force?: boolean
}

interface HydrateAccessibleCollectionsOptions {
  viewerId?: string | null
}

interface AccessibleCollectionsStore {
  collections: Collection[]
  loading: boolean
  loaded: boolean
  viewerId: string | null
  lastLoadedAt: number | null
  hydrateCollections: (collections: Collection[], options?: HydrateAccessibleCollectionsOptions) => void
  clearCollections: () => void
  loadAccessibleCollections: (options?: LoadAccessibleCollectionsOptions) => Promise<Collection[]>
}

const ACCESSIBLE_COLLECTIONS_TTL = 30_000
let inFlightAccessibleCollectionsLoad: Promise<Collection[]> | null = null

function normalizeCollections(collections: Collection[]) {
  const seenIds = new Set<string>()

  return collections
    .filter((collection) => {
      if (seenIds.has(collection.id)) return false
      seenIds.add(collection.id)
      return true
    })
    .sort((a, b) => a.name.localeCompare(b.name))
}

export const useAccessibleCollectionsStore = create<AccessibleCollectionsStore>((set, get) => ({
  collections: [],
  loading: false,
  loaded: false,
  viewerId: null,
  lastLoadedAt: null,

  hydrateCollections: (collections, { viewerId = null } = {}) => {
    set((state) => ({
      collections: normalizeCollections(collections),
      loading: false,
      loaded: true,
      viewerId: viewerId ?? state.viewerId,
      lastLoadedAt: Date.now(),
    }))
  },

  clearCollections: () => {
    set({
      collections: [],
      loading: false,
      loaded: false,
      viewerId: null,
      lastLoadedAt: null,
    })
  },

  loadAccessibleCollections: async ({ force = false } = {}) => {
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      get().clearCollections()
      return []
    }

    const state = get()
    const isFresh =
      state.loaded &&
      state.viewerId === user.id &&
      state.lastLoadedAt !== null &&
      Date.now() - state.lastLoadedAt < ACCESSIBLE_COLLECTIONS_TTL

    if (!force && isFresh) {
      return state.collections
    }

    if (inFlightAccessibleCollectionsLoad) {
      return inFlightAccessibleCollectionsLoad
    }

    set({ loading: true, viewerId: user.id })

    inFlightAccessibleCollectionsLoad = (async () => {
      const [ownedCollectionsRes, sharedCollectionsRes] = await Promise.all([
        supabase
          .from('collections')
          .select('*')
          .eq('user_id', user.id)
          .order('name'),
        supabase
          .from('shared_collections')
          .select('collection_id, collections(*)')
          .eq('user_id', user.id),
      ])

      const collections = normalizeCollections([
        ...(ownedCollectionsRes.data || []),
        ...(sharedCollectionsRes.data?.flatMap((row: { collections: Collection[] | Collection | null }) => {
          if (!row.collections) return []
          return Array.isArray(row.collections) ? row.collections : [row.collections]
        }) || []),
      ])

      set({
        collections,
        loading: false,
        loaded: true,
        viewerId: user.id,
        lastLoadedAt: Date.now(),
      })

      return collections
    })()

    try {
      return await inFlightAccessibleCollectionsLoad
    } catch (error) {
      set({ loading: false })
      throw error
    } finally {
      inFlightAccessibleCollectionsLoad = null
    }
  },
}))

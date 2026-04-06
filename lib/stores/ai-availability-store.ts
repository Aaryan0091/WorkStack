import { create } from 'zustand'

interface AiAvailabilityStore {
  enabled: boolean
  loading: boolean
  loaded: boolean
  loadAiAvailability: (options?: { force?: boolean }) => Promise<boolean>
}

let inFlightAiAvailabilityLoad: Promise<boolean> | null = null

export const useAiAvailabilityStore = create<AiAvailabilityStore>((set, get) => ({
  enabled: false,
  loading: false,
  loaded: false,

  loadAiAvailability: async ({ force = false } = {}) => {
    const state = get()

    if (!force && state.loaded) {
      return state.enabled
    }

    if (inFlightAiAvailabilityLoad) {
      return inFlightAiAvailabilityLoad
    }

    set({ loading: true })

    inFlightAiAvailabilityLoad = (async () => {
      try {
        const response = await fetch('/api/ai/suggest-tags')
        const data = await response.json().catch(() => ({ enabled: false }))
        const enabled = Boolean(data?.enabled)

        set({
          enabled,
          loading: false,
          loaded: true
        })

        return enabled
      } catch {
        set({
          enabled: false,
          loading: false,
          loaded: true
        })
        return false
      }
    })()

    try {
      return await inFlightAiAvailabilityLoad
    } finally {
      inFlightAiAvailabilityLoad = null
    }
  }
}))

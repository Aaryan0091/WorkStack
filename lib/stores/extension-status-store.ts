import { create } from 'zustand'

import {
  checkExtensionLocal,
  checkExtensionWithTimeout,
  getExtensionId,
  isExtensionInstalledViaContentScript,
} from '@/lib/extension-detect'

interface RefreshExtensionStatusOptions {
  timeoutMs?: number
  retries?: number
  delayMs?: number
}

interface ExtensionStatusStore {
  installed: boolean | null
  extensionId: string | null
  checking: boolean
  listening: boolean
  ensureListening: () => boolean
  refreshInstalled: (options?: RefreshExtensionStatusOptions) => Promise<boolean>
  markInstalled: (extensionId?: string | null) => void
}

let listenersInitialized = false

function syncInstalledState() {
  const installed = isExtensionInstalledViaContentScript()
  const extensionId = getExtensionId()

  if (installed) {
    useExtensionStatusStore.setState({
      installed: true,
      extensionId,
    })
  }

  return installed
}

function initializeExtensionListeners() {
  if (typeof window === 'undefined' || listenersInitialized) {
    return syncInstalledState()
  }

  listenersInitialized = true

  const markInstalled = (extensionId?: string | null) => {
    useExtensionStatusStore.setState({
      installed: true,
      extensionId: extensionId || getExtensionId(),
      checking: false,
      listening: true,
    })
  }

  window.addEventListener('workstack-extension-loaded', (event: Event) => {
    const customEvent = event as CustomEvent<{ extensionId?: string }>
    markInstalled(customEvent.detail?.extensionId || null)
  })

  window.addEventListener('message', (event: MessageEvent) => {
    if (event.data?.type === 'workstack-extension-installed') {
      markInstalled((event.data.extensionId as string | undefined) || null)
    }
  })

  const installed = syncInstalledState()
  useExtensionStatusStore.setState({ listening: true })
  return installed
}

export const useExtensionStatusStore = create<ExtensionStatusStore>((set) => ({
  installed: null,
  extensionId: null,
  checking: false,
  listening: false,

  ensureListening: () => initializeExtensionListeners(),

  refreshInstalled: async ({ timeoutMs, retries = 3, delayMs = 200 } = {}) => {
    const syncDetected = initializeExtensionListeners()
    if (syncDetected) {
      return true
    }

    set({ checking: true, listening: true })

    const detected = timeoutMs
      ? await checkExtensionWithTimeout(timeoutMs)
      : await checkExtensionLocal(retries, delayMs)

    set({
      installed: detected,
      extensionId: detected ? getExtensionId() : null,
      checking: false,
      listening: true,
    })

    return detected
  },

  markInstalled: (extensionId) => {
    set({
      installed: true,
      extensionId: extensionId || getExtensionId(),
      checking: false,
      listening: true,
    })
  },
}))

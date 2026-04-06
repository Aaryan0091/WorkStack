'use client'

import { useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { getExtensionId } from '@/lib/extension-detect'

const isDev = process.env.NODE_ENV === 'development'

export function ExtensionSync() {
  const syncAttempted = useRef(false)

  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') return

    const chrome = (window as typeof window & { chrome?: { runtime?: { sendMessage?: (id: string, msg: Record<string, unknown>, cb: (r: { success?: boolean } | undefined) => void) => void; lastError?: { message?: string } } } }).chrome
    if (!chrome?.runtime) return

    // Function to sync auth token to extension with improved timeout handling
    const syncToken = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()

        if (sessionError) {
          console.warn('[Extension Sync] Session error:', sessionError.message)
          return
        }

        if (!session?.access_token) {
          if (isDev) console.log('[Extension Sync] No active session')
          return
        }

        const extensionId = getExtensionId()
        if (!extensionId) {
          if (isDev) {
            console.log('[Extension Sync] Extension ID not available yet')
          }
          return
        }

        // Use a more reliable timeout pattern
        const TIMEOUT_MS = 2000
        let timeoutId: NodeJS.Timeout | null = null
        let responseReceived = false

        // Set timeout
        timeoutId = setTimeout(() => {
          if (!responseReceived && isDev) {
            console.log('[Extension Sync] No response (extension may not be installed)')
          }
        }, TIMEOUT_MS)

        // Send message to extension
        chrome.runtime?.sendMessage?.(extensionId, {
          action: 'storeAuthToken',
          authToken: session.access_token,
          apiBaseUrl: window.location.origin
        }, (response: { success?: boolean } | undefined) => {
          // Clear timeout if we got a response
          if (timeoutId) {
            clearTimeout(timeoutId)
            timeoutId = null
          }

          responseReceived = true

          if (chrome.runtime?.lastError) {
            const errorMsg = chrome.runtime.lastError.message || 'Unknown error'
            console.error('[Extension Sync] Failed to communicate with extension:', errorMsg)
          } else if (response?.success) {
            if (isDev) console.log('[Extension Sync] Auth token synced successfully')
          } else {
            console.warn('[Extension Sync] Extension responded but success is not true')
          }
        })
      } catch (error) {
        console.error('[Extension Sync] Unexpected error:', error)
      }
    }

    // Sync token on mount (once)
    if (!syncAttempted.current) {
      syncAttempted.current = true
      syncToken()
    }

    // Listen for auth state changes and sync token
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: string, session: { access_token?: string } | null) => {
      if (isDev) console.log('[Extension Sync] Auth state changed:', event)

      if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        if (session?.access_token) {
          const extensionId = getExtensionId()
          if (!extensionId) {
            if (isDev) {
              console.log('[Extension Sync] Skipping auth sync because extension ID is unavailable')
            }
            return
          }

          const TIMEOUT_MS = 2000
          let timeoutId: NodeJS.Timeout | null = null
          let responseReceived = false

          timeoutId = setTimeout(() => {
            if (!responseReceived && isDev) {
              console.log('[Extension Sync] No response after auth change')
            }
          }, TIMEOUT_MS)

          chrome.runtime?.sendMessage?.(extensionId, {
            action: 'storeAuthToken',
            authToken: session.access_token,
            apiBaseUrl: window.location.origin
          }, () => {
            if (timeoutId) {
              clearTimeout(timeoutId)
              timeoutId = null
            }

            responseReceived = true

            if (chrome.runtime?.lastError) {
              const errorMsg = chrome.runtime.lastError.message || 'Unknown error'
              console.error('[Extension Sync] Failed to sync token after auth change:', errorMsg)
            } else {
              if (isDev) console.log('[Extension Sync] Token synced after', event)
            }
          })
        }
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  return null
}

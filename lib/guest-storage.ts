'use client'

// Key to track if user signed in during this session
const SIGNED_IN_KEY = 'workstack_signed_in_this_session'
const GUEST_MODE_KEY = 'workstack_is_guest_mode'

// Simple helpers for localStorage (persists on refresh, cleared on browser close)
// We use localStorage for data persistence and clear it on beforeunload
export function guestStoreGet(key: string): any {
  if (typeof window === 'undefined') return null
  try {
    const item = localStorage.getItem(key)
    return item ? JSON.parse(item) : null
  } catch { return null }
}

export function guestStoreSet(key: string, value: any): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (e) { console.error('localStorage error:', e) }
}

export function guestStoreRemove(key: string): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(key)
}

// Keys for localStorage
export const GUEST_KEYS = {
  BOOKMARKS: 'workstack_guest_bookmarks',
  COLLECTIONS: 'workstack_guest_collections',
  TAGS: 'workstack_guest_tags',
  SIGNED_IN: SIGNED_IN_KEY,
  GUEST_MODE: GUEST_MODE_KEY
}

/**
 * Mark that the user has signed in
 * This prevents guest data from being cleared on browser close
 */
export function markUserSignedIn(): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(SIGNED_IN_KEY, 'true')
    // Clear guest mode flag since user is now signed in
    localStorage.removeItem(GUEST_MODE_KEY)
  } catch (e) { console.error('localStorage error:', e) }
}

/**
 * Mark user as guest mode (data persists on refresh, clears on close)
 */
export function markGuestMode(): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(GUEST_MODE_KEY, 'true')
  } catch (e) { console.error('localStorage error:', e) }
}

/**
 * Check if user signed in
 */
export function hasUserSignedIn(): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(SIGNED_IN_KEY) === 'true'
}

/**
 * Check if user is in guest mode
 */
export function isGuestMode(): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(GUEST_MODE_KEY) === 'true' && !hasUserSignedIn()
}

/**
 * Clear all guest data
 * Call this when user closes site without signing in
 */
export function clearGuestData(): void {
  if (typeof window === 'undefined') return
  try {
    Object.values(GUEST_KEYS).forEach(key => {
      localStorage.removeItem(key)
    })
  } catch (e) { console.error('Error clearing guest data:', e) }
}

/**
 * Get all guest data for syncing
 */
export function getAllGuestData(): {
  bookmarks: any[] | null
  collections: any[] | null
  tags: any[] | null
} {
  return {
    bookmarks: guestStoreGet(GUEST_KEYS.BOOKMARKS),
    collections: guestStoreGet(GUEST_KEYS.COLLECTIONS),
    tags: guestStoreGet(GUEST_KEYS.TAGS)
  }
}

/**
 * Setup cleanup listener for guest mode
 * Clears data when browser is closed (beforeunload) if user hasn't signed in
 */
export function setupGuestCleanup(): () => void {
  if (typeof window === 'undefined') return () => {}

  const handleBeforeUnload = (e: BeforeUnloadEvent) => {
    // Only clear if user is still in guest mode (never signed in)
    if (!hasUserSignedIn() && isGuestMode()) {
      clearGuestData()
    }
  }

  // Listen for page unload (browser close)
  window.addEventListener('beforeunload', handleBeforeUnload)

  // Return cleanup function
  return () => {
    window.removeEventListener('beforeunload', handleBeforeUnload)
  }
}

/**
 * Check if there's any guest data stored
 */
export function hasGuestData(): boolean {
  if (typeof window === 'undefined') return false
  return Object.values(GUEST_KEYS).some(key => {
    if (key === SIGNED_IN_KEY || key === GUEST_MODE_KEY) return false
    return localStorage.getItem(key) !== null
  })
}

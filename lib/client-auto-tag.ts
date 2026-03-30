import { supabase } from '@/lib/supabase'

async function getAccessToken(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token

  if (!token) {
    throw new Error('Missing auth session for auto-tagging')
  }

  return token
}

async function postAutoTag(bookmarkId: string, token: string): Promise<void> {
  const response = await fetch(`${window.location.origin}/api/ai/auto-tag`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ bookmark_id: bookmarkId })
  })

  if (!response.ok) {
    let errorMessage = 'Failed to auto-tag bookmark'

    try {
      const payload = await response.json()
      if (payload?.error) {
        errorMessage = payload.error
      }
    } catch {
      // Ignore response parsing errors and use the default message.
    }

    throw new Error(errorMessage)
  }
}

export async function autoTagBookmark(bookmarkId: string): Promise<void> {
  const token = await getAccessToken()
  await postAutoTag(bookmarkId, token)
}

export async function autoTagBookmarks(bookmarkIds: string[]): Promise<void> {
  const validBookmarkIds = bookmarkIds.filter(Boolean)
  if (validBookmarkIds.length === 0) return

  const token = await getAccessToken()
  const results = await Promise.allSettled(
    validBookmarkIds.map((bookmarkId) => postAutoTag(bookmarkId, token))
  )

  const failures = results.filter((result) => result.status === 'rejected')
  if (failures.length > 0) {
    throw new Error(`Failed to auto-tag ${failures.length} bookmark(s)`)
  }
}

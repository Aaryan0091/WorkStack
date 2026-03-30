import { supabase } from '@/lib/supabase'
import type { Bookmark } from '@/lib/types'

interface CreateBookmarkPayload {
  url: string
  title?: string
  description?: string | null
  notes?: string | null
  folder_id?: string | null
  collection_id?: string | null
}

interface CreateBookmarkResult {
  bookmark: Bookmark | null
  updated: boolean
  duplicate: boolean
}

interface CreateBookmarkBatchResult {
  ok: boolean
  result?: CreateBookmarkResult
  error?: unknown
}

async function getAccessToken(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token

  if (!token) {
    throw new Error('Missing auth session for bookmark creation')
  }

  return token
}

async function createBookmarkViaApiWithToken(
  payload: CreateBookmarkPayload,
  token: string
): Promise<CreateBookmarkResult> {
  const response = await fetch(`${window.location.origin}/api/bookmarks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  })

  if (response.status === 409) {
    return { bookmark: null, updated: false, duplicate: true }
  }

  const result = await response.json()

  if (!response.ok || !result?.success) {
    throw new Error(result?.error || 'Failed to create bookmark')
  }

  return {
    bookmark: result.data?.bookmark || null,
    updated: Boolean(result.data?.updated),
    duplicate: false
  }
}

export async function createBookmarkViaApi(payload: CreateBookmarkPayload): Promise<CreateBookmarkResult> {
  const token = await getAccessToken()
  return createBookmarkViaApiWithToken(payload, token)
}

export async function createBookmarksViaApi(payloads: CreateBookmarkPayload[]): Promise<CreateBookmarkBatchResult[]> {
  if (payloads.length === 0) return []

  const token = await getAccessToken()
  const results = await Promise.allSettled(
    payloads.map((payload) => createBookmarkViaApiWithToken(payload, token))
  )

  return results.map((result) => {
    if (result.status === 'fulfilled') {
      return { ok: true, result: result.value }
    }

    return { ok: false, error: result.reason }
  })
}

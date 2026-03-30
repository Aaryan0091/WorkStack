import { supabase } from '@/lib/supabase'

interface UpdateCollectionPayload {
  name?: string
  description?: string | null
  is_public?: boolean
}

async function getAccessToken(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token

  if (!token) {
    throw new Error('Missing auth session for collection action')
  }

  return token
}

async function parseApiResponse(response: Response) {
  const payload = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(payload?.error || 'Collection action failed')
  }

  return payload
}

export async function updateCollectionViaApi(collectionId: string, payload: UpdateCollectionPayload) {
  const token = await getAccessToken()
  const response = await fetch(`${window.location.origin}/api/collections/${collectionId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  })

  const result = await parseApiResponse(response)
  return result.collection
}

export async function deleteCollectionViaApi(collectionId: string) {
  const token = await getAccessToken()
  const response = await fetch(`${window.location.origin}/api/collections/${collectionId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  })

  return parseApiResponse(response)
}

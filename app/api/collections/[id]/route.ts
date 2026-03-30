import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

import { ENV, corsHeaders, handleOptionsRequest } from '@/lib/api-response'

const supabaseUrl = ENV.SUPABASE_URL
const supabaseAnonKey = ENV.SUPABASE_ANON_KEY
const supabaseServiceKey = ENV.SUPABASE_SERVICE_KEY

export async function OPTIONS(request: NextRequest) {
  return handleOptionsRequest(request)
}

async function getUserFromToken(authHeader: string | null) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null
  }

  const token = authHeader.substring(7)
  const supabase = createClient(supabaseUrl, supabaseAnonKey)
  const { data, error } = await supabase.auth.getUser(token)

  if (error || !data.user) {
    return null
  }

  return data.user
}

async function getCollectionAccess(collectionId: string, userId: string) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey)

  const { data: collection, error: collectionError } = await supabase
    .from('collections')
    .select('*')
    .eq('id', collectionId)
    .single()

  if (collectionError || !collection) {
    return { supabase, collection: null, sharedAccess: null }
  }

  const { data: sharedAccess } = await supabase
    .from('shared_collections')
    .select('role')
    .eq('collection_id', collectionId)
    .eq('user_id', userId)
    .maybeSingle()

  return { supabase, collection, sharedAccess }
}

function getPrivateEditMessage() {
  return 'You are not allowed to make edits in this private collection. Ask the owner to make the collection public first.'
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const authHeader = request.headers.get('Authorization')
    const user = await getUserFromToken(authHeader)

    if (!user) {
      const response = NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      return corsHeaders(response, request)
    }

    const params = await context.params
    const collectionId = params?.id || ''
    if (!collectionId) {
      const response = NextResponse.json({ error: 'Collection ID is required' }, { status: 400 })
      return corsHeaders(response, request)
    }

    const { supabase, collection, sharedAccess } = await getCollectionAccess(collectionId, user.id)

    if (!collection) {
      const response = NextResponse.json({ error: 'Collection not found' }, { status: 404 })
      return corsHeaders(response, request)
    }

    const isOwner = collection.user_id === user.id
    const sharedRole = sharedAccess?.role || null
    const canEditCollection = isOwner || (sharedRole === 'editor' && collection.is_public) || sharedRole === 'owner'

    if (!canEditCollection) {
      const response = NextResponse.json({ error: getPrivateEditMessage() }, { status: 403 })
      return corsHeaders(response, request)
    }

    const body = await request.json()
    const { name, description, is_public } = body as {
      name?: string
      description?: string | null
      is_public?: boolean
    }

    if (typeof is_public === 'boolean' && !isOwner && is_public !== collection.is_public) {
      const response = NextResponse.json({ error: 'Only the owner can change collection visibility.' }, { status: 403 })
      return corsHeaders(response, request)
    }

    const updateData: Record<string, unknown> = {}
    if (typeof name === 'string') updateData.name = name.trim()
    if (description !== undefined) updateData.description = description || null
    if (typeof is_public === 'boolean' && (isOwner || is_public === collection.is_public)) {
      updateData.is_public = is_public
    }

    if (Object.keys(updateData).length === 0) {
      const response = NextResponse.json({ error: 'No collection changes were provided' }, { status: 400 })
      return corsHeaders(response, request)
    }

    const { data, error } = await supabase
      .from('collections')
      .update(updateData)
      .eq('id', collectionId)
      .select()
      .single()

    if (error || !data) {
      const status = error?.code === '23505' ? 409 : 500
      const response = NextResponse.json({ error: error?.message || 'Failed to update collection' }, { status })
      return corsHeaders(response, request)
    }

    const response = NextResponse.json({ success: true, collection: data })
    return corsHeaders(response, request)
  } catch (error) {
    console.error('Collection PATCH API error:', error)
    const response = NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    return corsHeaders(response, request)
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const authHeader = request.headers.get('Authorization')
    const user = await getUserFromToken(authHeader)

    if (!user) {
      const response = NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      return corsHeaders(response, request)
    }

    const params = await context.params
    const collectionId = params?.id || ''
    if (!collectionId) {
      const response = NextResponse.json({ error: 'Collection ID is required' }, { status: 400 })
      return corsHeaders(response, request)
    }

    const { supabase, collection, sharedAccess } = await getCollectionAccess(collectionId, user.id)

    if (!collection) {
      const response = NextResponse.json({ error: 'Collection not found' }, { status: 404 })
      return corsHeaders(response, request)
    }

    const isOwner = collection.user_id === user.id
    const sharedRole = sharedAccess?.role || null
    const canDeleteCollection = isOwner || (sharedRole === 'editor' && collection.is_public) || sharedRole === 'owner'

    if (!canDeleteCollection) {
      const response = NextResponse.json({ error: getPrivateEditMessage() }, { status: 403 })
      return corsHeaders(response, request)
    }

    const { error } = await supabase
      .from('collections')
      .delete()
      .eq('id', collectionId)

    if (error) {
      const response = NextResponse.json({ error: error.message || 'Failed to delete collection' }, { status: 500 })
      return corsHeaders(response, request)
    }

    const response = NextResponse.json({ success: true })
    return corsHeaders(response, request)
  } catch (error) {
    console.error('Collection DELETE API error:', error)
    const response = NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    return corsHeaders(response, request)
  }
}

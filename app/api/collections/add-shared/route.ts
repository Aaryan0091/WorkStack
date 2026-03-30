import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

import { ENV, corsHeaders, handleOptionsRequest } from '@/lib/api-response'

const supabaseUrl = ENV.SUPABASE_URL
const supabaseAnonKey = ENV.SUPABASE_ANON_KEY
const supabaseServiceKey = ENV.SUPABASE_SERVICE_KEY
export async function OPTIONS(request: NextRequest) {
  return handleOptionsRequest(request)
}

// Verify auth token and get user
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

// POST - Add a shared collection by code or ID
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization')
    const user = await getUserFromToken(authHeader)

    if (!user) {
      const response = NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      return corsHeaders(response, request)
    }

    const body = await request.json()
    const { code } = body

    const rawCode = typeof code === 'string' ? code.trim() : ''

    if (!rawCode) {
      const response = NextResponse.json({ error: 'Collection code is required' }, { status: 400 })
      return corsHeaders(response, request)
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey)

    // Accept a public shared URL/slug for public collections, but do not allow raw internal IDs.
    const sharedSlugMatch = rawCode.match(/\/shared\/([^\/\s]+)/)
    const publicSlug = sharedSlugMatch?.[1] || rawCode

    let collection = null

    // First try by share_code. This is the only way to add private collections.
    const { data: collectionByCode } = await supabase
      .from('collections')
      .select('*')
      .eq('share_code', rawCode)
      .single()

    if (collectionByCode) {
      collection = collectionByCode
    } else {
      // For convenience, allow adding public collections by public share slug or shared URL.
      const { data: collectionBySlug } = await supabase
        .from('collections')
        .select('*')
        .eq('share_slug', publicSlug)
        .eq('is_public', true)
        .single()

      if (collectionBySlug) {
        collection = collectionBySlug
      }
    }

    if (!collection) {
      const response = NextResponse.json({ error: 'Collection not found' }, { status: 404 })
      return corsHeaders(response, request)
    }

    // Check if user already has access to this collection
    const { data: existingAccess } = await supabase
      .from('shared_collections')
      .select('*')
      .eq('collection_id', collection.id)
      .eq('user_id', user.id)
      .single()

    if (existingAccess) {
      const response = NextResponse.json({
        message: 'You already have access to this collection',
        collection,
        role: existingAccess.role
      })
      return corsHeaders(response, request)
    }

    // Determine role based on collection's is_public setting
    // If public: users become editors (can edit)
    // If private: users become viewers (read-only)
    const role = collection.is_public ? 'editor' : 'viewer'

    // Add user to shared_collections
    const { data: sharedCollection, error: shareError } = await supabase
      .from('shared_collections')
      .insert({
        collection_id: collection.id,
        user_id: user.id,
        role
      })
      .select()
      .single()

    if (shareError) {
      console.error('Error adding shared collection:', shareError)
      const response = NextResponse.json({ error: 'Failed to add collection' }, { status: 500 })
      return corsHeaders(response, request)
    }

    const response = NextResponse.json({
      message: 'Collection added successfully',
      collection,
      role,
      sharedCollection
    })
    return corsHeaders(response, request)
  } catch (error) {
    console.error('API error:', error)
    const response = NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    return corsHeaders(response, request)
  }
}

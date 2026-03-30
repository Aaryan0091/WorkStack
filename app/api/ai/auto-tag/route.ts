import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { applyAiTagsToBookmark } from '@/lib/ai-tagging'

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

// POST - Auto-tag a bookmark (runs in background)
export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate user
    const authHeader = request.headers.get('Authorization')
    const user = await getUserFromToken(authHeader)
    if (!user) {
      const response = NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      return corsHeaders(response, request)
    }

    // 2. Parse request body
    const body = await request.json()
    const { bookmark_id } = body

    if (!bookmark_id) {
      const response = NextResponse.json(
        { error: 'bookmark_id is required' },
        { status: 400 }
      )
      return corsHeaders(response, request)
    }

    // 3. Fetch the bookmark
    const supabase = createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey)
    const { data: bookmark, error: fetchError } = await supabase
      .from('bookmarks')
      .select('*')
      .eq('id', bookmark_id)
      .eq('user_id', user.id)
      .single()

    if (fetchError || !bookmark) {
      const response = NextResponse.json(
        { error: 'Bookmark not found' },
        { status: 404 }
      )
      return corsHeaders(response, request)
    }

    // 4. Apply AI tags (this creates tags and associates them)
    const suggestions = await applyAiTagsToBookmark(
      user.id,
      bookmark_id,
      bookmark.title,
      bookmark.url,
      bookmark.description || ''
    )

    const response = NextResponse.json({
      success: true,
      tags: suggestions,
      count: suggestions.length,
    })
    return corsHeaders(response, request)
  } catch (error) {
    console.error('AI auto-tag error:', error)
    const response = NextResponse.json(
      { error: 'Failed to auto-tag bookmark' },
      { status: 500 }
    )
    return corsHeaders(response, request)
  }
}

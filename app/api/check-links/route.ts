import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

import { ENV } from '@/lib/api-response'

const supabaseUrl = ENV.SUPABASE_URL
const supabaseAnonKey = ENV.SUPABASE_ANON_KEY
const supabaseServiceKey = ENV.SUPABASE_SERVICE_KEY

// Helper to check if a URL is accessible
async function checkUrl(url: string): Promise<{ alive: boolean; status?: number; error?: string }> {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout

    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      redirect: 'manual',
    })

    clearTimeout(timeoutId)

    // Consider 2xx, 3xx as alive, 4xx, 5xx as dead
    return {
      alive: response.status >= 200 && response.status < 400,
      status: response.status,
    }
  } catch (error) {
    return {
      alive: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

// Check a single bookmark
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization')

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.substring(7)
    const supabase = createClient(supabaseUrl, supabaseAnonKey)

    const { data: { user }, error } = await supabase.auth.getUser(token)

    if (error || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { bookmarkId } = body

    if (!bookmarkId) {
      return NextResponse.json({ error: 'Bookmark ID is required' }, { status: 400 })
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey)

    // Get the bookmark
    const { data: bookmark } = await supabaseAdmin
      .from('bookmarks')
      .select('url, id')
      .eq('id', bookmarkId)
      .eq('user_id', user.id)
      .single()

    if (!bookmark) {
      return NextResponse.json({ error: 'Bookmark not found' }, { status: 404 })
    }

    // Check the URL
    const result = await checkUrl(bookmark.url)

    return NextResponse.json({
      bookmarkId,
      url: bookmark.url,
      alive: result.alive,
      status: result.status,
      error: result.error,
    })
  } catch (error) {
    console.error('Check link API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Check all bookmarks
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization')

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.substring(7)
    const supabase = createClient(supabaseUrl, supabaseAnonKey)

    const { data: { user }, error } = await supabase.auth.getUser(token)

    if (error || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey)

    // Get all bookmarks for the user
    const { data: bookmarks } = await supabaseAdmin
      .from('bookmarks')
      .select('id, url, title')
      .eq('user_id', user.id)

    if (!bookmarks || bookmarks.length === 0) {
      return NextResponse.json({ results: [] })
    }

    // Check all bookmarks (with a limit to avoid too many requests)
    const results = []
    const maxChecks = 50 // Limit to avoid excessive processing
    const bookmarksToCheck = bookmarks.slice(0, maxChecks)

    for (const bookmark of bookmarksToCheck) {
      const result = await checkUrl(bookmark.url)
      results.push({
        id: bookmark.id,
        url: bookmark.url,
        title: bookmark.title,
        alive: result.alive,
        status: result.status,
      })

      // Small delay between requests to be respectful
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    return NextResponse.json({
      results,
      total: bookmarks.length,
      checked: bookmarksToCheck.length,
      truncated: bookmarks.length > maxChecks,
    })
  } catch (error) {
    console.error('Check links API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

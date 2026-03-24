import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { expandSearchQuery } from '@/lib/ai-tagging'

import { ENV, corsHeaders, handleOptionsRequest } from '@/lib/api-response'

const supabaseUrl = ENV.SUPABASE_URL
const supabaseAnonKey = ENV.SUPABASE_ANON_KEY
const supabaseServiceKey = ENV.SUPABASE_SERVICE_KEY
const GROQ_API_KEY = ENV.GROQ_API_KEY

interface Bookmark {
  id: string
  user_id: string
  url: string
  title?: string
  description?: string | null
  bookmark_tags?: Array<{ tags?: { name?: string } }>
}

interface ScoredBookmark extends Bookmark {
  _score: number
}

type SearchMode = 'semantic' | 'tags' | 'name' | 'all'
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

// POST - Unified search endpoint
export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const authHeader = request.headers.get('Authorization')
    const user = await getUserFromToken(authHeader)
    if (!user) {
      const response = NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      return corsHeaders(response, request)
    }

    const body = await request.json()
    const { query, mode = 'all', collection_id }: { query: string; mode: SearchMode; collection_id?: string } = body

    if (!query || query.trim().length === 0) {
      const response = NextResponse.json({ error: 'Query is required' }, { status: 400 })
      return corsHeaders(response, request)
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey)
    const searchLower = query.toLowerCase().trim()

    // Build base query
    let queryBuilder = supabase
      .from('bookmarks')
      .select(`
        *,
        bookmark_tags (
          tags (*)
        ),
        collections (
          id,
          name
        )
      `)
      .eq('user_id', user.id)

    // Filter by collection if provided
    if (collection_id) {
      queryBuilder = queryBuilder.eq('collection_id', collection_id)
    }

    const { data: bookmarks, error } = await queryBuilder

    if (error) {
      console.error('Search error:', error)
      const response = NextResponse.json({ error: error.message }, { status: 500 })
      return corsHeaders(response, request)
    }

    // Expand search query once (outside the map) to avoid calling AI multiple times
    let expandedTerms: string[] = [query]
    if (GROQ_API_KEY && (mode === 'semantic' || mode === 'all')) {
      try {
        expandedTerms = await expandSearchQuery(query)
      } catch (expandError) {
        // If expansion fails, fall back to original query
        console.warn('[Search] Query expansion failed, using original query:', expandError)
        expandedTerms = [query]
      }
    }

    // Score bookmarks based on mode using Promise.allSettled for error handling
    const scoredResults = await Promise.allSettled(
      (bookmarks || []).map(async (bookmark: Bookmark): Promise<ScoredBookmark> => {
        let score = 0
        const titleLower = (bookmark.title || '').toLowerCase()
        const descLower = (bookmark.description || '').toLowerCase()
        const urlLower = bookmark.url.toLowerCase()
        const tagNames = (bookmark.bookmark_tags || []).map((bt) => bt.tags?.name).filter(Boolean) as string[]

        switch (mode) {
          case 'name':
            // Only search in title and URL
            if (titleLower.includes(searchLower)) score += 10
            if (urlLower.includes(searchLower)) score += 5
            // Partial matches
            if (searchLower.length > 3) {
              const words = searchLower.split(' ')
              for (const word of words) {
                if (titleLower.includes(word)) score += 3
                if (urlLower.includes(word)) score += 1
              }
            }
            break

          case 'tags':
            // Only search in tags
            for (const tagName of tagNames) {
              const tagLower = tagName.toLowerCase()
              if (tagLower.includes(searchLower)) score += 10
              if (searchLower.includes(tagLower)) score += 8
            }
            break

          case 'semantic':
            // Use expanded query to match
            if (expandedTerms.length > 0) {
              // Direct query matches
              if (titleLower.includes(searchLower)) score += 10
              if (descLower.includes(searchLower)) score += 5
              if (urlLower.includes(searchLower)) score += 3

              // Expanded term matches (using the pre-expanded terms)
              for (const term of expandedTerms.slice(1)) {
                const termLower = term.toLowerCase()
                if (titleLower.includes(termLower)) score += 4
                if (descLower.includes(termLower)) score += 2
                if (urlLower.includes(termLower)) score += 1
                if (tagNames.some((tn) => tn.toLowerCase().includes(termLower))) score += 3
              }
            } else {
              // Fallback to regular search if AI not configured
              if (titleLower.includes(searchLower)) score += 10
              if (descLower.includes(searchLower)) score += 5
              if (urlLower.includes(searchLower)) score += 3
            }
            break

          case 'all':
          default:
            // Combined search with all methods
            // Title matches
            if (titleLower.includes(searchLower)) score += 10
            if (searchLower.length > 3 && titleLower.split(' ').some((w) => searchLower.includes(w))) score += 5

            // URL matches
            if (urlLower.includes(searchLower)) score += 5

            // Description matches
            if (descLower.includes(searchLower)) score += 3

            // Tag matches
            for (const tagName of tagNames) {
              const tagLower = tagName.toLowerCase()
              if (tagLower.includes(searchLower)) score += 8
              if (searchLower.includes(tagLower)) score += 6
            }

            // Semantic expansion if AI is available (using pre-expanded terms)
            if (expandedTerms.length > 0) {
              for (const term of expandedTerms.slice(1)) {
                const termLower = term.toLowerCase()
                if (titleLower.includes(termLower)) score += 3
                if (descLower.includes(termLower)) score += 1
                if (tagNames.some((tn) => tn.toLowerCase().includes(termLower))) score += 2
              }
            }
            break
        }

        return { ...bookmark, _score: score }
      })
    )

    // Extract successful results, log failed ones
    const scoredBookmarks: ScoredBookmark[] = []
    scoredResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        scoredBookmarks.push(result.value)
      } else {
        console.error('[Search] Failed to score bookmark:', index, result.reason)
        // Include failed bookmarks with score 0 to not lose them entirely
        scoredBookmarks.push({ ...bookmarks![index], _score: 0 })
      }
    })

    // Filter out zero-score results and sort by score
    const results = scoredBookmarks
      .filter((b: ScoredBookmark) => b._score > 0)
      .sort((a: ScoredBookmark, b: ScoredBookmark) => b._score - a._score)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      .map(({ _score, ...bookmark }) => bookmark)

    const response = NextResponse.json({
      results,
      query,
      mode,
      count: results.length,
    })
    return corsHeaders(response, request)
  } catch (error) {
    console.error('Search error:', error)
    const response = NextResponse.json({ error: 'Search failed' }, { status: 500 })
    return corsHeaders(response, request)
  }
}

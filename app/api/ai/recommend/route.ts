import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import Groq from 'groq-sdk'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!
const GROQ_API_KEY = process.env.GROQ_API_KEY!

// Add CORS headers
function corsHeaders(response: NextResponse) {
  response.headers.set('Access-Control-Allow-Origin', '*')
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  return response
}

// Handle OPTIONS preflight request
export async function OPTIONS(request: NextRequest) {
  return corsHeaders(new NextResponse(null, { status: 200 }))
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

// POST - Get semantically related bookmarks
export async function POST(request: NextRequest) {
  try {
    console.log('Recommendation API called')

    // Check if AI is configured
    if (!GROQ_API_KEY) {
      console.error('GROQ_API_KEY is not set')
      const response = NextResponse.json(
        { recommendations: [] },
        { status: 200 }
      )
      return corsHeaders(response)
    }

    // Authenticate user
    const authHeader = request.headers.get('Authorization')
    const user = await getUserFromToken(authHeader)
    if (!user) {
      console.error('User not authenticated')
      const response = NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      return corsHeaders(response)
    }

    console.log('Recommendation: User authenticated:', user.id)

    const supabase = createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey)

    // 1. Get user's recent reading list items (is_read = false)
    const { data: readingList, error: readingListError } = await supabase
      .from('bookmarks')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_read', false)
      .order('created_at', { ascending: false })
      .limit(5)

    if (readingListError) {
      console.error('Reading list fetch error:', readingListError)
      const response = NextResponse.json({ recommendations: [] })
      return corsHeaders(response)
    }

    console.log('Recommendation: Reading list items:', readingList?.length || 0)

    if (!readingList || readingList.length === 0) {
      const response = NextResponse.json({ recommendations: [] })
      return corsHeaders(response)
    }

    // 2. Build context from reading list
    const contextText = readingList
      .map(b => `Title: ${b.title}\nURL: ${b.url}\nDescription: ${b.description || 'N/A'}`)
      .join('\n\n---\n\n')

    // 3. Use AI to find related topics/terms
    const groq = new Groq({ apiKey: GROQ_API_KEY })

    const prompt = `You are a recommendation engine. Based on the user's current reading list, suggest 3-5 search queries that would find related content they might be interested in.

Current Reading List:
${contextText}

Guidelines:
1. Return ONLY a JSON object with a "queries" array
2. Queries should be specific topics, technologies, or themes
3. Keep queries to 1-3 words each
4. Focus on extracting the main themes from the reading list

Example output:
{
  "queries": ["react hooks", "frontend performance", "state management"]
}

Now generate queries for this reading list:`

    try {
      const aiResponse = await groq.chat.completions.create({
        model: 'llama-3.1-8b-instant',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 150,
        response_format: { type: 'json_object' },
      })

      const content = aiResponse.choices[0]?.message?.content
      if (!content) {
        const response = NextResponse.json({ recommendations: [] })
        return corsHeaders(response)
      }

      const parsed = JSON.parse(content)
      const queries = parsed.queries || []

      if (queries.length === 0) {
        const response = NextResponse.json({ recommendations: [] })
        return corsHeaders(response)
      }

      // 4. Search for bookmarks matching these queries (excluding current reading list)
      const readingListIds = readingList.map(b => b.id)
      console.log('Recommendation: Reading list IDs:', readingListIds)
      console.log('Recommendation: AI queries:', queries)

      // Get all other bookmarks (filter in JS to avoid Supabase syntax issues)
      const { data: allBookmarks } = await supabase
        .from('bookmarks')
        .select('*')
        .eq('user_id', user.id)

      // Filter out reading list items
      const otherBookmarks = (allBookmarks || []).filter((b: any) => !readingListIds.includes(b.id))
      console.log('Recommendation: Other bookmarks count:', otherBookmarks.length)

      // Score bookmarks based on query matches
      const scoredBookmarks = otherBookmarks.map((bookmark: any) => {
        let score = 0
        const titleLower = (bookmark.title || '').toLowerCase()
        const descLower = (bookmark.description || '').toLowerCase()
        const urlLower = bookmark.url.toLowerCase()

        for (const query of queries) {
          const queryLower = query.toLowerCase()
          if (titleLower.includes(queryLower)) score += 5
          if (descLower.includes(queryLower)) score += 2
          if (urlLower.includes(queryLower)) score += 1
        }

        return { ...bookmark, _score: score }
      })

      // Filter and sort by score
      const recommendations = scoredBookmarks
        .filter((b: any) => b._score > 0)
        .sort((a: any, b: any) => b._score - a._score)
        .slice(0, 6)
        .map(({ _score, ...bookmark }) => bookmark)

      console.log('Recommendation: Final recommendations count:', recommendations.length)
      if (recommendations.length > 0) {
        console.log('Recommendation: Sample:', recommendations[0]?.title)
      }

      const response = NextResponse.json({
        recommendations,
        queries,
        count: recommendations.length,
      })
      return corsHeaders(response)
    } catch (aiError) {
      console.error('AI recommendation error:', aiError)
      // Return empty recommendations on AI error instead of failing
      const response = NextResponse.json({ recommendations: [] })
      return corsHeaders(response)
    }
  } catch (error) {
    console.error('Recommendation API error:', error)
    const response = NextResponse.json(
      { recommendations: [] },
      { status: 200 }
    )
    return corsHeaders(response)
  }
}

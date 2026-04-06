import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import Groq from 'groq-sdk'

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
  is_read: boolean
  is_favorite: boolean
  created_at: string
}

interface ScoredBookmark extends Bookmark {
  _score: number
  _matchedQueries: number
  _exactMatches: number
  _contentPhraseMatches: number
  _mediaTitleOverlap: number
  _sourceAnchorMatches: number
  _strongWordMatches: number
}

const GENERIC_QUERY_TERMS = new Set([
  'article', 'blog', 'content', 'guide', 'homepage', 'link', 'music', 'page',
  'reference', 'resource', 'site', 'song', 'soundtrack', 'title', 'tool',
  'tools', 'track', 'tutorial', 'video', 'website', 'youtube'
])

const SEMANTIC_STOP_WORDS = new Set([
  ...GENERIC_QUERY_TERMS,
  'about', 'after', 'before', 'best', 'build', 'building', 'click', 'com',
  'course', 'from', 'have', 'http', 'https', 'into', 'just', 'learn',
  'lesson', 'more', 'page', 'read', 'that', 'them', 'there', 'these',
  'this', 'through', 'tips', 'watch', 'what', 'when', 'where', 'which',
  'with', 'www', 'your'
])

const MEDIA_HOSTS = new Set(['youtube', 'youtu', 'vimeo'])

function normalizeSemanticQuery(query: string): string | null {
  const normalized = query
    .toLowerCase()
    .trim()
    .replace(/^["']+|["']+$/g, '')
    .replace(/\s+/g, ' ')

  if (!normalized || normalized.length < 3) {
    return null
  }

  const words = normalized.split(/\s+/).filter(Boolean)
  if (words.length === 0) {
    return null
  }

  const hasSpecificWord = words.some((word) => word.length >= 4 && !GENERIC_QUERY_TERMS.has(word))
  if (!hasSpecificWord && GENERIC_QUERY_TERMS.has(normalized)) {
    return null
  }

  if (!hasSpecificWord && words.every((word) => GENERIC_QUERY_TERMS.has(word))) {
    return null
  }

  return normalized
}

function sanitizeSemanticQueries(queries: unknown[]): string[] {
  const unique = new Set<string>()
  const sanitized: string[] = []

  for (const query of queries) {
    if (typeof query !== 'string') continue

    const normalized = normalizeSemanticQuery(query)
    if (!normalized || unique.has(normalized)) continue

    unique.add(normalized)
    sanitized.push(normalized)
  }

  return sanitized
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function tokenizeSemanticText(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter(Boolean)
}

function hasDelimitedPhrase(text: string, phrase: string): boolean {
  const escapedPhrase = phrase
    .split(/\s+/)
    .filter(Boolean)
    .map(escapeRegex)
    .join('\\s+')

  if (!escapedPhrase) {
    return false
  }

  const pattern = new RegExp(`(?:^|[^a-z0-9])${escapedPhrase}(?=$|[^a-z0-9])`, 'i')
  return pattern.test(text)
}

function hasStrongWordMatch(words: Set<string>, queryWord: string): boolean {
  if (words.has(queryWord)) {
    return true
  }

  // Allow common tech suffix variants like reactjs/typescript shorthands without
  // letting unrelated substrings such as "reaction" count as matches.
  if (queryWord.length >= 4) {
    if (words.has(`${queryWord}js`) || words.has(`${queryWord}ts`)) {
      return true
    }
  }

  return false
}

function isUsefulSemanticToken(token: string): boolean {
  return token.length >= 4 && !SEMANTIC_STOP_WORDS.has(token) && !/^\d+$/.test(token)
}

function buildReadingListFallbackQueries(readingList: Bookmark[]): string[] {
  const tokenCounts = new Map<string, number>()
  const phraseCounts = new Map<string, number>()

  for (const bookmark of readingList) {
    const textParts = [
      bookmark.title || '',
      bookmark.description || '',
      bookmark.url || ''
    ]

    const bookmarkTokens = new Set<string>()
    const bookmarkPhrases = new Set<string>()

    for (const text of textParts) {
      const tokens = tokenizeSemanticText(text).filter(isUsefulSemanticToken)

      for (const token of tokens) {
        bookmarkTokens.add(token)
      }

      for (let index = 0; index < tokens.length - 1; index += 1) {
        const first = tokens[index]
        const second = tokens[index + 1]

        if (!first || !second) continue

        const phrase = `${first} ${second}`
        bookmarkPhrases.add(phrase)
      }
    }

    for (const token of bookmarkTokens) {
      tokenCounts.set(token, (tokenCounts.get(token) || 0) + 1)
    }

    for (const phrase of bookmarkPhrases) {
      phraseCounts.set(phrase, (phraseCounts.get(phrase) || 0) + 1)
    }
  }

  const topPhrases = [...phraseCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 6)
    .map(([phrase]) => phrase)

  const topTokens = [...tokenCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 8)
    .map(([token]) => token)

  return sanitizeSemanticQueries([...topPhrases, ...topTokens])
}

function buildSourceSemanticTokenSets(readingList: Bookmark[]): Set<string>[] {
  return readingList.map((bookmark) => {
    const text = [
      bookmark.title || '',
      bookmark.description || '',
      bookmark.url || ''
    ].join(' ')

    return new Set(tokenizeSemanticText(text).filter(isUsefulSemanticToken))
  })
}

function countSourceAnchorMatches(
  candidateWords: Set<string>,
  sourceTokenSets: Set<string>[]
): number {
  let bestMatchCount = 0

  for (const sourceTokens of sourceTokenSets) {
    let overlap = 0

    for (const word of candidateWords) {
      if (sourceTokens.has(word)) {
        overlap += 1
      }
    }

    if (overlap > bestMatchCount) {
      bestMatchCount = overlap
    }
  }

  return bestMatchCount
}

function getDomainRoot(url: string): string | null {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '')
    const parts = hostname.split('.').filter(Boolean)
    if (parts.length >= 2) {
      return parts[parts.length - 2] || null
    }
    return parts[0] || null
  } catch {
    return null
  }
}

function getMediaTitleTokens(bookmark: Bookmark): Set<string> {
  const titleTokens = tokenizeSemanticText(bookmark.title || '')
  return new Set(
    titleTokens.filter((token) =>
      token.length >= 3 &&
      !GENERIC_QUERY_TERMS.has(token) &&
      !SEMANTIC_STOP_WORDS.has(token) &&
      !/^\d+$/.test(token)
    )
  )
}

function countTokenOverlap(first: Set<string>, second: Set<string>): number {
  let overlap = 0

  for (const token of first) {
    if (second.has(token)) {
      overlap += 1
    }
  }

  return overlap
}
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

// POST - Get semantically related bookmarks
export async function POST(request: NextRequest) {
  try {
    // Check if AI is configured
    if (!GROQ_API_KEY) {
      console.error('GROQ_API_KEY is not set')
      const response = NextResponse.json(
        { recommendations: [] },
        { status: 200 }
      )
      return corsHeaders(response, request)
    }

    // Authenticate user
    const authHeader = request.headers.get('Authorization')
    const user = await getUserFromToken(authHeader)
    if (!user) {
      const response = NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      return corsHeaders(response, request)
    }

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
      return corsHeaders(response, request)
    }

    if (!readingList || readingList.length === 0) {
      const response = NextResponse.json({ recommendations: [] })
      return corsHeaders(response, request)
    }

    const seedBookmarks = readingList.slice(0, 1)

    // 2. Build context from the newest unread item so mixed-topic reading lists
    // do not pull in unrelated recommendations from older entries.
    const contextText = seedBookmarks
      .map(b => `Title: ${b.title}\nURL: ${b.url}\nDescription: ${b.description || 'N/A'}`)
      .join('\n\n---\n\n')

    // 3. Use AI to find related topics/terms
    const groq = new Groq({ apiKey: GROQ_API_KEY })

    const prompt = `You are a semantic recommendation engine. Your goal is to understand the TOPICS and THEMES of the user's reading list, then generate search queries that would find RELATED content across ANY domain.

Current Reading List:
${contextText}

CRITICAL GUIDELINES:
1. Return ONLY a JSON object with a "queries" array
2. Think about TOPICS, THEMES, and CONCEPTS - not just exact words
3. Generate 5-8 diverse search queries that would find semantically related content
4. Include: specific entities, broader topics, related technologies, synonyms, and adjacent concepts
5. Avoid generic container words like "video", "song", "tutorial", "guide", "article", or "youtube" unless they are part of a more specific topic phrase

SEMANTIC EXPANSION STRATEGY:
- If you see "ChatGPT", also extract: "AI assistant", "language model", "OpenAI", "GPT"
- If you see "React tutorial", also extract: "frontend framework", "JavaScript library", "web development"
- If you see "AI agent", also extract: "autonomous AI", "AI assistant", "AI bot", "agent system"
- If you see "Python script", also extract: "coding", "programming", "development"
- If you see a specific product, also extract: the category, competitors, use cases

EXAMPLES:

Example 1 - AI/Tech content:
Input: "Claude AI Agent Tutorial", "Building AI Agents with LangChain"
Output: { "queries": ["AI agent", "Claude", "LangChain", "autonomous AI", "AI assistant", "language model", "agent framework", "AI development"] }

Example 2 - YouTube/Entertainment:
Input: "dhurandar title track", "shararat song"
Output: { "queries": ["dhurandar", "title track", "shararat", "music", "soundtrack", "bollywood", "song"] }

Example 3 - Development:
Input: "Next.js tutorial", "React best practices"
Output: { "queries": ["Next.js", "React", "frontend", "framework", "JavaScript", "web development", "SSR", "Vercel"] }

IMPORTANT: The goal is to find RELATED content even if it uses different terminology or is on a different website. Think like a human making connections between related topics.

Now extract semantic queries from this reading list:`

    try {
      const aiResponse = await groq.chat.completions.create({
        model: 'llama-3.1-8b-instant',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        max_tokens: 300, // Increased to allow for more queries
        response_format: { type: 'json_object' },
      })

      const content = aiResponse.choices[0]?.message?.content
      if (!content) {
        const response = NextResponse.json({ recommendations: [] })
        return corsHeaders(response, request)
      }

      const parsed = JSON.parse(content)
      const aiQueries = sanitizeSemanticQueries(parsed.queries || [])
      const fallbackQueries = buildReadingListFallbackQueries(seedBookmarks)
      const queries = sanitizeSemanticQueries([...aiQueries, ...fallbackQueries])

      if (queries.length === 0) {
        const response = NextResponse.json({ recommendations: [] })
        return corsHeaders(response, request)
      }

      // 4. Search for bookmarks matching these queries (excluding current reading list)
      const readingListIds = readingList.map(b => b.id)
      const sourceTokenSets = buildSourceSemanticTokenSets(seedBookmarks)
      const seedDomains = new Set(seedBookmarks.map((bookmark) => getDomainRoot(bookmark.url)).filter(Boolean))
      const seedMediaTitleTokens = seedBookmarks.map(getMediaTitleTokens)

      // Get all other bookmarks (filter in JS to avoid Supabase syntax issues)
      const { data: allBookmarks } = await supabase
        .from('bookmarks')
        .select('*')
        .eq('user_id', user.id)

      // Filter out reading list items
      const otherBookmarks = (allBookmarks || []).filter((b: Bookmark) => !readingListIds.includes(b.id))

      // Score bookmarks based on query matches with improved semantic matching
      const scoredBookmarks = otherBookmarks.map((bookmark: Bookmark): ScoredBookmark => {
        let score = 0
        const matchedQueries = new Set<string>()
        let exactMatches = 0
        let contentPhraseMatches = 0
        let strongWordMatches = 0
        const titleLower = (bookmark.title || '').toLowerCase()
        const descLower = (bookmark.description || '').toLowerCase()
        const urlLower = bookmark.url.toLowerCase()
        const titleWords = new Set(tokenizeSemanticText(titleLower))
        const descWords = new Set(tokenizeSemanticText(descLower))
        const urlWords = new Set(tokenizeSemanticText(urlLower))
        const candidateWords = new Set([
          ...titleWords,
          ...descWords,
          ...urlWords,
        ].filter(isUsefulSemanticToken))
        const sourceAnchorMatches = countSourceAnchorMatches(candidateWords, sourceTokenSets)
        const candidateDomain = getDomainRoot(bookmark.url)
        const candidateMediaTitleTokens = getMediaTitleTokens(bookmark)
        const mediaTitleOverlap = (
          candidateDomain &&
          seedDomains.has(candidateDomain) &&
          MEDIA_HOSTS.has(candidateDomain)
        )
          ? Math.max(
            ...seedMediaTitleTokens.map((tokens) => countTokenOverlap(tokens, candidateMediaTitleTokens)),
            0
          )
          : 0

        for (const query of queries) {
          const queryLower = query.toLowerCase()
          const queryWords = queryLower
            .split(/\s+/)
            .filter((word) => word.length >= 4 && !GENERIC_QUERY_TERMS.has(word))
          let queryMatched = false

          // Exact delimited phrase match (highest score)
          if (hasDelimitedPhrase(titleLower, queryLower)) {
            score += 14
            exactMatches += 1
            contentPhraseMatches += 1
            queryMatched = true
          }
          if (hasDelimitedPhrase(descLower, queryLower)) {
            score += 8
            contentPhraseMatches += 1
            queryMatched = true
          }
          if (!queryMatched && hasDelimitedPhrase(urlLower, queryLower)) {
            score += 2
          }

          // Strong token matching for multi-word queries
          for (const qWord of queryWords) {
            const titleMatched = hasStrongWordMatch(titleWords, qWord)
            const descMatched = hasStrongWordMatch(descWords, qWord)
            const urlMatched = hasStrongWordMatch(urlWords, qWord)

            if (titleMatched) {
              score += 4
              strongWordMatches += 1
              queryMatched = true
            }
            if (descMatched) {
              score += 2
              strongWordMatches += 1
              queryMatched = true
            }
            if (!titleMatched && !descMatched && urlMatched) {
              score += 1
            }
          }

          if (queryMatched) {
            matchedQueries.add(queryLower)
          }
        }

        return {
          ...bookmark,
          _score: score,
          _matchedQueries: matchedQueries.size,
          _exactMatches: exactMatches,
          _contentPhraseMatches: contentPhraseMatches,
          _mediaTitleOverlap: mediaTitleOverlap,
          _sourceAnchorMatches: sourceAnchorMatches,
          _strongWordMatches: strongWordMatches,
        }
      })

      // Filter and sort by score - return up to 12 recommendations
      const strictRecommendations = scoredBookmarks
        .filter((bookmark: ScoredBookmark) => {
          if (bookmark._score < 6) return false
          if (bookmark._mediaTitleOverlap >= 1) return true
          if (bookmark._sourceAnchorMatches < 1) return false
          if (bookmark._exactMatches > 0 && bookmark._strongWordMatches > 0) return true
          if (bookmark._contentPhraseMatches > 0 && bookmark._score >= 8) return true
          if (bookmark._matchedQueries >= 2) return true
          if (bookmark._strongWordMatches >= 3 && bookmark._sourceAnchorMatches >= 2) return true
          return false
        })
        .sort((a: ScoredBookmark, b: ScoredBookmark) => b._score - a._score)
        .slice(0, 12)

      const fallbackRecommendations = scoredBookmarks
        .filter((bookmark: ScoredBookmark) => {
          if (bookmark._mediaTitleOverlap >= 1) return true
          if (bookmark._score < 4) return false
          if (bookmark._sourceAnchorMatches < 2) return false
          if (bookmark._contentPhraseMatches > 0) return true
          if (bookmark._strongWordMatches >= 2) return true
          return bookmark._matchedQueries >= 1 && bookmark._sourceAnchorMatches >= 2
        })
        .sort((a: ScoredBookmark, b: ScoredBookmark) => b._score - a._score)
        .slice(0, 8)

      const recommendations = (strictRecommendations.length > 0 ? strictRecommendations : fallbackRecommendations)
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        .map(({ _score, _matchedQueries, _exactMatches, _contentPhraseMatches, _mediaTitleOverlap, _sourceAnchorMatches, _strongWordMatches, ...bookmark }) => bookmark)

      const response = NextResponse.json({
        recommendations,
        queries,
        count: recommendations.length,
      })
      return corsHeaders(response, request)
    } catch (aiError) {
      console.error('AI recommendation error:', aiError)
      // Return empty recommendations on AI error instead of failing
      const response = NextResponse.json({ recommendations: [] })
      return corsHeaders(response, request)
    }
  } catch (error) {
    console.error('Recommendation API error:', error)
    const response = NextResponse.json(
      { recommendations: [] },
      { status: 200 }
    )
    return corsHeaders(response, request)
  }
}

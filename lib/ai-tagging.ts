import { createClient } from '@supabase/supabase-js'
import Groq from 'groq-sdk'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!
const GROQ_API_KEY = process.env.GROQ_API_KEY!

// Color palette for auto-generated tags
export const TAG_COLORS = [
  '#3B82F6', // blue
  '#EF4444', // red
  '#10B981', // green
  '#F59E0B', // amber
  '#8B5CF6', // purple
  '#EC4899', // pink
  '#06B6D4', // cyan
  '#84CC16', // lime
  '#F97316', // orange
  '#6366F1', // indigo
] as const

// Types
export interface Tag {
  id: string
  user_id: string
  name: string
  color: string
  created_at: string
}

export interface TagSuggestion {
  id: string
  name: string
  color: string
  isNew: boolean
}

export interface AiTagResponse {
  suggested: TagSuggestion[]
  summary: {
    total: number
    matched: number
    created: number
  }
}

export interface UserTag {
  id: string
  name: string
}

export interface TagMatchResult {
  matched: Array<{ aiTag: string; existingTag: UserTag }>
  newTags: string[]
}

// Levenshtein distance for fuzzy matching
export function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length
  const n = str2.length
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0))

  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1]
      } else {
        dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + 1)
      }
    }
  }
  return dp[m][n]
}

export function getSimilarity(str1: string, str2: string): number {
  const normalized1 = str1.toLowerCase().trim()
  const normalized2 = str2.toLowerCase().trim()
  const maxLen = Math.max(normalized1.length, normalized2.length)
  if (maxLen === 0) return 1
  const distance = levenshteinDistance(normalized1, normalized2)
  return 1 - distance / maxLen
}

const SIMILARITY_THRESHOLD = 0.7

export function fuzzyMatchTags(aiTags: string[], userTags: UserTag[]): TagMatchResult {
  const matched: TagMatchResult['matched'] = []
  const newTags: string[] = []
  const matchedExistingIds = new Set<string>()

  for (const aiTag of aiTags) {
    let bestMatch: UserTag | null = null
    let bestSimilarity = 0

    for (const userTag of userTags) {
      if (matchedExistingIds.has(userTag.id)) continue

      const similarity = getSimilarity(aiTag, userTag.name)
      if (similarity > bestSimilarity && similarity >= SIMILARITY_THRESHOLD) {
        bestMatch = userTag
        bestSimilarity = similarity
      }
    }

    if (bestMatch) {
      matched.push({ aiTag, existingTag: bestMatch })
      matchedExistingIds.add(bestMatch.id)
    } else {
      newTags.push(aiTag)
    }
  }

  return { matched, newTags }
}

export function getRandomColor(): string {
  return TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)]
}

// Generate AI tags using Groq
export async function generateAItags(
  title: string,
  url: string,
  description: string
): Promise<string[]> {
  if (!GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY is not configured')
  }

  const groq = new Groq({ apiKey: GROQ_API_KEY })

  const prompt = `You are a bookmark tagging assistant. Given a bookmark's title, URL, and description, suggest 3-5 relevant tags.

Bookmark Details:
Title: ${title}
URL: ${url}
Description: ${description || '(no description)'}

Guidelines for tag suggestions:
1. Tags should be concise (1-2 words preferred, maximum 3)
2. Use lowercase consistently
3. Focus on: topics, technologies, categories, content types
4. Avoid generic tags like "interesting", "useful", "cool"
5. For technical content, use specific technology names
6. For articles, consider both topic and format tags
7. For products/brands, include both category and specific name

Output Format:
Return ONLY a valid JSON object with a "tags" array containing the suggested tag strings.

Example:
{
  "tags": ["react", "frontend", "hooks", "tutorial", "javascript"]
}

Now generate tags for the given bookmark.`

  try {
    const response = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 150,
      response_format: { type: 'json_object' },
    })

    const content = response.choices[0]?.message?.content
    if (!content) return []

    const parsed = JSON.parse(content)
    return parsed.tags || []
  } catch (error) {
    console.error('Groq API error:', error)
    return []
  }
}

// Apply AI tags to a bookmark
export async function applyAiTagsToBookmark(
  userId: string,
  bookmarkId: string,
  title: string,
  url: string,
  description: string
): Promise<TagSuggestion[]> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  // 1. Generate AI tags
  const aiTags = await generateAItags(title, url, description)
  if (aiTags.length === 0) return []

  // 2. Fetch user's existing tags
  const { data: existingTags } = await supabase
    .from('tags')
    .select('id, name, color')
    .eq('user_id', userId)

  // 3. Perform fuzzy matching
  const { matched, newTags } = fuzzyMatchTags(aiTags, existingTags || [])

  // 4. Create new tags
  const createdTags: Tag[] = []
  for (const tagName of newTags) {
    const { data } = await supabase
      .from('tags')
      .insert({ name: tagName, user_id: userId, color: getRandomColor() })
      .select()
      .single()

    if (data) createdTags.push(data)
  }

  // 5. Get all tag IDs to associate
  const tagIds = [
    ...matched.map((m) => m.existingTag.id),
    ...createdTags.map((t) => t.id),
  ]

  // 6. Associate tags with bookmark
  for (const tagId of tagIds) {
    await supabase.from('bookmark_tags').insert({ bookmark_id: bookmarkId, tag_id: tagId })
  }

  // 7. Return suggestions for UI
  const suggested: TagSuggestion[] = [
    ...matched.map((m) => {
      const existingTag = existingTags?.find((t) => t.id === m.existingTag.id)!
      return { ...existingTag, isNew: false }
    }),
    ...createdTags.map((t) => ({ ...t, isNew: true })),
  ]

  return suggested
}

// Semantic search expansion using Groq
export async function expandSearchQuery(query: string): Promise<string[]> {
  if (!GROQ_API_KEY) return [query]

  const groq = new Groq({ apiKey: GROQ_API_KEY })

  const prompt = `You are a search assistant. Given a search query, expand it with 5-8 related terms and synonyms that would help find similar content.

Query: "${query}"

Rules:
- Return ONLY a JSON object with an "expanded" array
- Include synonyms, related concepts, broader and narrower terms
- Keep all terms lowercase
- Maximum 8 expanded terms

Example:
Query: "car"
Response: { "expanded": ["car", "automobile", "vehicle", "sedan", "suv", "sports car", "supercar", "automotive"] }

Now expand this query: "${query}"`

  try {
    const response = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 150,
      response_format: { type: 'json_object' },
    })

    const content = response.choices[0]?.message?.content
    if (!content) return [query]

    const parsed = JSON.parse(content)
    return parsed.expanded || [query]
  } catch (error) {
    console.error('Groq semantic search error:', error)
    return [query]
  }
}

// Cleanup unused tags
export async function cleanupUnusedTags(userId: string): Promise<number> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  // Find all tags that have no bookmark associations
  const { data: unusedTags } = await supabase
    .from('tags')
    .select('id')
    .eq('user_id', userId)
    .not('id', 'in', `(SELECT tag_id FROM bookmark_tags)`)

  if (!unusedTags || unusedTags.length === 0) return 0

  // Delete unused tags
  const tagIds = unusedTags.map((t) => t.id)
  const { error } = await supabase.from('tags').delete().in('id', tagIds)

  if (error) {
    console.error('Cleanup error:', error)
    return 0
  }

  return tagIds.length
}

// Get all bookmarks with their tags for a user
export async function getBookmarksWithTags(userId: string): Promise<any[]> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  const { data: bookmarks } = await supabase
    .from('bookmarks')
    .select(`
      *,
      bookmark_tags (
        tags (*)
      )
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  return bookmarks || []
}

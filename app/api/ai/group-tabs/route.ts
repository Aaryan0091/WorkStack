import { NextRequest, NextResponse } from 'next/server'
import Groq from 'groq-sdk'

import { ENV, corsHeaders, getUserFromToken, handleOptionsRequest } from '@/lib/api-response'

const GROQ_API_KEY = ENV.GROQ_API_KEY

interface InputTab {
  tabId: number
  url: string
  title?: string
  favicon?: string
}

interface GroupDraft {
  label: string
  reason: string
  tabIds: number[]
}

interface OutputGroup {
  id: string
  label: string
  reason: string
  count: number
  tabIds: number[]
  sampleTitles: string[]
}

const MAX_TABS = 80
const MAX_GROUPS = 7

const STRICT_TECH_KEYWORDS = [
  'algorithm', 'algorithms', 'api', 'auth', 'backend', 'bug', 'chatgpt', 'code',
  'coding', 'computer science', 'css', 'data structure', 'debug', 'developer',
  'engineering', 'frontend', 'github', 'html', 'javascript', 'js', 'llm',
  'login', 'machine learning', 'next.js', 'node', 'openai', 'programming',
  'python', 'react', 'software', 'sorting', 'sql', 'supabase', 'tech',
  'terminal', 'typescript', 'ui', 'ux', 'webdev'
] as const

const STRICT_ENTERTAINMENT_KEYWORDS = [
  'ambient', 'anime', 'eat', 'episode', 'forest', 'funny', 'medieval', 'mix',
  'music', 'parody', 'playlist', 'relax', 'scene', 'song', 'soundtrack',
  'trailer', 'watch', 'while you eat'
] as const

const CATEGORY_RULES: Array<{
  label: string
  reason: string
  keywords: string[]
  hosts?: string[]
}> = [
  {
    label: 'Tech',
    reason: 'Programming, developer tools, AI, software, or technical learning.',
    keywords: [
      'ai', 'api', 'backend', 'bug', 'code', 'coding', 'computer', 'css', 'data',
      'database', 'debug', 'developer', 'devops', 'docker', 'engineering', 'frontend',
      'github', 'html', 'javascript', 'js', 'kubernetes', 'llm', 'machine learning',
      'next.js', 'nextjs', 'node', 'openai', 'postgres', 'programming', 'python',
      'react', 'repo', 'saas', 'software', 'sql', 'supabase', 'tailwind', 'tech',
      'terminal', 'typescript', 'ui', 'ux', 'vercel', 'webdev'
    ],
    hosts: ['github.com', 'stackoverflow.com', 'vercel.com', 'developer.mozilla.org', 'docs']
  },
  {
    label: 'Work',
    reason: 'Email, docs, meetings, planning, productivity, or collaboration.',
    keywords: [
      'agenda', 'calendar', 'client', 'crm', 'dashboard', 'docs', 'document',
      'figma', 'jira', 'meeting', 'notion', 'project', 'proposal', 'roadmap',
      'sheet', 'slides', 'slack', 'spec', 'sprint', 'task', 'ticket', 'workspace'
    ],
    hosts: ['docs.google.com', 'notion.so', 'linear.app', 'slack.com', 'figma.com']
  },
  {
    label: 'Shopping',
    reason: 'Products, pricing, carts, purchases, reviews, or marketplaces.',
    keywords: [
      'amazon', 'buy', 'cart', 'checkout', 'coupon', 'deal', 'ebay', 'flipkart',
      'order', 'price', 'pricing', 'product', 'purchase', 'review', 'sale', 'shop'
    ]
  },
  {
    label: 'Learning',
    reason: 'Courses, tutorials, guides, explainers, or how-to content.',
    keywords: [
      'bootcamp', 'course', 'explained', 'guide', 'how to', 'intro', 'learn',
      'lesson', 'masterclass', 'reference', 'study', 'syllabus', 'tutorial', 'walkthrough'
    ]
  },
  {
    label: 'News & Reading',
    reason: 'Articles, essays, blogs, and current-events reading.',
    keywords: [
      'analysis', 'article', 'blog', 'coverage', 'editorial', 'essay', 'magazine',
      'newsletter', 'news', 'opinion', 'post', 'read', 'story'
    ]
  },
  {
    label: 'Social',
    reason: 'Social feeds, communities, chats, and discussion platforms.',
    keywords: [
      'community', 'discord', 'instagram', 'linkedin', 'message', 'post', 'reddit',
      'social', 'thread', 'threads', 'tweet', 'twitter', 'x.com'
    ]
  },
  {
    label: 'Entertainment',
    reason: 'Fun videos, music, streaming, sports, or general entertainment.',
    keywords: [
      'album', 'anime', 'clip', 'comedy', 'episode', 'football', 'funny', 'game',
      'highlights', 'movie', 'music', 'netflix', 'playlist', 'podcast', 'reaction',
      'song', 'spotify', 'stream', 'trailer', 'watch'
    ],
    hosts: ['youtube.com', 'youtu.be', 'netflix.com', 'spotify.com', 'twitch.tv']
  }
]

export async function OPTIONS(request: NextRequest) {
  return handleOptionsRequest(request)
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'group'
}

function normalizeTabs(input: unknown): InputTab[] {
  if (!Array.isArray(input)) return []

  return input
    .map((item): InputTab | null => {
      if (!item || typeof item !== 'object') return null
      const tab = item as Partial<InputTab>
      if (typeof tab.tabId !== 'number' || typeof tab.url !== 'string' || tab.url.trim().length === 0) {
        return null
      }

      return {
        tabId: tab.tabId,
        url: tab.url.trim(),
        title: typeof tab.title === 'string' ? tab.title.trim() : '',
        favicon: typeof tab.favicon === 'string' ? tab.favicon : undefined
      }
    })
    .filter((tab): tab is InputTab => Boolean(tab))
    .slice(0, MAX_TABS)
}

function getHost(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase()
  } catch {
    return ''
  }
}

function getPath(url: string): string {
  try {
    return new URL(url).pathname.toLowerCase()
  } catch {
    return ''
  }
}

function getSearchText(tab: InputTab): string {
  return [tab.title || '', tab.url, getHost(tab.url), getPath(tab.url)].join(' ').toLowerCase()
}

function hasAnyKeyword(text: string, keywords: readonly string[]): boolean {
  return keywords.some((keyword) => text.includes(keyword))
}

function isYoutubeHost(host: string): boolean {
  return host.includes('youtube.com') || host.includes('youtu.be')
}

function isTechSignal(text: string): boolean {
  return CATEGORY_RULES[0].keywords.some((keyword) => text.includes(keyword))
}

function isStrongTechTab(tab: InputTab): boolean {
  const text = getSearchText(tab)
  const host = getHost(tab.url)

  if (host.includes('chatgpt.com') || host.includes('openai.com') || host.includes('github.com')) {
    return true
  }

  return hasAnyKeyword(text, STRICT_TECH_KEYWORDS)
}

function isStrongEntertainmentTab(tab: InputTab): boolean {
  const text = getSearchText(tab)
  const host = getHost(tab.url)

  if (!isYoutubeHost(host) && !host.includes('spotify.com') && !host.includes('netflix.com')) {
    return false
  }

  return hasAnyKeyword(text, STRICT_ENTERTAINMENT_KEYWORDS)
}

function inferIntentFromGroupLabel(group: GroupDraft): 'tech' | 'entertainment' | 'other' {
  const text = `${group.label} ${group.reason}`.toLowerCase()

  if (text.includes('tech') || text.includes('technical') || text.includes('auth') || text.includes('login')) {
    return 'tech'
  }

  if (text.includes('entertainment') || text.includes('music') || text.includes('fun') || text.includes('video')) {
    return 'entertainment'
  }

  return 'other'
}

function reconcileAiGroups(rawGroups: GroupDraft[], tabs: InputTab[]): GroupDraft[] {
  const tabById = new Map(tabs.map((tab) => [tab.tabId, tab]))
  const reconciled = new Map<string, GroupDraft>()

  const ensureGroup = (label: string, reason: string) => {
    const key = label.toLowerCase()
    const existing = reconciled.get(key)
    if (existing) return existing

    const draft: GroupDraft = { label, reason, tabIds: [] }
    reconciled.set(key, draft)
    return draft
  }

  for (const rawGroup of rawGroups) {
    if (!rawGroup || typeof rawGroup.label !== 'string' || !Array.isArray(rawGroup.tabIds)) {
      continue
    }

    const intent = inferIntentFromGroupLabel(rawGroup)
    const baseGroup = ensureGroup(
      rawGroup.label.trim() || 'Misc',
      rawGroup.reason?.trim() || 'Related tabs grouped by shared topic.'
    )

    for (const tabId of rawGroup.tabIds) {
      const tab = tabById.get(tabId)
      if (!tab) continue

      if (intent === 'tech' && isStrongEntertainmentTab(tab) && !isStrongTechTab(tab)) {
        ensureGroup(
          'Entertainment',
          'Fun videos, music, streaming, sports, or general entertainment.'
        ).tabIds.push(tabId)
        continue
      }

      if (intent === 'entertainment' && isStrongTechTab(tab) && !isStrongEntertainmentTab(tab)) {
        ensureGroup(
          'Tech',
          'Programming, developer tools, AI, software, or technical learning.'
        ).tabIds.push(tabId)
        continue
      }

      baseGroup.tabIds.push(tabId)
    }
  }

  return [...reconciled.values()].filter((group) => group.tabIds.length > 0)
}

function scoreCategory(tab: InputTab, rule: (typeof CATEGORY_RULES)[number]): number {
  const text = getSearchText(tab)
  let score = 0

  for (const keyword of rule.keywords) {
    if (text.includes(keyword)) {
      score += keyword.length > 5 ? 3 : 2
    }
  }

  for (const host of rule.hosts || []) {
    if (text.includes(host)) {
      score += 4
    }
  }

  const host = getHost(tab.url)
  if ((host.includes('youtube.com') || host.includes('youtu.be')) && rule.label === 'Entertainment' && isTechSignal(text)) {
    score -= 5
  }

  if ((host.includes('youtube.com') || host.includes('youtu.be')) && rule.label === 'Tech' && isTechSignal(text)) {
    score += 4
  }

  return score
}

function buildHeuristicGroups(tabs: InputTab[]): GroupDraft[] {
  const grouped = new Map<string, InputTab[]>()

  for (const tab of tabs) {
    const scores = CATEGORY_RULES.map((rule) => ({
      label: rule.label,
      reason: rule.reason,
      score: scoreCategory(tab, rule)
    }))
      .sort((a, b) => b.score - a.score)

    const best = scores[0]
    const categoryLabel = best && best.score > 0 ? best.label : 'Misc'
    const bucket = grouped.get(categoryLabel) || []
    bucket.push(tab)
    grouped.set(categoryLabel, bucket)
  }

  const drafts = [...grouped.entries()].map(([label, groupedTabs]) => {
    const rule = CATEGORY_RULES.find((item) => item.label === label)
    return {
      label,
      reason: rule?.reason || 'Everything else that does not fit the main semantic buckets.',
      tabIds: groupedTabs.map((tab) => tab.tabId)
    }
  })

  return drafts
    .sort((a, b) => b.tabIds.length - a.tabIds.length || a.label.localeCompare(b.label))
    .slice(0, MAX_GROUPS)
}

async function groupTabsWithAi(tabs: InputTab[]): Promise<GroupDraft[] | null> {
  if (!GROQ_API_KEY) {
    return null
  }

  const groq = new Groq({
    apiKey: GROQ_API_KEY,
    timeout: 12000,
  })

  const summarizedTabs = tabs.map((tab) => ({
    tabId: tab.tabId,
    title: (tab.title || '').slice(0, 140),
    host: getHost(tab.url),
    path: getPath(tab.url).slice(0, 120),
    url: tab.url.slice(0, 180)
  }))

  const prompt = `You are grouping browser tabs for a "smart reopen" workflow.

Group the tabs semantically by topic or intent, not just by website.

Rules:
- A tech-related YouTube video belongs in Tech, not Entertainment.
- Group by meaning first, source second.
- Create between 2 and ${MAX_GROUPS} groups when possible.
- Use short human-friendly labels (1-3 words).
- Avoid duplicate or overlapping groups.
- Every tabId must appear exactly once across all groups.
- Return ONLY valid JSON with this shape:
{
  "groups": [
    {
      "label": "Tech",
      "reason": "Short reason",
      "tabIds": [1, 2, 3]
    }
  ]
}

Tabs:
${JSON.stringify(summarizedTabs, null, 2)}`

  try {
    const response = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0,
      max_tokens: 900,
      response_format: { type: 'json_object' },
    })

    const content = response.choices[0]?.message?.content
    if (!content) {
      return null
    }

    const parsed = JSON.parse(content) as { groups?: GroupDraft[] }
    if (!Array.isArray(parsed.groups)) {
      return null
    }

    return parsed.groups
  } catch (error) {
    console.warn('[AI Group Tabs] Falling back to heuristics:', error)
    return null
  }
}

function finalizeGroups(rawGroups: GroupDraft[], tabs: InputTab[]): OutputGroup[] {
  const validTabIds = new Set(tabs.map((tab) => tab.tabId))
  const tabById = new Map(tabs.map((tab) => [tab.tabId, tab]))
  const assignedIds = new Set<number>()
  const normalizedGroups: OutputGroup[] = []

  for (const rawGroup of rawGroups) {
    if (!rawGroup || typeof rawGroup.label !== 'string' || !Array.isArray(rawGroup.tabIds)) {
      continue
    }

    const cleanedIds = rawGroup.tabIds.filter((tabId): tabId is number => {
      if (typeof tabId !== 'number' || !validTabIds.has(tabId) || assignedIds.has(tabId)) {
        return false
      }
      assignedIds.add(tabId)
      return true
    })

    if (cleanedIds.length === 0) {
      continue
    }

    const label = rawGroup.label.trim().slice(0, 40) || 'Misc'
    const reason = typeof rawGroup.reason === 'string' && rawGroup.reason.trim().length > 0
      ? rawGroup.reason.trim().slice(0, 140)
      : 'Related tabs grouped by shared topic.'

    normalizedGroups.push({
      id: slugify(label),
      label,
      reason,
      count: cleanedIds.length,
      tabIds: cleanedIds,
      sampleTitles: cleanedIds
        .map((tabId) => tabById.get(tabId)?.title || getHost(tabById.get(tabId)?.url || ''))
        .filter(Boolean)
        .slice(0, 3)
    })
  }

  const leftovers = tabs.filter((tab) => !assignedIds.has(tab.tabId))
  if (leftovers.length > 0) {
    normalizedGroups.push({
      id: 'misc',
      label: 'Misc',
      reason: 'Tabs that did not cleanly fit the main semantic groups.',
      count: leftovers.length,
      tabIds: leftovers.map((tab) => tab.tabId),
      sampleTitles: leftovers
        .map((tab) => tab.title || getHost(tab.url))
        .filter(Boolean)
        .slice(0, 3)
    })
  }

  return normalizedGroups
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, MAX_GROUPS)
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization')
    const user = await getUserFromToken(authHeader)
    if (!user) {
      const response = NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      return corsHeaders(response, request)
    }

    const body = await request.json()
    const tabs = normalizeTabs(body?.tabs)

    if (tabs.length === 0) {
      const response = NextResponse.json({ error: 'No tabs provided' }, { status: 400 })
      return corsHeaders(response, request)
    }

    const aiGroups = await groupTabsWithAi(tabs)
    const fallbackGroups = buildHeuristicGroups(tabs)
    const groups = finalizeGroups(
      aiGroups && aiGroups.length > 0 ? reconcileAiGroups(aiGroups, tabs) : fallbackGroups,
      tabs
    )

    const response = NextResponse.json({ groups })
    return corsHeaders(response, request)
  } catch (error) {
    console.error('[AI Group Tabs] Error:', error)
    const response = NextResponse.json({ error: 'Failed to group tabs' }, { status: 500 })
    return corsHeaders(response, request)
  }
}

'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { DashboardLayout } from '@/components/dashboard-layout'
import { Card, CardContent } from '@/components/ui/card'
import type { TabActivity } from '@/lib/types'

const ACTIVITIES_PER_PAGE = 200

// Helper to get week date range
function getWeekRange(offset = 0) {
  const now = new Date()
  const dayOfWeek = now.getDay()
  const startOfWeek = new Date(now)
  startOfWeek.setDate(now.getDate() - dayOfWeek - (offset * 7))
  startOfWeek.setHours(0, 0, 0, 0)

  const endOfWeek = new Date(startOfWeek)
  endOfWeek.setDate(startOfWeek.getDate() + 6)
  endOfWeek.setHours(23, 59, 59, 999)

  return { start: startOfWeek.toISOString(), end: endOfWeek.toISOString() }
}

// Helper to get date range (single day)
function getDayRange(dateStr: string) {
  const startDate = new Date(dateStr + 'T00:00:00').toISOString()
  const endDate = new Date(dateStr + 'T23:59:59').toISOString()
  return { start: startDate, end: endDate }
}

type ViewMode = 'today' | 'yesterday' | 'week' | 'last-week'

interface GroupedActivity {
  url: string
  title: string | null
  domain: string | null
  count: number
  totalSeconds: number
  firstVisit: string
  lastVisit: string
  activities: TabActivity[]
}

export default function TrackedActivityPage() {
  const router = useRouter()
  const [activities, setActivities] = useState<TabActivity[]>([])
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [viewMode, setViewMode] = useState<ViewMode>('week')
  const [userId, setUserId] = useState<string | null>(null)
  const [page, setPage] = useState(0)
  const observerTarget = useRef<HTMLDivElement>(null)
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>(getWeekRange(0))

  useEffect(() => {
    getCurrentUser()
  }, [])

  // Reset and fetch new activities when view changes
  useEffect(() => {
    if (userId) {
      let range: { start: string; end: string }

      switch (viewMode) {
        case 'today':
          range = getDayRange(new Date().toISOString().split('T')[0])
          break
        case 'yesterday':
          const yesterday = new Date()
          yesterday.setDate(yesterday.getDate() - 1)
          range = getDayRange(yesterday.toISOString().split('T')[0])
          break
        case 'week':
          range = getWeekRange(0)
          break
        case 'last-week':
          range = getWeekRange(1)
          break
        default:
          range = getWeekRange(0)
      }

      setDateRange(range)
      setActivities([])
      setPage(0)
      setHasMore(true)
      fetchActivities(0, true, range)
    }
  }, [userId, viewMode])

  const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      setUserId(user.id)
    } else {
      router.push('/login')
    }
  }

  const fetchActivities = async (pageNum: number, reset = false, range = dateRange) => {
    if (!userId) return

    if (reset) {
      setLoading(true)
    }

    const startIndex = pageNum * ACTIVITIES_PER_PAGE

    const { data, error } = await supabase
      .from('tab_activity')
      .select('*')
      .eq('user_id', userId)
      .gte('started_at', range.start)
      .lte('started_at', range.end)
      .order('started_at', { ascending: false })
      .range(startIndex, startIndex + ACTIVITIES_PER_PAGE - 1)

    if (!error && data) {
      if (reset) {
        setActivities(data)
      } else {
        setActivities(prev => [...prev, ...data])
      }
      setHasMore(data.length === ACTIVITIES_PER_PAGE)
    }

    setLoading(false)
  }

  // Infinite scroll observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          const nextPage = page + 1
          setPage(nextPage)
          fetchActivities(nextPage, false)
        }
      },
      { threshold: 0.1 }
    )

    const currentTarget = observerTarget.current
    if (currentTarget) {
      observer.observe(currentTarget)
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget)
      }
    }
  }, [hasMore, loading, page])

  // Group activities by URL
  const groupedActivities: GroupedActivity[] = Object.values(
    activities.reduce((acc, activity) => {
      const key = activity.url
      if (!acc[key]) {
        acc[key] = {
          url: activity.url,
          title: activity.title,
          domain: activity.domain,
          count: 0,
          totalSeconds: 0,
          firstVisit: activity.started_at,
          lastVisit: activity.started_at,
          activities: []
        }
      }
      acc[key].count++
      acc[key].totalSeconds += activity.duration_seconds || 0
      if (activity.started_at < acc[key].firstVisit) {
        acc[key].firstVisit = activity.started_at
      }
      if (activity.started_at > acc[key].lastVisit) {
        acc[key].lastVisit = activity.started_at
      }
      acc[key].activities.push(activity)
      return acc
    }, {} as Record<string, GroupedActivity>)
  ).sort((a, b) => b.lastVisit.localeCompare(a.lastVisit))

  // Group by date for display
  const groupedByDate: Record<string, GroupedActivity[]> = {}
  groupedActivities.forEach(a => {
    const date = new Date(a.lastVisit).toISOString().split('T')[0]
    if (!groupedByDate[date]) {
      groupedByDate[date] = []
    }
    groupedByDate[date].push(a)
  })

  // Calculate statistics
  const totalVisits = groupedActivities.reduce((sum, a) => sum + a.count, 0)
  const totalSeconds = groupedActivities.reduce((sum, a) => sum + a.totalSeconds, 0)
  const totalMinutes = Math.floor(totalSeconds / 60)
  const totalHours = (totalMinutes / 60).toFixed(1)

  // Group by domain
  const domainStats: Record<string, { count: number; seconds: number }> = {}
  activities.forEach(a => {
    const domain = a.domain || 'other'
    if (!domainStats[domain]) {
      domainStats[domain] = { count: 0, seconds: 0 }
    }
    domainStats[domain].count++
    domainStats[domain].seconds += a.duration_seconds || 0
  })

  const topDomains = Object.entries(domainStats)
    .sort((a, b) => b[1].seconds - a[1].seconds)
    .slice(0, 10)

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const hrs = Math.floor(mins / 60)
    if (hrs > 0) {
      return `${hrs}h ${mins % 60}m`
    }
    return `${mins}m`
  }

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    if (date.toDateString() === today.toDateString()) return 'Today'
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday'
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  }

  const getViewLabel = () => {
    switch (viewMode) {
      case 'today': return 'Today'
      case 'yesterday': return 'Yesterday'
      case 'week': return 'This Week'
      case 'last-week': return 'Last Week'
    }
  }

  const getDomain = (url: string) => {
    try {
      return new URL(url).hostname
    } catch {
      return url
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>Tracked Activity</h1>
            <p className="mt-1" style={{ color: 'var(--text-secondary)' }}>
              View your browsing history and time spent
            </p>
          </div>
        </div>

        {/* View Mode Selector */}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setViewMode('today')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${viewMode === 'today' ? 'bg-blue-600 text-white' : ''}`}
            style={{
              backgroundColor: viewMode === 'today' ? undefined : 'var(--bg-secondary)',
              color: viewMode === 'today' ? undefined : 'var(--text-primary)',
              cursor: 'pointer'
            }}
          >
            Today
          </button>
          <button
            onClick={() => setViewMode('yesterday')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${viewMode === 'yesterday' ? 'bg-blue-600 text-white' : ''}`}
            style={{
              backgroundColor: viewMode === 'yesterday' ? undefined : 'var(--bg-secondary)',
              color: viewMode === 'yesterday' ? undefined : 'var(--text-primary)',
              cursor: 'pointer'
            }}
          >
            Yesterday
          </button>
          <button
            onClick={() => setViewMode('week')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${viewMode === 'week' ? 'bg-blue-600 text-white' : ''}`}
            style={{
              backgroundColor: viewMode === 'week' ? undefined : 'var(--bg-secondary)',
              color: viewMode === 'week' ? undefined : 'var(--text-primary)',
              cursor: 'pointer'
            }}
          >
            This Week
          </button>
          <button
            onClick={() => setViewMode('last-week')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${viewMode === 'last-week' ? 'bg-blue-600 text-white' : ''}`}
            style={{
              backgroundColor: viewMode === 'last-week' ? undefined : 'var(--bg-secondary)',
              color: viewMode === 'last-week' ? undefined : 'var(--text-primary)',
              cursor: 'pointer'
            }}
          >
            Last Week
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-3xl font-bold text-blue-600">{totalVisits}</p>
              <p style={{ color: 'var(--text-secondary)' }}>Total Visits ({getViewLabel()})</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-3xl font-bold text-green-600">{totalMinutes}</p>
              <p style={{ color: 'var(--text-secondary)' }}>Minutes Tracked</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-3xl font-bold text-purple-600">{totalHours}</p>
              <p style={{ color: 'var(--text-secondary)' }}>Hours Total</p>
            </CardContent>
          </Card>
        </div>

        {/* Top Domains */}
        {topDomains.length > 0 && (
          <Card>
            <CardContent className="p-6">
              <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Top Websites ({getViewLabel()})</h2>
              <div className="space-y-3">
                {topDomains.map(([domain, stats]) => (
                  <div key={domain} className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      <img
                        src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`}
                        className="w-5 h-5 rounded"
                        alt=""
                        loading="lazy"
                      />
                      <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{domain}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{stats.count} visits</span>
                      <span className="font-medium text-green-600">{formatDuration(stats.seconds)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Activity List grouped by date and URL */}
        {loading && activities.length === 0 ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="p-4 rounded-lg animate-pulse" style={{ backgroundColor: 'var(--bg-secondary)' }} />
            ))}
          </div>
        ) : activities.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center" style={{ color: 'var(--text-secondary)' }}>
              No activity tracked for {getViewLabel().toLowerCase()} yet.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedByDate)
              .sort((a, b) => b[0].localeCompare(a[0]))
              .map(([date, dateActivities]) => (
                <div key={date}>
                  <h3 className="text-sm font-semibold mb-3 uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
                    {formatDate(date)}
                  </h3>
                  <Card>
                    <CardContent className="p-4">
                      <div className="space-y-2">
                        {dateActivities.map((item, idx) => (
                          <a
                            key={`${item.url}-${idx}`}
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block"
                          >
                            <div
                              className="p-3 rounded-lg hover:bg-blue-50 transition-all duration-200 hover:scale-[1.02] hover:shadow-lg cursor-pointer"
                              style={{ backgroundColor: 'var(--bg-secondary)' }}
                            >
                              <div className="flex items-start gap-4">
                                <img
                                  src={`https://www.google.com/s2/favicons?domain=${getDomain(item.url)}&sz=32`}
                                  className="w-8 h-8 rounded flex-shrink-0"
                                  alt=""
                                  loading="lazy"
                                />
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                                    {item.title || item.url}
                                  </p>
                                  <p className="text-sm truncate" style={{ color: 'var(--text-secondary)' }}>{item.url}</p>
                                </div>
                                <div className="text-right flex-shrink-0">
                                  <div className="flex items-center gap-3">
                                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                                      {item.count} {item.count === 1 ? 'visit' : 'visits'}
                                    </span>
                                    <span className="font-medium text-green-600">{formatDuration(item.totalSeconds)}</span>
                                  </div>
                                  <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                                    {formatTime(item.lastVisit)}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </a>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ))}

            {/* Load more indicator */}
            {hasMore && (
              <div ref={observerTarget} className="py-4 text-center">
                {loading && (
                  <div className="inline-block w-6 h-6 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}

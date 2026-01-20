'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { DashboardLayout } from '@/components/dashboard-layout'
import { Card, CardContent } from '@/components/ui/card'
import type { TabActivity } from '@/lib/types'

type TimeFilter = 'today' | 'week' | 'month'

export default function TrackedActivityPage() {
  const router = useRouter()
  const [activities, setActivities] = useState<TabActivity[]>([])
  const [loading, setLoading] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [isTracking, setIsTracking] = useState(false)
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('today')

  useEffect(() => {
    getCurrentUser()
  }, [])

  useEffect(() => {
    if (userId) {
      fetchActivities()
      checkTrackingStatus()

      // Poll for updates every 3 seconds
      const interval = setInterval(() => {
        fetchActivities()
        checkTrackingStatus()
      }, 3000)

      return () => clearInterval(interval)
    }
  }, [userId])

  const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      setUserId(user.id)
    } else {
      router.push('/login')
    }
  }

  const checkTrackingStatus = () => {
    if (typeof window !== 'undefined' && (window as any).chrome) {
      (window as any).chrome.runtime.sendMessage(
        'llahljdmcglglkcaadldnbpcpnkdinco',
        { action: 'getStatus' },
        (response: any) => {
          if (response && !(window as any).chrome.runtime.lastError) {
            setIsTracking(response.isTracking)
          }
        }
      )
    }
  }

  const fetchActivities = async () => {
    if (!userId) return
    setLoading(true)

    const { data, error } = await supabase
      .from('tab_activity')
      .select('*')
      .eq('user_id', userId)
      .order('started_at', { ascending: false })

    if (!error && data) {
      setActivities(data)
    }

    setLoading(false)
  }

  const totalSeconds = activities.reduce((sum, a) => sum + (a.duration_seconds || 0), 0)
  const totalMinutes = (totalSeconds / 60).toFixed(1)
  const totalHours = (totalSeconds / 3600).toFixed(1)

  // Filter activities based on time period
  const getFilteredActivities = () => {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const weekAgo = new Date(today)
    weekAgo.setDate(weekAgo.getDate() - 7)
    const monthAgo = new Date(today)
    monthAgo.setMonth(monthAgo.getMonth() - 1)

    return activities.filter(item => {
      if (!item.started_at) return false
      const itemDate = new Date(item.started_at)

      switch (timeFilter) {
        case 'today':
          return itemDate >= today
        case 'week':
          return itemDate >= weekAgo
        case 'month':
          return itemDate >= monthAgo
        default:
          return true
      }
    })
  }

  const filteredActivities = getFilteredActivities()
  const filteredSeconds = filteredActivities.reduce((sum, a) => sum + (a.duration_seconds || 0), 0)
  const filteredMinutes = (filteredSeconds / 60).toFixed(1)
  const filteredHours = (filteredSeconds / 3600).toFixed(1)

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    if (mins >= 60) {
      const hrs = Math.floor(mins / 60)
      return `${hrs}h ${mins % 60}m`
    }
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`
  }

  const formatTotalTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    if (hrs > 0) {
      return `${hrs}h ${mins}m`
    }
    return `${mins}m`
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
            <h1 className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>
              Tracked Activity
            </h1>
            <p className="mt-1" style={{ color: 'var(--text-secondary)' }}>
              {isTracking ? 'Currently tracking tabs' : 'Last tracked session (tracking stopped)'}
            </p>
          </div>
        </div>

        {/* Time Filter Buttons */}
        <div className="flex gap-2">
          {(['today', 'week', 'month'] as TimeFilter[]).map((filter) => (
            <button
              key={filter}
              onClick={() => setTimeFilter(filter)}
              className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 cursor-pointer ${
                timeFilter === filter
                  ? 'bg-blue-600 text-white'
                  : 'hover:scale-105'
              }`}
              style={{
                backgroundColor: timeFilter !== filter ? 'var(--bg-secondary)' : undefined,
                color: timeFilter !== filter ? 'var(--text-primary)' : undefined
              }}
            >
              {filter === 'today' ? 'Today' : filter === 'week' ? 'This Week' : 'This Month'}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-3xl font-bold text-blue-600">{filteredActivities.length}</p>
              <p style={{ color: 'var(--text-secondary)' }}>Tracked Tabs</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-3xl font-bold text-green-600">{filteredMinutes}</p>
              <p style={{ color: 'var(--text-secondary)' }}>Total Minutes</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-3xl font-bold text-purple-600">{filteredHours}</p>
              <p style={{ color: 'var(--text-secondary)' }}>Total Hours</p>
            </CardContent>
          </Card>
        </div>

        {loading && activities.length === 0 ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="p-4 rounded-lg animate-pulse" style={{ backgroundColor: 'var(--bg-secondary)' }} />
            ))}
          </div>
        ) : filteredActivities.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center" style={{ color: 'var(--text-secondary)' }}>
              {activities.length === 0
                ? 'No tracked activity yet. Click "Track Activity" on the dashboard to start.'
                : 'No tracked activity for this time period.'}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-4">
              <div className="space-y-2">
                {filteredActivities.map((item) => (
                  <a
                    key={item.id}
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block"
                  >
                    <div
                      className="p-3 rounded-lg transition-all duration-200 hover:scale-[1.02] hover:shadow-lg"
                      style={{
                        backgroundColor: 'var(--bg-secondary)',
                        cursor: 'pointer'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.1)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'}
                    >
                      <div className="flex items-start gap-4">
                        <img
                          src={`https://www.google.com/s2/favicons?domain=${getDomain(item.url)}&sz=32`}
                          className="w-8 h-8 rounded flex-shrink-0"
                          alt=""
                          loading="lazy"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate hover:text-blue-600 transition-colors" style={{ color: 'var(--text-primary)' }}>
                            {item.title || item.url}
                          </p>
                          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{getDomain(item.url)}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <span className="font-medium text-green-600">
                            {formatDuration(item.duration_seconds || 0)}
                          </span>
                          <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                            time spent
                          </p>
                        </div>
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  )
}

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { activities } = body

    if (!activities || !Array.isArray(activities)) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    // Use service role key to bypass RLS for extension data
    const supabase = createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey)

    // Insert all activities
    const { data, error } = await supabase
      .from('tab_activity')
      .insert(activities.map((a: any) => ({
        user_id: a.user_id,
        url: a.url,
        title: a.title,
        domain: a.domain,
        duration_seconds: a.duration_seconds,
        started_at: a.started_at,
        ended_at: a.ended_at,
      })))
      .select()

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, count: activities.length, data })
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 })
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey)

    // Get today's activity for user
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const { data, error } = await supabase
      .from('tab_activity')
      .select('*')
      .eq('user_id', userId)
      .gte('started_at', today.toISOString())
      .order('started_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Calculate summary
    const totalTabs = data?.length || 0
    const totalSeconds = data?.reduce((sum, item) => sum + (item.duration_seconds || 0), 0) || 0

    // Group by domain
    const domainStats: Record<string, { count: number; seconds: number }> = {}
    data?.forEach((item: any) => {
      const domain = item.domain || 'other'
      if (!domainStats[domain]) {
        domainStats[domain] = { count: 0, seconds: 0 }
      }
      domainStats[domain].count++
      domainStats[domain].seconds += item.duration_seconds || 0
    })

    return NextResponse.json({
      activities: data || [],
      summary: {
        totalTabs,
        totalSeconds,
        domainStats
      }
    })
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

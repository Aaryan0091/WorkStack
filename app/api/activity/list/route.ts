import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!

// Get activity list - all sessions, latest entry per tab per session
export async function POST(request: NextRequest) {
  try {
    const { user_id } = await request.json()

    if (!user_id) {
      return NextResponse.json({ error: 'Missing user_id' }, { status: 400 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get all entries for this user, ordered by ended_at descending
    // This allows client-side filtering by time period (today/week/month/all)
    const { data, error } = await supabase
      .from('tab_activity')
      .select('*')
      .eq('user_id', user_id)
      .order('ended_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Filter to get only the latest entry per (session, tab) pair
    // This ensures that if user navigated within a tab during a session,
    // only the final URL for that tab is counted
    const seen = new Set<string>()
    const filtered = (data || []).filter(item => {
      // Use combination of tracking_session_id and tab_id as the key
      const key = `${item.tracking_session_id}_${item.tab_id}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    return NextResponse.json({ success: true, data: filtered })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

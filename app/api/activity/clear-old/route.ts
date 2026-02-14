import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!

// Clear activity older than the specified time period
export async function POST(request: NextRequest) {
  try {
    const { user_id, olderThan } = await request.json()

    if (!user_id || !olderThan) {
      return NextResponse.json({ error: 'Missing user_id or olderThan parameter' }, { status: 400 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Calculate the cutoff time
    const cutoffDate = new Date(olderThan)

    // Delete all activity older than the cutoff
    const { error } = await supabase
      .from('tab_activity')
      .delete()
      .eq('user_id', user_id)
      .lt('started_at', cutoffDate.toISOString())

    if (error) {
      console.error('Error clearing old activity:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, deleted: await supabase
      .from('tab_activity')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user_id)
      .lt('started_at', cutoffDate.toISOString()) })
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

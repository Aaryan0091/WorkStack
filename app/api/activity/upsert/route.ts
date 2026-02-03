import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!

// Get start of day in UTC for a given date
function getStartOfDay(date: Date): Date {
  const d = new Date(date)
  d.setUTCHours(0, 0, 0, 0)
  return d
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { user_id, url, title, domain, duration_seconds = 0, started_at } = body

    if (!user_id || !url) {
      return NextResponse.json({ error: 'Missing user_id or url' }, { status: 400 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Parse the started_at date to get the start of that day
    const startDate = started_at ? new Date(started_at) : new Date()
    const startOfDay = getStartOfDay(startDate)
    const endOfDay = new Date(startOfDay)
    endOfDay.setUTCDate(endOfDay.getUTCDate() + 1)

    // Check if an entry with this URL exists for the same user on the SAME DAY
    const { data: existingEntries } = await supabase
      .from('tab_activity')
      .select('*')
      .eq('user_id', user_id)
      .eq('url', url)
      .gte('started_at', startOfDay.toISOString())
      .lt('started_at', endOfDay.toISOString())

    // If there's an entry from today, update it. Otherwise create a new entry.
    const existingToday = existingEntries && existingEntries.length > 0 ? existingEntries[0] : null

    if (existingToday) {
      // Update the existing entry from today - ADD to the existing duration
      const { error: updateError } = await supabase
        .from('tab_activity')
        .update({
          title,
          domain,
          duration_seconds: (existingToday.duration_seconds || 0) + duration_seconds,
          // Keep original started_at from the first entry today
          // ended_at: new Date().toISOString(),
        })
        .eq('id', existingToday.id)

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 })
      }
      return NextResponse.json({ success: true, action: 'updated', duration_seconds, existingId: existingToday.id })
    } else {
      // Insert new entry for this URL on this day
      const { error: insertError } = await supabase
        .from('tab_activity')
        .insert({
          user_id,
          url,
          title,
          domain,
          duration_seconds,
          started_at: startDate.toISOString(),
          ended_at: startDate.toISOString()
        })

      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 500 })
      }
      return NextResponse.json({ success: true, action: 'inserted', duration_seconds })
    }
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

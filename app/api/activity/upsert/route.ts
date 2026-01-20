import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { user_id, url, title, domain, duration_seconds = 0, started_at } = body

    if (!user_id || !url) {
      return NextResponse.json({ error: 'Missing user_id or url' }, { status: 400 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Check if an entry with this URL already exists for this user
    const { data: existing } = await supabase
      .from('tab_activity')
      .select('*')
      .eq('user_id', user_id)
      .eq('url', url)
      .maybeSingle()

    if (existing) {
      // Update the existing entry (update duration and refresh timestamp)
      const { error: updateError } = await supabase
        .from('tab_activity')
        .update({
          title,
          domain,
          duration_seconds,
          started_at,
        })
        .eq('id', existing.id)

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 })
      }
      return NextResponse.json({ success: true, action: 'updated', duration_seconds })
    } else {
      // Insert new entry
      const { error: insertError } = await supabase
        .from('tab_activity')
        .insert({
          user_id,
          url,
          title,
          domain,
          duration_seconds,
          started_at,
          ended_at: started_at
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

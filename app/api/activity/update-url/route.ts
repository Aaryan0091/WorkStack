import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!

// URL update API - Simplified: update existing entry or create new one
// This preserves time across multiple tracking sessions
export async function POST(request: NextRequest) {
  try {
    const { user_id, oldUrl, newUrl, newTitle, additionalDuration, tabId } = await request.json()

    if (!user_id || !newUrl) {
      return NextResponse.json({ error: 'Missing user_id or newUrl parameter' }, { status: 400 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Use the provided title, or fall back to URL
    const titleToUse = (newTitle && newTitle.trim().length > 0) ? newTitle.trim() : newUrl

    console.log(`[Update-URL API] user: ${user_id}, newUrl: ${newUrl.slice(0,50)}, title: ${titleToUse.slice(0,50)}, time: ${additionalDuration}s`)

    // STEP 1: Look for an existing entry with this URL (from any previous session)
    // We want to ACCUMULATE time, not create duplicate entries
    const { data: existingEntry, error: fetchError } = await supabase
      .from('tab_activity')
      .select('*')
      .eq('user_id', user_id)
      .eq('url', newUrl)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('[Update-URL API] Fetch error:', fetchError)
    }

    if (existingEntry) {
      // Entry exists - UPDATE it (add time, update title)
      const newTotalTime = (existingEntry.duration_seconds || 0) + (additionalDuration || 0)

      const { error: updateError } = await supabase
        .from('tab_activity')
        .update({
          title: titleToUse,
          duration_seconds: newTotalTime,
          ended_at: new Date().toISOString()
        })
        .eq('id', existingEntry.id)

      if (updateError) {
        console.error('[Update-URL API] Update failed:', updateError)
        return NextResponse.json({ error: updateError.message }, { status: 500 })
      }

      console.log(`[Update-URL API] Updated existing entry: id=${existingEntry.id}, new total time=${newTotalTime}s`)

      return NextResponse.json({
        success: true,
        action: 'updated',
        record_id: existingEntry.id
      })
    }

    // STEP 2: No existing entry - CREATE new one
    const domain = extractDomain(newUrl)
    const { data: newEntry, error: insertError } = await supabase
      .from('tab_activity')
      .insert({
        user_id,
        url: newUrl,
        title: titleToUse,
        domain,
        duration_seconds: additionalDuration || 0,
        started_at: new Date().toISOString(),
        ended_at: new Date().toISOString()
      })
      .select()
      .single()

    if (insertError || !newEntry) {
      console.error('[Update-URL API] Insert error:', insertError)
      return NextResponse.json({ error: insertError?.message || 'Insert failed' }, { status: 500 })
    }

    console.log(`[Update-URL API] Created new entry: id=${newEntry.id}, url=${newUrl.slice(0,50)}`)

    return NextResponse.json({
      success: true,
      action: 'created',
      record_id: newEntry.id
    })
  } catch (error) {
    console.error('[Update-URL API] API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Helper function to extract domain from URL
function extractDomain(url: string) {
  try {
    const urlObj = new URL(url)
    return urlObj.hostname
  } catch {
    return url
  }
}

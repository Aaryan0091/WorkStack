import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { ENV } from '@/lib/api-response'

const supabaseUrl = ENV.SUPABASE_URL
const supabaseAnonKey = ENV.SUPABASE_ANON_KEY
const supabaseServiceKey = ENV.SUPABASE_SERVICE_KEY

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization')

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.substring(7)
    const supabase = createClient(supabaseUrl, supabaseAnonKey)

    const { data: { user }, error } = await supabase.auth.getUser(token)

    if (error || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey)

    // Try using the optimized SQL function (run the SQL in create-stats-function.sql first)
    const { data, error: queryError } = await supabaseAdmin.rpc('get_user_bookmark_stats', {
      p_user_id: user.id
    })

    if (queryError) {
      if (process.env.NODE_ENV === 'development') console.log('RPC not found, using parallel queries as fallback')
      // Fallback: parallel queries
      const [totalRes, favoritesRes, unreadRes] = await Promise.all([
        supabaseAdmin.from('bookmarks').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
        supabaseAdmin.from('bookmarks').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('is_favorite', true),
        supabaseAdmin.from('bookmarks').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('is_read', false),
      ])

      return NextResponse.json({
        total_bookmarks: totalRes.count ?? 0,
        favorites_count: favoritesRes.count ?? 0,
        unread_count: unreadRes.count ?? 0,
      })
    }

    // Return first row from the function result
    return NextResponse.json(Array.isArray(data) && data[0] ? data[0] : data)
  } catch (error) {
    console.error('Stats API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

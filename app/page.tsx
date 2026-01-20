import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { DashboardContent } from './dashboard-content'

// Server component - fetches data server-side for fast initial render
async function getDashboardData() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
      },
    }
  )

  // Use getUser() instead of getSession() for security
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) {
    return { bookmarks: [], collections: [], stats: { totalBookmarks: 0, favoritesCount: 0, unreadCount: 0 }, user: null }
  }

  // Use the optimized SQL function for all stats at once
  const [bookmarksRes, collectionsRes, statsRes] = await Promise.all([
    supabase.from('bookmarks').select('*').limit(5).order('created_at', { ascending: false }),
    supabase.from('collections').select('*'),
    // Try the optimized function first
    supabase.rpc('get_user_bookmark_stats', { p_user_id: user.id }),
  ])

  // If RPC failed, fall back to individual queries
  let stats = { totalBookmarks: 0, favoritesCount: 0, unreadCount: 0 }
  if (statsRes.data && Array.isArray(statsRes.data) && statsRes.data[0]) {
    stats = {
      totalBookmarks: statsRes.data[0].total_bookmarks || 0,
      favoritesCount: statsRes.data[0].favorites_count || 0,
      unreadCount: statsRes.data[0].unread_count || 0,
    }
  } else {
    // Fallback
    const [totalRes, favRes, unreadRes] = await Promise.all([
      supabase.from('bookmarks').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
      supabase.from('bookmarks').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('is_favorite', true),
      supabase.from('bookmarks').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('is_read', false),
    ])
    stats = {
      totalBookmarks: totalRes.count || 0,
      favoritesCount: favRes.count || 0,
      unreadCount: unreadRes.count || 0,
    }
  }

  return {
    bookmarks: bookmarksRes.data || [],
    collections: collectionsRes.data || [],
    stats,
    user,
  }
}

export default async function HomePage() {
  const data = await getDashboardData()

  // Redirect to login if not authenticated
  if (!data.user) {
    // Note: Middleware should handle this, but this is a fallback
    return null
  }

  return <DashboardContent initialBookmarks={data.bookmarks} initialCollections={data.collections} initialStats={data.stats} />
}

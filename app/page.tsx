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

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    return { bookmarks: [], collections: [], user: null }
  }

  const [bookmarksRes, collectionsRes, bookmarksCount] = await Promise.all([
    supabase.from('bookmarks').select('*').limit(5).order('created_at', { ascending: false }),
    supabase.from('collections').select('*'),
    supabase.from('bookmarks').select('id', { count: 'exact', head: true }),
  ])

  return {
    bookmarks: bookmarksRes.data || [],
    collections: collectionsRes.data || [],
    bookmarksCount: bookmarksCount.count || 0,
    user: session.user,
  }
}

export default async function HomePage() {
  const data = await getDashboardData()

  // Redirect to login if not authenticated
  if (!data.user) {
    // Note: Middleware should handle this, but this is a fallback
    return null
  }

  return <DashboardContent initialBookmarks={data.bookmarks} initialCollections={data.collections} initialBookmarksCount={data.bookmarksCount} />
}

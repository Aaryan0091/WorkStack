import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Only redirect to login if explicitly trying to access a protected route
// Allow guest users to browse the site freely
export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  const cookies = request.cookies.getAll()

  // Fast path: check if Supabase auth cookie exists
  const authCookie = cookies.find(c => c.name.startsWith('sb-') && c.name.includes('-auth-token'))
  const hasAuthCookie = !!authCookie

  // Create response
  let supabaseResponse = NextResponse.next({
    request,
  })

  // If on login page and already has auth cookie, redirect to home
  if (hasAuthCookie && pathname.startsWith('/login')) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  // Refresh the session cookie on every request to prevent token expiry during idle
  if (hasAuthCookie) {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
            supabaseResponse = NextResponse.next({ request })
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options)
            )
          },
        },
      }
    )

    // getUser() validates the token with the server and triggers refresh if expired
    await supabase.auth.getUser()
  }

  return supabaseResponse
}

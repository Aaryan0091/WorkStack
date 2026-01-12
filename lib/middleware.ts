import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  // Fast path: check if Supabase auth cookie exists (no network call)
  // Supabase SSR uses cookies like: sb-<project-ref>-auth-token
  const hasAuthCookie = request.cookies.getAll().some(c =>
    c.name.startsWith('sb-') && c.name.includes('-auth-token')
  )
  const pathname = request.nextUrl.pathname

  // If no token and not on login page, redirect immediately (no network call)
  if (!hasAuthCookie && !pathname.startsWith('/login')) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // If on login page and has token, redirect to home (no network call needed)
  if (hasAuthCookie && pathname.startsWith('/login')) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  // Create response once
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: any) {
          request.cookies.set(name, value)
          supabaseResponse.cookies.set(name, value, options)
        },
        remove(name: string, options: any) {
          request.cookies.delete(name)
          supabaseResponse.cookies.delete(name)
        },
      },
    }
  )

  // Only refresh session if we have a token (lighter operation than getUser)
  if (hasAuthCookie) {
    await supabase.auth.getSession()
  }

  return supabaseResponse
}

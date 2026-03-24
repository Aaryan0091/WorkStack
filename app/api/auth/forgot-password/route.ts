import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { ENV, corsHeaders, handleOptionsRequest } from '@/lib/api-response'

const supabaseUrl = ENV.SUPABASE_URL
const supabaseAnonKey = ENV.SUPABASE_ANON_KEY

export async function OPTIONS(request: NextRequest) {
  return handleOptionsRequest(request)
}

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      const response = NextResponse.json({ error: 'Please provide a valid email address' }, { status: 400 })
      return corsHeaders(response, request)
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey)

    // Reset password for user
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${request.nextUrl.origin}/login?reset=true`,
    })

    // Even if email doesn't exist, we return success to prevent email enumeration
    // This is a security best practice
    if (error) {
      console.error('Password reset error:', error)
      // Still return success to not leak user existence
      const response = NextResponse.json({
        message: 'If an account with this email exists, you will receive a password reset link shortly.',
      })
      return corsHeaders(response, request)
    }

    const response = NextResponse.json({
      message: 'If an account with this email exists, you will receive a password reset link shortly.',
    })
    return corsHeaders(response, request)
  } catch (error) {
    console.error('Forgot password error:', error)
    const response = NextResponse.json({ error: 'An error occurred. Please try again.' }, { status: 500 })
    return corsHeaders(response, request)
  }
}

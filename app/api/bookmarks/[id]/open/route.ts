import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!

// Helper to add CORS headers
function corsHeaders(response: NextResponse) {
  response.headers.set('Access-Control-Allow-Origin', '*')
  response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS')
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  return response
}

// Handle OPTIONS preflight request
export async function OPTIONS(request: NextRequest) {
  return corsHeaders(new NextResponse(null, { status: 200 }))
}

// Verify auth token and get user
async function getUserFromToken(authHeader: string | null) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null
  }

  const token = authHeader.substring(7)
  const supabase = createClient(supabaseUrl, supabaseAnonKey)

  const { data, error } = await supabase.auth.getUser(token)

  if (error || !data.user) {
    return null
  }

  return data.user
}

// POST - Record that a bookmark was opened
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authHeader = request.headers.get('Authorization')
    const user = await getUserFromToken(authHeader)

    if (!user) {
      const response = NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      return corsHeaders(response)
    }

    const { id } = await params

    if (!id) {
      const response = NextResponse.json({ error: 'Bookmark ID is required' }, { status: 400 })
      return corsHeaders(response)
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey)

    // Verify the bookmark belongs to the user
    const { data: bookmark } = await supabase
      .from('bookmarks')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (!bookmark) {
      const response = NextResponse.json({ error: 'Bookmark not found' }, { status: 404 })
      return corsHeaders(response)
    }

    // Update last_opened_at timestamp (but DON'T mark as read - user must manually mark as read)
    let updateError = null
    let updatedBookmark = null

    try {
      const result = await supabase
        .from('bookmarks')
        .update({
          last_opened_at: new Date().toISOString()
        })
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single()

      updateError = result.error
      updatedBookmark = result.data
    } catch (e) {
      updateError = e
    }

    if (updateError) {
      // Check if it's because column doesn't exist
      const errorCode = (updateError as any).code
      const errorMessage = (updateError as any).message || String(updateError)
      if (errorCode === '42703' || errorMessage.includes('column') || errorMessage.includes('last_opened_at')) {
        // Column doesn't exist, but that's okay - the bookmark was still "opened"
      } else {
        const response = NextResponse.json({ error: errorMessage }, { status: 500 })
        return corsHeaders(response)
      }
    }

    const response = NextResponse.json({ success: true })
    return corsHeaders(response)
  } catch (error) {
    console.error('API error:', error)
    const response = NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    return corsHeaders(response)
  }
}

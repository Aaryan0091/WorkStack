import { NextResponse, NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

/**
 * Standard API response types
 */
export interface ApiSuccessResponse<T = any> {
  success: true
  data: T
  message?: string
}

export interface ApiErrorResponse {
  success: false
  error: string
  details?: string
  code?: string
}

/**
 * Standard success response
 */
export function apiSuccess<T>(data: T, message?: string, status: number = 200): NextResponse<ApiSuccessResponse<T>> {
  return NextResponse.json(
    { success: true, data, message },
    { status }
  )
}

/**
 * Standard error response
 */
export function apiError(
  error: string,
  details?: string,
  status: number = 400,
  code?: string
): NextResponse<ApiErrorResponse> {
  return NextResponse.json(
    { success: false, error, details, code },
    { status }
  )
}

/**
 * Handle common API errors
 */
export class ApiError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 500,
    public code?: string
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

/**
 * Common error codes
 */
export const ErrorCodes = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  INVALID_INPUT: 'INVALID_INPUT',
  DUPLICATE: 'DUPLICATE',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  RATE_LIMITED: 'RATE_LIMITED'
} as const

/**
 * Wrap API route handlers with try-catch and consistent error handling
 */
export function withApiHandler(
  handler: (req: NextRequest, context?: any) => Promise<NextResponse>
) {
  return async (req: NextRequest, context?: any): Promise<NextResponse> => {
    try {
      return await handler(req, context)
    } catch (error) {
      console.error('API Error:', error)

      if (error instanceof ApiError) {
        return apiError(error.message, undefined, error.statusCode, error.code)
      }

      // Handle Supabase errors
      if (error && typeof error === 'object' && 'code' in error) {
        const supabaseError = error as any
        switch (supabaseError.code) {
          case 'PGRST116':
            return apiError('Resource not found', undefined, 404, ErrorCodes.NOT_FOUND)
          case '23505':
            return apiError('Resource already exists', undefined, 409, ErrorCodes.DUPLICATE)
          case '23503':
            return apiError('Referenced resource does not exist', undefined, 400, ErrorCodes.INVALID_INPUT)
          case '42501':
            return apiError('Access denied', undefined, 403, ErrorCodes.FORBIDDEN)
        }
      }

      // Generic error
      return apiError(
        'An unexpected error occurred',
        process.env.NODE_ENV === 'development' ? String(error) : undefined,
        500,
        ErrorCodes.INTERNAL_ERROR
      )
    }
  }
}

/**
 * Validate required fields in request body
 */
export function validateRequired(body: any, fields: string[]): string | null {
  for (const field of fields) {
    if (!body[field] || (typeof body[field] === 'string' && !body[field].trim())) {
      return `Field '${field}' is required`
    }
  }
  return null
}

/**
 * Validate URL format
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

/**
 * Sanitize user input (basic XSS prevention)
 */
export function sanitizeInput(input: string): string {
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    .trim()
}

/**
 * Verify auth token and get user
 * Shared authentication helper for all API routes
 */
export async function getUserFromToken(authHeader: string | null) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null
  }

  const token = authHeader.substring(7)
  const supabase = createClient(supabaseUrl, supabaseAnonKey)

  const { data, error } = await supabase.auth.getUser(token)

  if (error || !data.user) {
    console.error('Auth error:', error?.message)
    return null
  }

  return data.user
}

/**
 * Helper to add CORS headers for extension requests
 * Shared CORS helper for all API routes
 */
export function corsHeaders(response: NextResponse): NextResponse {
  response.headers.set('Access-Control-Allow-Origin', '*')
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  return response
}

/**
 * Handle OPTIONS preflight request - can be exported directly from API routes
 */
export function handleOptionsRequest(): NextResponse {
  return corsHeaders(new NextResponse(null, { status: 200 }))
}

/**
 * Get authenticated user from request headers
 * Convenience wrapper that extracts the Authorization header
 */
export async function getAuthenticatedUser(request: NextRequest) {
  const authHeader = request.headers.get('Authorization')
  return await getUserFromToken(authHeader)
}

/**
 * Require authentication - throws ApiError if user is not authenticated
 * Use this at the start of protected routes
 */
export async function requireAuth(request: NextRequest) {
  const user = await getAuthenticatedUser(request)
  if (!user) {
    throw new ApiError('Unauthorized', 401, ErrorCodes.UNAUTHORIZED)
  }
  return user
}

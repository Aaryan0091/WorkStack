import { NextResponse } from 'next/server'

export async function GET() {
  // Redirect to the pre-built ZIP file in the public folder
  // This works in production because the ZIP file is bundled with the app
  return NextResponse.redirect(new URL('/extension/workstack-extension.zip', process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'))
}

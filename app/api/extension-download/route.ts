import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  // Simply redirect to the static file
  // The /extension/workstack-extension.zip file is served directly by Next.js from the public folder
  return NextResponse.redirect(new URL('/extension/workstack-extension.zip', request.url))
}

import { NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

export async function GET() {
  try {
    // Try to serve the file directly from public folder
    const filePath = join(process.cwd(), 'public', 'extension', 'workstack-extension.zip')

    // Check if file exists
    if (!existsSync(filePath)) {
      return NextResponse.json({ error: 'Extension file not found' }, { status: 404 })
    }

    const fileBuffer = await readFile(filePath)

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="workstack-extension.zip"',
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
    })
  } catch (error) {
    console.error('Extension download error:', error)
    return NextResponse.json({ error: 'Failed to download extension' }, { status: 500 })
  }
}

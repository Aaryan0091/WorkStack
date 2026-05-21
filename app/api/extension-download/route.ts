import { NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'
import {
  WORKSTACK_EXTENSION_LEGACY_ZIP_FILENAME,
  WORKSTACK_EXTENSION_VERSION,
  WORKSTACK_EXTENSION_ZIP_FILENAME,
} from '@/lib/extension-release'

export async function GET() {
  try {
    const publicRoot = join(process.cwd(), 'public')
    const preferredFilePath = join(publicRoot, WORKSTACK_EXTENSION_ZIP_FILENAME)
    const fallbackFilePath = join(publicRoot, 'extension', WORKSTACK_EXTENSION_LEGACY_ZIP_FILENAME)
    const filePath = existsSync(preferredFilePath) ? preferredFilePath : fallbackFilePath

    // Check if file exists
    if (!existsSync(filePath)) {
      return NextResponse.json({ error: 'Extension file not found' }, { status: 404 })
    }

    const fileBuffer = await readFile(filePath)

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${WORKSTACK_EXTENSION_ZIP_FILENAME}"`,
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
        'X-WorkStack-Extension-Version': WORKSTACK_EXTENSION_VERSION,
      },
    })
  } catch (error) {
    console.error('Extension download error:', error)
    return NextResponse.json({ error: 'Failed to download extension' }, { status: 500 })
  }
}

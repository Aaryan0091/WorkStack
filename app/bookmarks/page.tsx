'use client'

import { Suspense } from 'react'
import { BookmarksList } from './bookmarks-list'
import { DashboardLayout } from '@/components/dashboard-layout'
import { Button } from '@/components/ui/button'

export default function BookmarksPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>Bookmarks</h1>
            <p className="mt-1" style={{ color: 'var(--text-secondary)' }}>Save and organize your links</p>
          </div>
          <Button onClick={() => (document as any).getElementById('add-bookmark-btn')?.click()}>+ Add Bookmark</Button>
        </div>
        <Suspense fallback={
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="p-4 rounded-lg animate-pulse" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded bg-gray-300" />
                  <div className="flex-1">
                    <div className="h-4 bg-gray-300 rounded mb-2 w-3/4" />
                    <div className="h-3 bg-gray-300 rounded w-1/2" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        }>
          <BookmarksList />
        </Suspense>
      </div>
    </DashboardLayout>
  )
}

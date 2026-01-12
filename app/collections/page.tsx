'use client'

import { Suspense } from 'react'
import { CollectionsContent } from './collections-content'
import { DashboardLayout } from '@/components/dashboard-layout'
import { Button } from '@/components/ui/button'

export default function CollectionsPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>Collections</h1>
            <p className="mt-1" style={{ color: 'var(--text-secondary)' }}>
              Organize and share your bookmarks
            </p>
          </div>
          <Button onClick={() => (document as any).getElementById('add-collection-btn')?.click()}>+ New Collection</Button>
        </div>
        <Suspense fallback={
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="overflow-hidden rounded-lg animate-pulse" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                <div className="h-2" />
                <div className="p-6">
                  <div className="h-6 bg-gray-300 rounded mb-2 w-3/4" />
                  <div className="h-4 bg-gray-300 rounded w-1/2 mb-4" />
                  <div className="flex gap-2">
                    <div className="h-8 bg-gray-300 rounded flex-1" />
                    <div className="h-8 bg-gray-300 rounded w-20" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        }>
          <CollectionsContent />
        </Suspense>
      </div>
    </DashboardLayout>
  )
}

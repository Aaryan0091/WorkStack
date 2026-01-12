'use client'

import { Suspense } from 'react'
import { ReadingListContent } from './reading-list-content'
import { DashboardLayout } from '@/components/dashboard-layout'

export default function ReadingListPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>Reading List</h1>
          <p className="mt-1" style={{ color: 'var(--text-secondary)' }}>
            Track what you want to read
          </p>
        </div>
        <Suspense fallback={
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="p-4 rounded-lg animate-pulse" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                <div className="flex gap-4">
                  <div className="w-6 h-6 rounded-full border-2" style={{ borderColor: 'var(--border-color)' }} />
                  <div className="flex-1">
                    <div className="h-4 bg-gray-300 rounded mb-2 w-3/4" />
                    <div className="h-3 bg-gray-300 rounded w-1/2" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        }>
          <ReadingListContent />
        </Suspense>
      </div>
    </DashboardLayout>
  )
}

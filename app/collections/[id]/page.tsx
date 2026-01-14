import { Suspense } from 'react'
import { DashboardLayout } from '@/components/dashboard-layout'
import { CollectionDetailContent } from './collection-detail-content'
import { CollectionLoader } from './collection-loader'

export default async function CollectionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  return (
    <DashboardLayout>
      <Suspense fallback={<CollectionLoader />}>
        <CollectionDetailContent collectionId={id} />
      </Suspense>
    </DashboardLayout>
  )
}

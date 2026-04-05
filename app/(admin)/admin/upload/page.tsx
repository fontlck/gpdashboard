import { AdminHeader } from '@/components/admin/AdminHeader'
import { CsvUploadClient } from '@/components/admin/CsvUploadClient'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Upload CSV' }

export default function AdminUploadPage() {
  return (
    <div>
      <AdminHeader
        title="Upload CSV"
        subtitle="Import an OPN/Omise transaction export to generate monthly reports"
      />
      <CsvUploadClient />
    </div>
  )
}

import { redirect } from 'next/navigation'

/**
 * /dashboard/reports has no index — all reports are listed on the Overview page.
 * Redirect so the sidebar "Reports" link never 404s.
 */
export default function ReportsIndexPage() {
  redirect('/dashboard')
}

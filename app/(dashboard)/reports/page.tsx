// TEMPORARILY HIDDEN: Reports page access blocked
// import ReportsPage from '@/modules/reports/ReportsPage'

import { redirect } from 'next/navigation'

export default function Page() {
  // Redirect to dashboard when trying to access reports page
  redirect('/dashboard')

  // return <ReportsPage />
}


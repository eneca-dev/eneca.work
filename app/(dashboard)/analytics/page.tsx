import { redirect } from "next/navigation"
import { createClient } from "@/utils/supabase/server"

export default async function FeedbackAnalyticsRoute() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect("/")
  }

  // Проверяем доступ к аналитике на сервере
  const { data: accessRecord } = await supabase
    .from('feedback_analytics_access')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!accessRecord) {
    redirect("/")
  }
  const { FeedbackAnalyticsPage } = await import("@/modules/feedback-analytics")
  return <FeedbackAnalyticsPage />
}

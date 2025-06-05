import { createClient } from "@/utils/supabase/client"

export interface CreateUserReportData {
  shortDescription: string
  detailedDescription?: string
}

// Создание нового репорта
export async function createUserReport(data: CreateUserReportData): Promise<void> {
  const supabase = createClient()
  
  // Получаем текущего пользователя
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  
  if (userError || !user) {
    console.error("Error getting current user:", userError)
    throw new Error("Пользователь не авторизован")
  }

  const { error } = await supabase
    .from("user_reports")
    .insert({
      user_report_short_description: data.shortDescription,
      user_report_detailed_description: data.detailedDescription || null,
      user_report_created_by: user.id,
    })

  if (error) {
    console.error("Error creating user report:", error)
    throw new Error("Не удалось создать отчет")
  }
} 
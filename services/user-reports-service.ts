import { createClient } from "@/utils/supabase/client"
import * as Sentry from "@sentry/nextjs"

export interface CreateUserReportData {
  shortDescription: string
  detailedDescription?: string
}

// Создание нового репорта
export async function createUserReport(data: CreateUserReportData): Promise<void> {
  return Sentry.startSpan(
    {
      op: "db.insert",
      name: "Создание пользовательского отчета",
    },
    async (span) => {
      try {
        const supabase = createClient()
        
        span.setAttribute("table", "user_reports")
        span.setAttribute("report.short_description", data.shortDescription.substring(0, 100))
        span.setAttribute("report.has_detailed_description", !!data.detailedDescription)
        
        // Получаем текущего пользователя
        const { data: { user }, error: userError } = await supabase.auth.getUser()
        
        if (userError || !user) {
          span.setAttribute("auth.error", true)
          span.setAttribute("auth.error_message", userError?.message || "No user")
          
          const error = new Error("Пользователь не авторизован")
          Sentry.captureException(userError || error, {
            tags: {
              module: 'user_reports_service',
              action: 'create_user_report',
              error_type: 'auth_error'
            },
            extra: {
              error_code: userError?.code,
              error_message: userError?.message,
              timestamp: new Date().toISOString()
            }
          })
          throw error
        }

        span.setAttribute("user.id", user.id)
        span.setAttribute("user.email", user.email || '')

        const { error } = await supabase
          .from("user_reports")
          .insert({
            user_report_short_description: data.shortDescription,
            user_report_detailed_description: data.detailedDescription || null,
            user_report_created_by: user.id,
          })

        if (error) {
          span.setAttribute("db.success", false)
          span.setAttribute("db.error", error.message)
          
          const insertError = new Error("Не удалось создать отчет")
          Sentry.captureException(error, {
            tags: {
              module: 'user_reports_service',
              action: 'create_user_report',
              error_type: 'db_insert_error',
              table: 'user_reports'
            },
            extra: {
              user_id: user.id,
              short_description: data.shortDescription,
              has_detailed_description: !!data.detailedDescription,
              error_code: error.code,
              error_details: error.details,
              error_hint: error.hint,
              timestamp: new Date().toISOString()
            }
          })
          throw insertError
        }

        span.setAttribute("db.success", true)
      } catch (error) {
        span.setAttribute("error", true)
        span.setAttribute("error.message", (error as Error).message)
        
        Sentry.captureException(error, {
          tags: {
            module: 'user_reports_service',
            action: 'create_user_report',
            error_type: 'general_error'
          },
          extra: {
            report_data: JSON.stringify(data),
            error_message: (error as Error).message,
            timestamp: new Date().toISOString()
          }
        })
        throw error
      }
    }
  )
} 
import * as Sentry from "@sentry/nextjs"

export interface CreateUserData {
  email: string
  password: string
  firstName: string
  lastName: string
  subdivision?: string
  department?: string
  team?: string
  position?: string
  category?: string
  roleId?: string
  workLocation?: "office" | "remote" | "hybrid"
  country?: string
  city?: string
}

export interface CreateUserResponse {
  success: boolean
  userId?: string
  email?: string
  error?: string
}

/**
 * Создает нового пользователя через API endpoint
 */
export async function createUserViaAPI(userData: CreateUserData): Promise<CreateUserResponse> {
  return Sentry.startSpan(
    {
      op: "api.call",
      name: "Вызов API создания пользователя",
    },
    async (span) => {
      try {
        console.log("=== createUserViaAPI ===")
        console.log("Отправка данных на сервер:", userData)
        
        span.setAttribute("user.email", userData.email)
        
        const response = await fetch("/api/users/create", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(userData),
        })

        const result = await response.json()
        
        if (!response.ok) {
          console.error("Ошибка API:", result)
          span.setAttribute("api.success", false)
          span.setAttribute("api.error", result.error)
          
          Sentry.captureException(new Error(`API Error: ${result.error}`), {
            tags: {
              module: 'user_api',
              action: 'create_user_via_api',
              status_code: response.status
            },
            extra: {
              error_message: result.error,
              user_email: userData.email,
              response_status: response.status,
              timestamp: new Date().toISOString()
            }
          })
          
          return { success: false, error: result.error }
        }

        span.setAttribute("api.success", true)
        span.setAttribute("created_user.id", result.userId)
        console.log("Пользователь успешно создан через API:", result)
        
        return result

      } catch (error) {
        console.error("Критическая ошибка при вызове API:", error)
        span.setAttribute("error", true)
        span.setAttribute("error.message", (error as Error).message)
        
        Sentry.captureException(error, {
          tags: {
            module: 'user_api',
            action: 'create_user_via_api',
            error_type: 'network_error'
          },
          extra: {
            error_message: (error as Error).message,
            user_email: userData.email,
            timestamp: new Date().toISOString()
          }
        })
        
        return { 
          success: false, 
          error: `Ошибка сети: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}` 
        }
      }
    }
  )
}

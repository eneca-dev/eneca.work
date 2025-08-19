import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import * as Sentry from "@sentry/nextjs"

export async function updateSession(request: NextRequest) {
  return Sentry.startSpan(
    {
      op: "middleware.auth",
      name: "Проверка сессии пользователя в middleware",
    },
    async (span) => {
      try {
        const url = new URL(request.url)
        span.setAttribute("http.url", url.pathname)
        span.setAttribute("http.method", request.method)
        span.setAttribute("user_agent", request.headers.get('user-agent') || '')

        let response = NextResponse.next({
          request: {
            headers: request.headers,
          },
        })

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
        const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

        if (!supabaseUrl || !supabaseKey) {
          const error = new Error("Отсутствуют переменные окружения Supabase")
          span.setAttribute("error", true)
          span.setAttribute("error.message", error.message)
          
          Sentry.captureException(error, {
            tags: {
              module: 'middleware',
              action: 'env_validation',
              critical: true
            },
            extra: {
              has_url: !!supabaseUrl,
              has_key: !!supabaseKey,
              pathname: url.pathname,
              timestamp: new Date().toISOString()
            }
          })
          throw error
        }

        const supabase = createServerClient(
          supabaseUrl,
          supabaseKey,
          {
            cookies: {
              get(name: string) {
                return request.cookies.get(name)?.value
              },
              set(name: string, value: string, options: any) {
                try {
                  request.cookies.set({
                    name,
                    value,
                    ...options,
                  })
                  response = NextResponse.next({
                    request: {
                      headers: request.headers,
                    },
                  })
                  response.cookies.set({
                    name,
                    value,
                    ...options,
                  })
                } catch (error) {
                  Sentry.captureException(error, {
                    tags: {
                      module: 'middleware',
                      action: 'cookie_set',
                      cookie_name: name
                    },
                    extra: {
                      pathname: url.pathname,
                      cookie_name: name,
                      timestamp: new Date().toISOString()
                    }
                  })
                  throw error
                }
              },
              remove(name: string, options: any) {
                try {
                  request.cookies.set({
                    name,
                    value: "",
                    ...options,
                  })
                  response = NextResponse.next({
                    request: {
                      headers: request.headers,
                    },
                  })
                  response.cookies.set({
                    name,
                    value: "",
                    ...options,
                  })
                } catch (error) {
                  Sentry.captureException(error, {
                    tags: {
                      module: 'middleware',
                      action: 'cookie_remove',
                      cookie_name: name
                    },
                    extra: {
                      pathname: url.pathname,
                      cookie_name: name,
                      timestamp: new Date().toISOString()
                    }
                  })
                  throw error
                }
              },
            },
          },
        )

        // Проверяем пользователя с отдельным span
        const { data: { user }, error } = await Sentry.startSpan(
          {
            op: "auth.getUser", 
            name: "Получение пользователя из Supabase",
          },
          async (userSpan) => {
            const result = await supabase.auth.getUser()
            userSpan.setAttribute("user.exists", !!result.data.user)
            if (result.error) {
              userSpan.setAttribute("error", true)
              userSpan.setAttribute("error.message", result.error.message)
            }
            return result
          }
        )

        if (error) {
          span.setAttribute("auth.error", true)
          span.setAttribute("auth.error_message", error.message)
          
          Sentry.captureException(error, {
            tags: {
              module: 'middleware',
              action: 'auth_check',
              error_type: 'supabase_auth_error'
            },
            extra: {
              pathname: url.pathname,
              error_message: error.message,
              timestamp: new Date().toISOString()
            }
          })
        }

        span.setAttribute("auth.user_authenticated", !!user)
        if (user) {
          span.setAttribute("user.id", user.id)
          span.setAttribute("user.email", user.email || '')
        }

        span.setAttribute("middleware.success", true)
        return response

      } catch (error) {
        span.setAttribute("error", true)
        span.setAttribute("error.message", (error as Error).message)
        
        Sentry.captureException(error, {
          tags: {
            module: 'middleware',
            action: 'update_session',
            error_type: 'critical_middleware_error'
          },
          extra: {
            url: request.url,
            method: request.method,
            user_agent: request.headers.get('user-agent'),
            timestamp: new Date().toISOString()
          }
        })
        
        // В случае критической ошибки возвращаем ответ без аутентификации
        return NextResponse.next({
          request: {
            headers: request.headers,
          },
        })
      }
    }
  )
}

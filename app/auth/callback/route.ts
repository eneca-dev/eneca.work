import { createClient } from "@/utils/supabase/server"
import { NextResponse } from "next/server"
import * as Sentry from "@sentry/nextjs"

export async function GET(request: Request) {
  return Sentry.startSpan(
    {
      op: "http.server",
      name: "GET /auth/callback",
    },
    async (span) => {
      try {
        const { searchParams } = new URL(request.url)
        const code = searchParams.get("code")
        const next = searchParams.get("next") || "/dashboard"

        span.setAttribute("auth.code_present", !!code)
        span.setAttribute("auth.redirect_url", next)

        if (code) {
          const supabase = await createClient()
          
          const { error } = await supabase.auth.exchangeCodeForSession(code)
          
          if (error) {
            span.setAttribute("auth.success", false)
            span.setAttribute("auth.error", error.message)
            
            // Отправляем ошибку обмена кода на сессию в Sentry
            Sentry.captureException(error, {
              tags: { 
                module: 'auth', 
                action: 'callback',
                error_type: 'code_exchange_failed'
              },
              extra: { 
                code: code.substring(0, 10) + '...', // Частично скрываем код
                redirect_url: next,
                timestamp: new Date().toISOString()
              }
            })
            
            // Редиректим на страницу ошибки или логина
            return NextResponse.redirect(new URL('/auth/login?error=callback_failed', request.url))
          }
          
          span.setAttribute("auth.success", true)
          
          // Логируем успешный callback
          Sentry.addBreadcrumb({
            message: 'Auth callback successful',
            category: 'auth',
            level: 'info',
            data: { redirect_url: next }
          })
        }

        return NextResponse.redirect(new URL(next, request.url))
      } catch (error) {
        span.recordException(error as Error)
        
        // Отправляем неожиданную ошибку в Sentry
        Sentry.captureException(error, {
          tags: { 
            module: 'auth', 
            action: 'callback',
            error_type: 'unexpected_error'
          },
          extra: { 
            url: request.url,
            timestamp: new Date().toISOString()
          }
        })
        
        // Редиректим на страницу ошибки
        return NextResponse.redirect(new URL('/auth/login?error=callback_error', request.url))
      }
    }
  )
}

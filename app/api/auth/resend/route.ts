import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { rateLimit, EMAIL_RESEND_RATE_LIMIT } from '@/utils/rate-limiting'
import { validateAuthCallbackUrl } from '@/utils/redirect-validation'
import * as Sentry from '@sentry/nextjs'

export async function POST(request: NextRequest) {
  return Sentry.startSpan(
    {
      op: "api.auth.resend",
      name: "Resend signup email",
    },
    async (span) => {
      try {
        // Parse request body
        let body
        try {
          body = await request.json()
        } catch (parseError) {
          span.setAttribute("error", true)
          span.setAttribute("error.type", "json_parse")
          return NextResponse.json({ error: 'Некорректный JSON' }, { status: 400 })
        }

        const email: string = (body?.email ?? '').trim().toLowerCase()

        // Validate required fields
        if (!email) {
          span.setAttribute("error", true)
          span.setAttribute("error.type", "missing_email")
          return NextResponse.json({ error: 'Email обязателен' }, { status: 400 })
        }

        span.setAttribute("email", email)

        // Apply rate limiting
        const rateLimitResult = rateLimit(request, EMAIL_RESEND_RATE_LIMIT)
        if (!rateLimitResult.success) {
          span.setAttribute("error", true)
          span.setAttribute("error.type", "rate_limit_exceeded")
          span.setAttribute("rate_limit.remaining", rateLimitResult.remaining)
          
          // Log rate limit exceeded for monitoring
          Sentry.addBreadcrumb({
            message: 'Rate limit exceeded for email resend',
            category: 'security',
            level: 'warning',
            data: { 
              email, 
              remaining: rateLimitResult.remaining,
              resetTime: new Date(rateLimitResult.resetTime).toISOString()
            }
          })

          return NextResponse.json(
            { 
              error: 'Слишком много попыток. Повторите попытку позже.',
              retryAfter: Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000)
            },
            { 
              status: 429,
              headers: {
                'Retry-After': Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000).toString(),
                'X-RateLimit-Limit': rateLimitResult.limit.toString(),
                'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
                'X-RateLimit-Reset': new Date(rateLimitResult.resetTime).toISOString(),
              }
            }
          )
        }

        // Validate redirect URL
        const redirectTo = `${request.nextUrl.origin}/auth/callback`
        const redirectValidation = validateAuthCallbackUrl(redirectTo, request.nextUrl.origin)
        if (!redirectValidation.isValid) {
          span.setAttribute("error", true)
          span.setAttribute("error.type", "invalid_redirect_url")
          span.setAttribute("redirect_url", redirectTo)
          
          // Log redirect validation failure for security monitoring
          Sentry.captureException(new Error('Invalid redirect URL in resend endpoint'), {
            tags: { 
              module: 'auth', 
              action: 'resend',
              error_type: 'invalid_redirect_url',
              security_issue: true
            },
            extra: { 
              email, 
              redirectTo,
              error: redirectValidation.error,
              origin: request.nextUrl.origin
            }
          })

          console.error('Invalid redirect URL:', redirectTo, redirectValidation.error)
          return NextResponse.json({ error: 'Недопустимый URL перенаправления' }, { status: 400 })
        }

        span.setAttribute("redirect_url.validated", true)
        span.setAttribute("redirect_url", redirectTo)

        // Use least-privilege server client instead of admin client
        // The server client with anon key can perform auth.resend operations
        const supabase = await createClient()
        const { error } = await supabase.auth.resend({
          type: 'signup',
          email,
          options: { emailRedirectTo: redirectTo },
        })

        if (error) {
          span.setAttribute("error", true)
          span.setAttribute("error.type", "supabase_resend_failed")
          span.setAttribute("supabase.error", error.message)
          
          // Log Supabase error for debugging
          Sentry.captureException(error, {
            tags: { 
              module: 'auth', 
              action: 'resend',
              error_type: 'supabase_error'
            },
            extra: { 
              email, 
              redirectTo,
              supabaseError: error.message
            }
          })

          console.error('Supabase resend error:', error)
          return NextResponse.json(
            { emailSent: false, error: 'Не удалось отправить письмо подтверждения' },
            { status: 400 }
          )
        }

        span.setAttribute("success", true)
        span.setAttribute("rate_limit.remaining", rateLimitResult.remaining)

        // Log successful resend for monitoring
        Sentry.addBreadcrumb({
          message: 'Email resend successful',
          category: 'auth',
          level: 'info',
          data: { 
            email,
            remaining: rateLimitResult.remaining
          }
        })

        return NextResponse.json({ emailSent: true })
      } catch (error) {
        span.setAttribute("error", true)
        span.setAttribute("error.type", "unexpected_error")
        
        console.error('Ошибка при повторной отправке письма:', error)
        Sentry.captureException(error, {
          tags: { 
            module: 'auth', 
            action: 'resend',
            error_type: 'unexpected_error'
          }
        })
        
        return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 })
      }
    }
  )
}





"use client"

import type React from "react"
import Link from "next/link"
import { useState } from "react"
import { AuthButton } from "@/components/auth-button"
import { AuthInput } from "@/components/auth-input"
import { useRouter } from "next/navigation"
import { createClient } from "@/utils/supabase/client"
import * as Sentry from "@sentry/nextjs"

export default function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [email, setEmail] = useState("")
  const [success, setSuccess] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    return Sentry.startSpan(
      {
        op: "auth.forgot_password",
        name: "Forgot Password Request",
      },
      async (span) => {
        try {
          span.setAttribute("auth.email", email)
          span.setAttribute("auth.method", "email_reset")

          const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/auth/reset-password`,
          })

          if (error) {
            span.setAttribute("auth.success", false)
            span.setAttribute("auth.error", error.message)
            
            // Отправляем ошибку запроса сброса пароля в Sentry
            Sentry.captureException(error, {
              tags: { 
                module: 'auth', 
                action: 'forgot_password',
                error_type: 'reset_email_failed'
              },
              user: { email },
              extra: { 
                error_code: error.message,
                redirect_url: `${window.location.origin}/auth/reset-password`,
                timestamp: new Date().toISOString()
              }
            })

            setError(error.message)
            setLoading(false)
            return
          }

          span.setAttribute("auth.success", true)
          
          // Логируем успешный запрос сброса пароля
          Sentry.addBreadcrumb({
            message: 'Password reset email sent',
            category: 'auth',
            level: 'info',
            data: { email }
          })

          setSuccess(true)
          router.push("/auth/password-reset-sent")
        } catch (err) {
          span.setAttribute("auth.success", false)
          span.recordException(err as Error)
          
          // Отправляем неожиданную ошибку в Sentry
          Sentry.captureException(err, {
            tags: { 
              module: 'auth', 
              action: 'forgot_password',
              error_type: 'unexpected_error'
            },
            user: { email },
            extra: { 
              component: 'ForgotPasswordPage',
              timestamp: new Date().toISOString()
            }
          })

          console.error("Password reset error:", err)
          setError("Произошла ошибка при отправке ссылки. Пожалуйста, попробуйте снова.")
          setLoading(false)
        }
      }
    )
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-bold tracking-tight dark:text-gray-100">Восстановление пароля</h1>
        <p className="text-sm text-muted-foreground">Введите ваш email для получения ссылки на сброс пароля</p>
      </div>

      {error && (
        <div className="p-3 bg-red-100 border border-red-200 text-red-600 text-sm rounded-md dark:bg-red-900/30 dark:border-red-800 dark:text-red-400">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <AuthInput
          label="Email"
          id="email"
          type="email"
          placeholder="name@example.com"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <AuthButton type="submit" loading={loading}>
          Отправить ссылку
        </AuthButton>
      </form>

      <div className="space-y-2">
        <p className="text-center text-sm text-muted-foreground">
          Вспомнили пароль?{" "}
          <Link href="/auth/login" className="text-primary hover:underline transition-all">
            Вернуться ко входу
          </Link>
        </p>
      </div>
    </div>
  )
}

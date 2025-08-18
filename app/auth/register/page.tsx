"use client"

import type React from "react"
import Link from "next/link"
import { useState } from "react"
import { AuthButton } from "@/components/auth-button"
import { AuthInput } from "@/components/auth-input"
import { useRouter } from "next/navigation"
import { createClient } from "@/utils/supabase/client"
import * as Sentry from "@sentry/nextjs"

export default function RegisterPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const router = useRouter()
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    // Validate passwords match
    if (password !== confirmPassword) {
      setError("Пароли не совпадают")
      setLoading(false)
      return
    }

    return Sentry.startSpan(
      {
        op: "auth.register",
        name: "User Registration",
      },
      async (span) => {
        try {
          span.setAttribute("auth.email", email)
          span.setAttribute("auth.name", name)
          span.setAttribute("auth.method", "email_password")

          const { error } = await supabase.auth.signUp({
            email,
            password,
            options: {
              data: {
                name,
              },
              emailRedirectTo: `${window.location.origin}/auth/callback`,
            },
          })

          if (error) {
            span.setAttribute("auth.success", false)
            span.setAttribute("auth.error", error.message)
            
            // Отправляем ошибку регистрации в Sentry
            Sentry.captureException(error, {
              tags: { 
                module: 'auth', 
                action: 'register',
                error_type: 'registration_failed'
              },
              user: { email, name },
              extra: { 
                error_code: error.message,
                timestamp: new Date().toISOString()
              }
            })

            setError(error.message)
            setLoading(false)
            return
          }

          span.setAttribute("auth.success", true)
          
          // Логируем успешную регистрацию
          Sentry.addBreadcrumb({
            message: 'User registration successful',
            category: 'auth',
            level: 'info',
            data: { email, name }
          })

          // Redirect to pending verification page
          router.push("/auth/pending-verification")
        } catch (err) {
          span.setAttribute("auth.success", false)
          span.recordException(err as Error)
          
          // Отправляем неожиданную ошибку в Sentry
          Sentry.captureException(err, {
            tags: { 
              module: 'auth', 
              action: 'register',
              error_type: 'unexpected_error'
            },
            user: { email, name },
            extra: { 
              component: 'RegisterPage',
              timestamp: new Date().toISOString()
            }
          })

          console.error("Registration error:", err)
          setError("Произошла ошибка при регистрации. Пожалуйста, попробуйте снова.")
          setLoading(false)
        }
      }
    )
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-bold tracking-tight dark:text-gray-100">Регистрация</h1>
        <p className="text-sm text-muted-foreground">Создайте аккаунт для доступа к платформе</p>
      </div>

      {error && (
        <div className="p-3 bg-red-100 border border-red-200 text-red-600 text-sm rounded-md dark:bg-red-900/30 dark:border-red-800 dark:text-red-400">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <AuthInput
          label="Имя"
          id="name"
          type="text"
          placeholder="Иван Иванов"
          required
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

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

        <AuthInput
          label="Пароль"
          id="password"
          type="password"
          required
          autoComplete="new-password"
          showPasswordToggle={true}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <AuthInput
          label="Подтверждение пароля"
          id="confirmPassword"
          type="password"
          required
          autoComplete="new-password"
          showPasswordToggle={true}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />

        <AuthButton type="submit" loading={loading}>
          Зарегистрироваться
        </AuthButton>
      </form>

      <div className="space-y-2">
        <p className="text-center text-sm text-muted-foreground">
          Уже есть аккаунт?{" "}
          <Link href="/auth/login" className="text-primary hover:underline transition-all">
            Войти
          </Link>
        </p>
      </div>
    </div>
  )
}

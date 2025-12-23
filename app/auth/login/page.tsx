"use client"

import type React from "react"
import Link from "next/link"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { AuthButton } from "@/components/auth-button"
import { AuthInput } from "@/components/auth-input"
import { LoginAnimation } from "@/components/login-animation"
import { createClient } from "@/utils/supabase/client"
// УДАЛЕНО: Legacy import syncCurrentUserState - теперь синхронизация автоматическая
import * as Sentry from "@sentry/nextjs"

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [redirectUrl, setRedirectUrl] = useState('/dashboard')
  const router = useRouter()
  const supabase = createClient()

  // Получаем URL для редиректа после логина из параметров
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const next = params.get('next')
    if (next) {
      setRedirectUrl(next)
    }
  }, [])

  // Функция для получения понятного сообщения об ошибке
  const getErrorMessage = (error: any): string => {
    if (!error?.message) return "Произошла неизвестная ошибка"
    
    const message = error.message.toLowerCase()
    
    // Проверка различных типов ошибок
    if (message.includes('invalid login credentials') || message.includes('invalid credentials')) {
      return "Неверный email или пароль. Проверьте правильность ввода данных."
    }
    
    if (message.includes('email not confirmed')) {
      return "Email не подтвержден. Проверьте почту и перейдите по ссылке подтверждения."
    }
    
    if (message.includes('user not found')) {
      return "Пользователь с таким email не найден. Проверьте правильность email или зарегистрируйтесь."
    }
    
    if (message.includes('invalid email')) {
      return "Указан некорректный email адрес. Проверьте правильность ввода."
    }
    
    if (message.includes('too many requests') || message.includes('rate limit')) {
      return "Слишком много попыток входа. Подождите несколько минут и попробуйте снова."
    }
    
    if (message.includes('account is disabled') || message.includes('user disabled')) {
      return "Ваш аккаунт заблокирован. Обратитесь к администратору."
    }
    
    if (message.includes('signup is disabled')) {
      return "Система временно недоступна. Попробуйте позже или обратитесь к администратору."
    }
    
    // Возвращаем оригинальное сообщение, если не нашли подходящего перевода
    return error.message
  }

  const validateForm = (): string | null => {
    // Проверка email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!email) {
      return "Введите email адрес"
    }
    
    if (!emailRegex.test(email)) {
      return "Введите корректный email адрес"
    }
    
    // Проверка пароля
    if (!password) {
      return "Введите пароль"
    }
    
    if (password.length < 6) {
      return "Пароль должен содержать минимум 6 символов"
    }
    
    return null
  }

  const checkEmailExists = async (email: string): Promise<boolean> => {
    try {
      const response = await fetch('/api/auth/check-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: email.trim() }),
      })

      if (!response.ok) {
        console.error('Ошибка при проверке email:', response.statusText)
        return true // В случае ошибки API, продолжаем с попыткой входа
      }

      const data = await response.json()
      return data.exists
    } catch (error) {
      console.error('Ошибка при проверке email:', error)
      return true // В случае ошибки, продолжаем с попыткой входа
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    // Валидация формы
    const validationError = validateForm()
    if (validationError) {
      setError(validationError)
      setLoading(false)
      return
    }

    return Sentry.startSpan(
      {
        op: "auth.login",
        name: "User Login",
      },
      async (span: any) => {
        try {
          const trimmedEmail = email.trim()
          span.setAttribute("auth.email", trimmedEmail)
          span.setAttribute("auth.method", "password")
          // Сначала проверяем существование email
          const emailExists = await checkEmailExists(trimmedEmail)
          span.setAttribute("auth.email_exists_checked", true)
          if (!emailExists) {
            setError("Пользователь с таким email не найден. Пожалуйста, зарегистрируйтесь или проверьте правильность email адреса.")
            setLoading(false)
            return
          }

          const { error: signInError } = await supabase.auth.signInWithPassword({
            email: trimmedEmail,
            password,
          })

          if (signInError) {
            span.setAttribute("auth.error", signInError.message)
            span.setAttribute("auth.success", false)
            
            // Отправляем ошибку авторизации в Sentry
            Sentry.captureException(signInError, {
              tags: { 
                module: 'auth', 
                action: 'login',
                error_type: 'auth_failed'
              },
              user: { email: trimmedEmail },
              extra: { 
                error_code: signInError.message,
                timestamp: new Date().toISOString()
              }
            })

            setError(getErrorMessage(signInError))
            setLoading(false)
            return
          }

          span.setAttribute("auth.success", true)

          router.refresh()
          router.push(redirectUrl)

        } catch (err) {
          span.setAttribute("auth.success", false)
          span.recordException(err as Error)
          
          // Отправляем неожиданную ошибку в Sentry
          Sentry.captureException(err, {
            tags: { 
              module: 'auth', 
              action: 'login',
              error_type: 'unexpected_error'
            },
            user: { email },
            extra: { 
              component: 'LoginPage',
              timestamp: new Date().toISOString()
            }
          })

          console.error("Login error:", err)
          setError("Произошла непредвиденная ошибка при входе. Пожалуйста, попробуйте снова.")
          setLoading(false)
        }
      }
    )
  }

  return (
    <>
      <div className="space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold tracking-tight dark:text-gray-100">Вход в систему</h1>
          <p className="text-sm text-muted-foreground">Введите ваши данные для входа</p>
        </div>

        {error && (
          <div className="p-3 bg-red-100 border border-red-200 text-red-600 text-sm rounded-md dark:bg-red-900/30 dark:border-red-800 dark:text-red-400">
            {error}
            {error.includes("не найден")}
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
            validateOnChange={true}
            validationRules={{
              required: true,
              email: true
            }}
          />

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <AuthInput
                label="Пароль"
                id="password"
                type="password"
                required
                autoComplete="current-password"
                showPasswordToggle={true}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                validateOnChange={true}
                validationRules={{
                  required: true,
                  minLength: 6
                }}
              />
            </div>
            <div className="flex justify-end">
              <Link href="/auth/forgot-password" className="text-xs text-primary hover:underline transition-all">
                Забыли пароль?
              </Link>
            </div>
          </div>

          <AuthButton type="submit" loading={loading} disabled={loading}>
            Войти
          </AuthButton>
        </form>

        {/* Регистрация отключена */}
        {/* <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t dark:border-gray-700" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white dark:bg-gray-800 px-2 text-muted-foreground">Или</span>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-center text-sm text-muted-foreground">
            Нет аккаунта?{" "}
            <Link href="/auth/register" className="text-primary hover:underline transition-all">
              Регистрация
            </Link>
          </p>
        </div> */}
      </div>

      {loading && <LoginAnimation isLoading={loading} onComplete={() => {}} />}
    </>
  )
}

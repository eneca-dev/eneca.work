"use client"

import type React from "react"
import Link from "next/link"
import { useState, useEffect, useMemo, Suspense } from "react"
import { AuthButton } from "@/components/auth-button"
import { AuthInput } from "@/components/auth-input"
import { PasswordRequirementCheckbox } from "@/components/password-requirement-checkbox"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/utils/supabase/client"
import * as Sentry from "@sentry/nextjs"

function ResetPasswordForm() {
  const [loading, setLoading] = useState(false)
  const [sessionLoading, setSessionLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isValidSession, setIsValidSession] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  // Вычисляем состояние требований к паролю
  const passwordRequirements = useMemo(() => {
    if (!password) return null
    
    return {
      minLength: password.length >= 8,
      hasDigit: /\d/.test(password),
      hasSpecial: /[^a-zA-Z0-9]/.test(password),
      hasLowercase: /[a-z]/.test(password),
      hasUppercase: /[A-Z]/.test(password),
    }
  }, [password])

  // Проверяем, выполнены ли все требования
  const allRequirementsMet = useMemo(() => {
    if (!passwordRequirements) return false
    return Object.values(passwordRequirements).every(Boolean)
  }, [passwordRequirements])

  // Показываем окошко требований только если пароль введен и не все требования выполнены
  const showRequirements = password && !allRequirementsMet

  useEffect(() => {
    const handlePasswordReset = async () => {
      try {
        // Check if we have the required parameters
        const token = searchParams.get('token')
        const type = searchParams.get('type')
        
        if (!token || type !== 'recovery') {
          setError("Недействительная ссылка для сброса пароля")
          setSessionLoading(false)
          return
        }

        // Verify the recovery token and establish session
        const { data, error } = await supabase.auth.verifyOtp({
          token_hash: token,
          type: 'recovery'
        })

        if (error) {
          console.error('Token verification error:', error)
          setError("Ссылка недействительна или истекла. Запросите новую ссылку для сброса пароля.")
        } else if (data.user) {
          setIsValidSession(true)
        }
      } catch (err) {
        // Отправляем ошибку проверки токена в Sentry
        Sentry.captureException(err, {
          tags: { 
            module: 'auth', 
            action: 'reset_password_verification',
            error_type: 'token_verification_failed'
          },
          extra: { 
            token_present: !!searchParams.get('token'),
            type: searchParams.get('type'),
            timestamp: new Date().toISOString()
          }
        })

        console.error('Password reset session error:', err)
        setError("Произошла ошибка при проверке ссылки")
      } finally {
        setSessionLoading(false)
      }
    }

    handlePasswordReset()
  // Run once per query-param change
  }, [searchParams])

  // Функция для получения понятного сообщения об ошибке
  const getErrorMessage = (error: any): string => {
    if (!error?.message) return "Произошла неизвестная ошибка"

    const message = error.message.toLowerCase()

    // Ошибки пароля
    if (message.includes('weak password') || message.includes('password should be at least')) {
      return "Пароль должен содержать минимум 8 символов, включая цифры, специальные символы, строчные и заглавные буквы."
    }

    if (message.includes('same password')) {
      return "Новый пароль должен отличаться от текущего."
    }

    // Ошибки сессии/токена — общее сообщение
    if (
      message.includes('session not found') ||
      message.includes('invalid session') ||
      message.includes('user not found') ||
      message.includes('token expired') ||
      message.includes('invalid token')
    ) {
      return "Ссылка истекла или недействительна. Запросите новую ссылку для сброса пароля."
    }

    // Общее сообщение для остальных ошибок
    return "Не удалось сбросить пароль. Попробуйте запросить новую ссылку."
  }

  const validatePassword = (password: string): string[] => {
    const errors = []
    
    if (password.length < 8) {
      errors.push("Минимум 8 символов")
    }
    
    if (!/\d/.test(password)) {
      errors.push("Минимум одна цифра")
    }
    
    if (!/[^a-zA-Z0-9]/.test(password)) {
      errors.push("Минимум один специальный символ (_/\!@#$%^&*(),.?:{}|'\"<>)")
    }
    
    if (!/[a-z]/.test(password)) {
      errors.push("Минимум одна строчная буква")
    }
    
    if (!/[A-Z]/.test(password)) {
      errors.push("Минимум одна заглавная буква")
    }
    
    return errors
  }

  const validateForm = (): string | null => {
    // Проверка пароля
    if (!password) {
      return "Введите новый пароль"
    }
    
    const passwordErrors = validatePassword(password)
    if (passwordErrors.length > 0) {
      return `Пароль не соответствует требованиям: ${passwordErrors.join(", ")}`
    }
    
    // Проверка подтверждения пароля
    if (!confirmPassword) {
      return "Подтвердите новый пароль"
    }
    
    if (password !== confirmPassword) {
      return "Пароли не совпадают"
    }
    
    return null
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
        op: "auth.reset_password",
        name: "Password Reset Submit",
      },
      async (span: any) => {
        try {
          span.setAttribute("auth.method", "password_reset")
          span.setAttribute("auth.password_length", password.length)

          const { error } = await supabase.auth.updateUser({
            password,
          })

          if (error) {
            span.setAttribute("auth.success", false)
            span.setAttribute("auth.error", error.message)
            
            // Отправляем ошибку сброса пароля в Sentry
            Sentry.captureException(error, {
              tags: { 
                module: 'auth', 
                action: 'reset_password',
                error_type: 'password_update_failed'
              },
              extra: { 
                error_code: error.message,
                password_length: password.length,
                timestamp: new Date().toISOString()
              }
            })

            setError(getErrorMessage(error))
            setLoading(false)
            return
          }

          span.setAttribute("auth.success", true)
          
          // Логируем успешный сброс пароля
          Sentry.addBreadcrumb({
            message: 'Password reset successful',
            category: 'auth',
            level: 'info'
          })

          // Success - redirect to login page
          router.push("/auth/login?message=Пароль успешно изменен")
        } catch (err) {
          span.setAttribute("auth.success", false)
          span.recordException(err as Error)
          
          // Отправляем неожиданную ошибку в Sentry
          Sentry.captureException(err, {
            tags: { 
              module: 'auth', 
              action: 'reset_password',
              error_type: 'unexpected_error'
            },
            extra: { 
              component: 'ResetPasswordForm',
              timestamp: new Date().toISOString()
            }
          })

          console.error("Password reset error:", err)
          setError("Произошла непредвиденная ошибка при сбросе пароля. Проверьте подключение к интернету и попробуйте снова.")
          setLoading(false)
        }
      }
    )
  }

  if (sessionLoading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold tracking-tight dark:text-gray-100">Проверка ссылки...</h1>
          <p className="text-sm text-muted-foreground">Пожалуйста, подождите</p>
        </div>
        <div className="flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    )
  }

  if (!isValidSession) {
    return (
      <div className="space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold tracking-tight dark:text-gray-100">Ошибка сброса пароля</h1>
          {error && (
            <div className="p-3 bg-red-100 border border-red-200 text-red-600 text-sm rounded-md dark:bg-red-900/30 dark:border-red-800 dark:text-red-400">
              {error}
            </div>
          )}
        </div>
        
        <div className="space-y-2">
          <Link href="/auth/forgot-password" className="block">
            <AuthButton variant="outline">Запросить новую ссылку</AuthButton>
          </Link>
          <Link href="/auth/login" className="block">
            <AuthButton variant="secondary">Вернуться ко входу</AuthButton>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-bold tracking-tight dark:text-gray-100">Создание нового пароля</h1>
        <p className="text-sm text-muted-foreground">Введите новый пароль для вашего аккаунта</p>
      </div>

      {error && (
        <div className="p-3 bg-red-100 border border-red-200 text-red-600 text-sm rounded-md dark:bg-red-900/30 dark:border-red-800 dark:text-red-400">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <AuthInput
          label="Новый пароль"
          id="password"
          type="password"
          required
          autoComplete="new-password"
          showPasswordToggle={true}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          validateOnChange={true}
          validationRules={{
            required: true,
            custom: (value: string) => {
              // Убираем красный текст ошибки валидации для поля пароля
              // Вместо этого покажем требования в отдельном блоке
              return null
            }
          }}
        />

        {/* Индикатор требований к паролю с анимацией */}
        <div className={`
          transition-all duration-300 ease-in-out overflow-hidden
          ${showRequirements 
            ? 'max-h-48 opacity-100 transform translate-y-0' 
            : 'max-h-0 opacity-0 transform -translate-y-2'
          }
        `}>
          <div className="space-y-2 p-3 bg-gray-50 border border-gray-200 rounded-md dark:bg-gray-800/30 dark:border-gray-700">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Требования к паролю:</p>
            <div className="space-y-2">
              {passwordRequirements && (
                <>
                  <PasswordRequirementCheckbox isValid={passwordRequirements.minLength}>
                    Минимум 8 символов
                  </PasswordRequirementCheckbox>
                  <PasswordRequirementCheckbox isValid={passwordRequirements.hasDigit}>
                    Минимум одна цифра
                  </PasswordRequirementCheckbox>
                  <PasswordRequirementCheckbox isValid={passwordRequirements.hasSpecial}>
                    Минимум один специальный символ (_/\!@#$%^&*(),.?:{}|'")                  </PasswordRequirementCheckbox>
                  <PasswordRequirementCheckbox isValid={passwordRequirements.hasLowercase}>
                    Минимум одна строчная буква
                  </PasswordRequirementCheckbox>
                  <PasswordRequirementCheckbox isValid={passwordRequirements.hasUppercase}>
                    Минимум одна заглавная буква
                  </PasswordRequirementCheckbox>
                </>
              )}
            </div>
          </div>
        </div>

        <AuthInput
          label="Подтверждение пароля"
          id="confirmPassword"
          type="password"
          required
          autoComplete="new-password"
          showPasswordToggle={true}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          validateOnChange={true}
          validationRules={{
            required: true,
            custom: (value: string) => {
              if (password && value !== password) {
                return "Пароли не совпадают"
              }
              return null
            }
          }}
        />

        <AuthButton type="submit" loading={loading}>
          Сохранить новый пароль
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

function LoadingFallback() {
  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-bold tracking-tight dark:text-gray-100">Загрузка...</h1>
        <p className="text-sm text-muted-foreground">Пожалуйста, подождите</p>
      </div>
      <div className="flex justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <ResetPasswordForm />
    </Suspense>
  )
}

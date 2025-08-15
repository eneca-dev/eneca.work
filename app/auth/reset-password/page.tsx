"use client"

import type React from "react"
import Link from "next/link"
import { useState, useEffect, Suspense } from "react"
import { AuthButton } from "@/components/auth-button"
import { AuthInput } from "@/components/auth-input"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/utils/supabase/client"

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
    
    // Проверка различных типов ошибок
    if (message.includes('weak password')) {
      return "Пароль слишком простой. Используйте комбинацию букв, цифр и специальных символов."
    }
    
    if (message.includes('password should be at least')) {
      return "Пароль должен содержать минимум 6 символов."
    }
    
    if (message.includes('same password')) {
      return "Новый пароль должен отличаться от текущего."
    }
    
    if (message.includes('session not found') || message.includes('invalid session')) {
      return "Сессия истекла. Запросите новую ссылку для сброса пароля."
    }
    
    if (message.includes('user not found')) {
      return "Пользователь не найден. Запросите новую ссылку для сброса пароля."
    }
    
    if (message.includes('token expired') || message.includes('invalid token')) {
      return "Ссылка истекла или недействительна. Запросите новую ссылку для сброса пароля."
    }
    
    // Возвращаем оригинальное сообщение, если не нашли подходящего перевода
    return error.message
  }

  const validateForm = (): string | null => {
    // Проверка пароля
    if (!password) {
      return "Введите новый пароль"
    }
    
    if (password.length < 6) {
      return "Пароль должен содержать минимум 6 символов"
    }
    
    // Проверка подтверждения пароля
    if (!confirmPassword) {
      return "Подтвердите новый пароль"
    }
    
    if (password !== confirmPassword) {
      return "Пароли не совпадают"
    }
    
    // Проверка сложности пароля
    if (!/(?=.*[a-zA-Z])(?=.*\d)/.test(password) && password.length < 8) {
      return "Рекомендуется использовать пароль длиной от 8 символов с буквами и цифрами"
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

    try {
      const { error } = await supabase.auth.updateUser({
        password,
      })

      if (error) {
        setError(getErrorMessage(error))
        setLoading(false)
        return
      }

      // Success - redirect to login page
      router.push("/auth/login?message=Пароль успешно изменен")
    } catch (err) {
      console.error("Password reset error:", err)
      setError("Произошла непредвиденная ошибка при сбросе пароля. Проверьте подключение к интернету и попробуйте снова.")
      setLoading(false)
    }
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
          // validationRules={{
          //   required: true,
          //   minLength: 6,
          //   custom: (value: string) => {
          //     if (value.length >= 8 && !/(?=.*[a-zA-Z])(?=.*\d)/.test(value)) {
          //       return "Рекомендуется использовать буквы и цифры для большей безопасности"
          //     }
          //     return null
          //   }
          // }}
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

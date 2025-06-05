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
  }, [searchParams, supabase.auth])

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

    if (password.length < 6) {
      setError("Пароль должен содержать минимум 6 символов")
      setLoading(false)
      return
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password,
      })

      if (error) {
        setError(error.message)
        setLoading(false)
        return
      }

      // Success - redirect to login page
      router.push("/auth/login?message=Пароль успешно изменен")
    } catch (err) {
      console.error("Password reset error:", err)
      setError("Произошла ошибка при сбросе пароля. Пожалуйста, попробуйте снова.")
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

"use client"

import type React from "react"
import Link from "next/link"
import { useState } from "react"
import { AuthButton } from "@/components/auth-button"
import { AuthInput } from "@/components/auth-input"
import { useRouter } from "next/navigation"
import { createClient } from "@/utils/supabase/client"

export default function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [email, setEmail] = useState("")
  const [success, setSuccess] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  // Функция для получения понятного сообщения об ошибке
  const getErrorMessage = (error: any): string => {
    if (!error?.message) return "Произошла неизвестная ошибка"
    
    const message = error.message.toLowerCase()
    
    // Проверка различных типов ошибок
    if (message.includes('user not found')) {
      return "Пользователь с таким email не найден. Проверьте правильность email адреса или зарегистрируйтесь."
    }
    
    if (message.includes('invalid email')) {
      return "Указан некорректный email адрес. Проверьте правильность ввода."
    }
    
    if (message.includes('email rate limit') || message.includes('too many requests')) {
      return "Превышен лимит отправки писем. Подождите несколько минут и попробуйте снова."
    }
    
    if (message.includes('smtp') || (message.includes('email') && message.includes('send'))) {
      return "Ошибка отправки письма. Проверьте правильность email адреса и попробуйте позже."
    }
    
    if (message.includes('password reset is disabled')) {
      return "Восстановление пароля временно отключено. Обратитесь к администратору."
    }
    
    if (message.includes('signup is disabled')) {
      return "Система временно недоступна. Попробуйте позже или обратитесь к администратору."
    }
    
    // Возвращаем оригинальное сообщение, если не нашли подходящего перевода
    return error.message
  }

  const validateForm = (): string | null => {
    // Проверка email
    if (!email) {
      return "Введите email адрес"
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return "Введите корректный email адрес"
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
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      })

      if (error) {
        setError(getErrorMessage(error))
        setLoading(false)
        return
      }

      setSuccess(true)
      router.push("/auth/password-reset-sent")
    } catch (err) {
      console.error("Password reset error:", err)
      setError("Произошла непредвиденная ошибка при отправке ссылки. Проверьте подключение к интернету и попробуйте снова.")
      setLoading(false)
    }
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
          validateOnChange={true}
          validationRules={{
            required: true,
            email: true
          }}
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

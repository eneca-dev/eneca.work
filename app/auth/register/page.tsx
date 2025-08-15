"use client"

import type React from "react"
import Link from "next/link"
import { useState } from "react"
import { AuthButton } from "@/components/auth-button"
import { AuthInput } from "@/components/auth-input"
import { useRouter } from "next/navigation"
// import { createClient } from "@/utils/supabase/client"
import { useToast } from "@/hooks/use-toast"

export default function RegisterPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const router = useRouter()
  // const supabase = createClient()
  const { toast } = useToast()

  // Функция для получения понятного сообщения об ошибке
  const getErrorMessage = (error: any): string => {
    if (!error?.message) return "Произошла неизвестная ошибка"
    
    const message = error.message.toLowerCase()
    
    // Проверка различных типов ошибок
    if (message.includes('user already registered')) {
      return "Пользователь с таким email уже зарегистрирован. Попробуйте войти в систему или восстановить пароль."
    }
    
    if (message.includes('invalid email')) {
      return "Указан некорректный email адрес. Проверьте правильность ввода."
    }
    
    if (message.includes('password should be at least')) {
      return "Пароль должен содержать минимум 6 символов."
    }
    
    if (message.includes('weak password')) {
      return "Пароль слишком простой. Используйте комбинацию букв, цифр и специальных символов."
    }
    
    if (message.includes('signup is disabled')) {
      return "Регистрация временно отключена. Обратитесь к администратору."
    }
    
    if (message.includes('email rate limit')) {
      return "Превышен лимит отправки писем. Попробуйте позже."
    }
    
    if (message.includes('smtp') || message.includes('email') && message.includes('send')) {
      return "Ошибка отправки письма подтверждения. Проверьте правильность email адреса и попробуйте снова."
    }
    
    // Возвращаем оригинальное сообщение, если не нашли подходящего перевода
    return error.message
  }

  const validateForm = (): string | null => {
    // Проверка имени
    if (!name.trim()) {
      return "Введите ваше имя"
    }
    
    if (name.trim().length < 2) {
      return "Имя должно содержать минимум 2 символа"
    }
    
    // Проверка email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return "Введите корректный email адрес"
    }
    
    // Проверка пароля
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
        return false // В случае ошибки API, продолжаем с регистрацией
      }

      const data = await response.json()
      return data.exists
    } catch (error) {
      console.error('Ошибка при проверке email:', error)
      return false // В случае ошибки, продолжаем с регистрацией
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    // Базовая валидация формы (без проверки совпадения паролей)
    const validationError = validateForm()
    if (validationError) {
      setError(validationError)
      setLoading(false)
      return
    }

    try {
      const creatingToast = toast({
        title: "Создание аккаунта",
        description: "Создаём ваш аккаунт...",
      })

      // Сначала проверяем существование email
      const emailExists = await checkEmailExists(email)
      if (emailExists) {
        setError("Пользователь с таким email уже зарегистрирован.")
        creatingToast.update({
          id: creatingToast.id,
          title: "Регистрация отклонена",
          description: "Такой email уже используется",
          variant: "destructive",
        } as any)
        setLoading(false)
        return
      }

      // Теперь проверяем совпадение паролей
      if (password !== confirmPassword) {
        setError("Пароли не совпадают")
        setLoading(false)
        return
      }

      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          password,
        }),
      })

      const result = await response.json().catch(() => null)

      if (!response.ok) {
        setError(result?.error || 'Не удалось создать аккаунт. Попробуйте снова.')
        creatingToast.update({
          id: creatingToast.id,
          title: 'Ошибка регистрации',
          description: result?.error || 'Не удалось создать аккаунт',
          variant: 'destructive',
        } as any)
        setLoading(false)
        return
      }

      // Успешное создание пользователя. Если письмо ушло — ведем на страницу ожидания подтверждения
      // Сохраняем email, чтобы на странице ожидания можно было повторно отправить письмо
      try {
        sessionStorage.setItem('pendingEmail', email.trim())
      } catch {}

      // Отображаем пользовательские сообщения
      if (result?.emailSent) {
        creatingToast.update({
          id: creatingToast.id,
          title: 'Подтвердите email',
          description: `Ссылка отправлена на ${email.trim()}`,
        } as any)
      } else if (result?.message) {
        creatingToast.update({
          id: creatingToast.id,
          title: 'Аккаунт создан',
          description: result.message,
        } as any)
      }

      if (result?.emailSent) {
        router.push('/auth/pending-verification')
        return
      }

      // Пользователь создан, но письмо не отправлено — показываем сообщение
      setError(result?.message || 'Аккаунт создан, но не удалось отправить письмо подтверждения. Обратитесь к администратору.')
      setLoading(false)
    } catch (err) {
      console.error("Registration error:", err)
      setError("Произошла непредвиденная ошибка при регистрации. Проверьте подключение к интернету и попробуйте снова.")
      setLoading(false)
    }
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
          {error.includes("уже зарегистрирован")}
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
          validateOnChange={true}
          validationRules={{
            required: true,
            minLength: 2,
            maxLength: 50
          }}
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
          validateOnChange={true}
          validationRules={{
            required: true,
            email: true
          }}
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

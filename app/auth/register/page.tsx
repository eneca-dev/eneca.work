"use client"

import type React from "react"
import Link from "next/link"
import { useState, useMemo } from "react"
import { AuthButton } from "@/components/auth-button"
import { AuthInput } from "@/components/auth-input"
import { PasswordRequirementCheckbox } from "@/components/password-requirement-checkbox"
import { useRouter } from "next/navigation"
// import { createClient } from "@/utils/supabase/client"
import * as Sentry from "@sentry/nextjs"

export default function RegisterPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const router = useRouter()
  // const supabase = createClient()

  // Вычисляем состояние требований к паролю
  const passwordRequirements = useMemo(() => {
    if (!password) return null
    
    return {
      minLength: password.length >= 8,
      hasDigit: /\d/.test(password),
      hasSpecial: /[^a-zA-Z0-9 ]/.test(password),
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
      return "Пароль должен содержать минимум 8 символов, включая цифры, специальные символы, строчные и заглавные буквы."
    }
    
    if (message.includes('weak password')) {
      return "Пароль слишком простой. Убедитесь, что он содержит минимум 8 символов, включая цифры, специальные символы, строчные и заглавные буквы."
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

  const validatePassword = (password: string): string[] => {
    const errors = []
    
    if (password.length < 8) {
      errors.push("Минимум 8 символов")
    }
    
    if (!/\d/.test(password)) {
      errors.push("Минимум одна цифра")
    }
    
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push("Минимум один специальный символ (_/\!@#$%^&*(),.?:{}|'\"<> ")
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
    // Проверка имени
    if (!firstName.trim()) {
      return "Введите ваше имя"
    }
    
    if (firstName.trim().length < 2) {
      return "Имя должно содержать минимум 2 символа"
    }
    
    // Проверка фамилии
    if (!lastName.trim()) {
      return "Введите вашу фамилию"
    }
    
    if (lastName.trim().length < 2) {
      return "Фамилия должна содержать минимум 2 символа"
    }
    
    // Проверка email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return "Введите корректный email адрес"
    }
    
    // Проверка пароля
    const passwordErrors = validatePassword(password)
    if (passwordErrors.length > 0) {
      return `Пароль не соответствует требованиям: ${passwordErrors.join(", ")}`
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

    return Sentry.startSpan(
      {
        op: "auth.register",
        name: "User Registration",
      },
      async (span) => {
        try {
          const trimmedEmail = email.trim()
          const trimmedFirstName = firstName.trim()
          const trimmedLastName = lastName.trim()
          span.setAttribute("auth.email", trimmedEmail)
          span.setAttribute("auth.first_name", trimmedFirstName)
          span.setAttribute("auth.last_name", trimmedLastName)
          span.setAttribute("auth.method", "email_password")

          // Сначала проверяем существование email
          const emailExists = await checkEmailExists(trimmedEmail)
          span.setAttribute("auth.email_exists_checked", true)
          if (emailExists) {
            setError("Пользователь с таким email уже зарегистрирован.")
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
              firstName: trimmedFirstName,
              lastName: trimmedLastName,
              email: trimmedEmail,
              password,
            }),
          })

          const result = await response.json().catch(() => null)

          if (!response.ok) {
            span.setAttribute("auth.success", false)
            const apiError = new Error(result?.error || 'Не удалось создать аккаунт. Попробуйте снова.')
            Sentry.captureException(apiError, {
              tags: { 
                module: 'auth', 
                action: 'register',
                error_type: 'registration_failed'
              },
              user: { email: trimmedEmail, first_name: trimmedFirstName, last_name: trimmedLastName },
              extra: { 
                status: response.status,
                timestamp: new Date().toISOString()
              }
            })
            setError(result?.error || 'Не удалось создать аккаунт. Попробуйте снова.')
            setLoading(false)
            return
          }

          // Успешное создание пользователя. Если письмо ушло — ведем на страницу ожидания подтверждения
          // Сохраняем email, чтобы на странице ожидания можно было повторно отправить письмо
          try {
            sessionStorage.setItem('pendingEmail', trimmedEmail)
          } catch {}

          span.setAttribute("auth.success", true)
          Sentry.addBreadcrumb({
            message: 'User registration successful',
            category: 'auth',
            level: 'info',
            data: { email: trimmedEmail, first_name: trimmedFirstName, last_name: trimmedLastName }
          })

          if (result?.emailSent) {
            router.push('/auth/pending-verification')
            return
          }

          // Пользователь создан, но письмо не отправлено — показываем сообщение
          setError(result?.message || 'Аккаунт создан, но не удалось отправить письмо подтверждения. Обратитесь к администратору.')
          setLoading(false)
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
            user: { email, first_name: firstName, last_name: lastName },
            extra: { 
              component: 'RegisterPage',
              timestamp: new Date().toISOString()
            }
          })

          console.error("Registration error:", err)
          setError("Произошла непредвиденная ошибка при регистрации. Проверьте подключение к интернету и попробуйте снова.")
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
          {error.includes("уже зарегистрирован")}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <AuthInput
          label="Имя"
          id="firstName"
          type="text"
          placeholder="Иван"
          required
          autoComplete="given-name"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          validateOnChange={true}
          validationRules={{
            required: true,
            minLength: 2,
            maxLength: 50
          }}
        />

        <AuthInput
          label="Фамилия"
          id="lastName"
          type="text"
          placeholder="Иванов"
          required
          autoComplete="family-name"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
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
                    Минимум один специальный символ (_/\!@#$%^&*(),.?:{}|'\")
                  </PasswordRequirementCheckbox>
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

"use client"

import type React from "react"
import Link from "next/link"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { AuthButton } from "@/components/auth-button"
import { AuthInput } from "@/components/auth-input"
import { LoginAnimation } from "@/components/login-animation"
import { createClient } from "@/utils/supabase/client"
import { syncCurrentUserState } from "@/modules/users/lib/data-service"

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const router = useRouter()
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) {
        setError(signInError.message)
        setLoading(false)
        return
      }

      console.log("Успешный вход, запускаем синхронизацию состояния...");
      const syncSuccess = await syncCurrentUserState();

      if (!syncSuccess) {
        setError("Не удалось синхронизировать данные пользователя после входа.");
        setLoading(false);
        return;
      }

      console.log("Синхронизация состояния после входа прошла успешно.");

      router.refresh()
      router.push("/dashboard")

    } catch (err) {
      console.error("Login error:", err)
      setError("Произошла непредвиденная ошибка при входе. Пожалуйста, попробуйте снова.")
      setLoading(false)
    }
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

        <div className="relative">
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
        </div>
      </div>

      {loading && <LoginAnimation isLoading={loading} onComplete={() => {}} />}
    </>
  )
}

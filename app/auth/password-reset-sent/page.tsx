"use client"

import Link from "next/link"
import { AuthButton } from "@/components/auth-button"
import { CheckCircle, Mail } from "lucide-react"
import { useEffect, useState } from "react"

export default function PasswordResetSentPage() {
  const [email, setEmail] = useState<string | null>(null)

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem('resetEmail')
      if (stored) setEmail(stored)
    } catch {}
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center justify-center space-y-3">
        <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
          <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-center dark:text-gray-100">Проверьте вашу почту</h1>
        <p className="text-sm text-muted-foreground text-center max-w-xs">
          Мы отправили ссылку для сброса пароля на ваш email {email && (
            <span className="text-primary font-medium break-all">{email}</span>
          )}. Пожалуйста, проверьте вашу почту.
        </p>
      </div>

      <div className="p-4 rounded-lg bg-primary/5 dark:bg-primary/10 flex items-center space-x-3">
        <Mail className="h-5 w-5 text-primary" />
        <div className="text-sm">
          <p className="font-medium dark:text-gray-200">Не получили письмо?</p>
          <p className="text-muted-foreground">Проверьте папку "Спам" или запросите новую ссылку через 5 минут.</p>
        </div>
      </div>

      <div className="space-y-6">
        <Link href="/auth/forgot-password" className="block">
          <AuthButton variant="outline">Отправить снова</AuthButton>
        </Link>

        <Link href="/auth/login" className="block">
          <AuthButton variant="secondary">Вернуться ко входу</AuthButton>
        </Link>
      </div>
    </div>
  )
}

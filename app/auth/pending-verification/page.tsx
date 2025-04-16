"use client"

import Link from "next/link"
import { AuthButton } from "@/components/auth-button"
import { Mail, RefreshCw } from "lucide-react"
import { useState } from "react"

export default function PendingVerificationPage() {
  const [resending, setResending] = useState(false)

  const handleResend = () => {
    setResending(true)
    // Simulate loading
    setTimeout(() => setResending(false), 1500)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center justify-center space-y-3">
        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
          <Mail className="h-6 w-6 text-primary" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-center dark:text-gray-100">Подтвердите ваш email</h1>
        <p className="text-sm text-muted-foreground text-center max-w-xs">
          Мы отправили ссылку для подтверждения на ваш email. Пожалуйста, проверьте вашу почту и подтвердите аккаунт.
        </p>
      </div>

      <div className="p-4 rounded-lg bg-primary/5 dark:bg-primary/10 flex items-center space-x-3">
        <RefreshCw className="h-5 w-5 text-primary animate-spin-slow" />
        <div className="text-sm">
          <p className="font-medium dark:text-gray-200">Ожидание подтверждения</p>
          <p className="text-muted-foreground">После подтверждения вы будете автоматически перенаправлены.</p>
        </div>
      </div>

      <div className="space-y-6">
        <AuthButton variant="outline" onClick={handleResend} loading={resending}>
          Отправить снова
        </AuthButton>

        <Link href="/auth/login">
          <AuthButton variant="secondary">Вернуться ко входу</AuthButton>
        </Link>
      </div>
    </div>
  )
}

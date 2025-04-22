"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"
import { checkPaymentAccess } from "@/services/org-data-service"

interface PaymentAccessCheckProps {
  children: React.ReactNode
}

export function PaymentAccessCheck({ children }: PaymentAccessCheckProps) {
  const [hasAccess, setHasAccess] = useState<boolean | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function checkAccess() {
      try {
        const access = await checkPaymentAccess()
        setHasAccess(access)
      } catch (error) {
        console.error("Ошибка при проверке доступа:", error)
        setHasAccess(false)
      } finally {
        setIsLoading(false)
      }
    }

    checkAccess()
  }, [])

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6 flex justify-center items-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
          <span className="ml-3">Проверка доступа...</span>
        </CardContent>
      </Card>
    )
  }

  if (!hasAccess) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Доступ запрещен</AlertTitle>
        <AlertDescription>
          У вас нет прав для просмотра информации об оплате. Обратитесь к администратору для получения доступа.
        </AlertDescription>
      </Alert>
    )
  }

  return <>{children}</>
}

"use client"

import { CheckCircle, Mail, Send, Loader2 } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

interface CompletionMessageProps {
  userEmail: string
  isEmailSent: boolean
  isSendingEmail: boolean
  onConfirmSend: () => void
  onReset: () => void
}

export const CompletionMessage = ({
  userEmail,
  isEmailSent,
  isSendingEmail,
  onConfirmSend,
  onReset,
}: CompletionMessageProps) => {
  // Состояние отправки email
  if (isSendingEmail) {
    return (
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="p-8 text-center">
          <Loader2 className="w-16 h-16 text-blue-500 mx-auto mb-4 animate-spin" />
          <h3 className="text-xl font-semibold text-blue-900 mb-2">Отправка на почту...</h3>
          <p className="text-blue-800 mb-4">
            Пожалуйста, дождитесь завершения отправки исправленного файла на <strong>{userEmail}</strong>
          </p>
        </CardContent>
      </Card>
    )
  }

  // Email успешно отправлен
  if (isEmailSent) {
    return (
      <Card className="border-green-200 bg-green-50">
        <CardContent className="p-8 text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-green-900 mb-2">Файл отправлен!</h3>
          <div className="flex items-center justify-center space-x-2 mb-6">
            <Mail className="w-5 h-5 text-green-600" />
            <p className="text-green-800">
              Ссылка на скачивание исправленного файла отправлена на почту: <strong>{userEmail}</strong>
            </p>
          </div>
          <Button onClick={onReset} size="lg" className="bg-green-600 hover:bg-green-700">
            Завершить / Загрузить новый файл
          </Button>
        </CardContent>
      </Card>
    )
  }

  // Обработка завершена, ожидается подтверждение отправки
  return (
    <Card className="border-blue-200 bg-blue-50">
      <CardContent className="p-8 text-center">
        <CheckCircle className="w-16 h-16 text-blue-500 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-blue-900 mb-2">Обработка завершена!</h3>
        <p className="text-blue-800 mb-6">Все выбранные режимы проверки успешно выполнены. Файл готов к отправке.</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button onClick={onConfirmSend} size="lg" className="bg-blue-600 hover:bg-blue-700">
            <Send className="w-4 h-4 mr-2" />
            Подтвердить отправку
          </Button>
          <Button onClick={onReset} variant="outline" size="lg">
            Завершить / Загрузить новый файл
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

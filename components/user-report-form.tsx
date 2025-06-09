"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/hooks/use-toast"
import { createUserReport } from "@/services/user-reports-service"

export function UserReportForm() {
  const [shortDescription, setShortDescription] = useState("")
  const [detailedDescription, setDetailedDescription] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!shortDescription.trim()) {
      toast({
        title: "Ошибка",
        description: "Краткое описание не может быть пустым.",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)

    try {
      await createUserReport({
        shortDescription: shortDescription.trim(),
        detailedDescription: detailedDescription.trim() || undefined,
      })

      toast({
        title: "Отчет отправлен",
        description: "Ваш отчет успешно отправлен. Спасибо за обратную связь!",
      })

      // Clear form
      setShortDescription("")
      setDetailedDescription("")
    } catch (error) {
      console.error("Error creating report:", error)
      toast({
        title: "Ошибка",
        description: error instanceof Error ? error.message : "Не удалось отправить отчет. Попробуйте позже.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle>Сообщить о проблеме или предложении</CardTitle>
        <CardDescription>Пожалуйста, опишите проблему или ваше предложение по улучшению системы.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="short-description">Краткое описание</Label>
            <Input
              id="short-description"
              placeholder="Например: Не работает кнопка 'Сохранить'"
              value={shortDescription}
              onChange={(e) => setShortDescription(e.target.value)}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="detailed-description">Подробное описание (необязательно)</Label>
            <Textarea
              id="detailed-description"
              placeholder="Опишите шаги для воспроизведения, ожидаемое и фактическое поведение."
              value={detailedDescription}
              onChange={(e) => setDetailedDescription(e.target.value)}
              className="min-h-[120px]"
            />
          </div>
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Отправка..." : "Отправить отчет"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

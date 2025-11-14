"use client"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { submitUserFeedback, scheduleNextSurvey, scheduleNeverSurvey } from "../services/feedbackService"
import * as Sentry from "@sentry/nextjs"

interface Props {
  userId: string | null
  firstName: string
  lastName: string
  hasDbRecord: boolean
  onClose: () => void
  onAnswered: () => void
  onSnooze: () => void
}

export function FeedbackBanner({ userId, firstName, lastName, hasDbRecord, onClose, onAnswered, onSnooze }: Props) {
  const [score, setScore] = useState<number | null>(null)
  const [hadProblems, setHadProblems] = useState<boolean | null>(null)
  const [problemText, setProblemText] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const canSubmit = score !== null && hadProblems !== null

  const handleScheduleAction = async (
    action: () => Promise<void>,
    onSuccess: () => void,
    requiresAuth = true
  ) => {
    if (requiresAuth && !userId) return
    setIsSubmitting(true)
    try {
      await action()
      onSuccess()
    } catch (e) {
      Sentry.captureException(e, {
        tags: { operation: 'feedback_schedule_action' }
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSubmit = async () => {
    if (!canSubmit || isSubmitting) return
    setIsSubmitting(true)

    try {
      await submitUserFeedback({
        userId: userId || null,
        firstName: firstName || "",
        lastName: lastName || "",
        score: score!,
        hadProblems: hadProblems!,
        problemText: problemText || null,
        hasDbRecord, // Передаем для оптимизации запросов
      })
      onAnswered()
    } catch (e) {
      console.error("Failed to submit feedback", e)
      Sentry.captureException(e, {
        tags: { operation: 'feedback_submit_handler' }
      })
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50 flex justify-center p-2">
      <Card className="w-full max-w-xl shadow-lg border bg-background dark:bg-[rgb(31_41_55)]">
        <div className="p-3 sm:p-4 flex flex-col gap-2 leading-tight max-h-[calc(100vh-32px)] overflow-auto dark:text-white">
          <div className="text-base sm:text-lg font-semibold">
            Пожалуйста оцените работу приложения.
          </div>

          <div className="flex items-center gap-3">
            <div className="font-medium whitespace-nowrap">Ваша оценка:</div>
            <div className="flex items-center gap-1 overflow-x-auto">
              {Array.from({ length: 10 }).map((_, i) => {
                const val = i + 1
                return (
                  <Button
                    key={val}
                    size="sm"
                    variant={score === val ? "default" : "outline"}
                    onClick={() => setScore(val)}
                    className="w-8 h-8 p-0"
                    aria-pressed={score === val}
                  >
                    {val}
                  </Button>
                )
              })}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="font-medium whitespace-nowrap">Сталкивались ли вы с проблемами?</div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant={hadProblems === false ? "default" : "outline"}
                onClick={() => setHadProblems(false)}
                aria-pressed={hadProblems === false}
              >
                Нет
              </Button>
              <Button
                size="sm"
                variant={hadProblems === true ? "default" : "outline"}
                onClick={() => setHadProblems(true)}
                aria-pressed={hadProblems === true}
              >
                Да
              </Button>
            </div>
          </div>

          {hadProblems !== null && (
            <div className="flex flex-col gap-2">
              <Textarea
                value={problemText}
                onChange={(e) => setProblemText(e.target.value)}
                placeholder={hadProblems ? "Опишите, что пошло не так" : "Есть пожелания или комментарии?"}
                className="resize-y max-h-[50vh] w-full"
              />
            </div>
          )}

          <div className="flex items-center gap-2 justify-end pt-1">
            <Button
              variant="outline"
              onClick={() => handleScheduleAction(
                () => scheduleNextSurvey(userId!, 7, { firstName, lastName }),
                onSnooze
              )}
              disabled={isSubmitting}
            >
              Позже
            </Button>
            <Button
              variant="outline"
              onClick={() => handleScheduleAction(
                () => scheduleNeverSurvey(userId!, { firstName, lastName }),
                onClose
              )}
              disabled={isSubmitting}
            >
              Не спрашивать
            </Button>
            <Button onClick={handleSubmit} disabled={!canSubmit || isSubmitting}>
              Отправить
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}



import { createClient } from "@/utils/supabase/client"
import * as Sentry from "@sentry/nextjs"

// Сервис работы с таблицей user_feedback: инкремент показов и сохранение ответа

function getNextSurveyAtInMonths(months: number): string {
  const d = new Date()
  d.setMonth(d.getMonth() + months)
  return d.toISOString()
}

type SubmitPayload = {
  userId: string | null
  firstName: string
  lastName: string
  score: number
  hadProblems: boolean
  problemText: string | null
  hasDbRecord?: boolean // Для оптимизации: если true - делаем UPDATE, если false - INSERT, если undefined - SELECT
}

export async function incrementShowCount(
  userId: string | null,
  opts?: { firstName?: string; lastName?: string }
): Promise<void> {
  try {
    const sb = createClient()
    if (!userId) return

    const nowIso = new Date().toISOString()
    const nextSurveyAt = getNextSurveyAtInMonths(2)

    // Сначала пробуем вставить новую запись
    const { error: insertError } = await sb
      .from("user_feedback")
      .insert({
        user_id: userId,
        first_name: opts?.firstName || "",
        last_name: opts?.lastName || "",
        show_count: 1,
        updated_at: nowIso,
        next_survey_at: nextSurveyAt,
      })

    // Если запись уже существует (код ошибки 23505 - unique violation)
    if (insertError?.code === '23505') {
      // Читаем текущее значение и обновляем
      const { data: existing } = await sb
        .from("user_feedback")
        .select("show_count")
        .eq("user_id", userId)
        .single()

      const current = (existing?.show_count as number) ?? 0
      const { error: updateError } = await sb
        .from("user_feedback")
        .update({
          show_count: current + 1,
          updated_at: nowIso,
          ...(opts?.firstName ? { first_name: opts.firstName } : {}),
          ...(opts?.lastName ? { last_name: opts.lastName } : {}),
        })
        .eq("user_id", userId)

      if (updateError) console.warn("incrementShowCount update error", updateError)
    } else if (insertError) {
      console.warn("incrementShowCount insert error", insertError)
    }
  } catch (e) {
    console.warn("incrementShowCount error", e)
  }
}

export async function submitUserFeedback(payload: SubmitPayload): Promise<void> {
  try {
    const sb = createClient()
    const nowIso = new Date().toISOString()
    const nextSurveyAt = getNextSurveyAtInMonths(2)

    const answerItem = {
      created_at: nowIso,
      score: payload.score,
      had_problems: payload.hadProblems,
      problem_text: payload.problemText,
    }

    if (payload.userId) {
      // ОПТИМИЗАЦИЯ: Используем hasDbRecord для избежания лишнего SELECT
      let existing: any = null
      let existingAnswers: any[] = []
      let showCount = 1

      if (payload.hasDbRecord === true) {
        // Запись существует - делаем только SELECT для получения answers и show_count
        const { data, error: selectError } = await sb
          .from("user_feedback")
          .select("answers, show_count")
          .eq("user_id", payload.userId)
          .maybeSingle()

        if (selectError) {
          Sentry.captureException(selectError, {
            tags: { operation: 'feedback_select' },
            extra: { userId: payload.userId }
          })
          throw selectError
        }

        existing = data
        existingAnswers = Array.isArray(data?.answers) ? data.answers : []
        showCount = ((data?.show_count as number) ?? 0) + 1
      } else if (payload.hasDbRecord === false) {
        // Записи точно нет - пропускаем SELECT
        existing = null
        existingAnswers = []
        showCount = 1
      } else {
        // hasDbRecord не передан - делаем SELECT как раньше (fallback)
        const { data, error: selectError } = await sb
          .from("user_feedback")
          .select("answers, show_count")
          .eq("user_id", payload.userId)
          .maybeSingle()

        if (selectError) {
          Sentry.captureException(selectError, {
            tags: { operation: 'feedback_select' },
            extra: { userId: payload.userId }
          })
          throw selectError
        }

        existing = data
        existingAnswers = Array.isArray(data?.answers) ? data.answers : []
        showCount = ((data?.show_count as number) ?? 0) + 1
      }

      // Добавляем новый ответ к существующим
      const updatedAnswers = [...existingAnswers, answerItem]

      let error

      if (existing || payload.hasDbRecord === true) {
        // Запись существует - делаем UPDATE с инкрементом show_count
        const result = await sb
          .from("user_feedback")
          .update({
            first_name: payload.firstName,
            last_name: payload.lastName,
            completed: true,
            score: payload.score,
            had_problems: payload.hadProblems,
            problem_text: payload.problemText,
            answers: updatedAnswers,
            show_count: showCount, // Инкрементируем счетчик показов
            next_survey_at: nextSurveyAt,
            updated_at: nowIso,
          })
          .eq("user_id", payload.userId)

        error = result.error
      } else {
        // Записи нет - делаем INSERT
        const result = await sb
          .from("user_feedback")
          .insert({
            user_id: payload.userId,
            first_name: payload.firstName,
            last_name: payload.lastName,
            completed: true,
            score: payload.score,
            had_problems: payload.hadProblems,
            problem_text: payload.problemText,
            answers: updatedAnswers,
            show_count: 1, // Первый показ
            next_survey_at: nextSurveyAt,
            updated_at: nowIso,
          })

        error = result.error
      }

      if (error) {
        Sentry.captureException(error, {
          tags: {
            operation: existing ? 'feedback_update' : 'feedback_insert',
            user_score: payload.score,
            had_problems: payload.hadProblems
          },
          extra: {
            userId: payload.userId,
            answersCount: updatedAnswers.length
          }
        })
        throw error
      }
      return
    }

    // Анонимная запись — обычный insert
    const { error } = await sb.from("user_feedback").insert({
      user_id: null,
      first_name: payload.firstName,
      last_name: payload.lastName,
      completed: true,
      score: payload.score,
      had_problems: payload.hadProblems,
      problem_text: payload.problemText,
      answers: [answerItem],
      show_count: 1,
      next_survey_at: nextSurveyAt,
      updated_at: nowIso,
    })

    if (error) {
      Sentry.captureException(error, {
        tags: { operation: 'feedback_anonymous_insert' }
      })
      throw error
    }
  } catch (error) {
    // Логируем в Sentry только если это не уже залогированная ошибка
    if (error && !(error as any).__sentry_captured__) {
      Sentry.captureException(error, {
        tags: { operation: 'feedback_submit_unexpected' },
        extra: {
          hasUserId: !!payload.userId,
          score: payload.score
        }
      })
    }
    throw error
  }
}

export async function scheduleNextSurvey(
  userId: string,
  days: number,
  opts?: { firstName?: string; lastName?: string }
): Promise<void> {
  const sb = createClient()
  const nextAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
  const nowIso = new Date().toISOString()

  // Сначала пробуем вставить новую запись
  const { error: insertError } = await sb
    .from("user_feedback")
    .insert({
      user_id: userId,
      first_name: opts?.firstName || "",
      last_name: opts?.lastName || "",
      show_count: 1,
      next_survey_at: nextAt,
      updated_at: nowIso,
    })

  // Если запись уже существует 
  if (insertError?.code === '23505') {
    // Обновляем существующую запись
    const { error: updateError } = await sb
      .from("user_feedback")
      .update({
        next_survey_at: nextAt,
        updated_at: nowIso,
        ...(opts?.firstName ? { first_name: opts.firstName } : {}),
        ...(opts?.lastName ? { last_name: opts.lastName } : {}),
      })
      .eq("user_id", userId)

    if (updateError) throw updateError
  } else if (insertError) {
    throw insertError
  }
}

// Никогда больше не показывать (используем специальное значение PostgreSQL 'infinity')
export async function scheduleNeverSurvey(
  userId: string,
  opts?: { firstName?: string; lastName?: string }
): Promise<void> {
  const sb = createClient()
  const nowIso = new Date().toISOString()

  // Сначала пробуем вставить новую запись
  const { error: insertError } = await sb
    .from("user_feedback")
    .insert({
      user_id: userId,
      first_name: opts?.firstName || "",
      last_name: opts?.lastName || "",
      show_count: 1,
      next_survey_at: "infinity" as unknown as string,
      updated_at: nowIso,
    })

  // Если запись уже существует
  if (insertError?.code === '23505') {
    // Обновляем существующую запись
    const { error: updateError } = await sb
      .from("user_feedback")
      .update({
        next_survey_at: "infinity" as unknown as string,
        updated_at: nowIso,
        ...(opts?.firstName ? { first_name: opts.firstName } : {}),
        ...(opts?.lastName ? { last_name: opts.lastName } : {}),
      })
      .eq("user_id", userId)

    if (updateError) throw updateError
  } else if (insertError) {
    throw insertError
  }
}



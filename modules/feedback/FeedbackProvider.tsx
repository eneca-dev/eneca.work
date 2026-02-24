"use client"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useActiveSurveyClicks } from "./hooks/useActiveSurveyTimer"
import { useUserStore } from "@/stores/useUserStore"
import { FeedbackBanner } from "./components/FeedbackBanner"
import { createClient } from "@/utils/supabase/client"
import { usePathname } from "next/navigation"
import { getFeedbackCache, setFeedbackCache } from "./utils/feedbackCache"

// Порог активности в количестве кликов ТОЛЬКО для первого показа
const THRESHOLD_CLICKS_FIRST = 200

interface UserFeedbackData {
  show_count: number | null
  next_survey_at: string | null
}

export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const userId = useUserStore((s) => s.id)
  const profile = useUserStore((s) => s.profile)
  const isAuthenticated = useUserStore((s) => s.isAuthenticated)
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)
  const hasBeenDismissedRef = useRef(false) // Флаг: был ли опрос закрыт пользователем

  // Состояние из БД
  const [hasDbRecord, setHasDbRecord] = useState<boolean | null>(null) // null = не загружено, true = есть запись, false = нет записи
  const [nextSurveyAt, setNextSurveyAt] = useState<string | null>(null)
  const [canShowBySurveyTime, setCanShowBySurveyTime] = useState(false)

  // ПРОСТАЯ ЛОГИКА:
  // - Если hasDbRecord === null (не загружено) → СЧИТАЕМ клики (пока не знаем что есть запись)
  // - Если hasDbRecord === true (есть запись в БД) → НЕ считаем клики, УДАЛЯЕМ счетчик навсегда
  // - Если hasDbRecord === false (нет записи) → СЧИТАЕМ клики (первый показ)
  const shouldCountClicks = hasDbRecord !== true

  const { clickCount, resetClicks } = useActiveSurveyClicks(userId, { disabled: !shouldCountClicks })

  // Блокируем показ на auth-страницах
  const isBlockedRoute = useMemo(() => {
    const p = pathname || "/"
    return p.startsWith("/auth/") || p === "/auth" || p === "/login" || p === "/register" || p.startsWith("/login/") || p.startsWith("/register/")
  }, [pathname])

  // ПРОСТАЯ логика показа:
  // 1. Если infinity - НЕ показываем НИКОГДА
  // 2. Если hasDbRecord === true - показываем ТОЛЬКО если canShowBySurveyTime === true
  // 3. Если hasDbRecord === false - показываем когда clickCount >= 60
  const canShow = useMemo(() => {
    if (typeof document === "undefined") return false
    if (!isAuthenticated) return false
    if (isBlockedRoute) return false

    // Если пользователь отказался - никогда не показываем
    if (nextSurveyAt && nextSurveyAt.toLowerCase() === 'infinity') return false

    // Если есть запись в БД - показываем ТОЛЬКО по времени (без кликов)
    if (hasDbRecord === true) {
      return canShowBySurveyTime
    }

    // Если нет записи в БД - показываем по кликам (первый показ)
    if (hasDbRecord === false) {
      return clickCount >= THRESHOLD_CLICKS_FIRST
    }

    // Если hasDbRecord === null (не загружено) - не показываем
    return false
  }, [isAuthenticated, isBlockedRoute, nextSurveyAt, hasDbRecord, canShowBySurveyTime, clickCount])

  const close = useCallback(() => {
    setIsOpen(false)
    hasBeenDismissedRef.current = true
  }, [])

  // Пытаемся открыть баннер при достижении порога
  useEffect(() => {
    if (canShow && !isOpen && !hasBeenDismissedRef.current) {
      setIsOpen(true)
    }
  }, [canShow, isOpen])

  // Закрываем баннер, если пользователь вышел или перешел на auth-страницу
  useEffect(() => {
    if (isOpen && (!isAuthenticated || isBlockedRoute)) {
      close()
    }
  }, [isOpen, isAuthenticated, isBlockedRoute, close])

  // После показа сбрасываем счётчик кликов (очищаем localStorage)
  useEffect(() => {
    if (isOpen) {
      try { resetClicks() } catch (err) { console.error('Failed to reset activity:', err) }
    }
  }, [isOpen, resetClicks])

  // Функция для загрузки данных из БД с использованием кеша
  const loadData = useCallback(async () => {
    if (!userId || !isAuthenticated || isBlockedRoute) {
      return
    }

    try {
      // Очистка устаревших ключей (миграция)
      localStorage.removeItem(`survey.lastSurveyAt.v1.${userId}`)
      localStorage.removeItem(`survey.snoozeUntil.v1.${userId}`)
    } catch {}

    // Проверяем кеш СНАЧАЛА
    const cached = getFeedbackCache(userId)
    if (cached) {
      // Используем закешированные данные - НЕТ ЗАПРОСА К БД!
      setHasDbRecord(cached.hasDbRecord)
      setNextSurveyAt(cached.next_survey_at)

      // Удаляем счетчик кликов из localStorage, если есть запись в БД
      if (cached.hasDbRecord) {
        try { resetClicks() } catch {}
      }

      // Проверка времени будет в отдельном useEffect
      return
    }

    // Кеша нет - загружаем из БД
    const sb = createClient()
    const { data, error } = await sb
      .from("user_feedback")
      .select("show_count,next_survey_at")
      .eq("user_id", userId)
      .maybeSingle()

    if (error || !data) {
      // Нет записи в БД - это первый показ, клики должны считаться
      setHasDbRecord(false)
      setNextSurveyAt(null)
      setCanShowBySurveyTime(false)
      // Сохраняем в кеш
      setFeedbackCache(userId, { next_survey_at: null, hasDbRecord: false })
      return
    }

    const feedbackData = data as UserFeedbackData
    const nextAt = feedbackData.next_survey_at

    // ЕСТЬ запись в БД - клики больше НЕ считаются, УДАЛЯЕМ счетчик
    setHasDbRecord(true)
    setNextSurveyAt(nextAt)

    // Сохраняем в кеш
    setFeedbackCache(userId, { next_survey_at: nextAt, hasDbRecord: true })

    // Если infinity - не показываем никогда
    if (nextAt && nextAt.toLowerCase() === 'infinity') {
      setCanShowBySurveyTime(false)
      // Удаляем счетчик кликов из localStorage
      try { resetClicks() } catch {}
      return
    }

    // ВАЖНО: Удаляем счетчик кликов из localStorage, если есть запись в БД
    try { resetClicks() } catch {}

    // Проверка времени будет в отдельном useEffect
  }, [userId, isAuthenticated, isBlockedRoute, resetClicks])

  // Проверка времени next_survey_at при каждом обновлении или изменении
  useEffect(() => {
    if (!nextSurveyAt || !hasDbRecord) {
      return
    }

    // Если infinity - не показываем никогда
    if (nextSurveyAt.toLowerCase() === 'infinity') {
      setCanShowBySurveyTime(false)
      return
    }

    // Проверяем текущее время vs next_survey_at
    const now = Date.now()
    const surveyTime = new Date(nextSurveyAt).getTime()
    const canShow = now >= surveyTime

    setCanShowBySurveyTime(canShow)
  }, [nextSurveyAt, hasDbRecord])

  // Отслеживание смены userId для определения входа/выхода
  const prevUserIdRef = useRef<string | null>(null)

  // Загрузка данных из БД при входе пользователя или смене userId
  useEffect(() => {
    const prevUserId = prevUserIdRef.current
    const currentUserId = userId

    // Если пользователь вышел (был userId → стал null)
    if (prevUserId && !currentUserId) {
      // Очищаем кеш при выходе (не используем clearFeedbackCache, т.к. userId = null)
      try {
        const key = `feedback.cache.v1.${prevUserId}`
        sessionStorage.removeItem(key)
      } catch {}
    }

    // Если пользователь вошел (был null → стал userId) или сменился userId
    if (currentUserId && currentUserId !== prevUserId) {
      // При смене пользователя загружаем данные заново
      loadData()
    }

    prevUserIdRef.current = currentUserId
  }, [userId, loadData, isAuthenticated, isBlockedRoute])

  // Коллбэки после действий - обновляем локальное состояние И кеш
  const handleAnswered = useCallback(() => {
    setHasDbRecord(true)
    const d = new Date()
    d.setMonth(d.getMonth() + 2)
    const nextAt = d.toISOString()
    setNextSurveyAt(nextAt)
    setCanShowBySurveyTime(false)
    // Обновляем кеш
    setFeedbackCache(userId, { next_survey_at: nextAt, hasDbRecord: true })
    close()
  }, [close, userId])

  const handleSnooze = useCallback(() => {
    setHasDbRecord(true)
    const nextAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    setNextSurveyAt(nextAt)
    setCanShowBySurveyTime(false)
    // Обновляем кеш
    setFeedbackCache(userId, { next_survey_at: nextAt, hasDbRecord: true })
    close()
  }, [close, userId])

  const handleClose = useCallback(() => {
    setHasDbRecord(true)
    setNextSurveyAt('infinity')
    setCanShowBySurveyTime(false)
    // Обновляем кеш
    setFeedbackCache(userId, { next_survey_at: 'infinity', hasDbRecord: true })
    close()
  }, [close, userId])

  return (
    <>
      {isOpen && isAuthenticated && !isBlockedRoute && (
        <FeedbackBanner
          userId={userId}
          firstName={profile?.first_name || ""}
          lastName={profile?.last_name || ""}
          hasDbRecord={hasDbRecord === true}
          onClose={handleClose}
          onAnswered={handleAnswered}
          onSnooze={handleSnooze}
        />
      )}
      {children}
    </>
  )
}
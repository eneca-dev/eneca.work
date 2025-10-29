"use client"
import { useEffect, useRef, useState } from "react"

// Счётчик пользовательской активности по кликам с сохранением в localStorage
// Ключ НЕ привязан к userId, чтобы сохранялся при выходе/входе
// Используем префикс app- чтобы Supabase signOut не удалял этот ключ

function storageKey() {
  // Просто возвращаем ключ без userId - он общий для устройства
  // Префикс app- гарантирует что Supabase не трогает этот ключ при signOut
  return `app-user-activity`
}

export function useActiveSurveyClicks(userId: string | null, opts?: { disabled?: boolean }) {
  const [clickCount, setClickCount] = useState<number>(0)
  const clickCountRef = useRef<number>(0)

  useEffect(() => {
    if (opts?.disabled) return
    const getNum = (def = 0) => {
      try {
        const raw = localStorage.getItem(storageKey())
        const n = Number(raw)
        return Number.isFinite(n) ? n : def
      } catch {
        return def
      }
    }
    const setNum = (value: number) => {
      try { localStorage.setItem(storageKey(), String(value)) } catch {}
    }

    // Восстанавливаем накопленное количество кликов
    const initialValue = getNum(0)
    setClickCount(initialValue)
    clickCountRef.current = initialValue

    // Учитываем только явные действия пользователя: pointerdown (клик/тап/стилус)
    const onPointerDown = () => {
      setClickCount((prev) => {
        const next = prev + 1
        setNum(next)
        clickCountRef.current = next
        return next
      })
    }

    window.addEventListener("pointerdown", onPointerDown as any, { passive: true })

    const flush = () => {
      try { localStorage.setItem(storageKey(), String(clickCountRef.current)) } catch {}
    }
    window.addEventListener("beforeunload", flush)

    return () => {
      window.removeEventListener("pointerdown", onPointerDown as any)
      window.removeEventListener("beforeunload", flush)
    }
  }, [userId, opts?.disabled])

  const resetClicks = () => {
    setClickCount(0)
    try { localStorage.removeItem(storageKey()) } catch {}
  }

  return { clickCount, resetClicks }
}

// Удалены lastSurveyAt/snoozeUntil — теперь график показа управляется в БД



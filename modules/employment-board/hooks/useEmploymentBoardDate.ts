'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  assertEmploymentBoardDate,
  getCurrentMinskDate,
  getEmploymentBoardDateMode,
  getMillisecondsUntilNextMinskDay,
} from '../lib/board-date'

const MIDNIGHT_TIMER_MARGIN_MS = 50

export function useEmploymentBoardDate() {
  const [currentMinskDate, setCurrentMinskDate] = useState(getCurrentMinskDate)
  const [selectedDate, setSelectedDate] = useState(getCurrentMinskDate)
  const [followsToday, setFollowsToday] = useState(true)
  const followsTodayRef = useRef(true)

  const refreshCurrentMinskDate = useCallback(() => {
    const nextCurrentDate = getCurrentMinskDate()
    setCurrentMinskDate(nextCurrentDate)

    if (followsTodayRef.current) {
      setSelectedDate(nextCurrentDate)
    }

    return nextCurrentDate
  }, [])

  const selectDate = useCallback((date: string) => {
    assertEmploymentBoardDate(date)
    followsTodayRef.current = false
    setFollowsToday(false)
    setSelectedDate(date)
  }, [])

  const selectToday = useCallback(() => {
    followsTodayRef.current = true
    setFollowsToday(true)
    setSelectedDate(refreshCurrentMinskDate())
  }, [refreshCurrentMinskDate])

  useEffect(() => {
    const timerId = window.setTimeout(
      refreshCurrentMinskDate,
      getMillisecondsUntilNextMinskDay() + MIDNIGHT_TIMER_MARGIN_MS,
    )

    return () => window.clearTimeout(timerId)
  }, [currentMinskDate, refreshCurrentMinskDate])

  useEffect(() => {
    const handleFocus = () => refreshCurrentMinskDate()
    const handleVisibilityChange = () => refreshCurrentMinskDate()

    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [refreshCurrentMinskDate])

  const mode = useMemo(
    () => getEmploymentBoardDateMode(selectedDate, currentMinskDate),
    [currentMinskDate, selectedDate],
  )

  return {
    currentMinskDate,
    selectedDate,
    followsToday,
    mode,
    selectDate,
    selectToday,
    refreshCurrentMinskDate,
  }
}

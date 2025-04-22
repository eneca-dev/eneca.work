"use client"

import { useEffect } from 'react'
import { useTheme } from 'next-themes'
import { useSettingsStore } from '@/stores/useSettingsStore'

/**
 * Хук для синхронизации темы между next-themes и Zustand
 * 
 * Этот хук делает следующее:
 * 1. При первой загрузке применяет тему из Zustand к next-themes
 * 2. Обновляет Zustand store при изменении темы через next-themes
 */
export function useThemeSync() {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const zustandTheme = useSettingsStore(state => state.theme)
  const setZustandTheme = useSettingsStore(state => state.setTheme)
  
  // При первой загрузке устанавливаем тему из Zustand стора в next-themes
  useEffect(() => {
    // Применяем тему из Zustand к next-themes
    if (zustandTheme !== theme && zustandTheme !== 'system') {
      setTheme(zustandTheme)
    }
  }, [])

  // Обновляем Zustand при изменении темы через next-themes
  useEffect(() => {
    if (theme && theme !== zustandTheme) {
      setZustandTheme(theme as 'light' | 'dark' | 'system')
    }
  }, [theme, zustandTheme, setZustandTheme])

  return {
    theme,
    setTheme: (newTheme: string) => {
      setTheme(newTheme)
      setZustandTheme(newTheme as 'light' | 'dark' | 'system')
    },
    resolvedTheme
  }
} 
"use client"

import { useEffect, useState } from 'react'
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
  const [mounted, setMounted] = useState(false)
  
  // Проверяем, что компонент полностью гидратировался
  useEffect(() => {
    setMounted(true)
  }, [])

  // При первой загрузке устанавливаем тему из Zustand стора в next-themes
  useEffect(() => {
    if (!mounted || typeof window === 'undefined') return
    
    // Применяем тему из Zustand к next-themes только если она отличается
    if (zustandTheme && zustandTheme !== theme && zustandTheme !== 'system') {
      setTheme(zustandTheme)
    }
  }, [mounted, zustandTheme, theme, setTheme])

  // Обновляем Zustand при изменении темы через next-themes
  useEffect(() => {
    if (!mounted || typeof window === 'undefined') return
    
    if (theme && theme !== zustandTheme) {
      setZustandTheme(theme as 'light' | 'dark' | 'system')
    }
  }, [mounted, theme, zustandTheme, setZustandTheme])

  return {
    theme,
    setTheme: (newTheme: string) => {
      if (!mounted || typeof window === 'undefined') return
      setTheme(newTheme)
      setZustandTheme(newTheme as 'light' | 'dark' | 'system')
    },
    resolvedTheme,
    mounted
  }
} 
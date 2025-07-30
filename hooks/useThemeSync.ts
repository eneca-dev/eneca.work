"use client"

import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { useSettingsStore } from '@/stores/useSettingsStore'

/**
 * Хук для синхронизации темы между next-themes и Zustand
 * 
 * Простая односторонняя синхронизация:
 * - При инициализации берем тему из Zustand
 * - При изменении через next-themes обновляем Zustand
 */
export function useThemeSync() {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const zustandTheme = useSettingsStore(state => state.theme)
  const setZustandTheme = useSettingsStore(state => state.setTheme)
  const [mounted, setMounted] = useState(false)
  const [initialized, setInitialized] = useState(false)
  
  // Проверяем, что компонент полностью гидратировался
  useEffect(() => {
    setMounted(true)
  }, [])

  // Инициализация: устанавливаем тему из Zustand в next-themes ОДИН РАЗ
  useEffect(() => {
    if (!mounted || typeof window === 'undefined' || initialized) return
    
    // Если в Zustand есть сохраненная тема, применяем ее
    if (zustandTheme && zustandTheme !== theme) {
      setTheme(zustandTheme)
    }
    
    setInitialized(true)
  }, [mounted, zustandTheme, theme, setTheme, initialized])

  // Синхронизация: обновляем Zustand при изменении next-themes (но только после инициализации)
  useEffect(() => {
    if (!mounted || typeof window === 'undefined' || !initialized) return
    
    // Обновляем Zustand только если тема действительно изменилась
    if (theme && theme !== zustandTheme) {
      setZustandTheme(theme as 'light' | 'dark' | 'system')
    }
  }, [mounted, initialized, theme, zustandTheme, setZustandTheme])

  return {
    theme,
    setTheme: (newTheme: string) => {
      if (!mounted || typeof window === 'undefined') return
      
      // Просто обновляем next-themes, эффект выше обновит Zustand
      setTheme(newTheme)
    },
    resolvedTheme,
    mounted
  }
} 
"use client"

import { useThemeSync } from "@/hooks/useThemeSync"

/**
 * Компонент для синхронизации темы между next-themes и Zustand без UI
 * Должен быть добавлен в дерево компонентов один раз, 
 * чтобы эффекты синхронизации работали
 */
export function ThemeSync() {
  // Просто вызываем хук для запуска эффектов
  useThemeSync()
  
  // Не рендерим ничего
  return null
} 
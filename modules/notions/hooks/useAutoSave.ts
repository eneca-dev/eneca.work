import { useCallback, useRef, useState, useEffect } from 'react'
import { useNotionsStore } from '@/modules/notions/store'
import { toast } from 'sonner'

interface UseAutoSaveOptions {
  notionId?: string
  delay?: number // ms
  enabled?: boolean
}

interface UseAutoSaveReturn {
  saveStatus: 'idle' | 'saving' | 'saved' | 'error'
  triggerSave: (content: string) => void
  forceSave: (content: string) => Promise<void>
}

export function useAutoSave({ 
  notionId, 
  delay = 1000, 
  enabled = true 
}: UseAutoSaveOptions): UseAutoSaveReturn {
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastContentRef = useRef<string>('')
  
  const { updateNotionSilent } = useNotionsStore()

  // Очистка таймаута при размонтировании
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  const performSave = useCallback(async (content: string, showToast = false) => {
    if (!notionId || !enabled) return
    
    // Не сохраняем если контент не изменился
    if (content === lastContentRef.current) return
    
    setSaveStatus('saving')
    
    try {
      await updateNotionSilent(notionId, { notion_content: content })

      lastContentRef.current = content
      setSaveStatus('saved')
      
      if (showToast) {
        toast.success('Заметка сохранена')
      }
      
      // Сбрасываем статус 'saved' через 2 секунды
      setTimeout(() => {
        setSaveStatus('idle')
      }, 2000)
      
    } catch (error) {
      console.error('Auto-save error:', error)
      setSaveStatus('error')
      
      if (showToast) {
        toast.error('Ошибка при сохранении заметки')
      }
      
      // Сбрасываем статус 'error' через 3 секунды
      setTimeout(() => {
        setSaveStatus('idle')
      }, 3000)
    }
  }, [notionId, enabled, updateNotionSilent])

  const triggerSave = useCallback((content: string) => {
    if (!enabled || !notionId) return
    
    // Очищаем предыдущий таймаут
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    
    // Устанавливаем новый таймаут
    timeoutRef.current = setTimeout(() => {
      performSave(content, false)
    }, delay)
  }, [delay, performSave, enabled, notionId])

  const forceSave = useCallback(async (content: string) => {
    // Очищаем таймаут если есть
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    
    await performSave(content, true)
  }, [performSave])

  return {
    saveStatus,
    triggerSave,
    forceSave
  }
} 
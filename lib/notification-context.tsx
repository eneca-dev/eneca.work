"use client"
import { createContext, useContext, ReactNode } from 'react'
import { toast, ToastT } from 'sonner'

interface NotificationContextType {
  /**
   * Показать успешное уведомление
   */
  success: (message: string, description?: string) => void
  /**
   * Показать уведомление об ошибке
   */
  error: (message: string, description?: string | Error) => void
  /**
   * Показать информационное уведомление
   */
  info: (message: string, description?: string) => void
  /**
   * Показать предупреждающее уведомление
   */
  warning: (message: string, description?: string) => void
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined)

// Базовые настройки для всех уведомлений
const baseToastOptions = {
  duration: 4000,
  className: 'custom-toast',
}

/**
 * Провайдер контекста уведомлений
 */
export function NotificationProvider({ children }: { children: ReactNode }) {
  // Функция для отображения успешного уведомления
  const success = (message: string, description?: string) => {
    toast.success(message, {
      ...baseToastOptions,
      description,
      className: `${baseToastOptions.className} toast-success`,
    })
  }

  // Функция для отображения уведомления об ошибке
  const error = (message: string, description?: string | Error) => {
    let errorDescription: string | undefined
    
    if (description instanceof Error) {
      errorDescription = description.message
    } else {
      errorDescription = description
    }
    
    toast.error(message, {
      ...baseToastOptions,
      description: errorDescription,
      duration: 5000, // Ошибки показываем дольше
      className: `${baseToastOptions.className} toast-error`,
    })
  }

  // Функция для отображения информационного уведомления
  const info = (message: string, description?: string) => {
    toast.info(message, {
      ...baseToastOptions,
      description,
      className: `${baseToastOptions.className} toast-info`,
    })
  }

  // Функция для отображения предупреждающего уведомления
  const warning = (message: string, description?: string) => {
    toast.warning(message, {
      ...baseToastOptions,
      description,
      duration: 4500, // Предупреждения показываем чуть дольше
      className: `${baseToastOptions.className} toast-warning`,
    })
  }

  return (
    <NotificationContext.Provider value={{ success, error, info, warning }}>
      {children}
    </NotificationContext.Provider>
  )
}

/**
 * Хук для доступа к контексту уведомлений
 */
export function useNotification() {
  const context = useContext(NotificationContext)
  
  if (!context) {
    throw new Error('useNotification должен использоваться внутри NotificationProvider')
  }
  
  return context
} 
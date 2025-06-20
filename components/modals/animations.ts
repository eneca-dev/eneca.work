import type { ModalSize } from './types'

// Функция для получения классов размера модального окна
export function getModalClasses(size: ModalSize): string {
  const sizeClasses = {
    sm: 'w-full max-w-md mx-4',
    md: 'w-full max-w-lg mx-4', 
    lg: 'w-full max-w-2xl mx-4',
    xl: 'w-full max-w-4xl mx-4',
    full: 'w-[95vw] max-w-[95vw] mx-4'
  }
  
  return sizeClasses[size]
}

// Анимации для overlay
export const overlayAnimations = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.2, ease: 'easeOut' }
}

// Анимации для модального окна
export const modalAnimations = {
  initial: { 
    opacity: 0, 
    scale: 0.95,
    y: 20
  },
  animate: { 
    opacity: 1, 
    scale: 1,
    y: 0
  },
  exit: { 
    opacity: 0, 
    scale: 0.95,
    y: 20
  },
  transition: { 
    duration: 0.3, 
    ease: 'easeOut' 
  }
}

// Анимации для мобильных устройств (снизу вверх)
export const mobileModalAnimations = {
  initial: { 
    opacity: 0, 
    y: '100%'
  },
  animate: { 
    opacity: 1, 
    y: 0
  },
  exit: { 
    opacity: 0, 
    y: '100%'
  },
  transition: { 
    duration: 0.3, 
    ease: 'easeOut' 
  }
} 
"use client"

import React, { useEffect } from 'react'
import { createPortal } from 'react-dom'
import type { ModalOverlayProps } from '../types'

export function ModalOverlay({
  isOpen,
  onClose,
  closeOnClick = true,
  className = '',
  children
}: ModalOverlayProps) {
  // Блокировка скролла body при открытии модального окна
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = 'unset'
      }
    }
  }, [isOpen])

  // Обработка нажатия ESC
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      return () => document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (closeOnClick && e.target === e.currentTarget) {
      onClose()
    }
  }

  return createPortal(
    <div
      className={`
        fixed inset-0 z-50 
        flex items-center justify-center 
        p-4
        bg-black/60 
        backdrop-blur-sm
        transition-all duration-300 ease-out
        ${isOpen ? 'opacity-100' : 'opacity-0'}
        ${className}
      `}
      onClick={handleOverlayClick}
    >
      {children}
    </div>,
    document.body
  )
} 
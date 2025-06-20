"use client"

import React, { useContext } from 'react'
import { ModalContextType } from '../types'
import { ModalProvider } from './ModalProvider'

const ModalContext = React.createContext<ModalContextType | undefined>(undefined)

export function useModal() {
  const context = useContext(ModalContext)
  
  if (!context) {
    throw new Error('useModal must be used within a ModalProvider')
  }
  
  return context
}

// Хук для простого управления состоянием модального окна
export function useModalState(initialState = false) {
  const [isOpen, setIsOpen] = React.useState(initialState)
  
  const openModal = React.useCallback(() => setIsOpen(true), [])
  const closeModal = React.useCallback(() => setIsOpen(false), [])
  const toggleModal = React.useCallback(() => setIsOpen(prev => !prev), [])
  
  return {
    isOpen,
    openModal,
    closeModal,
    toggleModal
  }
} 
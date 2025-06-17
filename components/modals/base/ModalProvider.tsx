"use client"

import React, { createContext, useContext, useState, ReactNode } from 'react'
import { ModalContextType, RegisteredModal } from '../types'

const ModalContext = createContext<ModalContextType | undefined>(undefined)

interface ModalProviderProps {
  children: ReactNode
}

export function ModalProvider({ children }: ModalProviderProps) {
  const [modals, setModals] = useState<RegisteredModal[]>([])
  const [registeredComponents, setRegisteredComponents] = useState<Map<string, React.ComponentType<any>>>(new Map())

  const registerModal = (id: string, component: React.ComponentType<any>) => {
    setRegisteredComponents(prev => new Map(prev.set(id, component)))
  }

  const openModal = (modalId: string, props: any = {}) => {
    setModals(prev => {
      const existingIndex = prev.findIndex(modal => modal.id === modalId)
      const newModal: RegisteredModal = {
        id: modalId,
        component: registeredComponents.get(modalId)!,
        props,
        isOpen: true
      }

      if (existingIndex >= 0) {
        const updated = [...prev]
        updated[existingIndex] = newModal
        return updated
      } else {
        return [...prev, newModal]
      }
    })
  }

  const closeModal = (modalId?: string) => {
    if (modalId) {
      setModals(prev => prev.map(modal => 
        modal.id === modalId ? { ...modal, isOpen: false } : modal
      ))
    } else {
      // Закрываем последнее открытое модальное окно
      setModals(prev => {
        const openModals = prev.filter(modal => modal.isOpen)
        if (openModals.length > 0) {
          const lastModal = openModals[openModals.length - 1]
          return prev.map(modal => 
            modal.id === lastModal.id ? { ...modal, isOpen: false } : modal
          )
        }
        return prev
      })
    }
  }

  const closeAllModals = () => {
    setModals(prev => prev.map(modal => ({ ...modal, isOpen: false })))
  }

  const isModalOpen = (modalId: string) => {
    return modals.find(modal => modal.id === modalId)?.isOpen || false
  }

  const getModalProps = (modalId: string) => {
    return modals.find(modal => modal.id === modalId)?.props || {}
  }

  const contextValue: ModalContextType = {
    openModal,
    closeModal,
    closeAllModals,
    isModalOpen,
    getModalProps
  }

  return (
    <ModalContext.Provider value={contextValue}>
      {children}
      
      {/* Рендерим все открытые модальные окна */}
      {modals
        .filter(modal => modal.isOpen && modal.component)
        .map(modal => {
          const ModalComponent = modal.component
          return (
            <ModalComponent
              key={modal.id}
              {...modal.props}
              onClose={() => closeModal(modal.id)}
            />
          )
        })}
    </ModalContext.Provider>
  )
}

// Хук для регистрации модальных окон
export function useModalRegistry() {
  const context = useContext(ModalContext)
  if (!context) {
    throw new Error('useModalRegistry must be used within a ModalProvider')
  }
  
  return {
    registerModal: (id: string, component: React.ComponentType<any>) => {
      // Логика регистрации будет добавлена позже
    }
  }
} 
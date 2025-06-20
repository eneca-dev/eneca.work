import { ReactNode } from 'react'

export interface ModalProps {
  isOpen: boolean
  onClose: () => void
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
  closeOnOverlayClick?: boolean
  closeOnEscape?: boolean
  showCloseButton?: boolean
  className?: string
  children: ReactNode
}

export interface ModalHeaderProps {
  title: string | ReactNode
  subtitle?: string | ReactNode
  onClose?: () => void
  showCloseButton?: boolean
  className?: string
}

export interface ModalBodyProps {
  children: ReactNode
  className?: string
  padding?: boolean
}

export interface ModalFooterProps {
  children: ReactNode
  className?: string
  align?: 'left' | 'center' | 'right' | 'between'
}

export interface ModalOverlayProps {
  isOpen: boolean
  onClose: () => void
  closeOnClick?: boolean
  className?: string
  children: ReactNode
}

export interface ModalContextType {
  openModal: (modalId: string, props?: any) => void
  closeModal: (modalId?: string) => void
  closeAllModals: () => void
  isModalOpen: (modalId: string) => boolean
  getModalProps: (modalId: string) => any
}

export interface RegisteredModal {
  id: string
  component: React.ComponentType<any>
  props?: any
  isOpen: boolean
}

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full'
export type ModalAlignment = 'left' | 'center' | 'right' | 'between' 
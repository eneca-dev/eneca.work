// Основные компоненты
export { Modal } from './base/Modal'
export { ModalOverlay } from './base/ModalOverlay'
export { ModalHeader } from './base/ModalHeader'
export { ModalBody } from './base/ModalBody'
export { ModalFooter } from './base/ModalFooter'
export { ModalProvider } from './base/ModalProvider'
export { ModalButton } from './base/ModalButton'

// Хуки
export { useModal, useModalState } from './base/useModal'
export { useModalRegistry } from './base/ModalProvider'

// Типы
export type {
  ModalProps,
  ModalHeaderProps,
  ModalBodyProps,
  ModalFooterProps,
  ModalOverlayProps,
  ModalContextType,
  RegisteredModal,
  ModalSize,
  ModalAlignment
} from './types'
export type { ModalButtonProps } from './base/ModalButton'

// Утилиты
export { modalAnimations, getModalClasses } from './animations' 
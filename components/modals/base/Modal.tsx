"use client"

import React from 'react'
import { ModalOverlay } from './ModalOverlay'
import { ModalHeader } from './ModalHeader'
import { ModalBody } from './ModalBody'
import { ModalFooter } from './ModalFooter'
import { getModalClasses } from '../animations'
import type { ModalProps } from '../types'

function ModalComponent({ 
  isOpen, 
  onClose, 
  size = 'md', 
  closeOnOverlayClick = true, 
  closeOnEscape = true,
  showCloseButton = true,
  className = '',
  children 
}: ModalProps) {
  const modalClasses = getModalClasses(size)

  return (
    <ModalOverlay 
      isOpen={isOpen} 
      onClose={onClose} 
      closeOnClick={closeOnOverlayClick}
    >
      <div
        role="dialog"
        aria-modal="true"
        className={`
          ${modalClasses}
          bg-card
          rounded-xl
          shadow-2xl
          border border-border
          backdrop-blur-sm
          transform transition-all duration-300 ease-out
          ${isOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}
          max-h-[90vh]
          flex flex-col
          ${className}
        `}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </ModalOverlay>
  )
}

// Композитный API
export const Modal = Object.assign(ModalComponent, {
  Header: ModalHeader,
  Body: ModalBody,
  Footer: ModalFooter,
}) 
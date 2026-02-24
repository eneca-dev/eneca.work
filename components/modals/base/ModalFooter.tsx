"use client"

import React from 'react'
import type { ModalFooterProps } from '../types'

export function ModalFooter({
  children,
  className = '',
  align = 'right'
}: ModalFooterProps) {
  const alignmentClasses = {
    left: 'justify-start',
    center: 'justify-center', 
    right: 'justify-end',
    between: 'justify-between'
  }

  return (
    <div className={`
      px-6 py-4
      border-t border-border
      bg-muted/30
      ${className}
    `}>
      <div className={`flex items-center gap-3 ${alignmentClasses[align]}`}>
        {children}
      </div>
    </div>
  )
} 
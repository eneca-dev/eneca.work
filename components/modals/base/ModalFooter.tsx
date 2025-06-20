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
      border-t border-gray-200 dark:border-slate-700
      bg-gray-50/30 dark:bg-slate-800/30
      ${className}
    `}>
      <div className={`flex items-center gap-3 ${alignmentClasses[align]}`}>
        {children}
      </div>
    </div>
  )
} 
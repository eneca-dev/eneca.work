"use client"

import React from 'react'
import type { ModalBodyProps } from '../types'

export function ModalBody({
  children,
  className = '',
  padding = true
}: ModalBodyProps) {
  return (
    <div 
      className={`
        flex-1 overflow-y-auto
        ${padding ? 'px-6 py-5' : ''}
        ${className}
      `}
    >
      <div className="space-y-4">
        {children}
      </div>
    </div>
  )
} 
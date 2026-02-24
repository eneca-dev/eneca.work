"use client"

import React from 'react'
import { X } from 'lucide-react'
import type { ModalHeaderProps } from '../types'

export function ModalHeader({
  title,
  subtitle,
  onClose,
  showCloseButton = true,
  className = ''
}: ModalHeaderProps) {
  return (
    <div className={`
      px-6 py-5
      border-b border-border
      bg-muted/50
      ${className}
    `}>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-semibold text-foreground leading-tight">
            {title}
          </h2>
          {subtitle && (
            <div className="mt-2 text-sm text-muted-foreground leading-relaxed">
              {subtitle}
            </div>
          )}
        </div>

        {showCloseButton && onClose && (
          <button
            onClick={onClose}
            className="
              ml-4 p-2
              text-muted-foreground hover:text-foreground
              hover:bg-accent
              rounded-lg transition-colors duration-200
              flex-shrink-0
            "
            aria-label="Закрыть"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>
    </div>
  )
} 
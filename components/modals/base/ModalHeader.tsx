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
      border-b border-gray-200 dark:border-slate-700 
      bg-gray-50/50 dark:bg-slate-800/50
      ${className}
    `}>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white leading-tight">
            {title}
          </h2>
          {subtitle && (
            <div className="mt-2 text-sm text-gray-600 dark:text-slate-400 leading-relaxed">
              {subtitle}
            </div>
          )}
        </div>
        
        {showCloseButton && onClose && (
          <button
            onClick={onClose}
            className="
              ml-4 p-2 
              text-gray-400 hover:text-gray-600 
              dark:text-slate-500 dark:hover:text-slate-300
              hover:bg-gray-100 dark:hover:bg-slate-700
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
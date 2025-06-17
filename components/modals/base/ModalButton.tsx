"use client"

import React from 'react'
import { Loader2 } from 'lucide-react'

export interface ModalButtonProps {
  children: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  loading?: boolean
  variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'cancel'
  type?: 'button' | 'submit' | 'reset'
  className?: string
  icon?: React.ReactNode
}

export function ModalButton({
  children,
  onClick,
  disabled = false,
  loading = false,
  variant = 'primary',
  type = 'button',
  className = '',
  icon
}: ModalButtonProps) {
  const baseClasses = `
    px-4 py-2.5 
    rounded-lg 
    font-medium 
    transition-all duration-200 
    flex items-center justify-center gap-2 
    focus:outline-none focus:ring-2 focus:ring-offset-2
    disabled:cursor-not-allowed
    min-w-[100px]
  `
  
  const variantClasses = {
    primary: `
      bg-blue-600 hover:bg-blue-700 
      text-white 
      shadow-sm hover:shadow-md
      focus:ring-blue-500
      disabled:bg-gray-300 disabled:text-gray-500 disabled:shadow-none
      dark:disabled:bg-slate-600 dark:disabled:text-slate-400
    `,
    secondary: `
      bg-gray-600 hover:bg-gray-700 
      text-white 
      shadow-sm hover:shadow-md
      focus:ring-gray-500
      disabled:bg-gray-300 disabled:text-gray-500 disabled:shadow-none
      dark:disabled:bg-slate-600 dark:disabled:text-slate-400
    `,
    success: `
      bg-green-600 hover:bg-green-700 
      text-white 
      shadow-sm hover:shadow-md
      focus:ring-green-500
      disabled:bg-gray-300 disabled:text-gray-500 disabled:shadow-none
      dark:disabled:bg-slate-600 dark:disabled:text-slate-400
    `,
    danger: `
      bg-red-600 hover:bg-red-700 
      text-white 
      shadow-sm hover:shadow-md
      focus:ring-red-500
      disabled:bg-gray-300 disabled:text-gray-500 disabled:shadow-none
      dark:disabled:bg-slate-600 dark:disabled:text-slate-400
    `,
    cancel: `
      text-gray-700 hover:text-gray-900 
      bg-white hover:bg-gray-50 
      border border-gray-300 hover:border-gray-400
      shadow-sm hover:shadow-md
      focus:ring-gray-500
      dark:text-slate-300 dark:hover:text-slate-100
      dark:bg-slate-800 dark:hover:bg-slate-700 
      dark:border-slate-600 dark:hover:border-slate-500
      disabled:text-gray-400 disabled:bg-gray-100 disabled:border-gray-200 disabled:shadow-none
      dark:disabled:text-slate-500 dark:disabled:bg-slate-700 dark:disabled:border-slate-600
    `
  }

  const isDisabled = disabled || loading

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
    >
      {loading ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          {children}
        </>
      ) : (
        <>
          {icon && <span className="h-4 w-4 flex items-center justify-center">{icon}</span>}
          {children}
        </>
      )}
    </button>
  )
} 
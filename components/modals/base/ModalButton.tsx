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
      dark:bg-blue-500 dark:hover:bg-blue-600
      disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none
    `,
    secondary: `
      bg-gray-600 hover:bg-gray-700
      text-white
      shadow-sm hover:shadow-md
      focus:ring-gray-500
      dark:bg-slate-600 dark:hover:bg-slate-500
      disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none
    `,
    success: `
      bg-green-600 hover:bg-green-700
      text-white dark:text-white
      shadow-sm hover:shadow-md
      focus:ring-green-500
      dark:bg-green-700 dark:hover:bg-green-800
      disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none
    `,
    danger: `
      bg-red-600 hover:bg-red-700
      text-white
      shadow-sm hover:shadow-md
      focus:ring-red-500
      dark:bg-red-500 dark:hover:bg-red-600
      disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none
    `,
    cancel: `
      text-foreground hover:text-foreground
      bg-background hover:bg-accent
      border border-border hover:border-border
      shadow-sm hover:shadow-md
      focus:ring-ring
      disabled:text-muted-foreground disabled:bg-muted disabled:border-border disabled:shadow-none
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
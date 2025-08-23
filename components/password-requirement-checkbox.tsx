"use client"

import React from "react"
import { cn } from "@/lib/utils"

interface PasswordRequirementCheckboxProps {
  isValid: boolean
  children: React.ReactNode
  className?: string
}

export function PasswordRequirementCheckbox({ 
  isValid, 
  children, 
  className 
}: PasswordRequirementCheckboxProps) {
  return (
    <div className={cn(
      "flex items-center gap-2 text-xs transition-colors duration-200",
      isValid 
        ? "text-green-600 dark:text-green-400" 
        : "text-gray-500 dark:text-gray-400",
      className
    )}>
      <div className={cn(
        "flex items-center justify-center w-4 h-4 rounded-full border-2 transition-all duration-200",
        isValid 
          ? "bg-green-500 border-green-500 text-white" 
          : "border-gray-300 dark:border-gray-600 bg-transparent"
      )}>
        {isValid ? (
          <svg 
            className="w-2.5 h-2.5" 
            fill="currentColor" 
            viewBox="0 0 20 20"
          >
            <path 
              fillRule="evenodd" 
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" 
              clipRule="evenodd" 
            />
          </svg>
        ) : null}
      </div>
      <span>{children}</span>
    </div>
  )
}

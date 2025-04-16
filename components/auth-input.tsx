"use client"

import type React from "react"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { Eye, EyeOff } from "lucide-react"
import { Button } from "@/components/ui/button"

interface AuthInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
  showPasswordToggle?: boolean
}

export function AuthInput({ label, error, className, id, type, showPasswordToggle = false, ...props }: AuthInputProps) {
  const [showPassword, setShowPassword] = useState(false)

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword)
  }

  const inputType = showPasswordToggle && showPassword ? "text" : type

  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-sm font-medium dark:text-gray-200">
        {label}
      </Label>
      <div className="relative">
        <Input
          id={id}
          type={inputType}
          className={cn(
            "transition-all duration-200 dark:bg-gray-800/50 dark:border-gray-700",
            showPasswordToggle && "pr-10",
            error && "border-red-500 focus-visible:ring-red-500",
            className,
          )}
          {...props}
        />
        {showPasswordToggle && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="absolute right-0 top-0 h-full px-3 py-2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
            onClick={togglePasswordVisibility}
            tabIndex={-1}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            <span className="sr-only">{showPassword ? "Скрыть пароль" : "Показать пароль"}</span>
          </Button>
        )}
      </div>
      {error && <p className="text-xs text-red-500 animate-fade-in">{error}</p>}
    </div>
  )
}

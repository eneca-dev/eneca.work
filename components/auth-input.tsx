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
  validateOnChange?: boolean
  validationRules?: {
    required?: boolean
    minLength?: number
    maxLength?: number
    pattern?: RegExp
    email?: boolean
    custom?: (value: string) => string | null
  }
  onValidationChange?: (isValid: boolean, error?: string) => void
}

export function AuthInput({ 
  label, 
  error, 
  className, 
  id, 
  type, 
  showPasswordToggle = false, 
  validateOnChange = false,
  validationRules,
  onValidationChange,
  value,
  onChange,
  ...props 
}: AuthInputProps) {
  const [showPassword, setShowPassword] = useState(false)
  const [internalError, setInternalError] = useState<string | null>(null)
  const [touched, setTouched] = useState(false)

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword)
  }

  const validateValue = (inputValue: string): string | null => {
    if (!validationRules) return null

    // Проверка обязательности
    if (validationRules.required && !inputValue.trim()) {
      return "Это поле обязательно для заполнения"
    }

    // Если поле пустое и не обязательное, не валидируем дальше
    if (!inputValue.trim() && !validationRules.required) {
      return null
    }

    // Проверка минимальной длины
    if (validationRules.minLength && inputValue.length < validationRules.minLength) {
      return `Минимальная длина: ${validationRules.minLength} символов`
    }

    // Проверка максимальной длины
    if (validationRules.maxLength && inputValue.length > validationRules.maxLength) {
      return `Максимальная длина: ${validationRules.maxLength} символов`
    }

    // Проверка email
    if (validationRules.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(inputValue)) {
        return "Введите корректный email адрес"
      }
    }

    // Проверка регулярного выражения
    if (validationRules.pattern && !validationRules.pattern.test(inputValue)) {
      return "Неверный формат данных"
    }

    // Кастомная валидация
    if (validationRules.custom) {
      const customError = validationRules.custom(inputValue)
      if (customError) {
        return customError
      }
    }

    return null
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    
    if (onChange) {
      onChange(e)
    }

    if (validateOnChange && touched) {
      const validationError = validateValue(newValue)
      setInternalError(validationError)
      
      if (onValidationChange) {
        onValidationChange(!validationError, validationError || undefined)
      }
    }
  }

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    setTouched(true)
    
    if (validateOnChange) {
      const validationError = validateValue(e.target.value)
      setInternalError(validationError)
      
      if (onValidationChange) {
        onValidationChange(!validationError, validationError || undefined)
      }
    }

    if (props.onBlur) {
      props.onBlur(e)
    }
  }

  const inputType = showPasswordToggle && showPassword ? "text" : type
  const displayError = error || (touched ? internalError : null)

  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-sm font-medium dark:text-gray-200">
        {label}
      </Label>
      <div className="relative">
        <Input
          id={id}
          type={inputType}
          value={value}
          onChange={handleChange}
          onBlur={handleBlur}
          className={cn(
            "transition-all duration-200 dark:bg-gray-800/50 dark:border-gray-700",
            showPasswordToggle && "pr-10",
            displayError && "border-red-500 focus-visible:ring-red-500",
            !displayError && touched && validationRules && "border-green-500 focus-visible:ring-green-500",
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
      {displayError && <p className="text-xs text-red-500 animate-fade-in">{displayError}</p>}
    </div>
  )
}

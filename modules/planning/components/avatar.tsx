"use client"

import type React from "react"

import { cn } from "@/lib/utils"
import { useState, useRef, useEffect } from "react"
import { createPortal } from "react-dom"

interface AvatarProps {
  name?: string
  avatarUrl?: string | null
  size?: "xs" | "sm" | "md" | "lg"
  theme?: "light" | "dark"
  className?: string
}

export function Avatar({ name, avatarUrl, size = "sm", theme = "light", className }: AvatarProps) {
  const [imageError, setImageError] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  // Сбрасываем состояние ошибки при изменении URL
  useEffect(() => {
    setImageError(false)
    setIsLoading(true)
  }, [avatarUrl])

  // Получаем инициалы из имени
  const getInitials = (name?: string) => {
    if (!name) return "?"

    const parts = name.split(" ")
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
  }

  // Определяем размер аватара
  const sizeClass = {
    xs: "w-5 h-5 text-[10px]",
    sm: "w-6 h-6 text-xs",
    md: "w-8 h-8 text-sm",
    lg: "w-10 h-10 text-base",
  }[size]

  // Генерируем случайный цвет на основе имени
  const getColorFromName = (name?: string) => {
    if (!name) return "bg-gray-400"

    const colors = [
      "bg-blue-500",
      "bg-green-500",
      "bg-yellow-500",
      "bg-purple-500",
      "bg-pink-500",
      "bg-indigo-500",
      "bg-red-500",
      "bg-teal-500",
    ]

    // Используем сумму кодов символов имени для выбора цвета
    const sum = name.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0)
    return colors[sum % colors.length]
  }

  // Если есть URL аватара и нет ошибки загрузки, показываем изображение
  if (avatarUrl && !imageError) {
    return (
      <div className={cn("relative rounded-full overflow-hidden", sizeClass, className)}>
        {isLoading && (
          <div className={cn("absolute inset-0 flex items-center justify-center", getColorFromName(name))}>
            <span className="text-white">{getInitials(name)}</span>
          </div>
        )}
        <img
          src={avatarUrl || "/placeholder.svg"}
          alt={name || "Аватар"}
          className="w-full h-full object-cover"
          onLoad={() => setIsLoading(false)}
          onError={() => {
            console.error(`Ошибка загрузки аватара: ${avatarUrl}`)
            setImageError(true)
            setIsLoading(false)
          }}
        />
      </div>
    )
  }

  // Если нет URL или произошла ошибка, показываем инициалы
  return (
    <div
      className={cn(
        "rounded-full flex items-center justify-center text-white font-medium",
        sizeClass,
        getColorFromName(name),
        className,
      )}
    >
      {getInitials(name)}
    </div>
  )
}

// Компонент для отображения тултипа
export interface TooltipProps {
  children: React.ReactNode
  content?: string
  isVisible: boolean
  position?: "top" | "bottom" | "left" | "right"
}

export function Tooltip({ children, content, isVisible, position = "top" }: TooltipProps) {
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 })
  const childRef = useRef<HTMLDivElement>(null)

  // Обновляем позицию тултипа при изменении видимости
  useEffect(() => {
    if (isVisible && childRef.current) {
      const rect = childRef.current.getBoundingClientRect()
      let top = 0
      let left = 0

      switch (position) {
        case "top":
          top = rect.top - 8 // Немного отступа
          left = rect.left + rect.width / 2
          break
        case "bottom":
          top = rect.bottom + 8
          left = rect.left + rect.width / 2
          break
        case "left":
          top = rect.top + rect.height / 2
          left = rect.left - 8
          break
        case "right":
          top = rect.top + rect.height / 2
          left = rect.right + 8
          break
      }

      setTooltipPosition({ top, left })
    }
  }, [isVisible, position])

  // Стили для позиционирования тултипа
  const getTooltipStyles = () => {
    const baseStyles = {
      position: "fixed" as const,
      zIndex: 9999,
      padding: "4px 8px",
      backgroundColor: "rgba(0, 0, 0, 0.8)",
      color: "white",
      borderRadius: "4px",
      fontSize: "12px",
      maxWidth: "200px",
      wordWrap: "break-word" as const,
    }

    switch (position) {
      case "top":
        return {
          ...baseStyles,
          bottom: `calc(100vh - ${tooltipPosition.top}px)`,
          left: `${tooltipPosition.left}px`,
          transform: "translateX(-50%)",
        }
      case "bottom":
        return {
          ...baseStyles,
          top: `${tooltipPosition.top}px`,
          left: `${tooltipPosition.left}px`,
          transform: "translateX(-50%)",
        }
      case "left":
        return {
          ...baseStyles,
          top: `${tooltipPosition.top}px`,
          right: `calc(100vw - ${tooltipPosition.left}px)`,
          transform: "translateY(-50%)",
        }
      case "right":
        return {
          ...baseStyles,
          top: `${tooltipPosition.top}px`,
          left: `${tooltipPosition.left}px`,
          transform: "translateY(-50%)",
        }
      default:
        return baseStyles
    }
  }

  return (
    <>
      <div ref={childRef} className="inline-block">
        {children}
      </div>
      {isVisible &&
        content &&
        typeof document !== "undefined" &&
        createPortal(<div style={getTooltipStyles()}>{content}</div>, document.body)}
    </>
  )
}

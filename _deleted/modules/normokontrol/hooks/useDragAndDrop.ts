"use client"

import type React from "react"

import { useState, useCallback } from "react"
import { validateFileSize, validateFileType } from "../utils"

interface UseDragAndDropProps {
  onFileSelect: (file: File) => void
  onError: (error: string) => void
  disabled?: boolean
}

export const useDragAndDrop = ({ onFileSelect, onError, disabled }: UseDragAndDropProps) => {
  const [isDragOver, setIsDragOver] = useState(false)

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      if (!disabled) {
        setIsDragOver(true)
      }
    },
    [disabled],
  )

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragOver(false)

      if (disabled) return

      const files = Array.from(e.dataTransfer.files)
      const file = files[0]

      if (!file) {
        onError("Файл не выбран")
        return
      }

      if (!validateFileType(file)) {
        onError("Поддерживаются только PDF файлы")
        return
      }

      if (!validateFileSize(file)) {
        onError("Размер файла не должен превышать 1GB")
        return
      }

      onFileSelect(file)
    },
    [onFileSelect, onError, disabled],
  )

  return {
    isDragOver,
    handleDragOver,
    handleDragLeave,
    handleDrop,
  }
}

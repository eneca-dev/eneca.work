"use client"

import type React from "react"

import { useRef } from "react"
import { Upload, FileText, RefreshCw, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { useDragAndDrop } from "../hooks/useDragAndDrop"
import { validateFileSize, validateFileType } from "../utils"
import type { FileUploadState } from "../types"

interface FileUploadProps {
  uploadedFile: any
  fileUploadState: FileUploadState
  onFileSelect: (file: File) => void
  onChangeFile: () => void
  onError: (error: string) => void
  disabled?: boolean
}

export const FileUpload = ({
  uploadedFile,
  fileUploadState,
  onFileSelect,
  onChangeFile,
  onError,
  disabled,
}: FileUploadProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { isDragOver, handleDragOver, handleDragLeave, handleDrop } = useDragAndDrop({
    onFileSelect,
    onError,
    disabled: disabled || fileUploadState.isUploading,
  })

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!validateFileType(file)) {
      onError("Поддерживаются только PDF файлы")
      return
    }

    if (!validateFileSize(file)) {
      onError("Размер файла не должен превышать 1GB")
      return
    }

    onFileSelect(file)
    // Сбрасываем значение input для возможности выбора того же файла
    e.target.value = ""
  }

  const handleSelectClick = () => {
    if (!disabled && !fileUploadState.isUploading) {
      fileInputRef.current?.click()
    }
  }

  // Состояние загрузки файла
  if (fileUploadState.isUploading) {
    return (
      <Card className="p-6 border-2 border-dashed border-blue-200 bg-blue-50">
        <div className="text-center">
          <div className="flex items-center justify-center mb-4">
            <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
          </div>
          <p className="font-medium text-blue-900 mb-2">Загрузка файла...</p>
          <p className="text-sm text-blue-600 mb-4">{Math.round(fileUploadState.uploadProgress)}%</p>
          <Progress value={fileUploadState.uploadProgress} className="h-2 mb-4" />
          <p className="text-xs text-blue-500">Пожалуйста, дождитесь завершения загрузки</p>
        </div>
      </Card>
    )
  }

  // Ошибка загрузки
  if (fileUploadState.uploadError) {
    return (
      <Card className="p-6 border-2 border-dashed border-red-200 bg-red-50">
        <div className="text-center">
          <X className="w-8 h-8 text-red-600 mx-auto mb-4" />
          <p className="font-medium text-red-900 mb-2">Ошибка загрузки</p>
          <p className="text-sm text-red-600 mb-4">{fileUploadState.uploadError}</p>
          <Button
            variant="outline"
            onClick={handleSelectClick}
            className="border-red-300 text-red-700 hover:bg-red-100"
          >
            Попробовать снова
          </Button>
        </div>
      </Card>
    )
  }

  // Файл успешно загружен
  if (uploadedFile) {
    return (
      <Card className="p-6 border-2 border-dashed border-green-200 bg-green-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <FileText className="w-8 h-8 text-green-600" />
            <div>
              <p className="font-medium text-green-900">{uploadedFile.name}</p>
              <p className="text-sm text-green-600">{uploadedFile.sizeFormatted}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onChangeFile}
              disabled={disabled}
              className="text-green-600 hover:text-green-800 hover:bg-green-100 border-green-300"
            >
              Изменить файл
            </Button>
          </div>
        </div>
      </Card>
    )
  }

  // Начальное состояние - выбор файла
  return (
    <Card
      className={`p-8 border-2 border-dashed transition-all duration-200 ${
        disabled
          ? "border-gray-200 bg-gray-50 cursor-not-allowed"
          : isDragOver
            ? "border-blue-400 bg-blue-50 cursor-pointer"
            : "border-gray-300 hover:border-gray-400 hover:bg-gray-50 cursor-pointer"
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleSelectClick}
    >
      <div className="text-center">
        <Upload
          className={`w-12 h-12 mx-auto mb-4 ${
            disabled ? "text-gray-300" : isDragOver ? "text-blue-500" : "text-gray-400"
          }`}
        />
        <p className={`text-lg font-medium mb-2 ${disabled ? "text-gray-400" : "text-gray-900"}`}>
          Перетащите PDF файл сюда или нажмите для выбора
        </p>
        <p className={`text-sm mb-4 ${disabled ? "text-gray-400" : "text-gray-500"}`}>Максимальный размер файла: 1GB</p>
        <Button variant="outline" className="mt-2" disabled={disabled}>
          Выбрать файл
        </Button>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf"
        onChange={handleFileInputChange}
        className="hidden"
        disabled={disabled}
      />
    </Card>
  )
}

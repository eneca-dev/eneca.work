"use client"

import { useState } from "react"
import { AlertCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useNormokontrolStore } from "./store"
import { FileUpload } from "./components/FileUpload"
import { ProcessingModes } from "./components/ProcessingModes"
import { ProcessingProgress } from "./components/ProcessingProgress"
import { CompletionMessage } from "./components/CompletionMessage"
import { ConfirmSendDialog } from "./components/ConfirmSendDialog"

export default function NormokontrolPage() {
  const [error, setError] = useState<string>("")

  const {
    uploadedFile,
    fileUploadState,
    processingModes,
    processingStatuses,
    isProcessing,
    isCompleted,
    showConfirmDialog,
    isEmailSent,
    isSendingEmail,
    userEmail,
    setUploadedFile,
    changeFile,
    toggleProcessingMode,
    selectAllModes,
    clearAllModes,
    startProcessing,
    resetModule,
    showConfirmSendDialog,
    hideConfirmSendDialog,
    sendEmailConfirmed,
  } = useNormokontrolStore()

  const handleFileSelect = (file: File) => {
    setUploadedFile(file)
    setError("")
  }

  const handleChangeFile = () => {
    changeFile()
    setError("")
  }

  const handleError = (errorMessage: string) => {
    setError(errorMessage)
  }

  const handleStartProcessing = () => {
    setError("")
    startProcessing()
  }

  const handleReset = () => {
    resetModule()
    setError("")
  }

  const handleConfirmSend = () => {
    showConfirmSendDialog()
  }

  const handleCancelSend = () => {
    hideConfirmSendDialog()
  }

  const handleSendConfirmed = () => {
    sendEmailConfirmed()
  }

  const hasProcessingStarted = Object.keys(processingStatuses).length > 0

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Нормоконтроль PDF-файлов</h1>
          <p className="text-lg text-gray-600">
            Выберите файл и режимы проверки. После обработки вы получите ссылку на результаты по электронной почте.
          </p>
        </div>

        <div className="space-y-8">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* File Upload Section */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">1. Выберите PDF файл</h2>
            <FileUpload
              uploadedFile={uploadedFile}
              fileUploadState={fileUploadState}
              onFileSelect={handleFileSelect}
              onChangeFile={handleChangeFile}
              onError={handleError}
              disabled={isProcessing || isSendingEmail}
            />
          </div>

          {/* Processing Modes Section */}
          {uploadedFile && !fileUploadState.isUploading && (
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">2. Выберите режимы обработки</h2>
              <ProcessingModes
                modes={processingModes}
                onToggleMode={toggleProcessingMode}
                onSelectAll={selectAllModes}
                onClearAll={clearAllModes}
                onStartProcessing={handleStartProcessing}
                disabled={isProcessing || isSendingEmail}
              />
            </div>
          )}

          {/* Processing Progress Section */}
          {hasProcessingStarted && (
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">3. Прогресс обработки</h2>
              <ProcessingProgress modes={processingModes} statuses={processingStatuses} />
            </div>
          )}

          {/* Completion Message */}
          {isCompleted && (
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">4. Результат</h2>
              <CompletionMessage
                userEmail={userEmail}
                isEmailSent={isEmailSent}
                isSendingEmail={isSendingEmail}
                onConfirmSend={handleConfirmSend}
                onReset={handleReset}
              />
            </div>
          )}
        </div>

        {/* Confirm Send Dialog */}
        <ConfirmSendDialog
          open={showConfirmDialog}
          userEmail={userEmail}
          onConfirm={handleSendConfirmed}
          onCancel={handleCancelSend}
        />
      </div>
    </div>
  )
}

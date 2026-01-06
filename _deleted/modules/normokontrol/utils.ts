export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 Bytes"

  const k = 1024
  const sizes = ["Bytes", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
}

export const validateFileSize = (file: File): boolean => {
  const maxSize = 1024 * 1024 * 1024 // 1GB
  return file.size <= maxSize
}

export const validateFileType = (file: File): boolean => {
  return file.type === "application/pdf"
}

export const simulateProcessing = (
  modeId: string,
  onProgress: (progress: number) => void,
  onComplete: () => void,
  onError: (error: string) => void,
): (() => void) => {
  let progress = 0
  const interval = setInterval(() => {
    progress += Math.random() * 15
    if (progress >= 100) {
      progress = 100
      onProgress(progress)
      clearInterval(interval)
      // Simulate occasional errors
      if (Math.random() < 0.2) {
        onError("Ошибка обработки")
      } else {
        onComplete()
      }
    } else {
      onProgress(progress)
    }
  }, 500)

  return () => clearInterval(interval)
}

export const simulateFileUpload = (
  file: File,
  onProgress: (progress: number) => void,
  onComplete: () => void,
  onError: (error: string) => void,
): (() => void) => {
  let progress = 0
  const fileSize = file.size
  const uploadSpeed = 1024 * 1024 * 2 // 2MB/s simulation
  const totalTime = Math.max(1000, (fileSize / uploadSpeed) * 1000) // минимум 1 секунда
  const interval = 50 // обновление каждые 50мс
  const progressStep = (100 / totalTime) * interval

  const uploadInterval = setInterval(() => {
    progress += progressStep + Math.random() * 2 // добавляем небольшую случайность

    if (progress >= 100) {
      progress = 100
      onProgress(progress)
      clearInterval(uploadInterval)

      // Имитируем небольшую задержку для финализации
      setTimeout(() => {
        // Случайная ошибка в 5% случаев
        if (Math.random() < 0.05) {
          onError("Ошибка загрузки файла. Попробуйте еще раз.")
        } else {
          onComplete()
        }
      }, 300)
    } else {
      onProgress(progress)
    }
  }, interval)

  return () => clearInterval(uploadInterval)
}

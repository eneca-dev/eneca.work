export interface ProcessingMode {
  id: string
  name: string
  description: string
  enabled: boolean
}

export interface ProcessingStatus {
  id: string
  status: "idle" | "processing" | "completed" | "error"
  progress: number
  error?: string
}

export interface UploadedFile {
  file: File
  name: string
  size: number
  sizeFormatted: string
}

export interface FileUploadState {
  isUploading: boolean
  uploadProgress: number
  uploadError?: string
}

export interface NormokontrolState {
  uploadedFile: UploadedFile | null
  fileUploadState: FileUploadState
  processingModes: ProcessingMode[]
  processingStatuses: Record<string, ProcessingStatus>
  isProcessing: boolean
  isCompleted: boolean
  showConfirmDialog: boolean
  isEmailSent: boolean
  isSendingEmail: boolean
  userEmail: string
}

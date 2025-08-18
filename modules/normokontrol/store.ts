import { create } from "zustand"
import type { NormokontrolState, ProcessingMode, UploadedFile, ProcessingStatus } from "./types"
import { formatFileSize, simulateProcessing, simulateFileUpload } from "./utils"

const initialProcessingModes: ProcessingMode[] = [
  {
    id: "belarus-forms",
    name: "Поиск неактуальных форм (Республика Беларусь)",
    description: "Проверка актуальности форм документов РБ",
    enabled: false,
  },
  {
    id: "russia-forms",
    name: "Поиск неактуальных форм (Российская Федерация)",
    description: "Проверка актуальности форм документов РФ",
    enabled: false,
  },
  {
    id: "combined-forms",
    name: "Поиск неактуальных форм (РБ + РФ)",
    description: "Комбинированная проверка форм РБ и РФ",
    enabled: false,
  },
  {
    id: "spelling",
    name: "Поиск орфографических ошибок",
    description: "Проверка правописания в документе",
    enabled: false,
  },
  {
    id: "text-lines",
    name: "Поиск пересечений текста с линиями",
    description: "Анализ пересечений текстовых элементов",
    enabled: false,
  },
  {
    id: "objects-frames",
    name: "Поиск пересечений объектов с размерными рамками",
    description: "Проверка соответствия размерным рамкам",
    enabled: false,
  },
  {
    id: "fonts",
    name: "Поиск ошибок в шрифтах",
    description: "Анализ корректности использования шрифтов",
    enabled: false,
  },
]

interface NormokontrolStore extends NormokontrolState {
  currentProcessingIndex: number
  enabledModeIds: string[]
  setUploadedFile: (file: File | null) => void
  startFileUpload: (file: File) => void
  updateUploadProgress: (progress: number) => void
  completeFileUpload: (file: File) => void
  failFileUpload: (error: string) => void
  changeFile: () => void
  toggleProcessingMode: (modeId: string) => void
  selectAllModes: () => void
  clearAllModes: () => void
  startProcessing: () => void
  processNextMode: () => void
  updateProcessingStatus: (modeId: string, status: Partial<ProcessingStatus>) => void
  resetModule: () => void
  showConfirmSendDialog: () => void
  hideConfirmSendDialog: () => void
  sendEmailConfirmed: () => void
}

const simulateEmailSending = (onComplete: () => void, onError: (error: string) => void): (() => void) => {
  const timeout = setTimeout(() => {
    // Имитируем случайную ошибку в 10% случаев
    if (Math.random() < 0.1) {
      onError("Ошибка отправки на почту. Попробуйте еще раз.")
    } else {
      onComplete()
    }
  }, 2000) // 2 секунды на отправку

  return () => clearTimeout(timeout)
}

export const useNormokontrolStore = create<NormokontrolStore>((set, get) => ({
  uploadedFile: null,
  fileUploadState: {
    isUploading: false,
    uploadProgress: 0,
  },
  processingModes: initialProcessingModes,
  processingStatuses: {},
  isProcessing: false,
  isCompleted: false,
  showConfirmDialog: false,
  isEmailSent: false,
  isSendingEmail: false,
  userEmail: "user@example.com",
  currentProcessingIndex: 0,
  enabledModeIds: [],

  startFileUpload: (file) => {
    set({
      fileUploadState: {
        isUploading: true,
        uploadProgress: 0,
      },
      // Сбрасываем все режимы и статусы при начале загрузки нового файла
      processingModes: initialProcessingModes,
      processingStatuses: {},
      isProcessing: false,
      isCompleted: false,
      showConfirmDialog: false,
      isEmailSent: false,
      isSendingEmail: false,
      currentProcessingIndex: 0,
      enabledModeIds: [],
    })

    simulateFileUpload(
      file,
      (progress) => {
        get().updateUploadProgress(progress)
      },
      () => {
        get().completeFileUpload(file)
      },
      (error) => {
        get().failFileUpload(error)
      },
    )
  },

  updateUploadProgress: (progress) => {
    set((state) => ({
      fileUploadState: {
        ...state.fileUploadState,
        uploadProgress: progress,
      },
    }))
  },

  completeFileUpload: (file) => {
    const uploadedFile: UploadedFile = {
      file,
      name: file.name,
      size: file.size,
      sizeFormatted: formatFileSize(file.size),
    }

    set({
      uploadedFile,
      fileUploadState: {
        isUploading: false,
        uploadProgress: 100,
      },
    })
  },

  failFileUpload: (error) => {
    set({
      fileUploadState: {
        isUploading: false,
        uploadProgress: 0,
        uploadError: error,
      },
    })
  },

  changeFile: () => {
    set({
      uploadedFile: null,
      fileUploadState: {
        isUploading: false,
        uploadProgress: 0,
      },
      // Сбрасываем все режимы и статусы при смене файла
      processingModes: initialProcessingModes,
      processingStatuses: {},
      isProcessing: false,
      isCompleted: false,
      showConfirmDialog: false,
      isEmailSent: false,
      isSendingEmail: false,
      currentProcessingIndex: 0,
      enabledModeIds: [],
    })
  },

  setUploadedFile: (file) => {
    if (file) {
      get().startFileUpload(file)
    } else {
      set({ uploadedFile: null })
    }
  },

  toggleProcessingMode: (modeId) => {
    set((state) => ({
      processingModes: state.processingModes.map((mode) =>
        mode.id === modeId ? { ...mode, enabled: !mode.enabled } : mode,
      ),
    }))
  },

  selectAllModes: () => {
    set((state) => ({
      processingModes: state.processingModes.map((mode) => ({ ...mode, enabled: true })),
    }))
  },

  clearAllModes: () => {
    set((state) => ({
      processingModes: state.processingModes.map((mode) => ({ ...mode, enabled: false })),
    }))
  },

  startProcessing: () => {
    const { processingModes } = get()
    const enabledModes = processingModes.filter((mode) => mode.enabled)
    const enabledModeIds = enabledModes.map((mode) => mode.id)

    // Инициализируем статусы для всех выбранных режимов
    const initialStatuses: Record<string, ProcessingStatus> = {}
    enabledModes.forEach((mode, index) => {
      initialStatuses[mode.id] = {
        id: mode.id,
        status: index === 0 ? "processing" : "idle", // Только первый режим начинает обработку
        progress: 0,
      }
    })

    set({
      processingStatuses: initialStatuses,
      isProcessing: true,
      isCompleted: false,
      showConfirmDialog: false,
      isEmailSent: false,
      isSendingEmail: false,
      currentProcessingIndex: 0,
      enabledModeIds,
    })

    // Запускаем первый режим
    if (enabledModes.length > 0) {
      get().processNextMode()
    }
  },

  processNextMode: () => {
    const { enabledModeIds, currentProcessingIndex } = get()

    if (currentProcessingIndex >= enabledModeIds.length) {
      // Все режимы завершены
      set({ isProcessing: false, isCompleted: true })
      return
    }

    const currentModeId = enabledModeIds[currentProcessingIndex]

    simulateProcessing(
      currentModeId,
      (progress) => {
        get().updateProcessingStatus(currentModeId, { progress })
      },
      () => {
        // Режим успешно завершен
        get().updateProcessingStatus(currentModeId, { status: "completed", progress: 100 })

        // Переходим к следующему режиму
        const nextIndex = get().currentProcessingIndex + 1
        set({ currentProcessingIndex: nextIndex })

        const { enabledModeIds: currentEnabledIds } = get()
        if (nextIndex < currentEnabledIds.length) {
          // Запускаем следующий режим
          const nextModeId = currentEnabledIds[nextIndex]
          get().updateProcessingStatus(nextModeId, { status: "processing", progress: 0 })
          get().processNextMode()
        } else {
          // Все режимы завершены
          set({ isProcessing: false, isCompleted: true })
        }
      },
      (error) => {
        // Режим завершился с ошибкой - помечаем как ошибку и переходим к следующему
        get().updateProcessingStatus(currentModeId, { status: "error", error })

        // Переходим к следующему режиму
        const nextIndex = get().currentProcessingIndex + 1
        set({ currentProcessingIndex: nextIndex })

        const { enabledModeIds: currentEnabledIds } = get()
        if (nextIndex < currentEnabledIds.length) {
          // Запускаем следующий режим
          const nextModeId = currentEnabledIds[nextIndex]
          get().updateProcessingStatus(nextModeId, { status: "processing", progress: 0 })
          get().processNextMode()
        } else {
          // Все режимы завершены
          set({ isProcessing: false, isCompleted: true })
        }
      },
    )
  },

  updateProcessingStatus: (modeId, statusUpdate) => {
    set((state) => ({
      processingStatuses: {
        ...state.processingStatuses,
        [modeId]: {
          ...state.processingStatuses[modeId],
          ...statusUpdate,
        },
      },
    }))
  },

  resetModule: () => {
    set({
      uploadedFile: null,
      processingModes: initialProcessingModes,
      processingStatuses: {},
      isProcessing: false,
      isCompleted: false,
      showConfirmDialog: false,
      isEmailSent: false,
      isSendingEmail: false,
      currentProcessingIndex: 0,
      enabledModeIds: [],
    })
  },

  showConfirmSendDialog: () => {
    set({ showConfirmDialog: true })
  },

  hideConfirmSendDialog: () => {
    set({ showConfirmDialog: false })
  },

  sendEmailConfirmed: () => {
    set({
      showConfirmDialog: false,
      isSendingEmail: true,
    })

    simulateEmailSending(
      () => {
        set({
          isSendingEmail: false,
          isEmailSent: true,
        })
      },
      (error) => {
        set({
          isSendingEmail: false,
        })
        // Здесь можно добавить обработку ошибки отправки
        console.error("Email sending error:", error)
      },
    )
  },
}))

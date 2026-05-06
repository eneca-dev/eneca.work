'use client'

/**
 * Loading Modal New - Комбинированный hook для управления состоянием модалки
 *
 * Объединяет:
 * - Состояние левой панели (выбранный проект, режим фильтра)
 * - Состояние правой панели (выбранный раздел, данные формы)
 * - Режим редактирования vs создания
 * - Валидация формы
 */

import { useState, useCallback, useMemo } from 'react'
import { addDays } from 'date-fns'
import { formatMinskDate } from '@/lib/timezone-utils'

/**
 * Breadcrumb item для отображения пути
 */
export interface BreadcrumbItem {
  id: string
  name: string
  type: 'project' | 'object' | 'section' | 'decomposition_stage'
}

export interface LoadingFormData {
  /** ID сотрудника (используется в edit mode) */
  employeeId: string
  /** Массив ID сотрудников (используется в create mode для мультивыбора) */
  employeeIds: string[]
  /** Дата начала (YYYY-MM-DD) */
  startDate: string
  /** Дата окончания (YYYY-MM-DD) */
  endDate: string
  /** Ставка загрузки (0.01 - 1.0) */
  rate: number
  /** Комментарий */
  comment: string
  /** ID этапа декомпозиции (опционально) */
  decompositionStageId: string
}

/**
 * Объект загрузки (минимальная структура для режима редактирования)
 */
export interface Loading {
  id: string
  employee_id: string
  start_date: string
  end_date: string
  rate: number
  comment: string | null
  section_id: string
}

export interface UseLoadingModalOptions {
  /** Режим модалки */
  mode: 'create' | 'edit'
  /** Начальный ID раздела */
  initialSectionId?: string
  /** Начальный ID сотрудника (для режима создания) */
  initialEmployeeId?: string
  /** Данные загрузки для редактирования */
  initialLoading?: Loading
  /** Предзаполненные данные формы (для копирования загрузки) */
  initialFormValues?: {
    rate?: number
    startDate?: string
    endDate?: string
    comment?: string
  }
}

export interface UseLoadingModalResult {
  // Состояние навигации
  projectMode: 'my' | 'all'
  setProjectMode: (mode: 'my' | 'all') => void
  /** ID выбранного раздела или этапа декомпозиции */
  selectedSectionId: string | null
  /** Название выбранного раздела или этапа декомпозиции */
  selectedSectionName: string | null
  /** Breadcrumbs выбранного раздела или этапа */
  selectedBreadcrumbs: BreadcrumbItem[] | null
  /** Выбор раздела или этапа декомпозиции */
  selectSection: (id: string | null, name?: string, breadcrumbs?: BreadcrumbItem[]) => void

  // Состояние формы
  formData: LoadingFormData
  setFormField: <K extends keyof LoadingFormData>(field: K, value: LoadingFormData[K]) => void
  errors: Partial<Record<keyof LoadingFormData, string>>

  // Валидация и сброс
  validateForm: () => boolean
  resetForm: () => void
  /** Проверка изменений в режиме редактирования */
  hasChanges: boolean

  // Режим смены раздела (edit и create)
  /** Включен ли режим смены этапа */
  isChangingStage: boolean
  /** Начать смену этапа */
  startChangingStage: () => void
  /** Отменить смену этапа */
  cancelChangingStage: () => void
}

/**
 * Функция для получения даты через N дней от сегодня (в часовом поясе Минска)
 */
function getDateInDays(daysFromNow: number): string {
  return formatMinskDate(addDays(new Date(), daysFromNow))
}

/**
 * Получение дефолтной формы с предзаполненными датами
 */
function getDefaultFormData(): LoadingFormData {
  return {
    employeeId: '',
    employeeIds: [],
    startDate: getDateInDays(0), // Сегодня
    endDate: getDateInDays(7), // Через неделю
    rate: 1.0,
    comment: '',
    decompositionStageId: '', // Опциональный этап
  }
}

export function useLoadingModal(options: UseLoadingModalOptions): UseLoadingModalResult {
  const { mode, initialSectionId, initialEmployeeId, initialLoading, initialFormValues } = options

  // Состояние навигации
  const [projectMode, setProjectMode] = useState<'my' | 'all'>('my')
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(
    initialSectionId ?? null
  )
  const [selectedSectionName, setSelectedSectionName] = useState<string | null>(null)
  const [selectedBreadcrumbs, setSelectedBreadcrumbs] = useState<BreadcrumbItem[] | null>(null)

  // Состояние для режима смены этапа
  const [isChangingStage, setIsChangingStage] = useState(false)
  const [originalSectionId, setOriginalSectionId] = useState<string | null>(initialSectionId ?? null)
  const [originalSectionName, setOriginalSectionName] = useState<string | null>(null)
  const [originalBreadcrumbs, setOriginalBreadcrumbs] = useState<BreadcrumbItem[] | null>(null)

  // Состояние формы - предзаполняем из initialLoading если режим edit, иначе дефолтные значения
  const [formData, setFormData] = useState<LoadingFormData>(() => {
    if (mode === 'edit' && initialLoading) {
      // Конвертируем даты в строки формата YYYY-MM-DD
      const startDate = typeof initialLoading.start_date === 'string'
        ? initialLoading.start_date
        : formatMinskDate(new Date(initialLoading.start_date))
      const endDate = typeof initialLoading.end_date === 'string'
        ? initialLoading.end_date
        : formatMinskDate(new Date(initialLoading.end_date))

      const initialFormData = {
        employeeId: initialLoading.employee_id,
        employeeIds: [initialLoading.employee_id],
        startDate,
        endDate,
        rate: initialLoading.rate,
        comment: initialLoading.comment ?? '',
        decompositionStageId: '', // Будет установлено в LoadingModalNew на основе breadcrumbs
      }
      return initialFormData
    }
    // Режим создания - предзаполняем даты, ставку и employeeId если есть
    const defaultForm = getDefaultFormData()
    if (initialEmployeeId) {
      defaultForm.employeeId = initialEmployeeId
      defaultForm.employeeIds = [initialEmployeeId]
    }
    // Применяем предзаполненные значения (для копирования загрузки)
    if (initialFormValues) {
      if (initialFormValues.rate !== undefined) defaultForm.rate = initialFormValues.rate
      if (initialFormValues.startDate !== undefined) defaultForm.startDate = initialFormValues.startDate
      if (initialFormValues.endDate !== undefined) defaultForm.endDate = initialFormValues.endDate
      if (initialFormValues.comment !== undefined) defaultForm.comment = initialFormValues.comment
    }
    return defaultForm
  })

  const [errors, setErrors] = useState<Partial<Record<keyof LoadingFormData, string>>>({})

  // Выбор раздела
  const selectSection = useCallback((id: string | null, name?: string, breadcrumbs?: BreadcrumbItem[]) => {
    setSelectedSectionId(id)
    setSelectedSectionName(name ?? null)
    setSelectedBreadcrumbs(breadcrumbs ?? null)

    // Если идет смена этапа и выбран новый этап - выключаем режим смены
    if (isChangingStage && id) {
      setIsChangingStage(false)
      // Обновляем оригинальные значения
      setOriginalSectionId(id)
      setOriginalSectionName(name ?? null)
      setOriginalBreadcrumbs(breadcrumbs ?? null)
      // Сбрасываем этап декомпозиции, так как он специфичен для конкретного раздела
      setFormData((prev) => ({ ...prev, decompositionStageId: '' }))
    }
  }, [isChangingStage])

  // Обновление одного поля формы
  const setFormField = useCallback(
    <K extends keyof LoadingFormData>(field: K, value: LoadingFormData[K]) => {
      setFormData((prev) => ({ ...prev, [field]: value }))
      // Очистить ошибку для этого поля
      setErrors((prev) => ({ ...prev, [field]: undefined }))
    },
    []
  )

  // Валидация формы
  const validateForm = useCallback((): boolean => {
    const newErrors: Partial<Record<keyof LoadingFormData, string>> = {}

    if (mode === 'create') {
      if (formData.employeeIds.length === 0) {
        newErrors.employeeId = 'Выберите хотя бы одного сотрудника'
      }
    } else if (!formData.employeeId.trim()) {
      newErrors.employeeId = 'Выберите сотрудника'
    }

    if (!formData.startDate.trim()) {
      newErrors.startDate = 'Укажите дату начала'
    } else {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/
      if (!dateRegex.test(formData.startDate)) {
        newErrors.startDate = 'Неверный формат даты (YYYY-MM-DD)'
      }
    }

    if (!formData.endDate.trim()) {
      newErrors.endDate = 'Укажите дату окончания'
    } else {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/
      if (!dateRegex.test(formData.endDate)) {
        newErrors.endDate = 'Неверный формат даты (YYYY-MM-DD)'
      } else if (
        formData.startDate &&
        new Date(formData.startDate) > new Date(formData.endDate)
      ) {
        newErrors.endDate = 'Дата окончания не может быть раньше даты начала'
      }
    }

    if (formData.rate < 0.01 || formData.rate > 10.0) {
      newErrors.rate = 'Ставка должна быть от 0.01 до 2.0'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }, [formData])

  // Сброс формы
  const resetForm = useCallback(() => {
    setFormData(getDefaultFormData())
    setErrors({})
    setSelectedSectionId(null)
    setSelectedSectionName(null)
    setSelectedBreadcrumbs(null)
  }, [])

  // rerender-derived-state: useMemo вместо useCallback — мемоизируем результат, а не функцию
  const hasChanges = useMemo((): boolean => {
    if (mode === 'create') {
      return true // В режиме создания кнопка всегда доступна (если валидация проходит)
    }

    if (!initialLoading) {
      return true // Если нет исходной загрузки, считаем что есть изменения
    }

    // Проверяем изменение раздела/этапа
    // Итоговый stageId = decompositionStageId (если выбран) || selectedSectionId (раздел)
    const currentStageId = formData.decompositionStageId || selectedSectionId
    const sectionChanged = currentStageId !== initialLoading.section_id

    // Нормализуем даты из initialLoading к формату YYYY-MM-DD для корректного сравнения
    const initialStartDate = typeof initialLoading.start_date === 'string'
      ? initialLoading.start_date
      : formatMinskDate(new Date(initialLoading.start_date))
    const initialEndDate = typeof initialLoading.end_date === 'string'
      ? initialLoading.end_date
      : formatMinskDate(new Date(initialLoading.end_date))

    // Сравниваем текущие значения с исходными
    // Для rate используем сравнение с допуском для чисел с плавающей точкой
    const rateChanged = Math.abs(formData.rate - initialLoading.rate) >= 0.001

    return (
      sectionChanged ||
      formData.employeeId !== initialLoading.employee_id ||
      formData.startDate !== initialStartDate ||
      formData.endDate !== initialEndDate ||
      rateChanged ||
      formData.comment !== (initialLoading.comment ?? '')
    )
  }, [mode, formData, initialLoading, selectedSectionId])

  // Начать смену этапа
  const startChangingStage = useCallback(() => {
    setIsChangingStage(true)
    // Сохраняем текущие значения на случай отмены
    setOriginalSectionId(selectedSectionId)
    setOriginalSectionName(selectedSectionName)
    setOriginalBreadcrumbs(selectedBreadcrumbs)
  }, [selectedSectionId, selectedSectionName, selectedBreadcrumbs])

  // Отменить смену этапа
  const cancelChangingStage = useCallback(() => {
    setIsChangingStage(false)
    // Восстанавливаем оригинальные значения
    setSelectedSectionId(originalSectionId)
    setSelectedSectionName(originalSectionName)
    setSelectedBreadcrumbs(originalBreadcrumbs)
  }, [originalSectionId, originalSectionName, originalBreadcrumbs])

  return {
    projectMode,
    setProjectMode,
    selectedSectionId,
    selectedSectionName,
    selectedBreadcrumbs,
    selectSection,
    formData,
    setFormField,
    errors,
    validateForm,
    resetForm,
    hasChanges,
    isChangingStage,
    startChangingStage,
    cancelChangingStage,
  }
}

'use client'

/**
 * Loading Modal 2 - Комбинированный hook для управления состоянием модалки
 *
 * Объединяет:
 * - Состояние левой панели (выбранный проект, режим фильтра)
 * - Состояние правой панели (выбранный раздел, данные формы)
 * - Режим редактирования vs создания
 * - Валидация формы
 */

import { useState, useCallback } from 'react'

/**
 * Breadcrumb item для отображения пути
 */
export interface BreadcrumbItem {
  id: string
  name: string
  type: 'project' | 'object' | 'section' | 'decomposition_stage'
}

export interface LoadingFormData {
  /** ID сотрудника */
  employeeId: string
  /** Дата начала (YYYY-MM-DD) */
  startDate: string
  /** Дата окончания (YYYY-MM-DD) */
  endDate: string
  /** Ставка загрузки (0.01 - 1.0) */
  rate: number
  /** Комментарий */
  comment: string
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
}

/**
 * Функция для получения даты в формате YYYY-MM-DD
 */
function formatDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Функция для получения даты через N дней от сегодня
 */
function getDateInDays(daysFromNow: number): string {
  const date = new Date()
  date.setDate(date.getDate() + daysFromNow)
  return formatDate(date)
}

/**
 * Получение дефолтной формы с предзаполненными датами
 */
function getDefaultFormData(): LoadingFormData {
  return {
    employeeId: '',
    startDate: getDateInDays(0), // Сегодня
    endDate: getDateInDays(7), // Через неделю
    rate: 1.0,
    comment: '',
  }
}

export function useLoadingModal(options: UseLoadingModalOptions): UseLoadingModalResult {
  const { mode, initialSectionId, initialEmployeeId, initialLoading } = options

  // Состояние навигации
  const [projectMode, setProjectMode] = useState<'my' | 'all'>('my')
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(
    initialSectionId ?? null
  )
  const [selectedSectionName, setSelectedSectionName] = useState<string | null>(null)
  const [selectedBreadcrumbs, setSelectedBreadcrumbs] = useState<BreadcrumbItem[] | null>(null)

  // Состояние формы - предзаполняем из initialLoading если режим edit, иначе дефолтные значения
  const [formData, setFormData] = useState<LoadingFormData>(() => {
    if (mode === 'edit' && initialLoading) {
      return {
        employeeId: initialLoading.employee_id,
        startDate: initialLoading.start_date,
        endDate: initialLoading.end_date,
        rate: initialLoading.rate,
        comment: initialLoading.comment ?? '',
      }
    }
    // Режим создания - предзаполняем даты, ставку и employeeId если есть
    const defaultForm = getDefaultFormData()
    if (initialEmployeeId) {
      defaultForm.employeeId = initialEmployeeId
    }
    return defaultForm
  })

  const [errors, setErrors] = useState<Partial<Record<keyof LoadingFormData, string>>>({})

  // Выбор раздела
  const selectSection = useCallback((id: string | null, name?: string, breadcrumbs?: BreadcrumbItem[]) => {
    setSelectedSectionId(id)
    setSelectedSectionName(name ?? null)
    setSelectedBreadcrumbs(breadcrumbs ?? null)
  }, [])

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

    if (!formData.employeeId.trim()) {
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

    if (formData.rate < 0.01 || formData.rate > 1.0) {
      newErrors.rate = 'Ставка должна быть от 0.01 до 1.0'
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

  // Проверка изменений в режиме редактирования
  const hasChanges = useCallback((): boolean => {
    if (mode === 'create') {
      return true // В режиме создания кнопка всегда доступна (если валидация проходит)
    }

    if (!initialLoading) {
      return true // Если нет исходной загрузки, считаем что есть изменения
    }

    // Сравниваем текущие значения с исходными
    return (
      formData.employeeId !== initialLoading.employee_id ||
      formData.startDate !== initialLoading.start_date ||
      formData.endDate !== initialLoading.end_date ||
      formData.rate !== initialLoading.rate ||
      formData.comment !== (initialLoading.comment ?? '')
    )
  }, [mode, formData, initialLoading])

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
    hasChanges: hasChanges(),
  }
}

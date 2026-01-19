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
import type { LoadingModal2CreateData, LoadingModal2EditData } from '../types'

export interface LoadingFormData {
  /** ID этапа декомпозиции */
  stageId: string
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

export interface UseLoadingModalOptions {
  /** Режим модалки */
  mode: 'create' | 'edit'
  /** Данные для создания */
  createData?: LoadingModal2CreateData
  /** Данные для редактирования */
  editData?: LoadingModal2EditData
  /** ID текущего пользователя */
  userId: string
}

export interface UseLoadingModalResult {
  // Режим модалки
  mode: 'create' | 'edit'

  // Состояние левой панели (навигация по проектам)
  projectsMode: 'my' | 'all'
  setProjectsMode: (mode: 'my' | 'all') => void
  selectedProjectId: string | null
  setSelectedProjectId: (id: string | null) => void
  selectedSectionId: string | null
  setSelectedSectionId: (id: string | null) => void

  // Состояние правой панели (форма)
  formData: LoadingFormData
  setFormData: (data: LoadingFormData) => void
  updateFormField: <K extends keyof LoadingFormData>(
    field: K,
    value: LoadingFormData[K]
  ) => void

  // Валидация
  errors: Partial<Record<keyof LoadingFormData, string>>
  validate: () => boolean

  // Сброс формы
  resetForm: () => void
}

const EMPTY_FORM: LoadingFormData = {
  stageId: '',
  employeeId: '',
  startDate: '',
  endDate: '',
  rate: 1.0,
  comment: '',
}

export function useLoadingModal(options: UseLoadingModalOptions): UseLoadingModalResult {
  const { mode, createData, editData, userId } = options

  // Левая панель (навигация)
  const [projectsMode, setProjectsMode] = useState<'my' | 'all'>('my')
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    createData?.projectId || null
  )
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(
    editData?.sectionId || null
  )

  // Правая панель (форма)
  const [formData, setFormData] = useState<LoadingFormData>({
    ...EMPTY_FORM,
    stageId: createData?.stageId || '',
    employeeId: createData?.employeeId || '',
  })

  const [errors, setErrors] = useState<Partial<Record<keyof LoadingFormData, string>>>({})

  // Обновление одного поля формы
  const updateFormField = useCallback(
    <K extends keyof LoadingFormData>(field: K, value: LoadingFormData[K]) => {
      setFormData((prev) => ({ ...prev, [field]: value }))
      // Очистить ошибку для этого поля
      setErrors((prev) => ({ ...prev, [field]: undefined }))
    },
    []
  )

  // Валидация формы
  const validate = useCallback((): boolean => {
    const newErrors: Partial<Record<keyof LoadingFormData, string>> = {}

    if (!formData.stageId.trim()) {
      newErrors.stageId = 'Выберите этап декомпозиции'
    }

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
    setFormData(EMPTY_FORM)
    setErrors({})
    setSelectedProjectId(null)
    setSelectedSectionId(null)
  }, [])

  return {
    mode,
    projectsMode,
    setProjectsMode,
    selectedProjectId,
    setSelectedProjectId,
    selectedSectionId,
    setSelectedSectionId,
    formData,
    setFormData,
    updateFormField,
    errors,
    validate,
    resetForm,
  }
}

export type { LoadingFormData }

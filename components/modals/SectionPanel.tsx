"use client"

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { X, Loader2, Calendar, User, Building, Package, Edit3, Check, AlertTriangle, ChevronDown, Trash2 } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { createClient } from '@/utils/supabase/client'
import { useUiStore } from '@/stores/useUiStore'
import { useProjectsStore } from '@/modules/projects/store'
import { CommentsPanel } from '@/modules/comments/components/CommentsPanel'
import SectionReportsTab from '@/modules/projects/components/SectionReportsTab'
import SectionLoadingsTab from '@/modules/projects/components/SectionLoadingsTab'
import SectionTasksPreview from '@/modules/projects/components/SectionTasksPreview'
import { DateRangePicker, type DateRange } from '@/modules/projects/components/DateRangePicker'
import { DeleteSectionModal } from '@/modules/projects/components/DeleteSectionModal'
import SectionDecomposition2Tab from '@/modules/decomposition2/components/SectionDecomposition2Tab'

interface SectionPanelProps {
  isOpen: boolean
  onClose: () => void
  sectionId: string
  initialTab?: 'overview' | 'details' | 'comments' | 'decomposition' | 'tasks' | 'reports' | 'loadings'
  statuses: Array<{id: string, name: string, color: string, description?: string}>
}

interface SectionData {
  section_id: string
  section_name: string
  section_description: string | null
  section_responsible: string | null
  section_start_date: string | null
  section_end_date: string | null
  section_object_id: string
  section_created: string
  section_updated: string
  section_status_id: string | null
  responsible_name?: string | null
  responsible_avatar?: string
  object_name?: string
  object_id?: string
  stage_name?: string
  stage_id?: string
  project_name?: string
  project_id?: string
  manager_name?: string | null
  status_name?: string | null
  status_color?: string | null
}

type HierarchyData = {
  object_name: string | null
  stage_name?: string | null
  project_name?: string | null
  manager_name?: string | null
  project_manager_name?: string | null
}

interface Profile {
  user_id: string
  first_name: string
  last_name: string
  email: string
}

const supabase = createClient()

export function SectionPanel({ isOpen, onClose, sectionId, initialTab = 'overview', statuses }: SectionPanelProps) {
  // initialTab теперь приходит уже готовый: 'comments' при навигации из уведомлений, иначе 'overview'
  const [sectionData, setSectionData] = useState<SectionData | null>(null)
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'comments' | 'decomposition2' | 'tasks' | 'reports' | 'loadings'>(
    initialTab === 'details' ? 'overview' : (initialTab === 'decomposition' ? 'decomposition2' : initialTab)
  )
  const initializedRef = useRef(false)

  // Состояние для inline редактирования отдельных полей
  const [editingField, setEditingField] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<Partial<SectionData>>({})
  const [savingField, setSavingField] = useState<string | null>(null)
  const [searchResponsible, setSearchResponsible] = useState('')
  const [showResponsibleDropdown, setShowResponsibleDropdown] = useState(false)

  // Состояние для выбора статуса
  const [showStatusDropdown, setShowStatusDropdown] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(false)

  // Состояние для модалки удаления
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  const router = useRouter()
  const { setNotification } = useUiStore()
  const {
    updateSectionStatus: updateSectionStatusInStore,
    updateSectionResponsible: updateSectionResponsibleInStore,
    focusProject,
    focusStage,
    focusObject
  } = useProjectsStore()

  // useSectionStatuses хук уже автоматически обновляется при всех событиях статусов
  // Убираем дублирующие обработчики событий

  // Функции для навигации к проекту/стадии/объекту
  const navigateToProject = () => {
    if (!sectionData?.project_id) return

    onClose() // Закрываем модальное окно
    focusProject(sectionData.project_id) // Фокусируем проект в дереве

    // Переходим на страницу проектов если мы не на ней
    if (typeof window !== 'undefined' && !window.location.pathname.includes('/dashboard/projects')) {
      router.push('/dashboard/projects')
    }
  }

  const navigateToStage = () => {
    if (!sectionData?.stage_id) return

    onClose() // Закрываем модальное окно
    focusStage(sectionData.stage_id) // Фокусируем стадию в дереве

    // Переходим на страницу проектов если мы не на ней
    if (typeof window !== 'undefined' && !window.location.pathname.includes('/dashboard/projects')) {
      router.push('/dashboard/projects')
    }
  }

  const navigateToObject = () => {
    if (!sectionData?.object_id) return

    onClose() // Закрываем модальное окно
    focusObject(sectionData.object_id) // Фокусируем объект в дереве

    // Переходим на страницу проектов если мы не на ней
    if (typeof window !== 'undefined' && !window.location.pathname.includes('/dashboard/projects')) {
      router.push('/dashboard/projects')
    }
  }

  const loadSectionData = useCallback(async () => {
    setLoading(true)
    try {
      // Загружаем основные данные раздела с информацией о статусе
      const { data: sectionData, error: sectionError } = await supabase
        .from('sections')
        .select(`
          *,
          section_statuses:section_status_id (
            id,
            name,
            color,
            description
          )
        `)
        .eq('section_id', sectionId)
        .single()

      if (sectionError) throw sectionError

      // Загружаем информацию об ответственном если он назначен
      let responsibleName: string | null = null
      let responsibleAvatar: string | null = null
      if (sectionData.section_responsible) {
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('first_name, last_name, email, avatar_url')
          .eq('user_id', sectionData.section_responsible)
          .single()

        if (!profileError && profileData) {
          responsibleName = `${profileData.first_name} ${profileData.last_name}`.trim() || profileData.email
          responsibleAvatar = (profileData as { avatar_url?: string }).avatar_url || null
        }
      }

      // Загружаем иерархию проекта
      console.log('Загружаем иерархию для раздела:', sectionId)
      let hierarchyData = null

      // Сначала пробуем загрузить через представление
      const { data: viewData, error: viewError } = await supabase
        .from('view_section_hierarchy')
        .select('object_id, object_name, stage_id, stage_name, project_id, project_name, project_manager_name:manager_name')
        .eq('section_id', sectionId)
        .single()

      if (viewData && !viewError) {
        hierarchyData = viewData
        console.log('Иерархия загружена через представление:', hierarchyData)
      } else {
        console.log('Представление не работает, загружаем через таблицы:', viewError)

        // Загружаем иерархию через обычные таблицы
        try {
          console.log('Загружаем объект для section_object_id:', sectionData.section_object_id)

          // Получаем данные объекта
          const { data: objectData, error: objectError } = await supabase
            .from('objects')
            .select('object_id, object_name, object_stage_id')
            .eq('object_id', sectionData.section_object_id)
            .single()

          console.log('Результат загрузки объекта:', { objectData, objectError })

          if (objectError) {
            console.error('Ошибка загрузки объекта:', objectError)
            throw objectError
          }

          if (!objectData) {
            console.error('Объект не найден')
            throw new Error('Объект не найден')
          }

          console.log('Загружаем стадию для object_stage_id:', objectData.object_stage_id)

          // Получаем данные стадии
          const { data: stageData, error: stageError } = await supabase
            .from('stages')
            .select('stage_id, stage_name, stage_project_id')
            .eq('stage_id', objectData.object_stage_id)
            .single()

          console.log('Результат загрузки стадии:', { stageData, stageError })

          if (stageError) {
            console.error('Ошибка загрузки стадии:', stageError)
            throw stageError
          }

          if (!stageData) {
            console.error('Стадия не найдена')
            throw new Error('Стадия не найдена')
          }

          console.log('Загружаем проект для stage_project_id:', stageData.stage_project_id)

          // Получаем данные проекта
          const { data: projectData, error: projectError } = await supabase
            .from('projects')
            .select('project_id, project_name, project_manager')
            .eq('project_id', stageData.stage_project_id)
            .single()

          console.log('Результат загрузки проекта:', { projectData, projectError })

          if (projectError) {
            console.error('Ошибка загрузки проекта:', projectError)
            throw projectError
          }

          if (!projectData) {
            console.error('Проект не найден')
            throw new Error('Проект не найден')
          }

          // Получаем данные менеджера (если есть)
          let managerName = null
          if (projectData.project_manager) {
            console.log('Загружаем менеджера для project_manager:', projectData.project_manager)

            const { data: managerData, error: managerError } = await supabase
              .from('profiles')
              .select('first_name, last_name, email')
              .eq('user_id', projectData.project_manager)
              .single()

            console.log('Результат загрузки менеджера:', { managerData, managerError })

            if (!managerError && managerData) {
              managerName = `${managerData.first_name} ${managerData.last_name}`.trim() || managerData.email
            }
          }

          hierarchyData = {
            object_id: objectData.object_id,
            object_name: objectData.object_name,
            stage_id: stageData.stage_id,
            stage_name: stageData.stage_name,
            project_id: projectData.project_id,
            project_name: projectData.project_name,
            manager_name: managerName
          }

          console.log('Иерархия успешно загружена через таблицы:', hierarchyData)
        } catch (error) {
          console.error('=== ОШИБКА ЗАГРУЗКИ ИЕРАРХИИ ЧЕРЕЗ ТАБЛИЦЫ ===')
          console.error('Полная ошибка:', error)
          console.error('Тип ошибки:', typeof error)
          console.error('JSON ошибки:', JSON.stringify(error, null, 2))

          // Устанавливаем пустые значения, чтобы интерфейс не сломался
          hierarchyData = {
            object_id: undefined,
            object_name: 'Не удалось загрузить',
            stage_id: undefined,
            stage_name: 'Не удалось загрузить',
            project_id: undefined,
            project_name: 'Не удалось загрузить',
            manager_name: 'Не удалось загрузить'
          }
        }
      }

      // Приведение типов и формирование итоговых данных
      const hierarchy = hierarchyData as HierarchyData | null
      // Формируем итоговые данные
      const formattedData = {
        ...sectionData,
        responsible_name: responsibleName,
        object_name: hierarchyData?.object_name || null,
        stage_name: hierarchy?.stage_name || null,
        project_name: hierarchy?.project_name || null,
        manager_name: hierarchy?.manager_name ?? hierarchy?.project_manager_name ?? null,
        status_name: sectionData.section_statuses?.name || null,
        status_color: sectionData.section_statuses?.color || null,
        responsible_avatar: responsibleAvatar
      }

      console.log('Итоговые данные раздела:', formattedData)

      setSectionData(formattedData)
    } catch (error) {
      console.error('Ошибка загрузки данных раздела:', error)
      setNotification('Ошибка загрузки данных раздела')
    } finally {
      setLoading(false)
    }
  }, [sectionId, setNotification])

  const loadProfiles = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, email')
        .order('first_name')

      if (error) throw error
      setProfiles(data || [])
    } catch (error) {
      console.error('Ошибка загрузки профилей:', error)
    }
  }, [])

  useEffect(() => {
    if (isOpen && sectionId) {
      loadSectionData()
      loadProfiles()
    }
  }, [isOpen, sectionId, loadSectionData, loadProfiles])

  // Устанавливаем активную вкладку только при первой инициализации
  useEffect(() => {
    if (isOpen && !initializedRef.current) {
      setActiveTab(initialTab === 'details' ? 'overview' : (initialTab === 'decomposition' ? 'decomposition2' : initialTab))
      initializedRef.current = true
    }
  }, [isOpen, initialTab])

  useEffect(() => {
    if (!isOpen) {
      setEditingField(null)
      setEditValues({})
      setSectionData(null)
      setSavingField(null)
      setShowStatusDropdown(false)
      setUpdatingStatus(false)
      setShowDeleteModal(false)
      initializedRef.current = false // Сбрасываем флаг инициализации
    }
  }, [isOpen])

  const updateSectionStatus = async (statusId: string | null): Promise<void> => {
    if (!sectionData) return
    
    setUpdatingStatus(true)
    try {
      const { error } = await supabase
        .from('sections')
        .update({ section_status_id: statusId })
        .eq('section_id', sectionId)

      if (error) throw error

      // Обновляем локальные данные
      const updatedStatus = statuses.find(s => s.id === statusId)
      setSectionData({
        ...sectionData,
        section_status_id: statusId,
        status_name: updatedStatus?.name || null,
        status_color: updatedStatus?.color || null
      })

      // Обновляем store для синхронизации с деревом проектов
      updateSectionStatusInStore(sectionId, {
        statusId: statusId,
        statusName: updatedStatus?.name || null,
        statusColor: updatedStatus?.color || null
      })

      
      // Создаем событие для уведомления других компонентов об изменении
      window.dispatchEvent(new CustomEvent('sectionPanel:statusUpdated', {
        detail: {
          sectionId,
          statusId: statusId,
          statusName: updatedStatus?.name || null,
          statusColor: updatedStatus?.color || null
        }
      }))
    } catch (error) {
      console.error('Ошибка обновления статуса:', error)
      setNotification('Ошибка обновления статуса')
    } finally {
      setUpdatingStatus(false)
      setShowStatusDropdown(false)
    }
  }

  const handleFieldEdit = (fieldName: string) => {
    setEditingField(fieldName)
    setEditValues({
      ...editValues,
      [fieldName]: sectionData?.[fieldName as keyof SectionData] || ''
    })
  }

  const handleFieldSave = async (fieldName: string) => {
    if (!sectionData) return
    
    const fieldValue = editValues[fieldName as keyof SectionData]
    setSavingField(fieldName)
    
    try {
      const { error } = await supabase
        .from('sections')
        .update({ [fieldName]: fieldValue })
        .eq('section_id', sectionId)

      if (error) throw error

      setSectionData({
        ...sectionData,
        [fieldName]: fieldValue
      })
      
      setEditingField(null)
      setNotification('Поле успешно обновлено')
    } catch (error) {
      console.error('Ошибка сохранения:', error)
      setNotification('Ошибка сохранения изменений')
    } finally {
      setSavingField(null)
    }
  }

  const handleFieldCancel = () => {
    setEditingField(null)
    setEditValues({})
    setSearchResponsible('')
    setShowResponsibleDropdown(false)
  }

  // удаление выполняется через DeleteSectionModal

  const handleDeleteSuccess = () => {
    setShowDeleteModal(false)
    onClose()
  }

  const getProfileName = (profile: Profile) => {
    return `${profile.first_name} ${profile.last_name}`.trim() || profile.email
  }

  const formatDate = (date: string | null | undefined) => {
    if (!date) return 'Не указана'
    try {
      return new Date(date).toLocaleDateString('ru-RU')
    } catch {
      return 'Некорректная дата'
    }
  }

  const formatDateISO = (d: Date) => {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  // Редактирование диапазона дат (как в отпускном календаре, но без событий)
  const [isEditingDates, setIsEditingDates] = useState(false)
  const currentRange: DateRange = {
    from: sectionData?.section_start_date ? new Date(sectionData.section_start_date) : null,
    to: sectionData?.section_end_date ? new Date(sectionData.section_end_date) : null,
  }

  const [pendingRange, setPendingRange] = useState<DateRange | null>(null)

  const handleDatesChange = async (range: DateRange) => {
    setPendingRange(range)

    // Ничего не выбрано — ничего не делаем
    if (!range.from && !range.to) return

    setSavingField('section_dates')
    try {
      const startStr = range.from ? formatDateISO(range.from) : null
      const endStr = range.to ? formatDateISO(range.to) : null

      const { error } = await supabase
        .from('sections')
        .update({ section_start_date: startStr, section_end_date: endStr })
        .eq('section_id', sectionId)

      if (error) throw error

      setSectionData(prev => prev ? {
        ...prev,
        section_start_date: startStr,
        section_end_date: endStr,
      } : null)

      setNotification('Сроки раздела обновлены')
      setIsEditingDates(false)
    } catch (err) {
      console.error('Ошибка сохранения дат раздела:', err)
      setNotification('Ошибка сохранения сроков')
    } finally {
      setSavingField(null)
    }
  }

  const renderEditableField = (
    fieldName: keyof SectionData,
    label: string,
    value: string | null | undefined,
    type: 'text' | 'textarea' | 'date' = 'text'
  ) => {
    const isEditing = editingField === fieldName
    const isSaving = savingField === fieldName

    return (
      <div>
        <label className="block text-sm font-medium mb-2 dark:text-slate-300 text-slate-700">
          {label}
        </label>
        {isEditing ? (
          <div className="space-y-3">
            {type === 'textarea' ? (
              <textarea
                value={editValues[fieldName] || ''}
                onChange={(e) => setEditValues({ ...editValues, [fieldName]: e.target.value })}
                className="w-full p-3 border rounded-lg dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 text-slate-900 bg-white border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={4}
                placeholder={`Введите ${label.toLowerCase()}`}
                disabled={isSaving}
              />
            ) : (
              <input
                type="text"
                value={editValues[fieldName] || ''}
                onChange={(e) => setEditValues({ ...editValues, [fieldName]: e.target.value })}
                className="w-full p-3 border rounded-lg dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 text-slate-900 bg-white border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder={`Введите ${label.toLowerCase()}`}
                disabled={isSaving}
              />
            )}

            {/* Кнопки управления */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleFieldSave(fieldName)}
                disabled={isSaving}
                className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 flex items-center gap-1"
              >
                {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                Сохранить
              </button>
              <button
                onClick={handleFieldCancel}
                disabled={isSaving}
                className="px-3 py-1 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
              >
                Отмена
              </button>
            </div>
          </div>
        ) : (
          <div
            className="group cursor-pointer p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            onClick={() => handleFieldEdit(fieldName)}
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                {type === 'date' ? (
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-slate-500" />
                    <span className="dark:text-slate-300 text-slate-600">
                      {formatDate(value)}
                    </span>
                  </div>
                ) : (
                  <span className={`dark:text-slate-300 text-slate-600 ${fieldName === 'section_name' ? 'text-lg font-semibold dark:text-slate-200 text-slate-800' : ''}`}>
                    {value || (type === 'textarea' ? 'Описание не указано' : 'Не указано')}
                  </span>
                )}
              </div>
              <Edit3 className="h-3 w-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>
        )}
      </div>
    )
  }

  if (!isOpen) return null

  return (
    <>
      <div 
        className="fixed bg-black bg-opacity-50 z-40"
        onClick={onClose}
        style={{
          position: 'fixed',
          top: '0px',
          left: '0px',
          right: '0px',
          bottom: '0px',
          width: '100vw',
          height: '100vh',
          margin: '0px',
          padding: '0px'
        }}
      />

      {/* Центрированное модальное окно, шире прежнего */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
        style={{ position: 'fixed', top: '0px', left: '0px', right: '0px', bottom: '0px', margin: '0px', padding: '16px' }}
      >
        <div
          className="w-full max-w-[1400px] h-[90vh] bg-white dark:bg-slate-900 shadow-2xl border border-gray-200 dark:border-slate-700 rounded-none flex flex-col overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
        {/* Заголовок прилегает к верху */}
        <div 
          className="flex items-start justify-between px-6 pt-5 pb-4 border-b dark:border-slate-700 bg-white dark:bg-slate-900"
          style={{ 
            paddingTop: '16px',
            margin: '0px'
          }}
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 min-w-0">
              {sectionData?.responsible_name && (
                <div className="flex-shrink-0" title={sectionData.responsible_name || undefined}>
                  <Avatar className="h-7 w-7">
                    <AvatarImage src={sectionData.responsible_avatar || undefined} alt={sectionData.responsible_name || undefined} />
                    <AvatarFallback>
                      {sectionData.responsible_name.split(' ').map(p => p[0]).slice(0,2).join('').toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </div>
              )}
              <h2 className="text-xl font-semibold dark:text-slate-200 text-slate-800 truncate" style={{ margin: '0px' }}>
                {sectionData?.section_name || 'Информация о разделе'}
              </h2>
              {sectionData && (
                <>
                  <div className="text-sm text-slate-600 dark:text-slate-400 flex items-center gap-2 translate-y-[2px]">
                    {sectionData.manager_name && (
                      <>
                        <User className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                        <span>{sectionData.manager_name}</span>
                        <span className="text-slate-400 dark:text-slate-500">/</span>
                      </>
                    )}
                    {sectionData.project_name && (
                      <>
                        <Package className="h-3 w-3 text-green-600 dark:text-green-400" />
                        <span
                          onClick={navigateToProject}
                          className="font-semibold text-slate-700 dark:text-slate-300 cursor-pointer hover:text-green-600 dark:hover:text-green-400 hover:underline transition-colors"
                          title="Перейти к проекту"
                        >
                          {sectionData.project_name}
                        </span>
                        <span className="text-slate-400 dark:text-slate-500">/</span>
                      </>
                    )}
                    {sectionData.stage_name && (
                      <>
                        <Building className="h-3 w-3 text-purple-600 dark:text-purple-400" />
                        <span
                          onClick={navigateToStage}
                          className="cursor-pointer hover:text-purple-600 dark:hover:text-purple-400 hover:underline transition-colors"
                          title="Перейти к стадии"
                        >
                          {sectionData.stage_name}
                        </span>
                        <span className="text-slate-400 dark:text-slate-500">/</span>
                      </>
                    )}
                    {sectionData.object_name && (
                      <>
                        <Package className="h-3 w-3 text-orange-600 dark:text-orange-400" />
                        <span
                          onClick={navigateToObject}
                          className="cursor-pointer hover:text-orange-600 dark:hover:text-orange-400 hover:underline transition-colors"
                          title="Перейти к объекту"
                        >
                          {sectionData.object_name}
                        </span>
                      </>
                    )}
                  </div>
                  {sectionData.status_name && (
                    <div className="flex items-center gap-2 text-sm ml-auto">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: sectionData.status_color || '#6B7280' }}
                      />
                      <span className="font-medium text-slate-700 dark:text-slate-300">{sectionData.status_name}</span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
          
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors flex-shrink-0 ml-4"
          >
            <X className="h-4 w-4 text-slate-600 dark:text-slate-400" />
          </button>
        </div>

        {/* Табы без лишних отступов */}
        <div className="px-6 py-3 border-b dark:border-slate-700 bg-white dark:bg-slate-900">
          <div className="inline-flex h-10 items-center justify-center rounded-md bg-slate-100 dark:bg-slate-800 p-1 text-slate-600 dark:text-slate-400">
            <button
              onClick={() => setActiveTab('overview')}
              className={`inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${
                activeTab === 'overview'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              Общее
            </button>
            <button
              onClick={() => setActiveTab('decomposition2')}
              className={`inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${
                activeTab === 'decomposition2'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              Декомпозиция
            </button>
            
            <button
              onClick={() => setActiveTab('tasks')}
              className={`inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${
                activeTab === 'tasks'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              Задания
            </button>
            <button
              onClick={() => setActiveTab('comments')}
              className={`inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${
                activeTab === 'comments'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              Комментарии
            </button>
            <button
              onClick={() => setActiveTab('reports')}
              className={`inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${
                activeTab === 'reports'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              Отчёты
            </button>
            <button
              onClick={() => setActiveTab('loadings')}
              className={`inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${
                activeTab === 'loadings'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              Загрузки
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            </div>
          ) : sectionData ? (
            <div className="p-6 space-y-8">
              {activeTab === 'overview' && (
                <>
                  {renderEditableField('section_name', 'Название', sectionData.section_name, 'text')}

                  {/* Компактная сетка метаданных */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Статус */}
                    <div>
                      <label className="block text-sm font-medium mb-2 dark:text-slate-300 text-slate-700">
                        Статус
                      </label>
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                          disabled={updatingStatus}
                          className="flex items-center gap-2 px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-md hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50 w-full"
                          onBlur={(e) => {
                            const relatedTarget = e.relatedTarget as HTMLElement
                            const currentTarget = e.currentTarget
                            const dropdownContainer = currentTarget.parentElement
                            if (!relatedTarget || !dropdownContainer?.contains(relatedTarget)) {
                              setShowStatusDropdown(false)
                            }
                          }}
                        >
                          {updatingStatus ? (
                            <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
                          ) : sectionData.status_name ? (
                            <>
                              <div 
                                className="w-3 h-3 rounded-full" 
                                style={{ backgroundColor: sectionData.status_color || '#6B7280' }}
                              />
                              <span className="text-sm font-medium text-gray-900 dark:text-slate-100">
                                {sectionData.status_name}
                              </span>
                            </>
                          ) : (
                            <>
                              <AlertTriangle className="w-4 h-4 text-gray-400" />
                              <span className="text-sm text-gray-500 dark:text-slate-400">
                                Без статуса
                              </span>
                            </>
                          )}
                          <ChevronDown className="w-4 h-4 text-gray-400 ml-auto" />
                        </button>

                        {showStatusDropdown && !updatingStatus && (
                          <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-md shadow-lg max-h-48 overflow-y-auto">
                            <button
                              type="button"
                              onClick={() => updateSectionStatus(null)}
                              className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-slate-600 cursor-pointer border-b dark:border-slate-600 flex items-center gap-2 focus:outline-none focus:bg-gray-100 dark:focus:bg-slate-600"
                            >
                              <AlertTriangle className="w-4 h-4 text-gray-400" />
                              <span className="text-sm text-gray-500 dark:text-slate-400">
                                Убрать статус
                              </span>
                            </button>
                            {statuses.map((status) => (
                              <button
                                key={status.id}
                                type="button"
                                onClick={() => updateSectionStatus(status.id)}
                                className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-slate-600 cursor-pointer flex items-center gap-2 focus:outline-none focus:bg-gray-100 dark:focus:bg-slate-600"
                              >
                                <div 
                                  className="w-3 h-3 rounded-full" 
                                  style={{ backgroundColor: status.color }}
                                />
                                <div>
                                  <div className="text-sm font-medium dark:text-white">
                                    {status.name}
                                  </div>
                                  {status.description && (
                                    <div className="text-xs text-gray-500 dark:text-slate-400">
                                      {status.description}
                                    </div>
                                  )}
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Ответственный */}
                    <div>
                      <label className="block text-sm font-medium mb-2 dark:text-slate-300 text-slate-700">
                        Ответственный
                      </label>
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingField('section_responsible')
                            setShowResponsibleDropdown(!showResponsibleDropdown)
                          }}
                          disabled={savingField === 'section_responsible'}
                          className="flex items-center gap-2 px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-md hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50 w-full"
                          onBlur={(e) => {
                            const relatedTarget = e.relatedTarget as HTMLElement
                            const currentTarget = e.currentTarget
                            const dropdownContainer = currentTarget.parentElement
                            if (!relatedTarget || !dropdownContainer?.contains(relatedTarget)) {
                              setTimeout(() => {
                                setShowResponsibleDropdown(false)
                                setEditingField(null)
                                setSearchResponsible('')
                              }, 200)
                            }
                          }}
                        >
                          {savingField === 'section_responsible' ? (
                            <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
                          ) : sectionData.responsible_name ? (
                            <>
                              <User className="w-4 h-4 text-emerald-600" />
                              <span className="text-sm font-medium text-gray-900 dark:text-slate-100">
                                {sectionData.responsible_name}
                              </span>
                            </>
                          ) : (
                            <>
                              <User className="w-4 h-4 text-gray-400" />
                              <span className="text-sm text-gray-500 dark:text-slate-400">
                                Не назначен
                              </span>
                            </>
                          )}
                          <ChevronDown className="w-4 h-4 text-gray-400 ml-auto" />
                        </button>

                        {showResponsibleDropdown && editingField === 'section_responsible' && (
                          <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-md shadow-lg max-h-64 overflow-y-auto">
                            {/* Поле поиска */}
                            <div className="sticky top-0 bg-white dark:bg-slate-700 p-2 border-b dark:border-slate-600">
                              <input
                                type="text"
                                value={searchResponsible}
                                onChange={(e) => setSearchResponsible(e.target.value)}
                                placeholder="Поиск..."
                                className="w-full px-2 py-1 text-sm border rounded dark:bg-slate-800 dark:border-slate-600 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                                autoFocus
                              />
                            </div>

                            {/* Опция "Не назначен" */}
                            <button
                              type="button"
                              onClick={async () => {
                                setShowResponsibleDropdown(false)
                                setEditingField(null)
                                setSearchResponsible('')

                                if (!sectionData) return
                                setSavingField('section_responsible')
                                try {
                                  const { error } = await supabase
                                    .from('sections')
                                    .update({ section_responsible: null })
                                    .eq('section_id', sectionId)

                                  if (error) throw error

                                  setSectionData({
                                    ...sectionData,
                                    section_responsible: null,
                                    responsible_name: null,
                                    responsible_avatar: undefined
                                  })

                                  updateSectionResponsibleInStore(sectionId, {
                                    responsibleName: undefined,
                                    responsibleAvatarUrl: undefined
                                  })

                                  setNotification('Ответственный снят')
                                  await loadSectionData()
                                } catch (error) {
                                  console.error('Ошибка снятия ответственного:', error)
                                  setNotification('Ошибка при снятии ответственного')
                                } finally {
                                  setSavingField(null)
                                }
                              }}
                              className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-slate-600 cursor-pointer border-b dark:border-slate-600 flex items-center gap-2 focus:outline-none focus:bg-gray-100 dark:focus:bg-slate-600"
                            >
                              <User className="w-4 h-4 text-gray-400" />
                              <span className="text-sm text-gray-500 dark:text-slate-400">
                                Не назначен
                              </span>
                            </button>

                            {/* Список сотрудников */}
                            {(searchResponsible ? profiles.filter(profile =>
                              getProfileName(profile).toLowerCase().includes(searchResponsible.toLowerCase()) ||
                              profile.email.toLowerCase().includes(searchResponsible.toLowerCase())
                            ) : profiles).map((profile) => (
                              <button
                                key={profile.user_id}
                                type="button"
                                onClick={async () => {
                                  setShowResponsibleDropdown(false)
                                  setEditingField(null)
                                  setSearchResponsible('')

                                  if (!sectionData) return
                                  setSavingField('section_responsible')
                                  try {
                                    const { error } = await supabase
                                      .from('sections')
                                      .update({ section_responsible: profile.user_id })
                                      .eq('section_id', sectionId)

                                    if (error) throw error

                                    setSectionData({
                                      ...sectionData,
                                      section_responsible: profile.user_id,
                                      responsible_name: getProfileName(profile),
                                      responsible_avatar: (profile as { avatar_url?: string }).avatar_url || undefined
                                    })

                                    updateSectionResponsibleInStore(sectionId, {
                                      responsibleName: getProfileName(profile),
                                      responsibleAvatarUrl: (profile as { avatar_url?: string }).avatar_url || undefined
                                    })

                                    setNotification('Ответственный успешно назначен')
                                    await loadSectionData()
                                  } catch (error) {
                                    console.error('Ошибка сохранения ответственного:', error)
                                    setNotification('Ошибка при назначении ответственного')
                                  } finally {
                                    setSavingField(null)
                                  }
                                }}
                                className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-slate-600 cursor-pointer focus:outline-none focus:bg-gray-100 dark:focus:bg-slate-600"
                              >
                                <div>
                                  <div className="text-sm font-medium dark:text-white">
                                    {getProfileName(profile)}
                                  </div>
                                  <div className="text-xs text-gray-500 dark:text-slate-400">
                                    {profile.email}
                                  </div>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Сроки (единый выбор периода, как в отпускном календаре) */}
                    <div className="md:col-span-2" style={{ maxWidth: '500px' }}>
                      <label className="block text-sm font-medium mb-2 dark:text-slate-300 text-slate-700">
                        Сроки
                      </label>
                      {isEditingDates ? (
                        <div className="space-y-2">
                          <DateRangePicker
                            value={pendingRange ?? currentRange}
                            onChange={handleDatesChange}
                            placeholder="Выберите период"
                            calendarWidth="500px"
                          />
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            Выберите начальную и конечную даты. Для одного дня щёлкните по дате дважды.
                          </div>
                        </div>
                      ) : (
                        <div
                          className="group cursor-pointer p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                          onClick={() => {
                            setPendingRange(currentRange)
                            setIsEditingDates(true)
                          }}
                        >
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-slate-500" />
                            <span className="dark:text-slate-300 text-slate-600">
                              {currentRange.from && currentRange.to
                                ? `${currentRange.from.toLocaleDateString('ru-RU')} - ${currentRange.to.toLocaleDateString('ru-RU')}`
                                : currentRange.from
                                ? `${currentRange.from.toLocaleDateString('ru-RU')} - …`
                                : currentRange.to
                                ? `… - ${currentRange.to.toLocaleDateString('ru-RU')}`
                                : 'Не указаны'}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Компактное описание */}
                  {(() => {
                    const isEditing = editingField === 'section_description'
                    const isSaving = savingField === 'section_description'
                    return (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="block text-sm font-medium dark:text-slate-300 text-slate-700">
                            Описание
                          </label>
                          {!isEditing && (
                            <button
                              onClick={() => {
                                setEditingField('section_description')
                                setEditValues({ ...editValues, section_description: sectionData.section_description || '' })
                              }}
                              className="text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                            >
                              Изменить
                            </button>
                          )}
                        </div>
                        {isEditing ? (
                          <div className="space-y-2">
                            <textarea
                              value={(editValues.section_description as string | undefined) || ''}
                              onChange={(e) => setEditValues({ ...editValues, section_description: e.target.value })}
                              className="w-full p-3 border rounded-lg dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 text-slate-900 bg-white border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              rows={3}
                              placeholder="Кратко опишите раздел"
                              disabled={isSaving}
                            />
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleFieldSave('section_description')}
                                disabled={isSaving}
                                className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 flex items-center gap-1"
                              >
                                {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                                Сохранить
                              </button>
                              <button
                                onClick={handleFieldCancel}
                                disabled={isSaving}
                                className="px-3 py-1 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
                              >
                                Отмена
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40 p-3">
                            {sectionData.section_description ? (
                              <p className="text-sm text-slate-700 dark:text-slate-300 line-clamp-3">
                                {sectionData.section_description}
                              </p>
                            ) : (
                              <p className="text-sm italic text-slate-500 dark:text-slate-400">
                                Описание не указано
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })()}

                  {/* Кнопка удаления раздела */}
                  <div className="pt-4 border-t border-slate-200 dark:border-slate-700 flex justify-end">
                    <button
                      onClick={() => setShowDeleteModal(true)}
                      className="px-3 py-1.5 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors flex items-center gap-1.5 border border-red-200 dark:border-red-800 text-sm"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Удалить раздел</span>
                    </button>
                  </div>
                </>
              )}



              {activeTab === 'comments' && (
                <CommentsPanel sectionId={sectionId} />
              )}
          {activeTab === 'decomposition2' && (
            <SectionDecomposition2Tab sectionId={sectionId} compact />
          )}
              
              {activeTab === 'tasks' && (
                <div>
                  <SectionTasksPreview sectionId={sectionId} />
                </div>
              )}
              {activeTab === 'reports' && (
                <SectionReportsTab sectionId={sectionId} />
              )}
              {activeTab === 'loadings' && (
                <SectionLoadingsTab sectionId={sectionId} />
              )}
            </div>
          ) : (
            <div className="text-center text-slate-500 dark:text-slate-400 py-8">
              Ошибка загрузки данных раздела
            </div>
          )}
        </div>

      </div>
      </div>

      {/* Модальное окно удаления раздела */}
      <DeleteSectionModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        sectionId={sectionId}
        sectionName={sectionData?.section_name || ''}
        onSuccess={handleDeleteSuccess}
      />
    </>
  )
} 
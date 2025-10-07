"use client"

import React, { useState, useEffect, useRef } from 'react'
import { X, Save, Trash2, Loader2, Calendar, User, Building, Package, Edit3, Check, AlertTriangle, ChevronDown } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { createClient } from '@/utils/supabase/client'
import { useUiStore } from '@/stores/useUiStore'
import { useSectionStatuses } from '@/modules/statuses-tags/statuses/hooks/useSectionStatuses'
import { useProjectsStore } from '@/modules/projects/store'
import { CommentsPanel } from '@/modules/comments/components/CommentsPanel'
import { SectionDecompositionTab } from '@/modules/projects/components/SectionDecompositionTab'
import SectionReportsTab from '@/modules/projects/components/SectionReportsTab'
import SectionLoadingsTab from '@/modules/projects/components/SectionLoadingsTab'
import SectionTasksPreview from '@/modules/projects/components/SectionTasksPreview'
import { DateRangePicker, type DateRange } from '@/modules/projects/components/DateRangePicker'

interface SectionPanelProps {
  isOpen: boolean
  onClose: () => void
  sectionId: string
  initialTab?: 'overview' | 'details' | 'comments' | 'decomposition'
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
  stage_name?: string
  project_name?: string
  manager_name?: string | null
  status_name?: string | null
  status_color?: string | null
  objects?: any
  responsible?: any
}

interface Profile {
  user_id: string
  first_name: string
  last_name: string
  email: string
}

const supabase = createClient()

export function SectionPanel({ isOpen, onClose, sectionId, initialTab = 'overview' }: SectionPanelProps) {
  // initialTab теперь приходит уже готовый: 'comments' при навигации из уведомлений, иначе 'overview'
  const [sectionData, setSectionData] = useState<SectionData | null>(null)
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'comments' | 'decomposition' | 'tasks' | 'reports' | 'loadings'>(initialTab === 'details' ? 'overview' : initialTab as any)
  const initializedRef = useRef(false)
  
  // Состояние для inline редактирования отдельных полей
  const [editingField, setEditingField] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<Partial<SectionData>>({})
  const [savingField, setSavingField] = useState<string | null>(null)
  const [searchResponsible, setSearchResponsible] = useState('')
  const [showResponsibleDropdown, setShowResponsibleDropdown] = useState(false)
  
  // Состояние для подтверждения удаления
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  
  // Состояние для выбора статуса
  const [showStatusDropdown, setShowStatusDropdown] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(false)
  
  const { setNotification } = useUiStore()
  const { statuses } = useSectionStatuses()
  const { updateSectionStatus: updateSectionStatusInStore } = useProjectsStore()

  // useSectionStatuses хук уже автоматически обновляется при всех событиях статусов
  // Убираем дублирующие обработчики событий

  useEffect(() => {
    if (isOpen && sectionId) {
      loadSectionData()
      loadProfiles()
    }
  }, [isOpen, sectionId])

  // Устанавливаем активную вкладку только при первой инициализации
  useEffect(() => {
    if (isOpen && !initializedRef.current) {
      setActiveTab((initialTab === 'details' ? 'overview' : initialTab) as any)
      initializedRef.current = true
    }
  }, [isOpen, initialTab])

  useEffect(() => {
    if (!isOpen) {
      setEditingField(null)
      setEditValues({})
      setSectionData(null)
      setSavingField(null)
      setShowDeleteConfirm(false)
      setIsDeleting(false)
      setShowStatusDropdown(false)
      setUpdatingStatus(false)
      initializedRef.current = false // Сбрасываем флаг инициализации
    }
  }, [isOpen])

  const loadSectionData = async () => {
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
          // @ts-ignore
          responsibleAvatar = (profileData as any).avatar_url || null
        }
      }

      // Загружаем иерархию проекта
      console.log('Загружаем иерархию для раздела:', sectionId)
      let hierarchyData = null
      
      // Сначала пробуем загрузить через представление
      const { data: viewData, error: viewError } = await supabase
        .from('view_section_hierarchy')
        .select('object_name, stage_name, project_name, manager_name')
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
            .select('object_name, object_stage_id')
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
            .select('stage_name, stage_project_id')
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
            .select('project_name, project_manager')
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
            object_name: objectData.object_name,
            stage_name: stageData.stage_name,
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
            object_name: 'Не удалось загрузить',
            stage_name: 'Не удалось загрузить',
            project_name: 'Не удалось загрузить',
            manager_name: 'Не удалось загрузить'
          }
        }
      }

      // Формируем итоговые данные
      const formattedData = {
        ...sectionData,
        responsible_name: responsibleName,
        object_name: hierarchyData?.object_name || null,
        stage_name: hierarchyData?.stage_name || null,
        project_name: hierarchyData?.project_name || null,
        manager_name: hierarchyData?.manager_name || null,
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
  }

  const loadProfiles = async () => {
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
  }

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

  const handleDeleteSection = async () => {
    if (!sectionData || isDeleting) return
    
    setIsDeleting(true)
    try {
      // Удаляем раздел
      const { error } = await supabase
        .from('sections')
        .delete()
        .eq('section_id', sectionId)

      if (error) throw error

      setNotification('Раздел успешно удален')
      onClose() // Закрываем модальное окно
      
      // Обновляем страницу или список проектов
      window.location.reload()
    } catch (error) {
      console.error('Ошибка удаления раздела:', error)
      setNotification('Ошибка при удалении раздела')
    } finally {
      setIsDeleting(false)
      setShowDeleteConfirm(false)
    }
  }

  const getProfileName = (profile: Profile) => {
    return `${profile.first_name} ${profile.last_name}`.trim() || profile.email
  }

  const getSelectedResponsibleName = () => {
    const selectedId = editValues.section_responsible
    if (!selectedId) return 'Не назначен'
    
    const profile = profiles.find(p => p.user_id === selectedId)
    return profile ? getProfileName(profile) : 'Не найден'
  }

  const filteredResponsible = profiles.filter(profile =>
    getProfileName(profile).toLowerCase().includes(searchResponsible.toLowerCase()) ||
    profile.email.toLowerCase().includes(searchResponsible.toLowerCase())
  )

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
    value: any,
    type: 'text' | 'textarea' | 'date' | 'responsible' = 'text'
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
            ) : type === 'responsible' ? (
              <div className="relative">
                <input
                  type="text"
                  value={searchResponsible || getSelectedResponsibleName()}
                  onChange={(e) => {
                    setSearchResponsible(e.target.value)
                    setShowResponsibleDropdown(true)
                  }}
                  onFocus={() => setShowResponsibleDropdown(true)}
                  className="w-full p-3 border rounded-lg dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 text-slate-900 bg-white border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Поиск ответственного..."
                  disabled={isSaving}
                />
                {showResponsibleDropdown && (
                  <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    <div
                      onClick={() => {
                        setEditValues({ ...editValues, [fieldName]: null })
                        setSearchResponsible('')
                        setShowResponsibleDropdown(false)
                      }}
                      className="px-3 py-2 hover:bg-gray-100 dark:hover:bg-slate-600 cursor-pointer border-b dark:border-slate-600"
                    >
                      <div className="font-medium text-gray-500 dark:text-slate-400">
                        Не назначен
                      </div>
                    </div>
                    {filteredResponsible.map((profile) => (
                      <div
                        key={profile.user_id}
                        onClick={() => {
                          setEditValues({ ...editValues, [fieldName]: profile.user_id })
                          setSearchResponsible('')
                          setShowResponsibleDropdown(false)
                        }}
                        className="px-3 py-2 hover:bg-gray-100 dark:hover:bg-slate-600 cursor-pointer"
                      >
                        <div className="font-medium dark:text-white">
                          {getProfileName(profile)}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-slate-400">
                          {profile.email}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
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
            {type !== 'responsible' && (
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
            )}
            
            {/* Индикатор состояния больше не нужен для дат, так как используется DateRangePicker */}
          </div>
        ) : (
          <div 
            className="group cursor-pointer p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            onClick={() => handleFieldEdit(fieldName)}
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                {type === 'responsible' ? (
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-slate-500" />
                    <span className="dark:text-slate-300 text-slate-600">
                      {sectionData?.responsible_name || 'Не назначен'}
                    </span>
                  </div>
                ) : type === 'date' ? (
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
        <div className="w-full max-w-[1200px] h-[90vh] bg-white dark:bg-slate-900 shadow-2xl border border-gray-200 dark:border-slate-700 rounded-none flex flex-col overflow-hidden">
        {/* Заголовок прилегает к верху */}
        <div 
          className="flex items-start justify-between px-6 pt-5 pb-4 border-b dark:border-slate-700 bg-white dark:bg-slate-900"
          style={{ 
            paddingTop: '16px',
            margin: '0px'
          }}
        >
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-semibold dark:text-slate-200 text-slate-800" style={{ margin: '0px' }}>
              {sectionData?.section_name || 'Информация о разделе'}
            </h2>
            
            {sectionData && (
              <>
                {/* Иерархия проекта */}
                <div className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                  <div className="flex items-center gap-2 flex-wrap">
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
                        <span className="font-semibold text-slate-700 dark:text-slate-300">{sectionData.project_name}</span>
                        <span className="text-slate-400 dark:text-slate-500">/</span>
                      </>
                    )}
                    {sectionData.stage_name && (
                      <>
                        <Building className="h-3 w-3 text-purple-600 dark:text-purple-400" />
                        <span>{sectionData.stage_name}</span>
                        <span className="text-slate-400 dark:text-slate-500">/</span>
                      </>
                    )}
                    {sectionData.object_name && (
                      <>
                        <Package className="h-3 w-3 text-orange-600 dark:text-orange-400" />
                        <span>{sectionData.object_name}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Ответственный */}
                {sectionData.responsible_name && (
                  <div className="mt-2 flex items-center gap-2 text-sm">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={sectionData.responsible_avatar || undefined} alt={sectionData.responsible_name || undefined} />
                      <AvatarFallback>
                        {sectionData.responsible_name.split(' ').map(p => p[0]).slice(0,2).join('').toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-slate-600 dark:text-slate-400">Ответственный:</span>
                    <span className="font-medium text-slate-700 dark:text-slate-300">{sectionData.responsible_name}</span>
                  </div>
                )}

                {/* Статус секции */}
                {sectionData.status_name && (
                  <div className="mt-2 flex items-center gap-2 text-sm">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: sectionData.status_color || '#6B7280' }}
                    />
                    <span className="text-slate-600 dark:text-slate-400">Статус:</span>
                    <span className="font-medium text-slate-700 dark:text-slate-300">{sectionData.status_name}</span>
                  </div>
                )}
              </>
            )}
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
              onClick={() => setActiveTab('decomposition')}
              className={`inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${
                activeTab === 'decomposition'
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
                      {renderEditableField('section_responsible', 'Ответственный', sectionData.section_responsible, 'responsible')}
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
                              value={(editValues as any).section_description || ''}
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
                </>
              )}

              

              {activeTab === 'comments' && (
                <CommentsPanel sectionId={sectionId} />
              )}
              {activeTab === 'decomposition' && (
                <SectionDecompositionTab sectionId={sectionId} compact />
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

        {/* Модальное окно подтверждения удаления */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
            <div className="bg-white dark:bg-slate-800 rounded-lg p-6 max-w-md mx-4 border border-red-200 dark:border-red-800">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-full">
                  <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                    Подтвердите удаление
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Это действие необратимо
                  </p>
                </div>
              </div>
              
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 rounded border border-red-200 dark:border-red-800">
                <p className="text-sm text-red-800 dark:text-red-200">
                  Вы действительно хотите удалить раздел{' '}
                  <span className="font-semibold">"{sectionData?.section_name}"</span>?
                </p>
                <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                  Все связанные данные, включая задачи и загрузки, будут удалены безвозвратно.
                </p>
              </div>

              <div className="flex items-center gap-3 justify-end">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isDeleting}
                  className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"
                >
                  Отмена
                </button>
                <button
                  onClick={handleDeleteSection}
                  disabled={isDeleting}
                  className="px-4 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Удаление...
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-3 w-3" />
                      Удалить
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      </div>
    </>
  )
} 
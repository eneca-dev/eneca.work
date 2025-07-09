"use client"

import React, { useState, useEffect } from 'react'
import { Save, Loader2, Calendar, User } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { useUiStore } from '@/stores/useUiStore'
import { Modal, ModalButton } from '@/components/modals'

interface CreateSectionModalProps {
  isOpen: boolean
  onClose: () => void
  objectId: string
  objectName: string
  projectId?: string
  onSuccess: () => void
}

interface Profile {
  user_id: string
  first_name: string
  last_name: string
  email: string
}

const supabase = createClient()

export function CreateSectionModal({ isOpen, onClose, objectId, objectName, projectId, onSuccess }: CreateSectionModalProps) {
  const [sectionName, setSectionName] = useState('')
  const [sectionDescription, setSectionDescription] = useState('')
  const [sectionResponsible, setSectionResponsible] = useState('')
  const [sectionStartDate, setSectionStartDate] = useState('')
  const [sectionEndDate, setSectionEndDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [searchResponsible, setSearchResponsible] = useState('')
  const [showResponsibleDropdown, setShowResponsibleDropdown] = useState(false)
  const [actualProjectId, setActualProjectId] = useState<string | null>(null)
  
  const { setNotification } = useUiStore()

  useEffect(() => {
    if (isOpen) {
      loadProfiles()
      loadProjectId()
    }
  }, [isOpen])

  const loadProjectId = async () => {
    if (projectId) {
      setActualProjectId(projectId)
      return
    }

    try {
      // Получаем project_id через object_id
      const { data, error } = await supabase
        .from('objects')
        .select('object_stage_id')
        .eq('object_id', objectId)
        .single()

      if (error) throw error

      if (data?.object_stage_id) {
        // Получаем project_id через stage_id
        const { data: stageData, error: stageError } = await supabase
          .from('stages')
          .select('stage_project_id')
          .eq('stage_id', data.object_stage_id)
          .single()

        if (stageError) throw stageError

        setActualProjectId(stageData?.stage_project_id || null)
      }
    } catch (error) {
      console.error('Ошибка получения project_id:', error)
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

  const getProfileName = (profile: Profile) => {
    const fullName = `${profile.first_name} ${profile.last_name}`.trim()
    return fullName || profile.email
  }

  const getSelectedResponsibleName = () => {
    if (!sectionResponsible) return ''
    const profile = profiles.find(p => p.user_id === sectionResponsible)
    return profile ? getProfileName(profile) : ''
  }

  const filteredResponsible = profiles.filter(profile =>
    getProfileName(profile).toLowerCase().includes(searchResponsible.toLowerCase()) ||
    profile.email.toLowerCase().includes(searchResponsible.toLowerCase())
  )

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    
    console.log('=== СОЗДАНИЕ РАЗДЕЛА ===')
    console.log('Параметры модального окна:', { objectId, objectName })
    console.log('Значения формы:', { 
      sectionName, 
      sectionDescription, 
      sectionResponsible, 
      sectionStartDate, 
      sectionEndDate,
      trimmedName: sectionName.trim(),
      nameLength: sectionName.trim().length 
    })
    
    if (!sectionName.trim()) {
      setNotification('Название раздела обязательно')
      return
    }

    if (!objectId) {
      setNotification('Не указан объект для создания раздела')
      return
    }

    if (!actualProjectId) {
      setNotification('Не удалось определить проект для создания раздела')
      return
    }

    setLoading(true)
    try {
      const sectionData = {
        section_name: sectionName.trim(),
        section_description: sectionDescription.trim() || null,
        section_responsible: sectionResponsible || null,
        section_start_date: sectionStartDate || null,
        section_end_date: sectionEndDate || null,
        section_object_id: objectId,
        section_project_id: actualProjectId
      }

      console.log('Отправляем данные раздела:', sectionData)

      const { data, error } = await supabase
        .from('sections')
        .insert(sectionData)
        .select()

      console.log('Результат создания раздела:', { data, error })

      if (error) throw error

      setNotification(`Раздел "${sectionName}" успешно создан`)
      onSuccess()
      handleClose()
    } catch (error) {
      console.error('=== ОШИБКА СОЗДАНИЯ РАЗДЕЛА ===')
      console.error('Полная ошибка:', error)
      console.error('Тип ошибки:', typeof error)
      console.error('JSON ошибки:', JSON.stringify(error, null, 2))
      
      let errorMessage = 'Неизвестная ошибка создания раздела'
      
      if (error && typeof error === 'object') {
        if ('message' in error && error.message) {
          errorMessage = error.message as string
        } else if ('error' in error && error.error) {
          errorMessage = error.error as string
        } else if ('details' in error && error.details) {
          errorMessage = error.details as string
        }
      } else if (typeof error === 'string') {
        errorMessage = error
      }
      
      console.error('Итоговое сообщение об ошибке:', errorMessage)
      setNotification(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setSectionName('')
    setSectionDescription('')
    setSectionResponsible('')
    setSectionStartDate('')
    setSectionEndDate('')
    setSearchResponsible('')
    setShowResponsibleDropdown(false)
    setActualProjectId(null)
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="lg">
      <Modal.Header 
        title="Создать новый раздел" 
        subtitle={`Объект: ${objectName}`}
      />
      
      <Modal.Body>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2 dark:text-slate-300 text-slate-700">
              Название раздела *
            </label>
            <input
              type="text"
              value={sectionName}
              onChange={(e) => setSectionName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent dark:bg-slate-800 dark:text-white"
              placeholder="Введите название раздела"
              disabled={loading}
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 dark:text-slate-300 text-slate-700">
              Описание
            </label>
            <textarea
              value={sectionDescription}
              onChange={(e) => setSectionDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent dark:bg-slate-800 dark:text-white"
              placeholder="Введите описание раздела (необязательно)"
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 dark:text-slate-300 text-slate-700">
              Ответственный
            </label>
            <div className="relative">
              <input
                type="text"
                value={showResponsibleDropdown ? searchResponsible : getSelectedResponsibleName()}
                onChange={(e) => {
                  setSearchResponsible(e.target.value)
                  setShowResponsibleDropdown(true)
                }}
                onFocus={() => {
                  setSearchResponsible('')
                  setShowResponsibleDropdown(true)
                }}
                onBlur={() => {
                  setTimeout(() => setShowResponsibleDropdown(false), 200)
                }}
                placeholder={getSelectedResponsibleName() || "Поиск ответственного..."}
                className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent dark:bg-slate-800 dark:text-white"
                disabled={loading}
              />
              <User className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
              {showResponsibleDropdown && (
                <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  <div
                    onClick={() => {
                      setSectionResponsible('')
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
                        setSectionResponsible(profile.user_id)
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
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2 dark:text-slate-300 text-slate-700">
                Дата начала
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={sectionStartDate}
                  onChange={(e) => setSectionStartDate(e.target.value)}
                  className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent dark:bg-slate-800 dark:text-white"
                  disabled={loading}
                />
                <Calendar className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2 dark:text-slate-300 text-slate-700">
                Дата окончания
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={sectionEndDate}
                  onChange={(e) => setSectionEndDate(e.target.value)}
                  className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent dark:bg-slate-800 dark:text-white"
                  disabled={loading}
                />
                <Calendar className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              </div>
            </div>
          </div>
        </form>
      </Modal.Body>

      <Modal.Footer>
        <ModalButton variant="cancel" onClick={handleClose} disabled={loading}>
          Отмена
        </ModalButton>
        <ModalButton 
          variant="success" 
          onClick={() => handleSubmit()}
          disabled={loading || !sectionName.trim()}
          icon={loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        >
          {loading ? 'Создание...' : 'Создать раздел'}
        </ModalButton>
      </Modal.Footer>
    </Modal>
  )
} 
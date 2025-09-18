"use client"

import React, { useState, useEffect, useRef } from 'react'
import { Save, Loader2, Trash2 } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { useUiStore } from '@/stores/useUiStore'
import { Modal, ModalButton } from '@/components/modals'
import { DeleteObjectModal } from './DeleteObjectModal'

interface EditObjectModalProps {
  isOpen: boolean
  onClose: () => void
  objectId: string
  onObjectUpdated?: () => void
}

interface ObjectData {
  object_id: string
  object_name: string
  object_description: string | null
  object_stage_id: string
  object_responsible: string | null
  object_start_date: string | null
  object_end_date: string | null
}

interface Profile {
  user_id: string
  first_name: string
  last_name: string
  email: string
}

const supabase = createClient()

export function EditObjectModal({ 
  isOpen, 
  onClose, 
  objectId, 
  onObjectUpdated 
}: EditObjectModalProps) {
  const [objectData, setObjectData] = useState<ObjectData | null>(null)
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [searchResponsible, setSearchResponsible] = useState('')
  const [showResponsibleDropdown, setShowResponsibleDropdown] = useState(false)
  const inputWrapperRef = useRef<HTMLDivElement>(null)
  const dropdownContentRef = useRef<HTMLDivElement>(null)
  const [dropdownPosition, setDropdownPosition] = useState<{ left: number; top: number; width: number; openUp: boolean } | null>(null)
  const { setNotification } = useUiStore()

  // Загрузка данных объекта
  useEffect(() => {
    if (isOpen && objectId) {
      loadObjectData()
      loadProfiles()
    }
  }, [isOpen, objectId])

  const loadObjectData = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('objects')
        .select('*')
        .eq('object_id', objectId)
        .single()

      if (error) throw error
      setObjectData(data)
    } catch (error) {
      console.error('Ошибка загрузки данных объекта:', error)
      setNotification('Ошибка загрузки данных объекта')
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

  const handleSave = async () => {
    if (!objectData) return

    setSaving(true)
    try {
      const { error } = await supabase
        .from('objects')
        .update({
          object_name: objectData.object_name,
          object_description: objectData.object_description,
          object_responsible: objectData.object_responsible,
          object_start_date: objectData.object_start_date,
          object_end_date: objectData.object_end_date,
        })
        .eq('object_id', objectId)

      if (error) throw error

      setNotification('Объект успешно обновлен')
      onObjectUpdated?.()
      onClose()
    } catch (error) {
      console.error('Ошибка сохранения объекта:', error)
      setNotification(error instanceof Error ? error.message : 'Ошибка сохранения объекта')
    } finally {
      setSaving(false)
    }
  }

  const getProfileName = (profile: Profile) => {
    const fullName = `${profile.first_name} ${profile.last_name}`.trim()
    return fullName || profile.email
  }

  const getSelectedResponsibleName = () => {
    if (!objectData?.object_responsible) return ''
    const profile = profiles.find(p => p.user_id === objectData.object_responsible)
    return profile ? getProfileName(profile) : ''
  }

  const filteredResponsible = profiles.filter(profile =>
    getProfileName(profile).toLowerCase().includes(searchResponsible.toLowerCase()) ||
    profile.email.toLowerCase().includes(searchResponsible.toLowerCase())
  )

  const updateDropdownPosition = () => {
    if (!inputWrapperRef.current) return

    const rect = inputWrapperRef.current.getBoundingClientRect()
    const viewportHeight = window.innerHeight

    // Динамическое измерение высоты содержимого dropdown
    let contentHeight = 256 // fallback to max-h-64 (256px)
    if (dropdownContentRef.current) {
      try {
        // Временно снимаем ограничение высоты для измерения
        const originalMaxHeight = dropdownContentRef.current.style.maxHeight
        dropdownContentRef.current.style.maxHeight = 'none'

        // Измеряем полную высоту содержимого
        contentHeight = dropdownContentRef.current.scrollHeight

        // Восстанавливаем ограничение высоты
        dropdownContentRef.current.style.maxHeight = originalMaxHeight || '16rem' // 256px = 16rem

        // Ограничиваем до максимальной CSS высоты (max-h-64 = 256px)
        contentHeight = Math.min(contentHeight, 256)
      } catch (error) {
        console.warn('Не удалось измерить высоту dropdown, используется значение по умолчанию:', error)
        contentHeight = 256 // fallback
      }
    }

    // Добавляем padding и border для точного расчета
    const dropdownPadding = 16 // приблизительно 8px сверху + 8px снизу
    const requiredHeight = contentHeight + dropdownPadding

    // Проверяем доступное пространство
    const spaceBelow = viewportHeight - rect.bottom
    const spaceAbove = rect.top

    // Решаем, открывать ли вверх
    const openUp = spaceBelow < requiredHeight && spaceAbove > spaceBelow

    setDropdownPosition({
      left: rect.left,
      top: openUp ? rect.top : rect.bottom,
      width: rect.width,
      openUp
    })
  }

  useEffect(() => {
    if (!showResponsibleDropdown) return
    updateDropdownPosition()

    let scrollTimeout: NodeJS.Timeout
    const throttledUpdatePosition = () => {
      clearTimeout(scrollTimeout)
      scrollTimeout = setTimeout(updateDropdownPosition, 100)
    }

    const handlers = [
      ['scroll', throttledUpdatePosition, { passive: true }],
      ['resize', updateDropdownPosition, { capture: false }],
    ] as const

    handlers.forEach(([event, fn, options]) => window.addEventListener(event, fn as EventListener, options))

    return () => {
      clearTimeout(scrollTimeout)
      handlers.forEach(([event, fn]) => window.removeEventListener(event, fn as EventListener))
    }
  }, [showResponsibleDropdown])

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md">
      <Modal.Header 
        title="Редактирование объекта" 
        onClose={onClose}
      />
      
      <Modal.Body>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          </div>
        ) : objectData ? (
          <div className="space-y-6">
            {/* Название объекта */}
            <div>
              <label className="block text-sm font-medium mb-2 dark:text-slate-300">
                Название объекта *
              </label>
              <input
                type="text"
                value={objectData.object_name}
                onChange={(e) => setObjectData({
                  ...objectData,
                  object_name: e.target.value
                })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-slate-700 dark:text-white"
                placeholder="Введите название объекта"
              />
            </div>

            {/* Описание объекта */}
            <div>
              <label className="block text-sm font-medium mb-2 dark:text-slate-300">
                Описание объекта
              </label>
              <textarea
                value={objectData.object_description || ''}
                onChange={(e) => setObjectData({
                  ...objectData,
                  object_description: e.target.value || null
                })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-slate-700 dark:text-white"
                placeholder="Введите описание объекта"
              />
            </div>

          </div>
        ) : (
          <div className="text-center py-8 text-gray-500 dark:text-slate-400">
            Ошибка загрузки данных объекта
          </div>
        )}
      </Modal.Body>

      <Modal.Footer>
        <div className="flex justify-between w-full">
          {/* Кнопка удаления слева */}
          <ModalButton
            variant="danger"
            onClick={() => setShowDeleteModal(true)}
            icon={<Trash2 />}
          >
            Удалить объект
          </ModalButton>
          
          {/* Основные кнопки справа */}
          <div className="flex gap-3">
            <ModalButton
              variant="cancel"
              onClick={onClose}
            >
              Отмена
            </ModalButton>
            <ModalButton
              variant="success"
              onClick={handleSave}
              disabled={!objectData?.object_name.trim()}
              loading={saving}
              icon={<Save />}
            >
              {saving ? 'Сохранение...' : 'Сохранить'}
            </ModalButton>
          </div>
        </div>
      </Modal.Footer>

      {/* Модальное окно удаления объекта */}
      {showDeleteModal && objectData && (
        <DeleteObjectModal
          isOpen={showDeleteModal}
          onClose={() => setShowDeleteModal(false)}
          objectId={objectData.object_id}
          objectName={objectData.object_name}
          onSuccess={() => {
            setShowDeleteModal(false)
            onClose() // Закрываем модальное окно редактирования
            onObjectUpdated?.() // Обновляем список объектов
          }}
        />
      )}
    </Modal>
  )
} 
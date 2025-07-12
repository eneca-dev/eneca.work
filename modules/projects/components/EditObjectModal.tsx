"use client"

import React, { useState, useEffect } from 'react'
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

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
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

            {/* Ответственный */}
            <div>
              <label className="block text-sm font-medium mb-2 dark:text-slate-300">
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
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-slate-700 dark:text-white"
                />
                {showResponsibleDropdown && (
                  <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {/* Опция "Не назначен" */}
                    <div
                      onClick={() => {
                        setObjectData({
                          ...objectData,
                          object_responsible: null
                        })
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
                          setObjectData({
                            ...objectData,
                            object_responsible: profile.user_id
                          })
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

            {/* Даты */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2 dark:text-slate-300">
                  Дата начала
                </label>
                <input
                  type="date"
                  value={objectData.object_start_date || ''}
                  onChange={(e) => setObjectData({
                    ...objectData,
                    object_start_date: e.target.value || null
                  })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-slate-700 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 dark:text-slate-300">
                  Дата окончания
                </label>
                <input
                  type="date"
                  value={objectData.object_end_date || ''}
                  onChange={(e) => setObjectData({
                    ...objectData,
                    object_end_date: e.target.value || null
                  })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-slate-700 dark:text-white"
                />
              </div>
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
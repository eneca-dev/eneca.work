"use client"

import React, { useState, useEffect } from 'react'
import { Save, Loader2, Calendar, User } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { useUiStore } from '@/stores/useUiStore'
import { Modal, ModalButton } from '@/components/modals'

interface CreateObjectModalProps {
  isOpen: boolean
  onClose: () => void
  stageId: string
  stageName: string
  onSuccess: () => void
}

interface Profile {
  user_id: string
  first_name: string
  last_name: string
  email: string
}

const supabase = createClient()

export function CreateObjectModal({ isOpen, onClose, stageId, stageName, onSuccess }: CreateObjectModalProps) {
  const [objectName, setObjectName] = useState('')
  const [objectDescription, setObjectDescription] = useState('')
  const [objectResponsible, setObjectResponsible] = useState('')
  const [objectStartDate, setObjectStartDate] = useState('')
  const [objectEndDate, setObjectEndDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [searchResponsible, setSearchResponsible] = useState('')
  const [showResponsibleDropdown, setShowResponsibleDropdown] = useState(false)
  
  const { setNotification } = useUiStore()

  useEffect(() => {
    if (isOpen) {
      loadProfiles()
    }
  }, [isOpen])

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
    if (!objectResponsible) return ''
    const profile = profiles.find(p => p.user_id === objectResponsible)
    return profile ? getProfileName(profile) : ''
  }

  const filteredResponsible = profiles.filter(profile =>
    getProfileName(profile).toLowerCase().includes(searchResponsible.toLowerCase()) ||
    profile.email.toLowerCase().includes(searchResponsible.toLowerCase())
  )

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    
    console.log('Создание объекта:', { objectName, trimmed: objectName.trim(), length: objectName.trim().length })
    
    if (!objectName.trim()) {
      setNotification('Название объекта обязательно')
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase
        .from('objects')
        .insert({
          object_name: objectName.trim(),
          object_description: objectDescription.trim() || null,
          object_responsible: objectResponsible || null,
          object_start_date: objectStartDate || null,
          object_end_date: objectEndDate || null,
          object_stage_id: stageId
        })

      if (error) throw error

      setNotification(`Объект "${objectName}" успешно создан`)
      onSuccess()
      handleClose()
    } catch (error) {
      console.error('Ошибка создания объекта:', error)
      setNotification(error instanceof Error ? error.message : 'Ошибка создания объекта')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setObjectName('')
    setObjectDescription('')
    setObjectResponsible('')
    setObjectStartDate('')
    setObjectEndDate('')
    setSearchResponsible('')
    setShowResponsibleDropdown(false)
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="lg">
      <Modal.Header 
        title="Создать новый объект" 
        subtitle={`Стадия: ${stageName}`}
      />
      
      <Modal.Body>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2 dark:text-slate-300 text-slate-700">
              Название объекта *
            </label>
            <input
              type="text"
              value={objectName}
              onChange={(e) => setObjectName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent dark:bg-slate-800 dark:text-white"
              placeholder="Введите название объекта"
              disabled={loading}
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 dark:text-slate-300 text-slate-700">
              Описание
            </label>
            <textarea
              value={objectDescription}
              onChange={(e) => setObjectDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent dark:bg-slate-800 dark:text-white"
              placeholder="Введите описание объекта (необязательно)"
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
                className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent dark:bg-slate-800 dark:text-white"
                disabled={loading}
              />
              <User className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
              {showResponsibleDropdown && (
                <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  <div
                    onClick={() => {
                      setObjectResponsible('')
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
                        setObjectResponsible(profile.user_id)
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
                  value={objectStartDate}
                  onChange={(e) => setObjectStartDate(e.target.value)}
                  className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent dark:bg-slate-800 dark:text-white"
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
                  value={objectEndDate}
                  onChange={(e) => setObjectEndDate(e.target.value)}
                  className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent dark:bg-slate-800 dark:text-white"
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
          disabled={loading || !objectName.trim()}
          icon={loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        >
          {loading ? 'Создание...' : 'Создать объект'}
        </ModalButton>
      </Modal.Footer>
    </Modal>
  )
} 
"use client"

import React, { useState, useEffect } from 'react'
import { Save, Loader2, Trash2 } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { useUiStore } from '@/stores/useUiStore'
import { updateProject } from '@/lib/supabase-client'
import { Modal, ModalButton } from '@/components/modals'
import { DeleteProjectModal } from './DeleteProjectModal'

interface EditProjectModalProps {
  isOpen: boolean
  onClose: () => void
  projectId: string
  onProjectUpdated?: () => void
}

interface ProjectData {
  project_id: string
  project_name: string
  project_description: string | null
  project_manager: string | null
  project_lead_engineer: string | null
  project_status: 'active' | 'archive' | 'paused' | 'canceled'
  client_id: string | null
}

interface Profile {
  user_id: string
  first_name: string
  last_name: string
  email: string
}

interface Client {
  client_id: string
  client_name: string
}

const supabase = createClient()

export function EditProjectModal({ 
  isOpen, 
  onClose, 
  projectId, 
  onProjectUpdated 
}: EditProjectModalProps) {
  const [projectData, setProjectData] = useState<ProjectData | null>(null)
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [searchManager, setSearchManager] = useState('')
  const [searchEngineer, setSearchEngineer] = useState('')
  const [searchClient, setSearchClient] = useState('')
  const [showManagerDropdown, setShowManagerDropdown] = useState(false)
  const [showEngineerDropdown, setShowEngineerDropdown] = useState(false)
  const [showClientDropdown, setShowClientDropdown] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const { setNotification } = useUiStore()

  // Загрузка данных проекта
  useEffect(() => {
    if (isOpen && projectId) {
      loadProjectData()
      loadProfiles()
      loadClients()
    }
  }, [isOpen, projectId])

  const loadProjectData = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('project_id', projectId)
        .single()

      if (error) throw error
      setProjectData(data)
    } catch (error) {
      console.error('Ошибка загрузки данных проекта:', error)
      setNotification('Ошибка загрузки данных проекта')
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

  const loadClients = async () => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('client_id, client_name')
        .order('client_name')

      if (error) throw error
      setClients(data || [])
    } catch (error) {
      console.error('Ошибка загрузки клиентов:', error)
    }
  }

  const handleSave = async () => {
    if (!projectData) return

    setSaving(true)
    try {
      const result = await updateProject(projectId, {
        project_name: projectData.project_name,
        project_description: projectData.project_description,
        project_manager: projectData.project_manager,
        project_lead_engineer: projectData.project_lead_engineer,
        project_status: projectData.project_status,
        client_id: projectData.client_id
      })

      if (!result.success) {
        throw new Error(result.error || 'Неизвестная ошибка')
      }

      setNotification('Проект успешно обновлен')
      onProjectUpdated?.()
      onClose()
    } catch (error) {
      console.error('Ошибка сохранения проекта:', error)
      setNotification(error instanceof Error ? error.message : 'Ошибка сохранения проекта')
    } finally {
      setSaving(false)
    }
  }

  const getProfileName = (profile: Profile) => {
    const fullName = `${profile.first_name} ${profile.last_name}`.trim()
    return fullName || profile.email
  }

  const getSelectedManagerName = () => {
    if (!projectData?.project_manager) return ''
    const manager = profiles.find(p => p.user_id === projectData.project_manager)
    return manager ? getProfileName(manager) : ''
  }

  const getSelectedEngineerName = () => {
    if (!projectData?.project_lead_engineer) return ''
    const engineer = profiles.find(p => p.user_id === projectData.project_lead_engineer)
    return engineer ? getProfileName(engineer) : ''
  }

  const getSelectedClientName = () => {
    if (!projectData?.client_id) return ''
    const client = clients.find(c => c.client_id === projectData.client_id)
    return client ? client.client_name : ''
  }

  const filteredManagers = profiles.filter(profile => 
    getProfileName(profile).toLowerCase().includes(searchManager.toLowerCase())
  )

  const filteredEngineers = profiles.filter(profile => 
    getProfileName(profile).toLowerCase().includes(searchEngineer.toLowerCase())
  )

  const filteredClients = clients.filter(client => 
    client.client_name.toLowerCase().includes(searchClient.toLowerCase())
  )

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <Modal.Header 
        title="Редактирование проекта" 
        onClose={onClose}
      />
      
      <Modal.Body>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            </div>
          ) : projectData ? (
            <div className="space-y-6">
              {/* Название проекта */}
              <div>
                <label className="block text-sm font-medium mb-2 dark:text-slate-300">
                  Название проекта *
                </label>
                <input
                  type="text"
                  value={projectData.project_name}
                  onChange={(e) => setProjectData({
                    ...projectData,
                    project_name: e.target.value
                  })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-slate-700 dark:text-white"
                  placeholder="Введите название проекта"
                />
              </div>

              {/* Описание проекта */}
              <div>
                <label className="block text-sm font-medium mb-2 dark:text-slate-300">
                  Описание проекта
                </label>
                <textarea
                  value={projectData.project_description || ''}
                  onChange={(e) => setProjectData({
                    ...projectData,
                    project_description: e.target.value || null
                  })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-slate-700 dark:text-white"
                  placeholder="Введите описание проекта"
                />
              </div>

              {/* Статус проекта */}
              <div>
                <label className="block text-sm font-medium mb-2 dark:text-slate-300">
                  Статус проекта
                </label>
                <select
                  value={projectData.project_status}
                  onChange={(e) => setProjectData({
                    ...projectData,
                    project_status: e.target.value as ProjectData['project_status']
                  })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-slate-700 dark:text-white"
                >
                  <option value="active">Активный</option>
                  <option value="paused">Приостановлен</option>
                  <option value="archive">Архив</option>
                  <option value="canceled">Отменен</option>
                </select>
              </div>

              {/* Менеджер проекта */}
              <div>
                <label className="block text-sm font-medium mb-2 dark:text-slate-300">
                  Менеджер проекта
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={showManagerDropdown ? searchManager : getSelectedManagerName()}
                    onChange={(e) => {
                      setSearchManager(e.target.value)
                      setShowManagerDropdown(true)
                    }}
                    onFocus={() => {
                      setSearchManager('')
                      setShowManagerDropdown(true)
                    }}
                    onBlur={() => {
                      setTimeout(() => setShowManagerDropdown(false), 200)
                    }}
                    placeholder={getSelectedManagerName() || "Поиск менеджера..."}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-slate-700 dark:text-white"
                  />
                  {showManagerDropdown && (
                    <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {/* Опция "Не назначен" */}
                      <div
                        onClick={() => {
                          setProjectData({
                            ...projectData,
                            project_manager: null
                          })
                          setSearchManager('')
                          setShowManagerDropdown(false)
                        }}
                        className="px-3 py-2 hover:bg-gray-100 dark:hover:bg-slate-600 cursor-pointer border-b dark:border-slate-600"
                      >
                        <div className="font-medium text-gray-500 dark:text-slate-400">
                          Не назначен
                        </div>
                      </div>
                      {filteredManagers.map((profile) => (
                        <div
                          key={profile.user_id}
                          onClick={() => {
                            setProjectData({
                              ...projectData,
                              project_manager: profile.user_id
                            })
                            setSearchManager('')
                            setShowManagerDropdown(false)
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

              {/* Главный инженер */}
              <div>
                <label className="block text-sm font-medium mb-2 dark:text-slate-300">
                  Главный инженер
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={showEngineerDropdown ? searchEngineer : getSelectedEngineerName()}
                    onChange={(e) => {
                      setSearchEngineer(e.target.value)
                      setShowEngineerDropdown(true)
                    }}
                    onFocus={() => {
                      setSearchEngineer('')
                      setShowEngineerDropdown(true)
                    }}
                    onBlur={() => {
                      setTimeout(() => setShowEngineerDropdown(false), 200)
                    }}
                    placeholder={getSelectedEngineerName() || "Поиск инженера..."}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-slate-700 dark:text-white"
                  />
                  {showEngineerDropdown && (
                    <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {/* Опция "Не назначен" */}
                      <div
                        onClick={() => {
                          setProjectData({
                            ...projectData,
                            project_lead_engineer: null
                          })
                          setSearchEngineer('')
                          setShowEngineerDropdown(false)
                        }}
                        className="px-3 py-2 hover:bg-gray-100 dark:hover:bg-slate-600 cursor-pointer border-b dark:border-slate-600"
                      >
                        <div className="font-medium text-gray-500 dark:text-slate-400">
                          Не назначен
                        </div>
                      </div>
                      {filteredEngineers.map((profile) => (
                        <div
                          key={profile.user_id}
                          onClick={() => {
                            setProjectData({
                              ...projectData,
                              project_lead_engineer: profile.user_id
                            })
                            setSearchEngineer('')
                            setShowEngineerDropdown(false)
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

              {/* Клиент */}
              <div>
                <label className="block text-sm font-medium mb-2 dark:text-slate-300">
                  Клиент
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={showClientDropdown ? searchClient : getSelectedClientName()}
                    onChange={(e) => {
                      setSearchClient(e.target.value)
                      setShowClientDropdown(true)
                    }}
                    onFocus={() => {
                      setSearchClient('')
                      setShowClientDropdown(true)
                    }}
                    onBlur={() => {
                      setTimeout(() => setShowClientDropdown(false), 200)
                    }}
                    placeholder={getSelectedClientName() || "Поиск клиента..."}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-slate-700 dark:text-white"
                  />
                  {showClientDropdown && (
                    <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {/* Опция "Не назначен" */}
                      <div
                        onClick={() => {
                          setProjectData({
                            ...projectData,
                            client_id: null
                          })
                          setSearchClient('')
                          setShowClientDropdown(false)
                        }}
                        className="px-3 py-2 hover:bg-gray-100 dark:hover:bg-slate-600 cursor-pointer border-b dark:border-slate-600"
                      >
                        <div className="font-medium text-gray-500 dark:text-slate-400">
                          Не назначен
                        </div>
                      </div>
                      {filteredClients.map((client) => (
                        <div
                          key={client.client_id}
                          onClick={() => {
                            setProjectData({
                              ...projectData,
                              client_id: client.client_id
                            })
                            setSearchClient('')
                            setShowClientDropdown(false)
                          }}
                          className="px-3 py-2 hover:bg-gray-100 dark:hover:bg-slate-600 cursor-pointer"
                        >
                          <div className="font-medium dark:text-white">
                            {client.client_name}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500 dark:text-slate-400">
              Ошибка загрузки данных проекта
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
            Удалить проект
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
              disabled={!projectData?.project_name.trim()}
              loading={saving}
              icon={<Save />}
            >
              {saving ? 'Сохранение...' : 'Сохранить'}
            </ModalButton>
          </div>
        </div>
      </Modal.Footer>

      {/* Модальное окно удаления проекта */}
      {showDeleteModal && projectData && (
        <DeleteProjectModal
          isOpen={showDeleteModal}
          onClose={() => setShowDeleteModal(false)}
          projectId={projectData.project_id}
          projectName={projectData.project_name}
          onSuccess={() => {
            setShowDeleteModal(false)
            onClose() // Закрываем модальное окно редактирования
            onProjectUpdated?.() // Обновляем список проектов
          }}
        />
      )}
    </Modal>
  )
} 
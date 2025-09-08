"use client"

import React, { useState, useEffect, useRef } from 'react'
import * as Sentry from "@sentry/nextjs"
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
  const [managerDropdownPosition, setManagerDropdownPosition] = useState<{ left: number; top: number; width: number; openUp: boolean } | null>(null)
  const [engineerDropdownPosition, setEngineerDropdownPosition] = useState<{ left: number; top: number; width: number; openUp: boolean } | null>(null)
  const [clientDropdownPosition, setClientDropdownPosition] = useState<{ left: number; top: number; width: number; openUp: boolean } | null>(null)
  const managerInputRef = useRef<HTMLDivElement>(null)
  const engineerInputRef = useRef<HTMLDivElement>(null)
  const clientInputRef = useRef<HTMLDivElement>(null)
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

    return Sentry.startSpan(
      {
        op: "projects.update_project",
        name: "Update Project",
      },
      async (span) => {
        setSaving(true)
        try {
          span.setAttribute("project.id", projectId)
          span.setAttribute("project.name", projectData.project_name)
          span.setAttribute("project.status", projectData.project_status)
          span.setAttribute("project.has_manager", !!projectData.project_manager)
          span.setAttribute("project.has_engineer", !!projectData.project_lead_engineer)
          span.setAttribute("project.has_client", !!projectData.client_id)

          const result = await updateProject(projectId, {
            project_name: projectData.project_name,
            project_description: projectData.project_description,
            project_manager: projectData.project_manager,
            project_lead_engineer: projectData.project_lead_engineer,
            project_status: projectData.project_status,
            client_id: projectData.client_id
          })

          if (!result.success) {
            span.setAttribute("update.success", false)
            span.setAttribute("update.error", result.error || 'Неизвестная ошибка')
            Sentry.captureException(new Error(result.error || 'Неизвестная ошибка'), {
              tags: { 
                module: 'projects', 
                action: 'update_project',
                error_type: 'update_failed'
              },
              extra: { 
                component: 'EditProjectModal',
                project_id: projectId,
                project_name: projectData.project_name,
                project_status: projectData.project_status,
                timestamp: new Date().toISOString()
              }
            })
            throw new Error(result.error || 'Неизвестная ошибка')
          }

          span.setAttribute("update.success", true)
          
          Sentry.addBreadcrumb({
            message: 'Project updated successfully',
            category: 'projects',
            level: 'info',
            data: { 
              project_id: projectId,
              project_name: projectData.project_name,
              project_status: projectData.project_status,
              has_manager: !!projectData.project_manager,
              has_engineer: !!projectData.project_lead_engineer,
              has_client: !!projectData.client_id
            }
          })

          setNotification('Проект успешно обновлен')
          onProjectUpdated?.()
          onClose()
        } catch (error) {
          span.setAttribute("update.success", false)
          span.recordException(error as Error)
          Sentry.captureException(error, {
            tags: { 
              module: 'projects', 
              action: 'update_project',
              error_type: 'unexpected_error'
            },
            extra: { 
              component: 'EditProjectModal',
              project_id: projectId,
              project_name: projectData?.project_name,
              timestamp: new Date().toISOString()
            }
          })
          console.error('Ошибка сохранения проекта:', error)
          setNotification(error instanceof Error ? error.message : 'Ошибка сохранения проекта')
        } finally {
          setSaving(false)
        }
      }
    )
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

  const updateManagerDropdownPosition = () => {
    if (!managerInputRef.current) return
    const rect = managerInputRef.current.getBoundingClientRect()
    const viewportSpaceBelow = window.innerHeight - rect.bottom
    const desired = 320
    const openUp = viewportSpaceBelow < 160 && rect.top > viewportSpaceBelow
    setManagerDropdownPosition({ left: rect.left, top: openUp ? rect.top : rect.bottom, width: rect.width, openUp })
  }

  const updateEngineerDropdownPosition = () => {
    if (!engineerInputRef.current) return
    const rect = engineerInputRef.current.getBoundingClientRect()
    const viewportSpaceBelow = window.innerHeight - rect.bottom
    const desired = 320
    const openUp = viewportSpaceBelow < 160 && rect.top > viewportSpaceBelow
    setEngineerDropdownPosition({ left: rect.left, top: openUp ? rect.top : rect.bottom, width: rect.width, openUp })
  }

  const updateClientDropdownPosition = () => {
    if (!clientInputRef.current) return
    const rect = clientInputRef.current.getBoundingClientRect()
    const viewportSpaceBelow = window.innerHeight - rect.bottom
    const desired = 320
    const openUp = viewportSpaceBelow < 160 && rect.top > viewportSpaceBelow
    setClientDropdownPosition({ left: rect.left, top: openUp ? rect.top : rect.bottom, width: rect.width, openUp })
  }

  useEffect(() => {
    if (!showManagerDropdown) return
    updateManagerDropdownPosition()
    const handlers = [
      ['scroll', updateManagerDropdownPosition, true],
      ['resize', updateManagerDropdownPosition, false],
    ] as const
    handlers.forEach(([event, fn, capture]) => window.addEventListener(event, fn as EventListener, capture))
    return () => handlers.forEach(([event, fn, capture]) => window.removeEventListener(event, fn as EventListener, capture))
  }, [showManagerDropdown])

  useEffect(() => {
    if (!showEngineerDropdown) return
    updateEngineerDropdownPosition()
    const handlers = [
      ['scroll', updateEngineerDropdownPosition, true],
      ['resize', updateEngineerDropdownPosition, false],
    ] as const
    handlers.forEach(([event, fn, capture]) => window.addEventListener(event, fn as EventListener, capture))
    return () => handlers.forEach(([event, fn, capture]) => window.removeEventListener(event, fn as EventListener, capture))
  }, [showEngineerDropdown])

  useEffect(() => {
    if (!showClientDropdown) return
    updateClientDropdownPosition()
    const handlers = [
      ['scroll', updateClientDropdownPosition, true],
      ['resize', updateClientDropdownPosition, false],
    ] as const
    handlers.forEach(([event, fn, capture]) => window.addEventListener(event, fn as EventListener, capture))
    return () => handlers.forEach(([event, fn, capture]) => window.removeEventListener(event, fn as EventListener, capture))
  }, [showClientDropdown])

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
                <div className="relative">
                  <select
                    value={projectData.project_status}
                    onChange={(e) => setProjectData({
                      ...projectData,
                      project_status: e.target.value as ProjectData['project_status']
                    })}
                    className="w-full px-3 py-2 pr-8 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-slate-700 dark:text-white appearance-none"
                  >
                    <option value="active">Активный</option>
                    <option value="paused">Приостановлен</option>
                    <option value="archive">Архив</option>
                    <option value="canceled">Отменен</option>
                  </select>
                  <div className="absolute inset-y-0 right-2 flex items-center pointer-events-none">
                    <svg
                      className="h-4 w-4 text-gray-400 dark:text-slate-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Руководитель проекта */}
              <div>
                <label className="block text-sm font-medium mb-2 dark:text-slate-300">
                  Руководитель проекта
                </label>
                <div className="relative" ref={managerInputRef}>
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
                    placeholder={getSelectedManagerName() || "Поиск руководителя проекта..."}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-slate-700 dark:text-white"
                  />
                  {showManagerDropdown && managerDropdownPosition && typeof document !== 'undefined' && (
                    (typeof window !== 'undefined') && (
                      // Render to body to avoid clipping inside modal scroll container
                      require('react-dom').createPortal(
                        <div
                          style={{
                            position: 'fixed',
                            left: managerDropdownPosition.left,
                            top: managerDropdownPosition.top,
                            width: managerDropdownPosition.width,
                            transform: managerDropdownPosition.openUp ? 'translateY(-8px) translateY(-100%)' : 'translateY(8px)',
                          }}
                          className="z-50"
                          onMouseDown={(e) => e.preventDefault()}
                        >
                          <div className="bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg shadow-xl ring-1 ring-black/5 overflow-hidden">
                            <div className="sticky top-0 bg-white/90 dark:bg-slate-700/90 backdrop-blur px-3 py-2 border-b border-gray-100 dark:border-slate-600 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                              Руководитель проекта
                            </div>
                            <div className="max-h-64 overflow-y-auto overscroll-contain">
                              <div
                                onClick={() => {
                                  setProjectData({
                                    ...projectData,
                                    project_manager: null
                                  })
                                  setSearchManager('')
                                  setShowManagerDropdown(false)
                                }}
                                className="px-3 py-2 hover:bg-gray-50 dark:hover:bg-slate-600/70 cursor-pointer border-b border-gray-100 dark:border-slate-600"
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
                                  className="px-3 py-2 hover:bg-gray-50 dark:hover:bg-slate-600/70 cursor-pointer"
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
                          </div>
                        </div>,
                        document.body
                      )
                    )
                  )}
                </div>
              </div>

              {/* Главный инженер */}
              <div>
                <label className="block text-sm font-medium mb-2 dark:text-slate-300">
                  Главный инженер
                </label>
                <div className="relative" ref={engineerInputRef}>
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
                  {showEngineerDropdown && engineerDropdownPosition && typeof document !== 'undefined' && (
                    (typeof window !== 'undefined') && (
                      // Render to body to avoid clipping inside modal scroll container
                      require('react-dom').createPortal(
                        <div
                          style={{
                            position: 'fixed',
                            left: engineerDropdownPosition.left,
                            top: engineerDropdownPosition.top,
                            width: engineerDropdownPosition.width,
                            transform: engineerDropdownPosition.openUp ? 'translateY(-8px) translateY(-100%)' : 'translateY(8px)',
                          }}
                          className="z-50"
                          onMouseDown={(e) => e.preventDefault()}
                        >
                          <div className="bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg shadow-xl ring-1 ring-black/5 overflow-hidden">
                            <div className="sticky top-0 bg-white/90 dark:bg-slate-700/90 backdrop-blur px-3 py-2 border-b border-gray-100 dark:border-slate-600 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                              Главный инженер
                            </div>
                            <div className="max-h-64 overflow-y-auto overscroll-contain">
                              <div
                                onClick={() => {
                                  setProjectData({
                                    ...projectData,
                                    project_lead_engineer: null
                                  })
                                  setSearchEngineer('')
                                  setShowEngineerDropdown(false)
                                }}
                                className="px-3 py-2 hover:bg-gray-50 dark:hover:bg-slate-600/70 cursor-pointer border-b border-gray-100 dark:border-slate-600"
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
                                  className="px-3 py-2 hover:bg-gray-50 dark:hover:bg-slate-600/70 cursor-pointer"
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
                          </div>
                        </div>,
                        document.body
                      )
                    )
                  )}
                </div>
              </div>

              {/* Клиент */}
              <div>
                <label className="block text-sm font-medium mb-2 dark:text-slate-300">
                  Клиент
                </label>
                <div className="relative" ref={clientInputRef}>
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
                  {showClientDropdown && clientDropdownPosition && typeof document !== 'undefined' && (
                    (typeof window !== 'undefined') && (
                      // Render to body to avoid clipping inside modal scroll container
                      require('react-dom').createPortal(
                        <div
                          style={{
                            position: 'fixed',
                            left: clientDropdownPosition.left,
                            top: clientDropdownPosition.top,
                            width: clientDropdownPosition.width,
                            transform: clientDropdownPosition.openUp ? 'translateY(-8px) translateY(-100%)' : 'translateY(8px)',
                          }}
                          className="z-50"
                          onMouseDown={(e) => e.preventDefault()}
                        >
                          <div className="bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg shadow-xl ring-1 ring-black/5 overflow-hidden">
                            <div className="sticky top-0 bg-white/90 dark:bg-slate-700/90 backdrop-blur px-3 py-2 border-b border-gray-100 dark:border-slate-600 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                              Клиент
                            </div>
                            <div className="max-h-64 overflow-y-auto overscroll-contain">
                              <div
                                onClick={() => {
                                  setProjectData({
                                    ...projectData,
                                    client_id: null
                                  })
                                  setSearchClient('')
                                  setShowClientDropdown(false)
                                }}
                                className="px-3 py-2 hover:bg-gray-50 dark:hover:bg-slate-600/70 cursor-pointer border-b border-gray-100 dark:border-slate-600"
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
                                  className="px-3 py-2 hover:bg-gray-50 dark:hover:bg-slate-600/70 cursor-pointer"
                                >
                                  <div className="font-medium dark:text-white">
                                    {client.client_name}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>,
                        document.body
                      )
                    )
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
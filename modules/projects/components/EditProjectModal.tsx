"use client"

import React, { useState, useEffect, useRef, useCallback } from 'react'
import * as Sentry from "@sentry/nextjs"
import ReactDOM from 'react-dom'
import { Save, Loader2, Trash2 } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { useUiStore } from '@/stores/useUiStore'
import { updateProject } from '@/lib/supabase-client'
import {
  PROJECT_STATUS_OPTIONS,
  getProjectStatusLabel,
  normalizeProjectStatus,
} from '../constants/project-status'
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
  project_status:
    | 'draft'
    | 'active'
    | 'completed'
    | 'paused'
    | 'waiting for input data'
    | 'author supervision'
    | 'actual calculation'
    | 'customer approval'
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
import { useDropdownPosition, useDropdownPositionEffect } from '@/hooks/useDropdownPosition'

// Dropdown header styling constant
export const DROPDOWN_HEADER_CLASS = "sticky top-0 bg-white/90 dark:bg-slate-700/90 backdrop-blur px-3 py-2 border-b border-gray-100 dark:border-slate-600 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400"

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
  const [searchStatus, setSearchStatus] = useState('')
  const [showManagerDropdown, setShowManagerDropdown] = useState(false)
  const [showEngineerDropdown, setShowEngineerDropdown] = useState(false)
  const [showClientDropdown, setShowClientDropdown] = useState(false)
  const [showStatusDropdown, setShowStatusDropdown] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [statusHighlightedIndex, setStatusHighlightedIndex] = useState(-1)
  const [focusedManagerIndex, setFocusedManagerIndex] = useState(0)
  const [focusedEngineerIndex, setFocusedEngineerIndex] = useState(0)
  const [focusedClientIndex, setFocusedClientIndex] = useState(0)
  const [canRenderPortal, setCanRenderPortal] = useState(false)
  const managerDropdown = useDropdownPosition()
  const engineerDropdown = useDropdownPosition()
  const clientDropdown = useDropdownPosition()
  const managerInputRef = managerDropdown.ref
  const engineerInputRef = engineerDropdown.ref
  const clientInputRef = clientDropdown.ref
  const managerItemRefs = useRef<(HTMLDivElement | null)[]>([])
  const engineerItemRefs = useRef<(HTMLDivElement | null)[]>([])
  const clientItemRefs = useRef<(HTMLDivElement | null)[]>([])
  const { setNotification } = useUiStore()
  const canRenderPortal = typeof window !== 'undefined' && typeof document !== 'undefined'

  // Refs for proper focus management
  const statusInputRef = useRef<HTMLInputElement>(null)
  const statusDropdownRef = useRef<HTMLDivElement>(null)
  const statusMouseDownRef = useRef(false)

  // Проверка возможности рендера портала
  useEffect(() => {
    setCanRenderPortal(typeof document !== 'undefined')
  }, [])

  // Загрузка данных проекта
  useEffect(() => {
    if (isOpen && projectId) {
      loadProjectData()
      loadProfiles()
      loadClients()
    }
  }, [isOpen, projectId])

  // Reset highlighted index when dropdown state changes
  useEffect(() => {
    if (showStatusDropdown) {
      setStatusHighlightedIndex(-1)
    }
  }, [showStatusDropdown])

  // Очистка refs при размонтировании компонента
  useEffect(() => {
    return () => {
      managerItemRefs.current = []
      engineerItemRefs.current = []
      clientItemRefs.current = []
    }
  }, [])

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
            project_status: normalizeProjectStatus(projectData.project_status) || 'active',
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

  const getStatusName = (status: ProjectData['project_status']) => getProjectStatusLabel(status)

  const getSelectedStatusName = () => {
    if (!projectData?.project_status) return ''
    return getStatusName(projectData.project_status)
  }

  const statusOptions: readonly ProjectData['project_status'][] = PROJECT_STATUS_OPTIONS

  const filteredManagers = profiles.filter(profile =>
    getProfileName(profile).toLowerCase().includes(searchManager.toLowerCase())
  )

  const filteredEngineers = profiles.filter(profile =>
    getProfileName(profile).toLowerCase().includes(searchEngineer.toLowerCase())
  )

  const filteredClients = clients.filter(client =>
    client.client_name.toLowerCase().includes(searchClient.toLowerCase())
  )

  const filteredStatuses = statusOptions.filter(status =>
    getStatusName(status).toLowerCase().includes(searchStatus.toLowerCase())
  )

  // Keyboard handler for status combobox
  const handleStatusKeyDown = (e: React.KeyboardEvent) => {
    if (!showStatusDropdown && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setShowStatusDropdown(true)
      return
    }

    if (!showStatusDropdown) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setStatusHighlightedIndex(prev =>
          prev < filteredStatuses.length - 1 ? prev + 1 : 0
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setStatusHighlightedIndex(prev =>
          prev > 0 ? prev - 1 : filteredStatuses.length - 1
        )
        break
      case 'Enter':
        e.preventDefault()
        if (statusHighlightedIndex >= 0 && statusHighlightedIndex < filteredStatuses.length) {
          const selectedStatus = filteredStatuses[statusHighlightedIndex]
          setProjectData({
            ...projectData!,
            project_status: selectedStatus
          })
          setSearchStatus('')
          setShowStatusDropdown(false)
          setStatusHighlightedIndex(-1)
        }
        break
      case 'Escape':
        e.preventDefault()
        setShowStatusDropdown(false)
        setStatusHighlightedIndex(-1)
        setSearchStatus('')
        break
    }
  }

  const updateManagerDropdownPosition = managerDropdown.updatePosition
  const updateEngineerDropdownPosition = engineerDropdown.updatePosition
  const updateClientDropdownPosition = clientDropdown.updatePosition

  // Обработчики клавиатуры для dropdown'ов
  const handleManagerKeyDown = useCallback((e: React.KeyboardEvent) => {
    const itemsCount = filteredManagers.length + 1 // +1 для опции "Не назначен"

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setFocusedManagerIndex(prev => (prev + 1) % itemsCount)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setFocusedManagerIndex(prev => prev === 0 ? itemsCount - 1 : prev - 1)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (focusedManagerIndex === 0) {
        // "Не назначен"
        setProjectData(prev => prev ? { ...prev, project_manager: null } : null)
        setSearchManager('')
        setShowManagerDropdown(false)
      } else {
        // Выбор менеджера
        const selectedProfile = filteredManagers[focusedManagerIndex - 1]
        if (selectedProfile) {
          setProjectData(prev => prev ? { ...prev, project_manager: selectedProfile.user_id } : null)
          setSearchManager('')
          setShowManagerDropdown(false)
        }
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setShowManagerDropdown(false)
      setSearchManager('')
      setFocusedManagerIndex(0)
    } else if (e.key === 'Home') {
      e.preventDefault()
      setFocusedManagerIndex(0)
    } else if (e.key === 'End') {
      e.preventDefault()
      setFocusedManagerIndex(itemsCount - 1)
    }
  }, [filteredManagers, focusedManagerIndex, projectData])

  const handleEngineerKeyDown = useCallback((e: React.KeyboardEvent) => {
    const itemsCount = filteredEngineers.length + 1 // +1 для опции "Не назначен"

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setFocusedEngineerIndex(prev => (prev + 1) % itemsCount)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setFocusedEngineerIndex(prev => prev === 0 ? itemsCount - 1 : prev - 1)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (focusedEngineerIndex === 0) {
        // "Не назначен"
        setProjectData(prev => prev ? { ...prev, project_lead_engineer: null } : null)
        setSearchEngineer('')
        setShowEngineerDropdown(false)
      } else {
        // Выбор инженера
        const selectedProfile = filteredEngineers[focusedEngineerIndex - 1]
        if (selectedProfile) {
          setProjectData(prev => prev ? { ...prev, project_lead_engineer: selectedProfile.user_id } : null)
          setSearchEngineer('')
          setShowEngineerDropdown(false)
        }
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setShowEngineerDropdown(false)
      setSearchEngineer('')
      setFocusedEngineerIndex(0)
    } else if (e.key === 'Home') {
      e.preventDefault()
      setFocusedEngineerIndex(0)
    } else if (e.key === 'End') {
      e.preventDefault()
      setFocusedEngineerIndex(itemsCount - 1)
    }
  }, [filteredEngineers, focusedEngineerIndex, projectData])

  const handleClientKeyDown = useCallback((e: React.KeyboardEvent) => {
    const itemsCount = filteredClients.length + 1 // +1 для опции "Не назначен"

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setFocusedClientIndex(prev => (prev + 1) % itemsCount)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setFocusedClientIndex(prev => prev === 0 ? itemsCount - 1 : prev - 1)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (focusedClientIndex === 0) {
        // "Не назначен"
        setProjectData(prev => prev ? { ...prev, client_id: null } : null)
        setSearchClient('')
        setShowClientDropdown(false)
      } else {
        // Выбор клиента
        const selectedClient = filteredClients[focusedClientIndex - 1]
        if (selectedClient) {
          setProjectData(prev => prev ? { ...prev, client_id: selectedClient.client_id } : null)
          setSearchClient('')
          setShowClientDropdown(false)
        }
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setShowClientDropdown(false)
      setSearchClient('')
      setFocusedClientIndex(0)
    } else if (e.key === 'Home') {
      e.preventDefault()
      setFocusedClientIndex(0)
    } else if (e.key === 'End') {
      e.preventDefault()
      setFocusedClientIndex(itemsCount - 1)
    }
  }, [filteredClients, focusedClientIndex, projectData])

  useDropdownPositionEffect(showManagerDropdown, updateManagerDropdownPosition)
  useDropdownPositionEffect(showEngineerDropdown, updateEngineerDropdownPosition)
  useDropdownPositionEffect(showClientDropdown, updateClientDropdownPosition)

  // Управление фокусом на элементах списка
  useEffect(() => {
    if (showManagerDropdown && managerItemRefs.current[focusedManagerIndex]) {
      managerItemRefs.current[focusedManagerIndex]?.focus()
    }
  }, [focusedManagerIndex, showManagerDropdown])

  useEffect(() => {
    if (showEngineerDropdown && engineerItemRefs.current[focusedEngineerIndex]) {
      engineerItemRefs.current[focusedEngineerIndex]?.focus()
    }
  }, [focusedEngineerIndex, showEngineerDropdown])

  useEffect(() => {
    if (showClientDropdown && clientItemRefs.current[focusedClientIndex]) {
      clientItemRefs.current[focusedClientIndex]?.focus()
    }
  }, [focusedClientIndex, showClientDropdown])

  // Сброс focusedIndex при изменении фильтров
  useEffect(() => {
    setFocusedManagerIndex(0)
  }, [searchManager])

  useEffect(() => {
    setFocusedEngineerIndex(0)
  }, [searchEngineer])

  useEffect(() => {
    setFocusedClientIndex(0)
  }, [searchClient])

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
                  <input
                    ref={statusInputRef}
                    type="text"
                    value={showStatusDropdown ? searchStatus : getSelectedStatusName()}
                    onChange={(e) => {
                      setSearchStatus(e.target.value)
                      setShowStatusDropdown(true)
                    }}
                    onFocus={() => {
                      setSearchStatus('')
                      setShowStatusDropdown(true)
                    }}
                    onBlur={() => {
                      // Don't close immediately - let mouse events be handled first
                      setTimeout(() => {
                        if (!statusMouseDownRef.current) {
                          setShowStatusDropdown(false)
                          setStatusHighlightedIndex(-1)
                          setSearchStatus('')
                        }
                      }, 150)
                    }}
                    onKeyDown={handleStatusKeyDown}
                    placeholder={getSelectedStatusName() || "Выберите статус проекта..."}
                    role="combobox"
                    aria-expanded={showStatusDropdown}
                    aria-controls="status-listbox"
                    aria-activedescendant={showStatusDropdown && statusHighlightedIndex >= 0 ? `status-option-${statusHighlightedIndex}` : undefined}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-slate-700 dark:text-white"
                  />
                  {showStatusDropdown && (
                    <div
                      ref={statusDropdownRef}
                      id="status-listbox"
                      role="listbox"
                      className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg shadow-lg max-h-48 overflow-y-auto"
                      onMouseDown={() => {
                        statusMouseDownRef.current = true
                      }}
                      onMouseUp={() => {
                        statusMouseDownRef.current = false
                      }}
                    >
                      {filteredStatuses.map((status, index) => (
                        <div
                          key={status}
                          id={`status-option-${index}`}
                          role="option"
                          aria-selected={index === statusHighlightedIndex}
                          onClick={() => {
                            setProjectData({
                              ...projectData,
                              project_status: status
                            })
                            setSearchStatus('')
                            setShowStatusDropdown(false)
                            setStatusHighlightedIndex(-1)
                          }}
                          className={`px-3 py-2 cursor-pointer ${
                            index === statusHighlightedIndex
                              ? 'bg-blue-100 dark:bg-blue-900'
                              : 'hover:bg-gray-100 dark:hover:bg-slate-600'
                          }`}
                        >
                          <div className="font-medium dark:text-white">
                            {getStatusName(status)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
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
                  {showManagerDropdown && managerDropdown.position && canRenderPortal && (
                    ReactDOM.createPortal(
                        <div
                          style={{
                            position: 'fixed',
                            left: managerDropdown.position.left,
                            top: managerDropdown.position.top,
                            width: managerDropdown.position.width,
                            transform: managerDropdown.position.openUp ? 'translateY(-8px) translateY(-100%)' : 'translateY(8px)',
                          }}
                          className="z-50"
                          onMouseDown={(e) => e.preventDefault()}
                          onKeyDown={handleManagerKeyDown}
                        >
                          <div className="bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg shadow-xl ring-1 ring-black/5 overflow-hidden">
                            <div className={DROPDOWN_HEADER_CLASS}>
                              Руководитель проекта
                            </div>
                            <div className="max-h-64 overflow-y-auto overscroll-contain">
                              <div
                                ref={(el) => { managerItemRefs.current[0] = el }}
                                tabIndex={-1}
                                onClick={() => {
                                  setProjectData(prev => prev ? { ...prev, project_manager: null } : null)
                                  setSearchManager('')
                                  setShowManagerDropdown(false)
                                }}
                                className={`px-3 py-2 cursor-pointer border-b border-gray-100 dark:border-slate-600 ${
                                  focusedManagerIndex === 0
                                    ? 'bg-blue-50 dark:bg-blue-900/50'
                                    : 'hover:bg-gray-50 dark:hover:bg-slate-600/70'
                                }`}
                              >
                                <div className="font-medium text-gray-500 dark:text-slate-400">
                                  Не назначен
                                </div>
                              </div>
                              {filteredManagers.map((profile, index) => (
                                <div
                                  key={profile.user_id}
                                  ref={(el) => { managerItemRefs.current[index + 1] = el }}
                                  tabIndex={-1}
                                  onClick={() => {
                                    setProjectData(prev => prev ? { ...prev, project_manager: profile.user_id } : null)
                                    setSearchManager('')
                                    setShowManagerDropdown(false)
                                  }}
                                  className={`px-3 py-2 cursor-pointer ${
                                    focusedManagerIndex === index + 1
                                      ? 'bg-blue-50 dark:bg-blue-900/50'
                                      : 'hover:bg-gray-50 dark:hover:bg-slate-600/70'
                                  }`}
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
                  {showEngineerDropdown && engineerDropdown.position && canRenderPortal && (
                    ReactDOM.createPortal(
                        <div
                          style={{
                            position: 'fixed',
                            left: engineerDropdown.position.left,
                            top: engineerDropdown.position.top,
                            width: engineerDropdown.position.width,
                            transform: engineerDropdown.position.openUp ? 'translateY(-8px) translateY(-100%)' : 'translateY(8px)',
                          }}
                          className="z-50"
                          onMouseDown={(e) => e.preventDefault()}
                          onKeyDown={handleEngineerKeyDown}
                        >
                          <div className="bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg shadow-xl ring-1 ring-black/5 overflow-hidden">
                            <div className={DROPDOWN_HEADER_CLASS}>
                              Главный инженер
                            </div>
                            <div className="max-h-64 overflow-y-auto overscroll-contain">
                              <div
                                ref={(el) => { engineerItemRefs.current[0] = el }}
                                tabIndex={-1}
                                onClick={() => {
                                  setProjectData(prev => prev ? { ...prev, project_lead_engineer: null } : null)
                                  setSearchEngineer('')
                                  setShowEngineerDropdown(false)
                                }}
                                className={`px-3 py-2 cursor-pointer border-b border-gray-100 dark:border-slate-600 ${
                                  focusedEngineerIndex === 0
                                    ? 'bg-blue-50 dark:bg-blue-900/50'
                                    : 'hover:bg-gray-50 dark:hover:bg-slate-600/70'
                                }`}
                              >
                                <div className="font-medium text-gray-500 dark:text-slate-400">
                                  Не назначен
                                </div>
                              </div>
                              {filteredEngineers.map((profile, index) => (
                                <div
                                  key={profile.user_id}
                                  ref={(el) => { engineerItemRefs.current[index + 1] = el }}
                                  tabIndex={-1}
                                  onClick={() => {
                                    setProjectData(prev => prev ? { ...prev, project_lead_engineer: profile.user_id } : null)
                                    setSearchEngineer('')
                                    setShowEngineerDropdown(false)
                                  }}
                                  className={`px-3 py-2 cursor-pointer ${
                                    focusedEngineerIndex === index + 1
                                      ? 'bg-blue-50 dark:bg-blue-900/50'
                                      : 'hover:bg-gray-50 dark:hover:bg-slate-600/70'
                                  }`}
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
                  {showClientDropdown && clientDropdown.position && canRenderPortal && (
                    ReactDOM.createPortal(
                        <div
                          style={{
                            position: 'fixed',
                            left: clientDropdown.position.left,
                            top: clientDropdown.position.top,
                            width: clientDropdown.position.width,
                            transform: clientDropdown.position.openUp ? 'translateY(-8px) translateY(-100%)' : 'translateY(8px)',
                          }}
                          className="z-50"
                          onMouseDown={(e) => e.preventDefault()}
                          onKeyDown={handleClientKeyDown}
                        >
                          <div className="bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg shadow-xl ring-1 ring-black/5 overflow-hidden">
                            <div className={DROPDOWN_HEADER_CLASS}>
                              Клиент
                            </div>
                            <div className="max-h-64 overflow-y-auto overscroll-contain">
                              <div
                                ref={(el) => { clientItemRefs.current[0] = el }}
                                tabIndex={-1}
                                onClick={() => {
                                  setProjectData(prev => prev ? { ...prev, client_id: null } : null)
                                  setSearchClient('')
                                  setShowClientDropdown(false)
                                }}
                                className={`px-3 py-2 cursor-pointer border-b border-gray-100 dark:border-slate-600 ${
                                  focusedClientIndex === 0
                                    ? 'bg-blue-50 dark:bg-blue-900/50'
                                    : 'hover:bg-gray-50 dark:hover:bg-slate-600/70'
                                }`}
                              >
                                <div className="font-medium text-gray-500 dark:text-slate-400">
                                  Не назначен
                                </div>
                              </div>
                              {filteredClients.map((client, index) => (
                                <div
                                  key={client.client_id}
                                  ref={(el) => { clientItemRefs.current[index + 1] = el }}
                                  tabIndex={-1}
                                  onClick={() => {
                                    setProjectData(prev => prev ? { ...prev, client_id: client.client_id } : null)
                                    setSearchClient('')
                                    setShowClientDropdown(false)
                                  }}
                                  className={`px-3 py-2 cursor-pointer ${
                                    focusedClientIndex === index + 1
                                      ? 'bg-blue-50 dark:bg-blue-900/50'
                                      : 'hover:bg-gray-50 dark:hover:bg-slate-600/70'
                                  }`}
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
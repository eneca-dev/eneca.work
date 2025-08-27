"use client"

import React, { useEffect, useState } from 'react'
import * as Sentry from '@sentry/nextjs'
import { Save, Loader2 } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { Modal, ModalButton } from '@/components/modals'
import { useUiStore } from '@/stores/useUiStore'
import { createProject } from '@/lib/supabase-client'

interface CreateProjectModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: (projectId: string) => void
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

type ProjectStatus = 'active' | 'archive' | 'paused' | 'canceled'

const supabase = createClient()

export function CreateProjectModal({ isOpen, onClose, onSuccess }: CreateProjectModalProps) {
  const [projectName, setProjectName] = useState('')
  const [projectDescription, setProjectDescription] = useState<string | null>('')
  const [projectStatus, setProjectStatus] = useState<ProjectStatus>('active')
  const [projectManager, setProjectManager] = useState<string | null>(null)
  const [projectLeadEngineer, setProjectLeadEngineer] = useState<string | null>(null)
  const [clientId, setClientId] = useState<string | null>(null)

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

  const { setNotification } = useUiStore()

  useEffect(() => {
    if (!isOpen) return
    setLoading(true)
    Promise.all([loadProfiles(), loadClients()])
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [isOpen])

  const loadProfiles = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('user_id, first_name, last_name, email')
      .order('first_name')
    if (!error) setProfiles(data || [])
  }

  const loadClients = async () => {
    const { data, error } = await supabase
      .from('clients')
      .select('client_id, client_name')
      .order('client_name')
    if (!error) setClients(data || [])
  }

  const getProfileName = (p: Profile) => `${p.first_name} ${p.last_name}`.trim() || p.email
  const selectedManagerName = () => {
    if (!projectManager) return ''
    const m = profiles.find(p => p.user_id === projectManager)
    return m ? getProfileName(m) : ''
  }
  const selectedEngineerName = () => {
    if (!projectLeadEngineer) return ''
    const e = profiles.find(p => p.user_id === projectLeadEngineer)
    return e ? getProfileName(e) : ''
  }
  const selectedClientName = () => {
    if (!clientId) return ''
    const c = clients.find(c => c.client_id === clientId)
    return c ? c.client_name : ''
  }

  const filteredManagers = profiles.filter(p => getProfileName(p).toLowerCase().includes(searchManager.toLowerCase()))
  const filteredEngineers = profiles.filter(p => getProfileName(p).toLowerCase().includes(searchEngineer.toLowerCase()))
  const filteredClients = clients.filter(c => c.client_name.toLowerCase().includes(searchClient.toLowerCase()))

  const handleCreate = async () => {
    if (!projectName.trim()) return
    return Sentry.startSpan(
      { op: 'projects.create_project', name: 'Create Project' },
      async (span) => {
        setSaving(true)
        try {
          span.setAttribute('project.name', projectName)
          span.setAttribute('project.status', projectStatus)
          const result = await createProject({
            project_name: projectName.trim(),
            project_description: projectDescription || null,
            project_status: projectStatus,
            project_manager: projectManager,
            project_lead_engineer: projectLeadEngineer,
            client_id: clientId,
          })
          if (!result.success || !result.projectId) {
            throw new Error(result.error || 'Не удалось создать проект')
          }
          setNotification('Проект создан')
          onSuccess?.(result.projectId)
          onClose()
        } catch (error) {
          Sentry.captureException(error)
          setNotification(error instanceof Error ? error.message : 'Ошибка создания проекта')
        } finally {
          setSaving(false)
        }
      }
    )
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <Modal.Header title="Создание проекта" onClose={onClose} />
      <Modal.Body>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Название проекта */}
            <div>
              <label className="block text-sm font-medium mb-2 dark:text-slate-300">Название проекта *</label>
              <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-slate-700 dark:text-white"
                placeholder="Введите название проекта"
              />
            </div>

            {/* Описание проекта */}
            <div>
              <label className="block text-sm font-medium mb-2 dark:text-slate-300">Описание проекта</label>
              <textarea
                value={projectDescription || ''}
                onChange={(e) => setProjectDescription(e.target.value || null)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-slate-700 dark:text-white"
                placeholder="Введите описание проекта"
              />
            </div>

            {/* Статус */}
            <div>
              <label className="block text-sm font-medium mb-2 dark:text-slate-300">Статус</label>
              <select
                value={projectStatus}
                onChange={(e) => setProjectStatus(e.target.value as ProjectStatus)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-slate-700 dark:text-white"
              >
                <option value="active">Активный</option>
                <option value="paused">Приостановлен</option>
                <option value="archive">Архив</option>
                <option value="canceled">Отменен</option>
              </select>
            </div>

            {/* Руководитель проекта */}
            <div>
              <label className="block text-sm font-medium mb-2 dark:text-slate-300">Руководитель проекта</label>
              <div className="relative">
                <input
                  type="text"
                  value={showManagerDropdown ? searchManager : selectedManagerName()}
                  onChange={(e) => { setSearchManager(e.target.value); setShowManagerDropdown(true) }}
                  onFocus={() => { setSearchManager(''); setShowManagerDropdown(true) }}
                  onBlur={() => { setTimeout(() => setShowManagerDropdown(false), 200) }}
                  placeholder={selectedManagerName() || 'Поиск руководителя проекта...'}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-slate-700 dark:text-white"
                />
                {showManagerDropdown && (
                  <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    <div
                      onClick={() => { setProjectManager(null); setSearchManager(''); setShowManagerDropdown(false) }}
                      className="px-3 py-2 hover:bg-gray-100 dark:hover:bg-slate-600 cursor-pointer border-b dark:border-slate-600"
                    >
                      <div className="font-medium text-gray-500 dark:text-slate-400">Не назначен</div>
                    </div>
                    {filteredManagers.map((p) => (
                      <div
                        key={p.user_id}
                        onClick={() => { setProjectManager(p.user_id); setSearchManager(''); setShowManagerDropdown(false) }}
                        className="px-3 py-2 hover:bg-gray-100 dark:hover:bg-slate-600 cursor-pointer"
                      >
                        <div className="font-medium dark:text-white">{getProfileName(p)}</div>
                        <div className="text-sm text-gray-500 dark:text-slate-400">{p.email}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Главный инженер */}
            <div>
              <label className="block text-sm font-medium mb-2 dark:text-slate-300">Главный инженер</label>
              <div className="relative">
                <input
                  type="text"
                  value={showEngineerDropdown ? searchEngineer : selectedEngineerName()}
                  onChange={(e) => { setSearchEngineer(e.target.value); setShowEngineerDropdown(true) }}
                  onFocus={() => { setSearchEngineer(''); setShowEngineerDropdown(true) }}
                  onBlur={() => { setTimeout(() => setShowEngineerDropdown(false), 200) }}
                  placeholder={selectedEngineerName() || 'Поиск инженера...'}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-slate-700 dark:text-white"
                />
                {showEngineerDropdown && (
                  <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    <div
                      onClick={() => { setProjectLeadEngineer(null); setSearchEngineer(''); setShowEngineerDropdown(false) }}
                      className="px-3 py-2 hover:bg-gray-100 dark:hover:bg-slate-600 cursor-pointer border-b dark:border-slate-600"
                    >
                      <div className="font-medium text-gray-500 dark:text-slate-400">Не назначен</div>
                    </div>
                    {filteredEngineers.map((p) => (
                      <div
                        key={p.user_id}
                        onClick={() => { setProjectLeadEngineer(p.user_id); setSearchEngineer(''); setShowEngineerDropdown(false) }}
                        className="px-3 py-2 hover:bg-gray-100 dark:hover:bg-slate-600 cursor-pointer"
                      >
                        <div className="font-medium dark:text-white">{getProfileName(p)}</div>
                        <div className="text-sm text-gray-500 dark:text-slate-400">{p.email}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Клиент */}
            <div>
              <label className="block text-sm font-medium mb-2 dark:text-slate-300">Клиент</label>
              <div className="relative">
                <input
                  type="text"
                  value={showClientDropdown ? searchClient : selectedClientName()}
                  onChange={(e) => { setSearchClient(e.target.value); setShowClientDropdown(true) }}
                  onFocus={() => { setSearchClient(''); setShowClientDropdown(true) }}
                  onBlur={() => { setTimeout(() => setShowClientDropdown(false), 200) }}
                  placeholder={selectedClientName() || 'Поиск клиента...'}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-slate-700 dark:text-white"
                />
                {showClientDropdown && (
                  <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    <div
                      onClick={() => { setClientId(null); setSearchClient(''); setShowClientDropdown(false) }}
                      className="px-3 py-2 hover:bg-gray-100 dark:hover:bg-slate-600 cursor-pointer border-b dark:border-slate-600"
                    >
                      <div className="font-medium text-gray-500 dark:text-slate-400">Не назначен</div>
                    </div>
                    {filteredClients.map((c) => (
                      <div
                        key={c.client_id}
                        onClick={() => { setClientId(c.client_id); setSearchClient(''); setShowClientDropdown(false) }}
                        className="px-3 py-2 hover:bg-gray-100 dark:hover:bg-slate-600 cursor-pointer"
                      >
                        <div className="font-medium dark:text-white">{c.client_name}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal.Body>
      <Modal.Footer>
        <div className="flex justify-end w-full gap-3">
          <ModalButton variant="cancel" onClick={onClose}>Отмена</ModalButton>
          <ModalButton
            variant="success"
            onClick={handleCreate}
            disabled={!projectName.trim()}
            loading={saving}
            icon={<Save />}
          >
            {saving ? 'Создание...' : 'Создать'}
          </ModalButton>
        </div>
      </Modal.Footer>
    </Modal>
  )
}



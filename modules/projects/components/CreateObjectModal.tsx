"use client"

import React, { useState, useEffect, useRef } from 'react'
import * as Sentry from "@sentry/nextjs"
import { Save, Loader2 } from 'lucide-react'
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
  const inputWrapperRef = useRef<HTMLDivElement>(null)
  const [dropdownPosition, setDropdownPosition] = useState<{ left: number; top: number; width: number; openUp: boolean } | null>(null)
  
  const { setNotification } = useUiStore()

  useEffect(() => {
    if (isOpen) {
      loadProfiles()
    }
  }, [isOpen])

  const loadProfiles = async () => {
    return Sentry.startSpan(
      {
        op: "projects.load_profiles",
        name: "Load Profiles for Object Creation",
      },
      async (span) => {
        try {
          span.setAttribute("stage.id", stageId)
          span.setAttribute("stage.name", stageName)
          
          const { data, error } = await supabase
            .from('profiles')
            .select('user_id, first_name, last_name, email')
            .order('first_name')

          if (error) {
            span.setAttribute("load.success", false)
            span.setAttribute("load.error", error.message)
            Sentry.captureException(error, {
              tags: { 
                module: 'projects', 
                action: 'load_profiles',
                error_type: 'db_error'
              },
              extra: { 
                component: 'CreateObjectModal',
                stage_id: stageId,
                stage_name: stageName,
                timestamp: new Date().toISOString()
              }
            })
            throw error
          }
          
          span.setAttribute("load.success", true)
          span.setAttribute("profiles.count", data?.length || 0)
          setProfiles(data || [])
        } catch (error) {
          span.recordException(error as Error)
          Sentry.captureException(error, {
            tags: { 
              module: 'projects', 
              action: 'load_profiles',
              error_type: 'unexpected_error'
            },
            extra: { 
              component: 'CreateObjectModal',
              stage_id: stageId,
              stage_name: stageName,
              timestamp: new Date().toISOString()
            }
          })
          console.error('Ошибка загрузки профилей:', error)
        }
      }
    )
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

  const updateDropdownPosition = () => {
    if (!inputWrapperRef.current) return
    const rect = inputWrapperRef.current.getBoundingClientRect()
    const viewportSpaceBelow = window.innerHeight - rect.bottom
    const openUp = viewportSpaceBelow < 160 && rect.top > viewportSpaceBelow
    setDropdownPosition({ left: rect.left, top: openUp ? rect.top : rect.bottom, width: rect.width, openUp })
  }

  useEffect(() => {
    if (!showResponsibleDropdown) return
    updateDropdownPosition()
    const handlers = [
      ['scroll', updateDropdownPosition, true],
      ['resize', updateDropdownPosition, false],
    ] as const
    handlers.forEach(([event, fn, capture]) => window.addEventListener(event, fn as EventListener, capture))
    return () => handlers.forEach(([event, fn, capture]) => window.removeEventListener(event, fn as EventListener, capture))
  }, [showResponsibleDropdown])

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    
    console.log('Создание объекта:', { objectName, trimmed: objectName.trim(), length: objectName.trim().length })
    
    if (!objectName.trim()) {
      setNotification('Название объекта обязательно')
      return
    }

    return Sentry.startSpan(
      {
        op: "projects.create_object",
        name: "Create Object",
      },
      async (span) => {
        setLoading(true)
        try {
          span.setAttribute("object.name", objectName.trim())
          span.setAttribute("stage.id", stageId)
          span.setAttribute("stage.name", stageName)
          span.setAttribute("object.has_responsible", !!objectResponsible)
          span.setAttribute("object.has_dates", !!(objectStartDate && objectEndDate))

          const { data: created, error } = await supabase
            .from('objects')
            .insert({
              object_name: objectName.trim(),
              object_description: objectDescription.trim() || null,
              object_responsible: objectResponsible || null,
              object_start_date: objectStartDate || null,
              object_end_date: objectEndDate || null,
              object_stage_id: stageId
            })
            .select('object_id, object_name, object_stage_id')
            .single()

          if (error) {
            span.setAttribute("create.success", false)
            span.setAttribute("create.error", error.message)
            Sentry.captureException(error, {
              tags: { 
                module: 'projects', 
                action: 'create_object',
                error_type: 'db_error'
              },
              extra: { 
                component: 'CreateObjectModal',
                object_name: objectName.trim(),
                stage_id: stageId,
                stage_name: stageName,
                responsible_id: objectResponsible,
                timestamp: new Date().toISOString()
              }
            })
            throw error
          }

          span.setAttribute("create.success", true)
          
          Sentry.addBreadcrumb({
            message: 'Object created successfully',
            category: 'projects',
            level: 'info',
            data: { 
              object_name: objectName.trim(),
              stage_id: stageId,
              stage_name: stageName,
              has_responsible: !!objectResponsible
            }
          })

          setNotification(`Объект "${objectName}" успешно создан`)
          // Немедленно обновляем дерево и фокусируемся на созданном объекте
          try {
            if (typeof window !== 'undefined' && created?.object_id) {
              const detail = { entity: 'object', id: created.object_id as string }
              window.dispatchEvent(new CustomEvent('projectsTree:created', { detail }))
              window.dispatchEvent(new CustomEvent('projectsTree:focusNode', { detail }))
            }
          } catch (_) {}
          onSuccess()
          handleClose()
        } catch (error) {
          span.setAttribute("create.success", false)
          span.recordException(error as Error)
          Sentry.captureException(error, {
            tags: { 
              module: 'projects', 
              action: 'create_object',
              error_type: 'unexpected_error'
            },
            extra: { 
              component: 'CreateObjectModal',
              object_name: objectName.trim(),
              stage_id: stageId,
              stage_name: stageName,
              timestamp: new Date().toISOString()
            }
          })
          console.error('Ошибка создания объекта:', error)
          setNotification(error instanceof Error ? error.message : 'Ошибка создания объекта')
        } finally {
          setLoading(false)
        }
      }
    )
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
    <Modal isOpen={isOpen} onClose={handleClose} size="md">
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
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 focus-visible:border-transparent ring-offset-white dark:ring-offset-slate-800 dark:bg-slate-800 dark:text-white"
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
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 focus-visible:border-transparent focus-visible:placeholder-green-600 ring-offset-white dark:ring-offset-slate-800 dark:bg-slate-800 dark:text-white placeholder-gray-400 dark:placeholder-slate-500"
              placeholder="Введите описание объекта (необязательно)"
              disabled={loading}
            />
          </div>
          {/* Ответственный удалён по требованиям */}

          {/* Даты начала/окончания удалены по требованиям */}
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
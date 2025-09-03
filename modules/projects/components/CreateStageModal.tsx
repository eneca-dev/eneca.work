"use client"

import React, { useState } from 'react'
import * as Sentry from "@sentry/nextjs"
import { Save, Loader2 } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { useUiStore } from '@/stores/useUiStore'
import { Modal, ModalButton } from '@/components/modals'

interface CreateStageModalProps {
  isOpen: boolean
  onClose: () => void
  projectId: string
  projectName: string
  onSuccess: () => void
}

const supabase = createClient()

export function CreateStageModal({ isOpen, onClose, projectId, projectName, onSuccess }: CreateStageModalProps) {
  const [stageName, setStageName] = useState('')
  const [stageDescription, setStageDescription] = useState('')
  const [loading, setLoading] = useState(false)
  
  const { setNotification } = useUiStore()

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    
    console.log('Создание стадии:', { stageName, trimmed: stageName.trim(), length: stageName.trim().length })
    
    if (!stageName.trim()) {
      setNotification('Название стадии обязательно')
      return
    }

    return Sentry.startSpan(
      {
        op: "projects.create_stage",
        name: "Create Stage",
      },
      async (span) => {
        setLoading(true)
        try {
          span.setAttribute("stage.name", stageName.trim())
          span.setAttribute("project.id", projectId)
          span.setAttribute("project.name", projectName)
          span.setAttribute("stage.has_description", !!stageDescription.trim())

          const { data: created, error } = await supabase
            .from('stages')
            .insert({
              stage_name: stageName.trim(),
              stage_description: stageDescription.trim() || null,
              stage_project_id: projectId
            })
            .select('stage_id, stage_name, stage_project_id')
            .single()

          if (error) {
            span.setAttribute("create.success", false)
            span.setAttribute("create.error", error.message)
            Sentry.captureException(error, {
              tags: { 
                module: 'projects', 
                action: 'create_stage',
                error_type: 'db_error'
              },
              extra: { 
                component: 'CreateStageModal',
                stage_name: stageName.trim(),
                project_id: projectId,
                project_name: projectName,
                timestamp: new Date().toISOString()
              }
            })
            throw error
          }

          span.setAttribute("create.success", true)
          
          Sentry.addBreadcrumb({
            message: 'Stage created successfully',
            category: 'projects',
            level: 'info',
            data: { 
              stage_name: stageName.trim(),
              project_id: projectId,
              project_name: projectName,
              has_description: !!stageDescription.trim()
            }
          })

          setNotification(`Стадия "${stageName}" успешно создана`)
          // Немедленно обновляем дерево и фокусируемся на созданной стадии
          try {
            if (typeof window !== 'undefined' && created?.stage_id) {
              const detail = { entity: 'stage', id: created.stage_id as string }
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
              action: 'create_stage',
              error_type: 'unexpected_error'
            },
            extra: { 
              component: 'CreateStageModal',
              stage_name: stageName.trim(),
              project_id: projectId,
              project_name: projectName,
              timestamp: new Date().toISOString()
            }
          })
          console.error('Ошибка создания стадии:', error)
          setNotification(error instanceof Error ? error.message : 'Ошибка создания стадии')
        } finally {
          setLoading(false)
        }
      }
    )
  }

  const handleClose = () => {
    setStageName('')
    setStageDescription('')
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="md">
      <Modal.Header 
        title="Создать новую стадию" 
        subtitle={`Проект: ${projectName}`}
      />
      
      <Modal.Body>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2 dark:text-slate-300 text-slate-700">
              Название стадии *
            </label>
            <input
              type="text"
              value={stageName}
              onChange={(e) => setStageName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-slate-800 dark:text-white"
              placeholder="Введите название стадии"
              disabled={loading}
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 dark:text-slate-300 text-slate-700">
              Описание
            </label>
            <textarea
              value={stageDescription}
              onChange={(e) => setStageDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-slate-800 dark:text-white"
              placeholder="Введите описание стадии (необязательно)"
              disabled={loading}
            />
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
          disabled={loading || !stageName.trim()}
          icon={loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        >
          {loading ? 'Создание...' : 'Создать стадию'}
        </ModalButton>
      </Modal.Footer>
    </Modal>
  )
} 
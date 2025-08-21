"use client"

import React, { useState, useEffect } from 'react'
import * as Sentry from "@sentry/nextjs"
import { AlertTriangle, Trash2, Loader2 } from 'lucide-react'
import { Modal, ModalButton, useModalState } from '@/components/modals'
import { createClient } from '@/utils/supabase/client'

interface ProjectStats {
  stages_count: number
  objects_count: number
  sections_count: number
  tasks_count: number
  loadings_count: number
  assignments_count: number
  contracts_count: number
  decompositions_count: number
}

interface DeleteProjectModalProps {
  isOpen: boolean
  onClose: () => void
  projectId: string
  projectName: string
  onSuccess: () => void
}

const supabase = createClient()

export function DeleteProjectModal({ 
  isOpen, 
  onClose, 
  projectId, 
  projectName, 
  onSuccess 
}: DeleteProjectModalProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  const [stats, setStats] = useState<ProjectStats | null>(null)
  const [isLoadingStats, setIsLoadingStats] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Загружаем статистику при открытии модального окна
  useEffect(() => {
    if (isOpen && projectId) {
      loadProjectStats()
    }
  }, [isOpen, projectId])

  const loadProjectStats = async () => {
    return Sentry.startSpan(
      {
        op: "projects.load_delete_stats",
        name: "Load Project Delete Statistics",
      },
      async (span) => {
        setIsLoadingStats(true)
        setError(null)
        
        try {
          span.setAttribute("project.id", projectId)
          span.setAttribute("project.name", projectName)
          
          const { data, error } = await supabase.rpc('get_project_delete_stats', {
            project_id_param: projectId
          })
          
          if (error) {
            span.setAttribute("load.success", false)
            span.setAttribute("load.error", error.message)
            Sentry.captureException(error, {
              tags: { 
                module: 'projects', 
                action: 'load_delete_stats',
                error_type: 'db_error'
              },
              extra: { 
                component: 'DeleteProjectModal',
                project_id: projectId,
                project_name: projectName,
                timestamp: new Date().toISOString()
              }
            })
            console.error('Ошибка загрузки статистики:', error)
            setError('Не удалось загрузить статистику проекта')
          } else {
            const statsData = data[0] || {
              stages_count: 0,
              objects_count: 0,
              sections_count: 0,
              tasks_count: 0,
              loadings_count: 0,
              assignments_count: 0,
              contracts_count: 0,
              decompositions_count: 0
            }
            
            span.setAttribute("load.success", true)
            span.setAttribute("stats.stages", statsData.stages_count)
            span.setAttribute("stats.objects", statsData.objects_count)
            span.setAttribute("stats.sections", statsData.sections_count)
            setStats(statsData)
            
            Sentry.addBreadcrumb({
              message: 'Project delete stats loaded',
              category: 'projects',
              level: 'info',
              data: { 
                project_id: projectId,
                project_name: projectName,
                total_stages: statsData.stages_count,
                total_objects: statsData.objects_count,
                total_sections: statsData.sections_count
              }
            })
          }
        } catch (err) {
          span.setAttribute("load.success", false)
          span.recordException(err as Error)
          Sentry.captureException(err, {
            tags: { 
              module: 'projects', 
              action: 'load_delete_stats',
              error_type: 'unexpected_error'
            },
            extra: { 
              component: 'DeleteProjectModal',
              project_id: projectId,
              project_name: projectName,
              timestamp: new Date().toISOString()
            }
          })
          console.error('Ошибка:', err)
          setError('Произошла ошибка при загрузке данных')
        } finally {
          setIsLoadingStats(false)
        }
      }
    )
  }

  const handleDelete = async () => {
    if (!projectId) return

    return Sentry.startSpan(
      {
        op: "projects.delete_project",
        name: "Delete Project Cascade",
      },
      async (span) => {
        setIsDeleting(true)
        setError(null)

        try {
          span.setAttribute("project.id", projectId)
          span.setAttribute("project.name", projectName)
          if (stats) {
            span.setAttribute("delete.stages_count", stats.stages_count)
            span.setAttribute("delete.objects_count", stats.objects_count)
            span.setAttribute("delete.sections_count", stats.sections_count)
            span.setAttribute("delete.tasks_count", stats.tasks_count)
          }

          // Удаляем проект
          const { error } = await supabase.rpc('delete_project_cascade', {
            project_id_param: projectId
          })

          if (error) {
            span.setAttribute("delete.success", false)
            span.setAttribute("delete.error", error.message)
            Sentry.captureException(error, {
              tags: { 
                module: 'projects', 
                action: 'delete_project',
                error_type: 'cascade_delete_failed'
              },
              extra: { 
                component: 'DeleteProjectModal',
                project_id: projectId,
                project_name: projectName,
                stats: stats,
                timestamp: new Date().toISOString()
              }
            })
            console.error('Ошибка удаления проекта:', error)
            setError(error.message || 'Не удалось удалить проект')
            return
          }

          // Проверяем что проект действительно удален
          const { data: verificationData, error: verifyError } = await supabase.rpc('verify_project_deleted', {
            project_id_param: projectId
          })

          if (verifyError) {
            span.setAttribute("verify.success", false)
            span.setAttribute("verify.error", verifyError.message)
            Sentry.captureException(verifyError, {
              tags: { 
                module: 'projects', 
                action: 'verify_project_deleted',
                error_type: 'verification_failed'
              },
              extra: { 
                component: 'DeleteProjectModal',
                project_id: projectId,
                project_name: projectName,
                timestamp: new Date().toISOString()
              }
            })
            console.error('Ошибка проверки удаления:', verifyError)
            setError('Не удалось проверить результат удаления')
            return
          }

          const verification = verificationData?.[0]
          if (verification?.project_exists) {
            // Проект все еще существует
            const deps = verification.remaining_dependencies
            const remainingItems = Object.entries(deps || {})
              .filter(([_, count]) => Number(count) > 0)
              .map(([type, count]) => `${type}: ${count}`)
              .join(', ')
            
            span.setAttribute("delete.success", false)
            span.setAttribute("delete.incomplete", true)
            span.setAttribute("remaining_dependencies", remainingItems)
            
            Sentry.captureMessage('Project deletion incomplete - dependencies remain', {
              level: 'warning',
              tags: { 
                module: 'projects', 
                action: 'delete_project',
                error_type: 'incomplete_deletion'
              },
              extra: { 
                project_id: projectId,
                project_name: projectName,
                remaining_dependencies: deps,
                timestamp: new Date().toISOString()
              }
            })
            
            setError(`Проект не был удален полностью. Остались зависимости: ${remainingItems}`)
            return
          }

          // Проект успешно удален
          span.setAttribute("delete.success", true)
          span.setAttribute("verify.success", true)
          
          console.log('✅ Проект успешно удален и проверен')
          
          Sentry.addBreadcrumb({
            message: 'Project deleted successfully',
            category: 'projects',
            level: 'info',
            data: { 
              project_id: projectId,
              project_name: projectName,
              deleted_stats: stats
            }
          })
          
          // Показываем детальное уведомление об успешном удалении
          const deletedStats = stats ? [
            `${stats.stages_count} стадий`,
            `${stats.objects_count} объектов`, 
            `${stats.sections_count} разделов`,
            `${stats.tasks_count} задач`,
            `${stats.loadings_count} загрузок`,
            `${stats.assignments_count} передач`,
            `${stats.contracts_count} договоров`,
            `${stats.decompositions_count} декомпозиций`
          ].filter((item, idx) => [
            stats.stages_count, stats.objects_count, stats.sections_count, 
            stats.tasks_count, stats.loadings_count, stats.assignments_count,
            stats.contracts_count, stats.decompositions_count
          ][idx] > 0).join(', ') : ''
          
          setTimeout(() => {
            alert(`✅ Проект "${projectName}" успешно удален!\n\nТакже удалено: ${deletedStats || 'нет связанных данных'}`)
          }, 100)
          
          onSuccess()
          onClose()
        } catch (err) {
          span.setAttribute("delete.success", false)
          span.recordException(err as Error)
          Sentry.captureException(err, {
            tags: { 
              module: 'projects', 
              action: 'delete_project',
              error_type: 'unexpected_error'
            },
            extra: { 
              component: 'DeleteProjectModal',
              project_id: projectId,
              project_name: projectName,
              timestamp: new Date().toISOString()
            }
          })
          console.error('Ошибка:', err)
          setError('Произошла ошибка при удалении проекта')
        } finally {
          setIsDeleting(false)
        }
      }
    )
  }

  const handleClose = () => {
    if (!isDeleting) {
      setError(null)
      setStats(null)
      onClose()
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="lg">
      <Modal.Header 
        title="Удаление проекта"
        subtitle="Это действие нельзя отменить"
      />
      
      <Modal.Body>
        <div className="space-y-6">
          {/* Предупреждение */}
          <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
            <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-red-800 dark:text-red-200 mb-1">
                Внимание! Данное действие необратимо
              </h3>
              <p className="text-sm text-red-700 dark:text-red-300">
                Будет удален проект <strong>"{projectName}"</strong> и все связанные с ним данные.
              </p>
            </div>
          </div>

          {/* Статистика */}
          <div>
            <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">
              Будет удалено:
            </h4>
            
            {isLoadingStats ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                <span className="ml-2 text-gray-500">Загрузка статистики...</span>
              </div>
            ) : error ? (
              <div className="text-red-600 dark:text-red-400 text-sm">
                {error}
              </div>
            ) : stats ? (
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Стадии:</span>
                  <span className="font-semibold text-gray-900 dark:text-gray-100">{stats.stages_count}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Объекты:</span>
                  <span className="font-semibold text-gray-900 dark:text-gray-100">{stats.objects_count}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Разделы:</span>
                  <span className="font-semibold text-gray-900 dark:text-gray-100">{stats.sections_count}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Задачи:</span>
                  <span className="font-semibold text-gray-900 dark:text-gray-100">{stats.tasks_count}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Загрузки:</span>
                  <span className="font-semibold text-gray-900 dark:text-gray-100">{stats.loadings_count}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Передачи:</span>
                  <span className="font-semibold text-gray-900 dark:text-gray-100">{stats.assignments_count}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Договоры:</span>
                  <span className="font-semibold text-gray-900 dark:text-gray-100">{stats.contracts_count}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Декомпозиции:</span>
                  <span className="font-semibold text-gray-900 dark:text-gray-100">{stats.decompositions_count}</span>
                </div>
              </div>
            ) : null}
          </div>

          {/* Ошибка */}
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}
        </div>
      </Modal.Body>

      <Modal.Footer>
        <ModalButton variant="cancel" onClick={handleClose} disabled={isDeleting}>
          Отмена
        </ModalButton>
        <ModalButton 
          variant="danger" 
          onClick={handleDelete}
          loading={isDeleting}
          disabled={isLoadingStats || !!error}
          icon={<Trash2 />}
        >
          Удалить проект
        </ModalButton>
      </Modal.Footer>
    </Modal>
  )
} 
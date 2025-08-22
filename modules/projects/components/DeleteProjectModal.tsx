"use client"

import React, { useState, useEffect } from 'react'
import * as Sentry from "@sentry/nextjs"
import { AlertTriangle, Trash2, Loader2, Info, CheckCircle, XCircle } from 'lucide-react'
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
  const [deleteResult, setDeleteResult] = useState<{success: boolean, message: string, deletedCounts?: any} | null>(null)

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
        name: "Delete Project Safe",
      },
      async (span) => {
        setIsDeleting(true)
        setError(null)
        setDeleteResult(null)

        try {
          span.setAttribute("project.id", projectId)
          span.setAttribute("project.name", projectName)
          if (stats) {
            span.setAttribute("delete.stages_count", stats.stages_count)
            span.setAttribute("delete.objects_count", stats.objects_count)
            span.setAttribute("delete.sections_count", stats.sections_count)
            span.setAttribute("delete.tasks_count", stats.tasks_count)
          }

          // Используем новую безопасную функцию удаления
          const { data, error } = await supabase.rpc('safe_delete_project', {
            project_id_param: projectId
          })

          if (error) {
            span.setAttribute("delete.success", false)
            span.setAttribute("delete.error", error.message)
            Sentry.captureException(error, {
              tags: { 
                module: 'projects', 
                action: 'delete_project',
                error_type: 'safe_delete_failed'
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

          const result = data?.[0]
          if (result?.success) {
            span.setAttribute("delete.success", true)
            span.setAttribute("delete.message", result.message)
            
            setDeleteResult({
              success: true,
              message: result.message,
              deletedCounts: result.deleted_counts
            })
            
            Sentry.addBreadcrumb({
              message: 'Project deleted successfully',
              category: 'projects',
              level: 'info',
              data: { 
                project_id: projectId,
                project_name: projectName,
                deleted_counts: result.deleted_counts
              }
            })
            
            // Закрываем модальное окно через 2 секунды
            setTimeout(() => {
              onSuccess()
              onClose()
            }, 2000)
          } else {
            span.setAttribute("delete.success", false)
            span.setAttribute("delete.message", result?.message || 'Неизвестная ошибка')
            
            setDeleteResult({
              success: false,
              message: result?.message || 'Неизвестная ошибка при удалении'
            })
            
            Sentry.captureException(new Error(result?.message || 'Неизвестная ошибка при удалении'), {
              tags: { 
                module: 'projects', 
                action: 'delete_project',
                error_type: 'delete_failed'
              },
              extra: { 
                component: 'DeleteProjectModal',
                project_id: projectId,
                project_name: projectName,
                result: result,
                timestamp: new Date().toISOString()
              }
            })
          }
          
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
          setError('Произошла непредвиденная ошибка при удалении проекта')
        } finally {
          setIsDeleting(false)
        }
      }
    )
  }

  const renderStats = () => {
    if (!stats) return null

    const statItems = [
      { label: 'Стадии', count: stats.stages_count, icon: '🏗️' },
      { label: 'Объекты', count: stats.objects_count, icon: '🏢' },
      { label: 'Разделы', count: stats.sections_count, icon: '📋' },
      { label: 'Задачи', count: stats.tasks_count, icon: '✅' },
      { label: 'Загрузки', count: stats.loadings_count, icon: '⏰' },
      { label: 'Передачи', count: stats.assignments_count, icon: '🔄' },
      { label: 'Договоры', count: stats.contracts_count, icon: '📄' },
      { label: 'Декомпозиция', count: stats.decompositions_count, icon: '🔧' }
    ]

    return (
      <div className="space-y-3">
        <h4 className="font-medium text-gray-900">Будет удалено:</h4>
        <div className="grid grid-cols-2 gap-3">
          {statItems.map((item) => (
            <div key={item.label} className="flex items-center space-x-2 p-2 bg-gray-50 rounded-lg">
              <span className="text-lg">{item.icon}</span>
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-700">{item.label}</div>
                <div className="text-lg font-bold text-gray-900">{item.count}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  const renderDeleteResult = () => {
    if (!deleteResult) return null

    if (deleteResult.success) {
      return (
        <div className="flex items-center space-x-3 p-4 bg-green-50 border border-green-200 rounded-lg">
          <CheckCircle className="h-6 w-6 text-green-600" />
          <div>
            <h4 className="font-medium text-green-900">Проект успешно удален!</h4>
            <p className="text-sm text-green-700">{deleteResult.message}</p>
            {deleteResult.deletedCounts && (
              <div className="mt-2 text-xs text-green-600">
                Удалено записей: {Object.values(deleteResult.deletedCounts).reduce((a: any, b: any) => a + b, 0)}
              </div>
            )}
          </div>
        </div>
      )
    } else {
      return (
        <div className="flex items-center space-x-3 p-4 bg-red-50 border border-red-200 rounded-lg">
          <XCircle className="h-6 w-6 text-red-600" />
          <div>
            <h4 className="font-medium text-red-900">Ошибка удаления</h4>
            <p className="text-sm text-red-700">{deleteResult.message}</p>
          </div>
        </div>
      )
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <Modal.Header 
        title="Удаление проекта" 
        subtitle={`Вы собираетесь удалить проект "${projectName}"`}
      />
      
      <Modal.Body>
        <div className="space-y-6">
          {/* Предупреждение */}
          <div className="flex items-start space-x-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
            <div>
              <h4 className="font-medium text-amber-900">Внимание!</h4>
              <p className="text-sm text-amber-700">
                Это действие нельзя отменить. Все связанные данные (стадии, объекты, разделы, задачи, загрузки, передачи, договоры, элементы декомпозиции) будут безвозвратно удалены.
              </p>
            </div>
          </div>

          {/* Статистика */}
          {isLoadingStats ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              <span className="ml-2 text-gray-600">Загрузка статистики...</span>
            </div>
          ) : error ? (
            <div className="flex items-center space-x-3 p-4 bg-red-50 border border-red-200 rounded-lg">
              <XCircle className="h-5 w-5 text-red-600" />
              <div>
                <h4 className="font-medium text-red-900">Ошибка загрузки</h4>
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          ) : (
            stats && renderStats()
          )}

          {/* Результат удаления */}
          {renderDeleteResult()}
        </div>
      </Modal.Body>

      <Modal.Footer>
        <ModalButton variant="cancel" onClick={onClose} disabled={isDeleting}>
          Отмена
        </ModalButton>
        <ModalButton 
          variant="danger" 
          onClick={handleDelete} 
          disabled={isDeleting || isLoadingStats || !!error}
          icon={isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 />}
        >
          {isDeleting ? 'Удаление...' : 'Удалить проект'}
        </ModalButton>
      </Modal.Footer>
    </Modal>
  )
} 
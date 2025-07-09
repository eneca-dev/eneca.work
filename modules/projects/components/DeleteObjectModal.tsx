"use client"

import React, { useState, useEffect } from 'react'
import { AlertTriangle, Loader2, Trash2 } from 'lucide-react'
import { useUiStore } from '@/stores/useUiStore'
import { Modal, ModalButton } from '@/components/modals'

interface DeleteObjectModalProps {
  isOpen: boolean
  onClose: () => void
  objectId: string
  objectName: string
  onSuccess?: () => void
}

interface DeleteStats {
  sections_count: number
  loadings_count: number
  assignments_count: number
  tasks_count: number
}

export function DeleteObjectModal({ 
  isOpen, 
  onClose, 
  objectId, 
  objectName,
  onSuccess 
}: DeleteObjectModalProps) {
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [stats, setStats] = useState<DeleteStats | null>(null)
  const [confirmText, setConfirmText] = useState('')
  const { setNotification } = useUiStore()

  // Загрузка статистики при открытии
  useEffect(() => {
    if (isOpen && objectId) {
      loadDeleteStats()
    }
  }, [isOpen, objectId])

  const loadDeleteStats = async () => {
    setLoading(true)
    try {
      const { createClient } = await import('@/utils/supabase/client')
      const supabase = createClient()
      
      // Подсчитываем разделы
      const { count: sectionsCount } = await supabase
        .from('sections')
        .select('*', { count: 'exact', head: true })
        .eq('section_object_id', objectId)

      // Подсчитываем загрузки через разделы
      const { count: loadingsCount } = await supabase
        .from('loadings')
        .select('*, sections!inner(*)', { count: 'exact', head: true })
        .eq('sections.section_object_id', objectId)

      // Подсчитываем передачи через разделы
      const { count: assignmentsCount } = await supabase
        .from('assignments')
        .select('*, sections!inner(*)', { count: 'exact', head: true })
        .eq('sections.section_object_id', objectId)

      // Подсчитываем задачи через разделы
      const { count: tasksCount } = await supabase
        .from('tasks')
        .select('*, sections!inner(*)', { count: 'exact', head: true })
        .eq('sections.section_object_id', objectId)

      setStats({
        sections_count: sectionsCount || 0,
        loadings_count: loadingsCount || 0,
        assignments_count: assignmentsCount || 0,
        tasks_count: tasksCount || 0
      })
    } catch (error) {
      console.error('Ошибка загрузки статистики удаления:', error)
      setNotification('Ошибка загрузки статистики удаления объекта')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (confirmText !== objectName) {
      setNotification('Введите точное название объекта для подтверждения')
      return
    }

    setDeleting(true)
    try {
      const { createClient } = await import('@/utils/supabase/client')
      const supabase = createClient()

      // Выполняем каскадное удаление в правильном порядке
      
      // 1. Получаем все разделы объекта
      const { data: sections } = await supabase
        .from('sections')
        .select('section_id')
        .eq('section_object_id', objectId)

      if (sections && sections.length > 0) {
        const sectionIds = sections.map(s => s.section_id)
        
        // 2. Удаляем plan_loadings для всех загрузок в разделах объекта
        const { data: loadings } = await supabase
          .from('loadings')
          .select('loading_id')
          .in('loading_section_id', sectionIds)

        if (loadings && loadings.length > 0) {
          const loadingIds = loadings.map(l => l.loading_id)
          await supabase
            .from('plan_loadings')
            .delete()
            .in('plan_loading_id', loadingIds)
        }
        
        // 3. Удаляем assignments для разделов объекта
        await supabase
          .from('assignments')
          .delete()
          .in('assignment_section_id', sectionIds)
        
        // 4. Удаляем decompositions для разделов объекта
        await supabase
          .from('decompositions')
          .delete()
          .in('decomposition_section_id', sectionIds)
        
        // 5. Удаляем tasks для разделов объекта
        await supabase
          .from('tasks')
          .delete()
          .in('task_section_id', sectionIds)
        
        // 6. Удаляем loadings для разделов объекта
        await supabase
          .from('loadings')
          .delete()
          .in('loading_section_id', sectionIds)
        
        // 7. Удаляем sections объекта
        await supabase
          .from('sections')
          .delete()
          .in('section_id', sectionIds)
      }
      
      // 8. Удаляем сам объект
      const { error: deleteError } = await supabase
        .from('objects')
        .delete()
        .eq('object_id', objectId)

      if (deleteError) {
        throw new Error(`Ошибка удаления объекта: ${deleteError.message}`)
      }

      // Проверяем что объект действительно удален
      const { data: remainingObject } = await supabase
        .from('objects')
        .select('object_id')
        .eq('object_id', objectId)
        .maybeSingle()

      if (remainingObject) {
        throw new Error('Объект не был удален. Возможно, остались зависимости.')
      }

      // Формируем сообщение об успешном удалении
      let message = '✅ Объект успешно удален!'
      if (stats) {
        const deletedItems = []
        if (stats.sections_count > 0) deletedItems.push(`${stats.sections_count} разделов`)
        if (stats.tasks_count > 0) deletedItems.push(`${stats.tasks_count} задач`)
        if (stats.loadings_count > 0) deletedItems.push(`${stats.loadings_count} загрузок`)
        if (stats.assignments_count > 0) deletedItems.push(`${stats.assignments_count} передач`)
        
        if (deletedItems.length > 0) {
          message += ` Также удалено: ${deletedItems.join(', ')}`
        }
      }

      setNotification(message)
      onSuccess?.()
      onClose()
    } catch (error) {
      console.error('Ошибка удаления объекта:', error)
      setNotification(error instanceof Error ? error.message : 'Ошибка удаления объекта')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <Modal.Header 
        title="Удаление объекта" 
        onClose={onClose}
      />
      
      <Modal.Body>
        <div className="space-y-6">
          {/* Предупреждение */}
          <div className="flex items-start gap-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-red-900 dark:text-red-100 mb-2">
                Внимание! Необратимое действие
              </h4>
              <p className="text-red-800 dark:text-red-200 text-sm">
                Удаление объекта приведет к каскадному удалению всех связанных данных:
                разделов, задач, загрузок и передач. Это действие нельзя отменить.
              </p>
            </div>
          </div>

          {/* Информация об объекте */}
          <div>
            <h4 className="font-semibold mb-2 dark:text-slate-200">Объект для удаления:</h4>
            <p className="text-lg font-medium text-red-600 dark:text-red-400">
              {objectName}
            </p>
          </div>

          {/* Статистика удаления */}
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
              <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">
                Подсчет связанных данных...
              </span>
            </div>
          ) : stats ? (
            <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-lg">
              <h4 className="font-semibold mb-3 dark:text-slate-200">
                Данные для удаления:
              </h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex justify-between">
                  <span className="dark:text-slate-300">Разделы:</span>
                  <span className="font-medium text-red-600 dark:text-red-400">
                    {stats.sections_count}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="dark:text-slate-300">Задачи:</span>
                  <span className="font-medium text-red-600 dark:text-red-400">
                    {stats.tasks_count}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="dark:text-slate-300">Загрузки:</span>
                  <span className="font-medium text-red-600 dark:text-red-400">
                    {stats.loadings_count}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="dark:text-slate-300">Передачи:</span>
                  <span className="font-medium text-red-600 dark:text-red-400">
                    {stats.assignments_count}
                  </span>
                </div>
              </div>
            </div>
          ) : null}

          {/* Подтверждение */}
          <div>
            <label className="block text-sm font-medium mb-2 dark:text-slate-300">
              Для подтверждения введите точное название объекта:
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={objectName}
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent dark:bg-slate-700 dark:text-white"
            />
          </div>
        </div>
      </Modal.Body>

      <Modal.Footer>
        <div className="flex gap-3 w-full justify-end">
          <ModalButton
            variant="cancel"
            onClick={onClose}
            disabled={deleting}
          >
            Отмена
          </ModalButton>
          <ModalButton
            variant="danger"
            onClick={handleDelete}
            disabled={confirmText !== objectName || deleting || loading}
            loading={deleting}
            icon={deleting ? <Loader2 className="animate-spin" /> : <Trash2 />}
          >
            {deleting ? 'Удаление...' : 'Удалить объект'}
          </ModalButton>
        </div>
      </Modal.Footer>
    </Modal>
  )
} 
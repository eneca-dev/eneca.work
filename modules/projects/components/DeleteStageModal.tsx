"use client"

import React, { useState, useEffect } from 'react'
import { AlertTriangle, Loader2, Trash2, CheckCircle } from 'lucide-react'
import { useUiStore } from '@/stores/useUiStore'
import { Modal, ModalButton } from '@/components/modals'

interface DeleteStageModalProps {
  isOpen: boolean
  onClose: () => void
  stageId: string
  stageName: string
  onSuccess?: () => void
}

interface DeleteStats {
  objects_count: number
  sections_count: number
  loadings_count: number
  assignments_count: number
}

interface VerificationResult {
  stage_exists: boolean
  remaining_dependencies: Array<{
    table_name: string
    count: number
  }>
}

export function DeleteStageModal({ 
  isOpen, 
  onClose, 
  stageId, 
  stageName,
  onSuccess 
}: DeleteStageModalProps) {
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [stats, setStats] = useState<DeleteStats | null>(null)
  const [confirmText, setConfirmText] = useState('')
  const { setNotification } = useUiStore()

  // Загрузка статистики при открытии
  useEffect(() => {
    if (isOpen && stageId) {
      loadDeleteStats()
    }
  }, [isOpen, stageId])

  const loadDeleteStats = async () => {
    setLoading(true)
    try {
      const { createClient } = await import('@/utils/supabase/client')
      const supabase = createClient()
      
      // Подсчитываем объекты
      const { count: objectsCount } = await supabase
        .from('objects')
        .select('*', { count: 'exact', head: true })
        .eq('object_stage_id', stageId)

      // Подсчитываем разделы через объекты
      const { count: sectionsCount } = await supabase
        .from('sections')
        .select('*, objects!inner(*)', { count: 'exact', head: true })
        .eq('objects.object_stage_id', stageId)

      // Подсчитываем загрузки через разделы и объекты
      const { count: loadingsCount } = await supabase
        .from('loadings')
        .select('*, sections!inner(*, objects!inner(*))', { count: 'exact', head: true })
        .eq('sections.objects.object_stage_id', stageId)

      // Подсчитываем передачи через разделы и объекты
      const { count: assignmentsCount } = await supabase
        .from('assignments')
        .select('*, sections!inner(*, objects!inner(*))', { count: 'exact', head: true })
        .eq('sections.objects.object_stage_id', stageId)

      setStats({
        objects_count: objectsCount || 0,
        sections_count: sectionsCount || 0,
        loadings_count: loadingsCount || 0,
        assignments_count: assignmentsCount || 0
      })
    } catch (error) {
      console.error('Ошибка загрузки статистики удаления:', error)
      setNotification('Ошибка загрузки статистики удаления стадии')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (confirmText !== stageName) {
      setNotification('Введите точное название стадии для подтверждения')
      return
    }

    setDeleting(true)
    try {
      const { createClient } = await import('@/utils/supabase/client')
      const supabase = createClient()

      // Выполняем каскадное удаление в правильном порядке
      
      // 1. Удаляем plan_loadings для всех загрузок в разделах стадии
      const { data: loadings } = await supabase
        .from('loadings')
        .select('loading_id, sections!inner(*, objects!inner(*))')
        .eq('sections.objects.object_stage_id', stageId)

      if (loadings && loadings.length > 0) {
        const loadingIds = loadings.map(l => l.loading_id)
        await supabase
          .from('plan_loadings')
          .delete()
          .in('plan_loading_id', loadingIds)
      }
      
      // 2. Удаляем assignments для разделов стадии
      const { data: sections } = await supabase
        .from('sections')
        .select('section_id, objects!inner(*)')
        .eq('objects.object_stage_id', stageId)

      if (sections && sections.length > 0) {
        const sectionIds = sections.map(s => s.section_id)
        
        await supabase
          .from('assignments')
          .delete()
          .in('assignment_section_id', sectionIds)
        
        // 3. Удаляем decompositions для разделов стадии
        await supabase
          .from('decompositions')
          .delete()
          .in('decomposition_section_id', sectionIds)
        
        // 4. Удаляем tasks для разделов стадии
        await supabase
          .from('tasks')
          .delete()
          .in('task_section_id', sectionIds)
        
        // 5. Удаляем loadings для разделов стадии
        await supabase
          .from('loadings')
          .delete()
          .in('loading_section_id', sectionIds)
        
        // 6. Удаляем sections для объектов стадии
        await supabase
          .from('sections')
          .delete()
          .in('section_id', sectionIds)
      }
      
      // 7. Удаляем objects стадии
      await supabase
        .from('objects')
        .delete()
        .eq('object_stage_id', stageId)
      
      // 8. Удаляем саму стадию
      const { error: deleteError } = await supabase
        .from('stages')
        .delete()
        .eq('stage_id', stageId)

      if (deleteError) {
        throw new Error(`Ошибка удаления стадии: ${deleteError.message}`)
      }

      // Проверяем что стадия действительно удалена
      const { data: remainingStage } = await supabase
        .from('stages')
        .select('stage_id')
        .eq('stage_id', stageId)
        .maybeSingle()

      if (remainingStage) {
        throw new Error('Стадия не была удалена. Возможно, остались зависимости.')
      }

      // Формируем сообщение об успешном удалении
      let message = '✅ Стадия успешно удалена!'
      if (stats) {
        const deletedItems = []
        if (stats.objects_count > 0) deletedItems.push(`${stats.objects_count} объектов`)
        if (stats.sections_count > 0) deletedItems.push(`${stats.sections_count} разделов`)
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
      console.error('Ошибка удаления стадии:', error)
      setNotification(error instanceof Error ? error.message : 'Ошибка удаления стадии')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <Modal.Header 
        title="Удаление стадии" 
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
                Удаление стадии приведет к каскадному удалению всех связанных данных:
                объектов, разделов, задач, загрузок и передач. Это действие нельзя отменить.
              </p>
            </div>
          </div>

          {/* Информация о стадии */}
          <div>
            <h4 className="font-semibold mb-2 dark:text-slate-200">Стадия для удаления:</h4>
            <p className="text-lg font-medium text-red-600 dark:text-red-400">
              {stageName}
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
                  <span className="dark:text-slate-300">Объекты:</span>
                  <span className="font-medium text-red-600 dark:text-red-400">
                    {stats.objects_count}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="dark:text-slate-300">Разделы:</span>
                  <span className="font-medium text-red-600 dark:text-red-400">
                    {stats.sections_count}
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
              Для подтверждения введите точное название стадии:
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={stageName}
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
            disabled={confirmText !== stageName || deleting || loading}
            loading={deleting}
            icon={deleting ? <Loader2 className="animate-spin" /> : <Trash2 />}
          >
            {deleting ? 'Удаление...' : 'Удалить стадию'}
          </ModalButton>
        </div>
      </Modal.Footer>
    </Modal>
  )
} 
"use client"

import React, { useState, useEffect } from 'react'
import { Loader2, AlertTriangle, Trash2, X } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { useUiStore } from '@/stores/useUiStore'
import { Modal, ModalButton } from '@/components/modals'

interface DeleteSectionModalProps {
  isOpen: boolean
  onClose: () => void
  sectionId: string
  sectionName: string
  onSuccess?: () => void
}

interface DeleteStats {
  tasks_count: number
  loadings_count: number
  assignments_count: number
  decompositions_count: number
  plan_loadings_count: number
}

const supabase = createClient()

export function DeleteSectionModal({ isOpen, onClose, sectionId, sectionName, onSuccess }: DeleteSectionModalProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteStats, setDeleteStats] = useState<DeleteStats | null>(null)
  const [confirmationText, setConfirmationText] = useState('')
  const [showConfirmation, setShowConfirmation] = useState(false)
  
  const { setNotification } = useUiStore()

  useEffect(() => {
    if (isOpen) {
      loadDeleteStats()
      setConfirmationText('')
      setShowConfirmation(false)
    }
  }, [isOpen, sectionId])

  const loadDeleteStats = async () => {
    setIsLoading(true)
    try {
      // Получаем статистику по связанным данным
      const [tasksResult, loadingsResult, assignmentsResult, decompositionsResult, planLoadingsResult] = await Promise.all([
        supabase.from('tasks').select('task_id', { count: 'exact' }).eq('task_section_id', sectionId),
        supabase.from('loadings').select('loading_id', { count: 'exact' }).eq('loading_section_id', sectionId),
        supabase.from('assignments').select('assignment_id', { count: 'exact' }).eq('assignment_section_id', sectionId),
        supabase.from('decompositions').select('decomposition_id', { count: 'exact' }).eq('decomposition_section_id', sectionId),
        supabase.from('plan_loadings').select('plan_loading_id', { count: 'exact' }).eq('plan_loading_section_id', sectionId)
      ])

      setDeleteStats({
        tasks_count: tasksResult.count || 0,
        loadings_count: loadingsResult.count || 0,
        assignments_count: assignmentsResult.count || 0,
        decompositions_count: decompositionsResult.count || 0,
        plan_loadings_count: planLoadingsResult.count || 0
      })
    } catch (error) {
      console.error('Ошибка загрузки статистики удаления:', error)
      setNotification('Ошибка загрузки статистики удаления')
      onClose()
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteStats) return

    setIsDeleting(true)
    try {
      // Удаляем в правильном порядке (от зависимых к независимым)
      
      // 1. План загрузки
      if (deleteStats.plan_loadings_count > 0) {
        const { error } = await supabase
          .from('plan_loadings')
          .delete()
          .eq('plan_loading_section_id', sectionId)
        if (error) throw error
      }

      // 2. Назначения
      if (deleteStats.assignments_count > 0) {
        const { error } = await supabase
          .from('assignments')
          .delete()
          .eq('assignment_section_id', sectionId)
        if (error) throw error
      }

      // 3. Декомпозиции
      if (deleteStats.decompositions_count > 0) {
        const { error } = await supabase
          .from('decompositions')
          .delete()
          .eq('decomposition_section_id', sectionId)
        if (error) throw error
      }

      // 4. Задачи
      if (deleteStats.tasks_count > 0) {
        const { error } = await supabase
          .from('tasks')
          .delete()
          .eq('task_section_id', sectionId)
        if (error) throw error
      }

      // 5. Загрузки
      if (deleteStats.loadings_count > 0) {
        const { error } = await supabase
          .from('loadings')
          .delete()
          .eq('loading_section_id', sectionId)
        if (error) throw error
      }

      // 6. Сам раздел
      const { error: sectionError } = await supabase
        .from('sections')
        .delete()
        .eq('section_id', sectionId)

      if (sectionError) throw sectionError

      // Проверяем результат удаления
      const { data: verification } = await supabase
        .from('sections')
        .select('section_id')
        .eq('section_id', sectionId)
        .single()

      if (verification) {
        throw new Error('Раздел не был удален')
      }

      // Формируем детальное уведомление
      const deletedItems = []
      if (deleteStats.tasks_count > 0) deletedItems.push(`задач: ${deleteStats.tasks_count}`)
      if (deleteStats.loadings_count > 0) deletedItems.push(`загрузок: ${deleteStats.loadings_count}`)
      if (deleteStats.assignments_count > 0) deletedItems.push(`назначений: ${deleteStats.assignments_count}`)
      if (deleteStats.decompositions_count > 0) deletedItems.push(`декомпозиций: ${deleteStats.decompositions_count}`)
      if (deleteStats.plan_loadings_count > 0) deletedItems.push(`плановых загрузок: ${deleteStats.plan_loadings_count}`)

      const detailMessage = deletedItems.length > 0
        ? `Также удалено: ${deletedItems.join(', ')}`
        : 'Связанных данных не было'

      setNotification(`Раздел "${sectionName}" успешно удален. ${detailMessage}`)
      onSuccess?.()
      onClose()
    } catch (error) {
      console.error('Ошибка удаления раздела:', error)
      setNotification(error instanceof Error ? error.message : 'Ошибка удаления раздела')
    } finally {
      setIsDeleting(false)
    }
  }

  const totalRelatedItems = deleteStats
    ? deleteStats.tasks_count + deleteStats.loadings_count + deleteStats.assignments_count + 
      deleteStats.decompositions_count + deleteStats.plan_loadings_count
    : 0

  const isConfirmationValid = confirmationText === sectionName

  if (!isOpen) return null

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md">
      <Modal.Header 
        title="Удаление раздела" 
        subtitle="Это действие нельзя отменить"
      />
      
      <Modal.Body>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            <span className="ml-3 text-slate-600 dark:text-slate-400">
              Загрузка информации...
            </span>
          </div>
        ) : deleteStats ? (
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
              <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h4 className="font-medium text-red-800 dark:text-red-200 mb-1">
                  Внимание! Каскадное удаление
                </h4>
                <p className="text-sm text-red-700 dark:text-red-300">
                  Будет удален раздел <strong>"{sectionName}"</strong> и все связанные с ним данные.
                </p>
              </div>
            </div>

            {totalRelatedItems > 0 && (
              <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
                <h4 className="font-medium text-slate-800 dark:text-slate-200 mb-3">
                  Также будет удалено:
                </h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {deleteStats.tasks_count > 0 && (
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">Задачи:</span>
                      <span className="font-medium">{deleteStats.tasks_count}</span>
                    </div>
                  )}
                  {deleteStats.loadings_count > 0 && (
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">Загрузки:</span>
                      <span className="font-medium">{deleteStats.loadings_count}</span>
                    </div>
                  )}
                  {deleteStats.assignments_count > 0 && (
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">Назначения:</span>
                      <span className="font-medium">{deleteStats.assignments_count}</span>
                    </div>
                  )}
                  {deleteStats.decompositions_count > 0 && (
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">Декомпозиции:</span>
                      <span className="font-medium">{deleteStats.decompositions_count}</span>
                    </div>
                  )}
                  {deleteStats.plan_loadings_count > 0 && (
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">План загрузки:</span>
                      <span className="font-medium">{deleteStats.plan_loadings_count}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {!showConfirmation ? (
              <div className="text-center pt-2">
                <button
                  onClick={() => setShowConfirmation(true)}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  Подтвердить удаление
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Для подтверждения введите точное название раздела:
                  </label>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">
                    <strong>{sectionName}</strong>
                  </p>
                  <input
                    type="text"
                    value={confirmationText}
                    onChange={(e) => setConfirmationText(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent dark:bg-slate-800 dark:text-white"
                    placeholder="Введите название раздела"
                    disabled={isDeleting}
                  />
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center text-slate-500 dark:text-slate-400 py-8">
            Ошибка загрузки данных
          </div>
        )}
      </Modal.Body>

      <Modal.Footer>
        <ModalButton 
          variant="cancel" 
          onClick={onClose}
          disabled={isDeleting}
        >
          Отмена
        </ModalButton>
        
        {showConfirmation && deleteStats && (
          <ModalButton
            variant="danger"
            onClick={handleDelete}
            disabled={!isConfirmationValid || isDeleting}
            icon={isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          >
            {isDeleting ? 'Удаление...' : 'Удалить раздел'}
          </ModalButton>
        )}
      </Modal.Footer>
    </Modal>
  )
} 
"use client"

import React, { useState, useEffect } from 'react'
import { Save, Loader2, Trash2 } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { useUiStore } from '@/stores/useUiStore'
import { Modal, ModalButton } from '@/components/modals'
import { DeleteStageModal } from './DeleteStageModal'

interface EditStageModalProps {
  isOpen: boolean
  onClose: () => void
  stageId: string
  onStageUpdated?: () => void
}

interface StageData {
  stage_id: string
  stage_name: string
  stage_description: string | null
  stage_project_id: string
}

const supabase = createClient()

export function EditStageModal({ 
  isOpen, 
  onClose, 
  stageId, 
  onStageUpdated 
}: EditStageModalProps) {
  const [stageData, setStageData] = useState<StageData | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const { setNotification } = useUiStore()

  // Загрузка данных стадии
  useEffect(() => {
    if (isOpen && stageId) {
      loadStageData()
    }
  }, [isOpen, stageId])

  const loadStageData = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('stages')
        .select('*')
        .eq('stage_id', stageId)
        .single()

      if (error) throw error
      setStageData(data)
    } catch (error) {
      console.error('Ошибка загрузки данных стадии:', error)
      setNotification('Ошибка загрузки данных стадии')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!stageData) return

    setSaving(true)
    try {
      const { error } = await supabase
        .from('stages')
        .update({
          stage_name: stageData.stage_name,
          stage_description: stageData.stage_description,
        })
        .eq('stage_id', stageId)

      if (error) throw error

      setNotification('Стадия успешно обновлена')
      onStageUpdated?.()
      onClose()
    } catch (error) {
      console.error('Ошибка сохранения стадии:', error)
      setNotification(error instanceof Error ? error.message : 'Ошибка сохранения стадии')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <Modal.Header 
        title="Редактирование стадии" 
        onClose={onClose}
      />
      
      <Modal.Body>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          </div>
        ) : stageData ? (
          <div className="space-y-6">
            {/* Название стадии */}
            <div>
              <label className="block text-sm font-medium mb-2 dark:text-slate-300">
                Название стадии *
              </label>
              <input
                type="text"
                value={stageData.stage_name}
                onChange={(e) => setStageData({
                  ...stageData,
                  stage_name: e.target.value
                })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-slate-700 dark:text-white"
                placeholder="Введите название стадии"
              />
            </div>

            {/* Описание стадии */}
            <div>
              <label className="block text-sm font-medium mb-2 dark:text-slate-300">
                Описание стадии
              </label>
              <textarea
                value={stageData.stage_description || ''}
                onChange={(e) => setStageData({
                  ...stageData,
                  stage_description: e.target.value || null
                })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-slate-700 dark:text-white"
                placeholder="Введите описание стадии"
              />
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500 dark:text-slate-400">
            Ошибка загрузки данных стадии
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
            Удалить стадию
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
              disabled={!stageData?.stage_name.trim()}
              loading={saving}
              icon={<Save />}
            >
              {saving ? 'Сохранение...' : 'Сохранить'}
            </ModalButton>
          </div>
        </div>
      </Modal.Footer>

      {/* Модальное окно удаления стадии */}
      {showDeleteModal && stageData && (
        <DeleteStageModal
          isOpen={showDeleteModal}
          onClose={() => setShowDeleteModal(false)}
          stageId={stageData.stage_id}
          stageName={stageData.stage_name}
          onSuccess={() => {
            setShowDeleteModal(false)
            onClose() // Закрываем модальное окно редактирования
            onStageUpdated?.() // Обновляем список стадий
          }}
        />
      )}
    </Modal>
  )
} 
"use client"

import React, { useState } from 'react'
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

    setLoading(true)
    try {
      const { error } = await supabase
        .from('stages')
        .insert({
          stage_name: stageName.trim(),
          stage_description: stageDescription.trim() || null,
          stage_project_id: projectId
        })

      if (error) throw error

      setNotification(`Стадия "${stageName}" успешно создана`)
      onSuccess()
      handleClose()
    } catch (error) {
      console.error('Ошибка создания стадии:', error)
      setNotification(error instanceof Error ? error.message : 'Ошибка создания стадии')
    } finally {
      setLoading(false)
    }
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
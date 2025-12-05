'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Check, Settings } from 'lucide-react'
import { useHasPermission } from '@/modules/permissions'
import { useProjectTagsStore } from '../../stores/useProjectTagsStore'
import * as api from '../../api/project-tags'
import { toast } from 'sonner'
import type { ProjectTag } from '../../types'
import { ProjectTagManagementModal } from './ProjectTagManagementModal'

/**
 * Вычисляет контрастный цвет текста (чёрный или белый) на основе яркости фона.
 * Использует формулу относительной яркости WCAG.
 */
function getContrastColor(hexColor: string): string {
  // Убираем # если есть
  let hex = hexColor.replace('#', '')

  // Поддержка сокращённого формата (#RGB -> #RRGGBB)
  if (hex.length === 3) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2]
  }

  // Парсим RGB компоненты
  const r = parseInt(hex.substring(0, 2), 16)
  const g = parseInt(hex.substring(2, 4), 16)
  const b = parseInt(hex.substring(4, 6), 16)

  // Вычисляем относительную яркость (формула WCAG)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255

  // Возвращаем чёрный для светлых фонов, белый для тёмных
  return luminance > 0.5 ? '#000000' : '#ffffff'
}

interface ProjectTagSelectorProps {
  projectId: string
  projectName: string
  selectedTags: ProjectTag[]
  onUpdate: () => void
  onTagsChange: (tags: ProjectTag[]) => void
  open: boolean
  onOpenChange: (open: boolean) => void
  anchorRef: React.RefObject<HTMLElement | null>
}

export function ProjectTagSelector({
  projectId,
  selectedTags,
  onUpdate,
  onTagsChange,
  open,
  onOpenChange,
  anchorRef,
}: ProjectTagSelectorProps) {
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 })
  const [isUpdating, setIsUpdating] = useState(false)
  const [localSelectedIds, setLocalSelectedIds] = useState<Set<string>>(
    new Set(selectedTags.map(t => t.tag_id))
  )
  const [showManagement, setShowManagement] = useState(false)

  const allTags = useProjectTagsStore(state => state.tags)
  const isLoading = useProjectTagsStore(state => state.isLoading)
  const isAdmin = useHasPermission('hierarchy.is_admin')

  // Обновить позицию дропдауна
  const updateDropdownPosition = () => {
    if (anchorRef.current) {
      const rect = anchorRef.current.getBoundingClientRect()
      setDropdownPosition({
        top: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX,
      })
    }
  }

  // Обновляем позицию при открытии
  useEffect(() => {
    if (open) {
      updateDropdownPosition()
      setLocalSelectedIds(new Set(selectedTags.map(t => t.tag_id)))
    }
  }, [open, selectedTags])

  // Обновляем позицию при resize/scroll
  useEffect(() => {
    if (open) {
      const handleUpdate = () => updateDropdownPosition()
      window.addEventListener('resize', handleUpdate)
      window.addEventListener('scroll', handleUpdate, true)

      return () => {
        window.removeEventListener('resize', handleUpdate)
        window.removeEventListener('scroll', handleUpdate, true)
      }
    }
  }, [open])

  // Получить выбранные теги по ID
  const getSelectedTags = (selectedIds: Set<string>): ProjectTag[] => {
    return allTags.filter(tag => selectedIds.has(tag.tag_id))
  }

  // Переключить выбор тега
  const handleToggleTag = async (tagId: string) => {
    if (isUpdating) return
    setIsUpdating(true)

    const isCurrentlySelected = localSelectedIds.has(tagId)
    const newSelectedIds = new Set(localSelectedIds)

    // Оптимистичное обновление UI
    if (isCurrentlySelected) {
      newSelectedIds.delete(tagId)
    } else {
      newSelectedIds.add(tagId)
    }
    setLocalSelectedIds(newSelectedIds)

    // Мгновенно обновить отображение в родительском компоненте
    onTagsChange(getSelectedTags(newSelectedIds))

    try {
      let result
      if (isCurrentlySelected) {
        result = await api.removeTagFromProject(projectId, tagId)
      } else {
        result = await api.addTagToProject(projectId, tagId)
      }

      if (!result.success) {
        // Откат при ошибке
        setLocalSelectedIds(localSelectedIds)
        onTagsChange(getSelectedTags(localSelectedIds))
        toast.error(result.error || 'Ошибка при обновлении тегов')
      } else {
        // Успех - синхронизировать с сервером
        onUpdate()
      }
    } catch (error) {
      // Откат при ошибке
      setLocalSelectedIds(localSelectedIds)
      onTagsChange(getSelectedTags(localSelectedIds))
      toast.error('Произошла ошибка при обновлении тегов')
      console.error('Error toggling tag:', error)
    } finally {
      setIsUpdating(false)
    }
  }

  if (!open || typeof window === 'undefined') return null

  return createPortal(
    <>
      {/* Невидимый backdrop для перехвата кликов */}
      <div
        className="fixed inset-0 z-40"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          onOpenChange(false)
        }}
        onMouseDown={(e) => {
          e.preventDefault()
          e.stopPropagation()
        }}
      />
      <div
        className="fixed z-40 rounded-md border bg-popover text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95 p-2"
        style={{
          top: dropdownPosition.top + 4,
          left: dropdownPosition.left,
        }}
        onClick={(e) => e.stopPropagation()}
      >
      {/* Чипы тегов */}
      {isLoading ? (
        <div className="px-2 py-1 text-sm text-muted-foreground">
          Загрузка...
        </div>
      ) : allTags.length === 0 ? (
        <div className="px-2 py-1 text-sm text-muted-foreground">
          Нет доступных тегов
        </div>
      ) : (
        <div className="flex items-center gap-1.5 flex-wrap">
          {allTags.map((tag) => {
            const isSelected = localSelectedIds.has(tag.tag_id)
            return (
              <button
                key={tag.tag_id}
                onClick={() => handleToggleTag(tag.tag_id)}
                disabled={isUpdating}
                className={`
                  px-2 py-0.5 text-xs font-medium rounded-full transition-all cursor-pointer
                  disabled:cursor-not-allowed
                  ${isSelected ? 'shadow-sm' : 'opacity-40 hover:opacity-60'}
                `}
                style={{
                  backgroundColor: tag.color,
                  color: getContrastColor(tag.color),
                }}
              >
                {tag.name}
              </button>
            )
          })}

          {/* Шестерёнка управления (только для админов) */}
          {isAdmin && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                setShowManagement(true)
              }}
              className="p-1 hover:bg-accent rounded transition-colors text-muted-foreground hover:text-foreground"
              title="Управление тегами"
            >
              <Settings className="h-3.5 w-3.5" />
            </button>
          )}

          {/* Галочка закрытия */}
          <button
            onClick={() => onOpenChange(false)}
            className="p-1 hover:bg-accent rounded transition-colors text-primary hover:text-primary/80"
            title="Готово"
          >
            <Check className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Модальное окно управления тегами */}
      {showManagement && (
        <ProjectTagManagementModal
          isOpen={showManagement}
          onClose={() => setShowManagement(false)}
        />
      )}
    </div>
    </>,
    document.body
  )
}

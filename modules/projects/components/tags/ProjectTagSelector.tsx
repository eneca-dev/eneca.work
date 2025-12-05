'use client'

import React, { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Settings, Loader2 } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useHasPermission } from '@/modules/permissions'
import { useProjectTagsStore } from '../../stores/useProjectTagsStore'
import * as api from '../../api/project-tags'
import { toast } from 'sonner'
import type { ProjectTag } from '../../types'
import { ProjectTagManagementModal } from './ProjectTagManagementModal'
import { getTagStyles } from '../../utils/color'

interface ProjectTagSelectorProps {
  projectId: string
  projectName: string
  selectedTags: ProjectTag[]
  onUpdate?: () => void
  onTagsChange: (tags: ProjectTag[]) => void
  open: boolean
  onOpenChange: (open: boolean) => void
  anchorRef: React.RefObject<HTMLElement | null>
}

export function ProjectTagSelector({
  projectId,
  selectedTags,
  onTagsChange,
  open,
  onOpenChange,
  anchorRef,
}: ProjectTagSelectorProps) {
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 })
  const [isUpdating, setIsUpdating] = useState(false)
  const [updatingTagId, setUpdatingTagId] = useState<string | null>(null)
  const [localSelectedIds, setLocalSelectedIds] = useState<Set<string>>(
    new Set(selectedTags.map(t => t.tag_id))
  )
  const [showManagement, setShowManagement] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const allTags = useProjectTagsStore(state => state.tags)
  const isLoading = useProjectTagsStore(state => state.isLoading)
  const isAdmin = useHasPermission('hierarchy.is_admin')
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const updateDropdownPosition = () => {
    if (anchorRef.current) {
      const rect = anchorRef.current.getBoundingClientRect()
      const dropdownWidth = 320
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight

      let left = rect.left + window.scrollX
      let top = rect.bottom + window.scrollY + 8

      // Check if dropdown would overflow right edge
      if (left + dropdownWidth > viewportWidth - 16) {
        left = Math.max(16, viewportWidth - dropdownWidth - 16)
      }

      // Check if dropdown would overflow bottom
      const estimatedHeight = Math.min(allTags.length * 40 + 60, 300)
      if (rect.bottom + estimatedHeight > viewportHeight - 16) {
        top = rect.top + window.scrollY - estimatedHeight - 8
      }

      setDropdownPosition({ top, left })
    }
  }

  useEffect(() => {
    if (open) {
      updateDropdownPosition()
      setLocalSelectedIds(new Set(selectedTags.map(t => t.tag_id)))
    }
  }, [open, selectedTags])

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

  const getSelectedTags = (selectedIds: Set<string>): ProjectTag[] => {
    return allTags.filter(tag => selectedIds.has(tag.tag_id))
  }

  const handleToggleTag = async (tagId: string) => {
    if (isUpdating) return
    setIsUpdating(true)
    setUpdatingTagId(tagId)

    const isCurrentlySelected = localSelectedIds.has(tagId)
    const newSelectedIds = new Set(localSelectedIds)

    if (isCurrentlySelected) {
      newSelectedIds.delete(tagId)
    } else {
      newSelectedIds.add(tagId)
    }
    setLocalSelectedIds(newSelectedIds)
    onTagsChange(getSelectedTags(newSelectedIds))

    try {
      let result
      if (isCurrentlySelected) {
        result = await api.removeTagFromProject(projectId, tagId)
      } else {
        result = await api.addTagToProject(projectId, tagId)
      }

      if (!result.success) {
        setLocalSelectedIds(localSelectedIds)
        onTagsChange(getSelectedTags(localSelectedIds))
        toast.error(result.error || 'Ошибка при обновлении тегов')
        // Отправить событие отката для синхронизации дерева
        window.dispatchEvent(new CustomEvent('projectTags:revert', {
          detail: {
            projectId: projectId,
            tags: getSelectedTags(localSelectedIds)
          }
        }))
      } else {
        // Отправить событие успешного обновления с данными для оптимистичного обновления дерева
        window.dispatchEvent(new CustomEvent('projectTags:updated', {
          detail: {
            projectId: projectId,
            tags: getSelectedTags(newSelectedIds)
          }
        }))
      }
    } catch (error) {
      setLocalSelectedIds(localSelectedIds)
      onTagsChange(getSelectedTags(localSelectedIds))
      toast.error('Произошла ошибка при обновлении тегов')
      console.error('Error toggling tag:', error)
      // Отправить событие отката для синхронизации дерева
      window.dispatchEvent(new CustomEvent('projectTags:revert', {
        detail: {
          projectId: projectId,
          tags: getSelectedTags(localSelectedIds)
        }
      }))
    } finally {
      setIsUpdating(false)
      setUpdatingTagId(null)
    }
  }

  if (!open || typeof window === 'undefined') return null

  return createPortal(
    <>
      {/* Backdrop */}
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

      {/* Dropdown */}
      <div
        ref={dropdownRef}
        className="
          fixed z-50 w-80 max-w-[calc(100vw-32px)]
          rounded-lg border border-border/50
          bg-popover/95 backdrop-blur-sm
          shadow-xl shadow-black/10
          animate-in fade-in-0 zoom-in-95 slide-in-from-top-2
          duration-200
        "
        style={{
          top: dropdownPosition.top,
          left: dropdownPosition.left,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-border/50">
          <span className="text-sm font-medium text-foreground">
            Теги проекта
          </span>
          {isAdmin && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                setShowManagement(true)
              }}
              className="
                p-1.5 rounded-md
                text-muted-foreground hover:text-foreground
                hover:bg-accent/80
                transition-colors duration-150
              "
              title="Управление тегами"
            >
              <Settings className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Tags list */}
        <div className="p-2 max-h-64 overflow-y-auto no-scrollbar-bg">
          {isLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span className="ml-2 text-sm text-muted-foreground">Загрузка...</span>
            </div>
          ) : allTags.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-sm text-muted-foreground">Нет доступных тегов</p>
              {isAdmin && (
                <button
                  onClick={() => setShowManagement(true)}
                  className="mt-2 text-sm text-primary hover:underline"
                >
                  Создать первый тег
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-1">
              {allTags.map((tag) => {
                const isSelected = localSelectedIds.has(tag.tag_id)
                const isThisUpdating = updatingTagId === tag.tag_id
                const styles = getTagStyles(tag.color, isDark)

                return (
                  <button
                    key={tag.tag_id}
                    onClick={() => handleToggleTag(tag.tag_id)}
                    disabled={isUpdating}
                    className={`
                      group w-full flex items-center gap-3 px-2.5 py-2
                      rounded-lg
                      transition-all duration-150
                      ${isUpdating && !isThisUpdating ? 'opacity-50' : ''}
                      ${isSelected
                        ? 'bg-primary/8 dark:bg-primary/12'
                        : 'hover:bg-accent/50'
                      }
                      disabled:cursor-not-allowed
                    `}
                  >
                    {/* Checkbox like statuses */}
                    <div className={`
                      relative flex-shrink-0 w-[18px] h-[18px] rounded-md
                      flex items-center justify-center
                      transition-all duration-200 ease-out
                      ${isSelected
                        ? 'bg-primary shadow-sm shadow-primary/30'
                        : 'border-2 border-muted-foreground/25 group-hover:border-primary/40'
                      }
                    `}>
                      {isThisUpdating ? (
                        <Loader2 className="h-2.5 w-2.5 text-primary-foreground animate-spin" />
                      ) : (
                        <svg
                          className={`w-2.5 h-2.5 text-primary-foreground transition-all duration-200 ${isSelected ? 'scale-100 opacity-100' : 'scale-50 opacity-0'}`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={3}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>

                    {/* Tag badge - striped style */}
                    <span
                      className={`
                        relative overflow-hidden flex-1 text-left px-2.5 py-1 text-[11px] font-medium rounded-md border
                        transition-all duration-200
                        ${isSelected ? 'shadow-sm' : ''}
                      `}
                      style={{
                        backgroundColor: styles.backgroundColor,
                        borderColor: styles.borderColor,
                        color: styles.color,
                      }}
                    >
                      {/* Diagonal stripes overlay */}
                      <span
                        className="absolute inset-0 pointer-events-none opacity-[0.08]"
                        style={{
                          backgroundImage: `repeating-linear-gradient(
                            -45deg,
                            ${styles.stripeColor},
                            ${styles.stripeColor} 1px,
                            transparent 1px,
                            transparent 5px
                          )`,
                        }}
                      />
                      <span className="relative">{tag.name}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Management modal */}
      {showManagement && (
        <ProjectTagManagementModal
          isOpen={showManagement}
          onClose={() => setShowManagement(false)}
        />
      )}
    </>,
    document.body
  )
}

'use client'

import { useEffect, useState, useMemo, useCallback, useRef, useLayoutEffect } from 'react'
import { X, Loader2, Check, FolderKanban, Tag, ChevronDown, Trash2, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { createClient } from '@/utils/supabase/client'
import { useTasksTabsStore } from '@/modules/tasks/stores'
import type { BaseModalProps } from '../../types'

// ============================================================================
// Types
// ============================================================================

export interface ProjectQuickEditModalProps extends BaseModalProps {
  /** ID проекта */
  projectId: string
  /** Название проекта (для отображения в заголовке) */
  projectName: string
  /** Текущий статус */
  currentStatus?: string | null
  /** Текущая стадия */
  currentStageType?: string | null
  /** Текущие теги */
  currentTags?: Array<{ tag_id: string; name: string; color: string }>
  /** Callback при удалении проекта */
  onDeleted?: () => void
}

interface ProjectTag {
  tag_id: string
  name: string
  color: string
}

// ============================================================================
// Constants
// ============================================================================

/** Статусы проекта с русскими названиями */
const PROJECT_STATUSES = [
  { value: 'active', label: 'Активный', color: 'bg-green-500/20 text-green-400' },
  { value: 'draft', label: 'Черновик', color: 'bg-slate-500/20 text-slate-400' },
  { value: 'potential project', label: 'Потенциальный', color: 'bg-blue-500/20 text-blue-400' },
  { value: 'waiting for input data', label: 'Ожидание данных', color: 'bg-yellow-500/20 text-yellow-400' },
  { value: 'paused', label: 'Приостановлен', color: 'bg-orange-500/20 text-orange-400' },
  { value: 'customer approval', label: 'Согласование', color: 'bg-purple-500/20 text-purple-400' },
  { value: 'author supervision', label: 'Авторский надзор', color: 'bg-cyan-500/20 text-cyan-400' },
  { value: 'actual calculation', label: 'Актуальный расчёт', color: 'bg-indigo-500/20 text-indigo-400' },
  { value: 'completed', label: 'Завершён', color: 'bg-emerald-500/20 text-emerald-400' },
] as const

/** Стадии проекта */
const STAGE_TYPES = [
  'Стадия А',
  'Стадия П',
  'Стадия ПП',
  'Стадия Р',
  'Стадия С',
  'Э',
  'Базовая стадия (РУО)',
  'Основные проекты',
  'Отпуск',
  'Отчетная стадия',
  'Прочие работы',
] as const

// ============================================================================
// Hooks
// ============================================================================

function useProjectTags() {
  return useQuery({
    queryKey: ['project-tags'],
    queryFn: async (): Promise<ProjectTag[]> => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('project_tags')
        .select('tag_id, name, color')
        .order('name')

      if (error) throw error
      return data || []
    },
    staleTime: 5 * 60 * 1000, // 5 минут
  })
}

function useProjectTagLinks(projectId: string) {
  return useQuery({
    queryKey: ['project-tag-links', projectId],
    queryFn: async (): Promise<string[]> => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('project_tag_links')
        .select('tag_id')
        .eq('project_id', projectId)

      if (error) throw error
      return data?.map(d => d.tag_id) || []
    },
    staleTime: 60 * 1000, // 1 минута
  })
}

// ============================================================================
// Component
// ============================================================================

export function ProjectQuickEditModal({
  isOpen,
  onClose,
  onSuccess,
  projectId,
  projectName,
  currentStatus,
  currentStageType,
  currentTags = [],
  onDeleted,
}: ProjectQuickEditModalProps) {
  // State
  const [name, setName] = useState(projectName)
  const [status, setStatus] = useState<string | null>(currentStatus || null)
  const [stageType, setStageType] = useState<string | null>(currentStageType || null)
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>(currentTags.map(t => t.tag_id))

  // Dropdown states
  const [statusOpen, setStatusOpen] = useState(false)
  const [stageOpen, setStageOpen] = useState(false)
  const [tagsOpen, setTagsOpen] = useState(false)

  // Delete confirmation state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const queryClient = useQueryClient()
  const { updateProjectName, removeProjectFilter } = useTasksTabsStore()

  // Fetch available tags
  const { data: allTags = [] } = useProjectTags()
  const { data: projectTagIds } = useProjectTagLinks(projectId)

  // Sync project tags when loaded
  useEffect(() => {
    if (projectTagIds) {
      setSelectedTagIds(projectTagIds)
    }
  }, [projectTagIds])

  // Refs for click-outside detection
  const statusDropdownRef = useRef<HTMLDivElement>(null)
  const stageDropdownRef = useRef<HTMLDivElement>(null)
  const tagsDropdownRef = useRef<HTMLDivElement>(null)

  // Track previous isOpen to detect open transition
  const prevIsOpenRef = useRef(false)

  // Reset state when modal opens (only on open transition, not on every render)
  useLayoutEffect(() => {
    // Only reset when transitioning from closed to open
    if (isOpen && !prevIsOpenRef.current) {
      setName(projectName)
      setStatus(currentStatus || null)
      setStageType(currentStageType || null)
      setSelectedTagIds(currentTags.map(t => t.tag_id))
      setStatusOpen(false)
      setStageOpen(false)
      setTagsOpen(false)
      setShowDeleteConfirm(false)
    }
    prevIsOpenRef.current = isOpen
  }, [isOpen, projectName, currentStatus, currentStageType, currentTags])

  // Click outside to close dropdowns
  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node
      if (statusOpen && statusDropdownRef.current && !statusDropdownRef.current.contains(target)) {
        setStatusOpen(false)
      }
      if (stageOpen && stageDropdownRef.current && !stageDropdownRef.current.contains(target)) {
        setStageOpen(false)
      }
      if (tagsOpen && tagsDropdownRef.current && !tagsDropdownRef.current.contains(target)) {
        setTagsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen, statusOpen, stageOpen, tagsOpen])

  // Update project mutation
  const updateProject = useMutation({
    mutationFn: async (data: {
      name?: string
      status?: string | null
      stageType?: string | null
      tagIds?: string[]
    }) => {
      const supabase = createClient()

      // Update project fields
      const updateData: Record<string, unknown> = {
        project_updated: new Date().toISOString(),
      }
      if (data.name !== undefined && data.name !== projectName) {
        updateData.project_name = data.name
      }
      if (data.status !== undefined) {
        updateData.project_status = data.status
      }
      if (data.stageType !== undefined) {
        updateData.stage_type = data.stageType
      }

      if (Object.keys(updateData).length > 1) {
        const { error: projectError } = await supabase
          .from('projects')
          .update(updateData)
          .eq('project_id', projectId)

        if (projectError) throw projectError
      }

      // Update tags if changed
      if (data.tagIds !== undefined) {
        // Delete existing links
        const { error: deleteError } = await supabase
          .from('project_tag_links')
          .delete()
          .eq('project_id', projectId)

        if (deleteError) throw deleteError

        // Insert new links
        if (data.tagIds.length > 0) {
          const { error: insertError } = await supabase
            .from('project_tag_links')
            .insert(
              data.tagIds.map(tagId => ({
                project_id: projectId,
                tag_id: tagId,
              }))
            )

          if (insertError) throw insertError
        }
      }

      return { success: true }
    },
    onSuccess: (_, variables) => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['budgets-hierarchy'] })
      queryClient.invalidateQueries({ queryKey: ['project-tag-links', projectId] })
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      // Invalidate filter structure for inline filter (project name autocomplete)
      queryClient.invalidateQueries({ queryKey: ['filter-structure', 'project'] })
      queryClient.invalidateQueries({ queryKey: ['resourceGraph'] })

      // Update filter if project name was changed
      if (variables.name && variables.name !== projectName) {
        updateProjectName(projectName, variables.name)
      }

      onClose()
      onSuccess?.()
    },
    onError: (error) => {
      console.error('[ProjectQuickEditModal] Update failed:', error)
    },
  })

  // Delete project mutation
  const deleteProject = useMutation({
    mutationFn: async () => {
      const supabase = createClient()

      // Delete project (cascades to objects, sections, etc. via FK constraints)
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('project_id', projectId)

      if (error) throw error
      return { success: true }
    },
    onSuccess: () => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['budgets-hierarchy'] })
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      queryClient.invalidateQueries({ queryKey: ['resourceGraph'] })
      // Invalidate filter structure for inline filter (project name autocomplete)
      queryClient.invalidateQueries({ queryKey: ['filter-structure', 'project'] })

      // Remove deleted project from filter
      removeProjectFilter(projectName)

      onClose()
      onDeleted?.()
    },
    onError: (error) => {
      console.error('[ProjectQuickEditModal] Delete failed:', error)
      setShowDeleteConfirm(false)
    },
  })

  // Check if there are changes
  const hasChanges = useMemo(() => {
    const nameChanged = name !== projectName
    const statusChanged = status !== currentStatus
    const stageChanged = stageType !== currentStageType
    const tagsChanged = JSON.stringify(selectedTagIds.sort()) !== JSON.stringify(currentTags.map(t => t.tag_id).sort())
    return nameChanged || statusChanged || stageChanged || tagsChanged
  }, [name, projectName, status, currentStatus, stageType, currentStageType, selectedTagIds, currentTags])

  // Save handler
  const handleSave = useCallback(() => {
    if (!hasChanges) return

    updateProject.mutate({
      name: name !== projectName ? name : undefined,
      status: status !== currentStatus ? status : undefined,
      stageType: stageType !== currentStageType ? stageType : undefined,
      tagIds: JSON.stringify(selectedTagIds.sort()) !== JSON.stringify(currentTags.map(t => t.tag_id).sort())
        ? selectedTagIds
        : undefined,
    })
  }, [hasChanges, name, projectName, status, currentStatus, stageType, currentStageType, selectedTagIds, currentTags, updateProject])

  // Toggle tag selection
  const toggleTag = useCallback((tagId: string) => {
    setSelectedTagIds(prev =>
      prev.includes(tagId)
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    )
  }, [])

  // Get current status display
  const currentStatusDisplay = useMemo(() => {
    return PROJECT_STATUSES.find(s => s.value === status)
  }, [status])

  const isPending = updateProject.isPending || deleteProject.isPending

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50">
      {/* Overlay */}
      <div
        className="absolute inset-0 z-[1] bg-black/20 dark:bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="absolute inset-0 z-[2] flex items-center justify-center p-4 pointer-events-none">
        <div
          className={cn(
            'pointer-events-auto w-full max-w-md',
            'bg-white border border-slate-300',
            'dark:bg-slate-900/95 dark:backdrop-blur-md dark:border-slate-700/50',
            'rounded-lg shadow-2xl',
            'shadow-slate-500/20 dark:shadow-black/50',
            'transform transition-all duration-200',
            isOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className={cn(
            'flex items-center justify-between px-4 py-2.5 border-b',
            'border-slate-200 dark:border-slate-700/50'
          )}>
            <div className="flex items-center gap-2">
              <FolderKanban className="w-4 h-4 text-amber-500" />
              <span className={cn(
                'text-xs font-medium',
                'text-slate-700 dark:text-slate-300'
              )}>
                Редактировать проект
              </span>
            </div>
            <button
              onClick={onClose}
              className={cn(
                'p-1 rounded transition-colors',
                'text-slate-400 hover:text-slate-600 hover:bg-slate-100',
                'dark:text-slate-500 dark:hover:text-slate-300 dark:hover:bg-slate-800'
              )}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="px-4 py-3 space-y-3">
            {/* Name */}
            <div>
              <label className={cn(
                'block text-[10px] font-medium uppercase tracking-wide mb-1.5',
                'text-slate-500 dark:text-slate-400'
              )}>
                Название
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={cn(
                  'w-full px-2.5 py-1.5 text-xs rounded transition-colors',
                  'bg-white border border-slate-300 text-slate-700',
                  'focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400/50',
                  'dark:bg-slate-800/50 dark:border-slate-700 dark:text-slate-200',
                  'dark:focus:border-slate-600 dark:focus:ring-slate-600/50'
                )}
                disabled={isPending}
              />
            </div>

            {/* Status & Stage in two columns */}
            <div className="grid grid-cols-2 gap-3">
              {/* Status */}
              <div className="relative" ref={statusDropdownRef}>
                <label className={cn(
                  'block text-[10px] font-medium uppercase tracking-wide mb-1.5',
                  'text-slate-500 dark:text-slate-400'
                )}>
                  Статус
                </label>
                <button
                  type="button"
                  onClick={() => setStatusOpen(!statusOpen)}
                  className={cn(
                    'w-full flex items-center justify-between px-2.5 py-1.5 text-xs rounded transition-colors',
                    'bg-white border border-slate-300 text-slate-700',
                    'hover:border-slate-400',
                    'dark:bg-slate-800/50 dark:border-slate-700 dark:text-slate-200',
                    'dark:hover:border-slate-600'
                  )}
                  disabled={isPending}
                >
                  {currentStatusDisplay ? (
                    <span className={cn('px-1.5 py-0.5 rounded text-[10px]', currentStatusDisplay.color)}>
                      {currentStatusDisplay.label}
                    </span>
                  ) : (
                    <span className="text-slate-400">Не выбран</span>
                  )}
                  <ChevronDown className="w-3 h-3 text-slate-400" />
                </button>
                {statusOpen && (
                  <div className={cn(
                    'absolute left-0 top-full mt-1 z-[60] w-full max-h-[200px] overflow-y-auto',
                    'bg-white border border-slate-200 rounded-md shadow-lg',
                    'dark:bg-slate-900 dark:border-slate-700'
                  )}>
                    {PROJECT_STATUSES.map((s) => (
                      <button
                        key={s.value}
                        type="button"
                        onClick={() => {
                          setStatus(s.value)
                          setStatusOpen(false)
                        }}
                        className={cn(
                          'w-full text-left px-2.5 py-1.5 text-[11px] transition-colors',
                          'hover:bg-slate-50 dark:hover:bg-slate-800',
                          status === s.value && 'bg-slate-100 dark:bg-slate-800'
                        )}
                      >
                        <span className={cn('px-1.5 py-0.5 rounded', s.color)}>
                          {s.label}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Stage */}
              <div className="relative" ref={stageDropdownRef}>
                <label className={cn(
                  'block text-[10px] font-medium uppercase tracking-wide mb-1.5',
                  'text-slate-500 dark:text-slate-400'
                )}>
                  Стадия
                </label>
                <button
                  type="button"
                  onClick={() => setStageOpen(!stageOpen)}
                  className={cn(
                    'w-full flex items-center justify-between px-2.5 py-1.5 text-xs rounded transition-colors',
                    'bg-white border border-slate-300 text-slate-700',
                    'hover:border-slate-400',
                    'dark:bg-slate-800/50 dark:border-slate-700 dark:text-slate-200',
                    'dark:hover:border-slate-600'
                  )}
                  disabled={isPending}
                >
                  {stageType ? (
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-purple-500/20 text-purple-400">
                      {stageType}
                    </span>
                  ) : (
                    <span className="text-slate-400">Не выбрана</span>
                  )}
                  <ChevronDown className="w-3 h-3 text-slate-400" />
                </button>
                {stageOpen && (
                  <div className={cn(
                    'absolute left-0 top-full mt-1 z-[60] w-full max-h-[200px] overflow-y-auto',
                    'bg-white border border-slate-200 rounded-md shadow-lg',
                    'dark:bg-slate-900 dark:border-slate-700'
                  )}>
                    <button
                      type="button"
                      onClick={() => {
                        setStageType(null)
                        setStageOpen(false)
                      }}
                      className={cn(
                        'w-full text-left px-2.5 py-1.5 text-[11px] transition-colors',
                        'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-400'
                      )}
                    >
                      Без стадии
                    </button>
                    {STAGE_TYPES.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => {
                          setStageType(s)
                          setStageOpen(false)
                        }}
                        className={cn(
                          'w-full text-left px-2.5 py-1.5 text-[11px] transition-colors',
                          'hover:bg-slate-50 dark:hover:bg-slate-800',
                          stageType === s && 'bg-slate-100 dark:bg-slate-800'
                        )}
                      >
                        <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400">
                          {s}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Tags */}
            <div className="relative" ref={tagsDropdownRef}>
              <label className={cn(
                'block text-[10px] font-medium uppercase tracking-wide mb-1.5',
                'text-slate-500 dark:text-slate-400'
              )}>
                <Tag className="w-3 h-3 inline mr-1" />
                Теги
              </label>
              <button
                type="button"
                onClick={() => setTagsOpen(!tagsOpen)}
                className={cn(
                  'w-full flex items-center justify-between px-2.5 py-1.5 text-xs rounded transition-colors min-h-[32px]',
                  'bg-white border border-slate-300 text-slate-700',
                  'hover:border-slate-400',
                  'dark:bg-slate-800/50 dark:border-slate-700 dark:text-slate-200',
                  'dark:hover:border-slate-600'
                )}
                disabled={isPending}
              >
                <div className="flex flex-wrap gap-1">
                  {selectedTagIds.length > 0 ? (
                    selectedTagIds.map((tagId) => {
                      const tag = allTags.find(t => t.tag_id === tagId)
                      if (!tag) return null
                      return (
                        <span
                          key={tagId}
                          className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                          style={{
                            backgroundColor: `${tag.color}20`,
                            color: tag.color,
                          }}
                        >
                          {tag.name}
                        </span>
                      )
                    })
                  ) : (
                    <span className="text-slate-400">Нет тегов</span>
                  )}
                </div>
                <ChevronDown className="w-3 h-3 text-slate-400 shrink-0 ml-2" />
              </button>
              {tagsOpen && (
                <div className={cn(
                  'absolute left-0 top-full mt-1 z-[60] w-full max-h-[150px] overflow-y-auto',
                  'bg-white border border-slate-200 rounded-md shadow-lg',
                  'dark:bg-slate-900 dark:border-slate-700'
                )}>
                  {allTags.length === 0 ? (
                    <div className="px-2.5 py-2 text-[11px] text-slate-400">
                      Нет доступных тегов
                    </div>
                  ) : (
                    allTags.map((tag) => (
                      <button
                        key={tag.tag_id}
                        type="button"
                        onClick={() => toggleTag(tag.tag_id)}
                        className={cn(
                          'w-full flex items-center gap-2 px-2.5 py-1.5 text-[11px] transition-colors',
                          'hover:bg-slate-50 dark:hover:bg-slate-800',
                          selectedTagIds.includes(tag.tag_id) && 'bg-slate-100 dark:bg-slate-800'
                        )}
                      >
                        <div
                          className={cn(
                            'w-3 h-3 rounded border flex items-center justify-center',
                            selectedTagIds.includes(tag.tag_id)
                              ? 'border-transparent'
                              : 'border-slate-300 dark:border-slate-600'
                          )}
                          style={{
                            backgroundColor: selectedTagIds.includes(tag.tag_id) ? tag.color : 'transparent',
                          }}
                        >
                          {selectedTagIds.includes(tag.tag_id) && (
                            <Check className="w-2 h-2 text-white" />
                          )}
                        </div>
                        <span
                          className="px-1.5 py-0.5 rounded font-medium"
                          style={{
                            backgroundColor: `${tag.color}20`,
                            color: tag.color,
                          }}
                        >
                          {tag.name}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className={cn(
            'flex items-center justify-between px-4 py-2.5 border-t',
            'border-slate-200 dark:border-slate-700/50'
          )}>
            {/* Delete button (left side) */}
            <div>
              {showDeleteConfirm ? (
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 text-[10px] text-red-500 dark:text-red-400">
                    <AlertTriangle className="w-3 h-3" />
                    <span>Удалить проект?</span>
                  </div>
                  <button
                    onClick={() => deleteProject.mutate()}
                    disabled={isPending}
                    className={cn(
                      'px-2 py-1 text-[10px] font-medium rounded transition-colors',
                      'text-white bg-red-600 hover:bg-red-500',
                      'disabled:opacity-50 disabled:cursor-not-allowed'
                    )}
                  >
                    {deleteProject.isPending ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      'Да'
                    )}
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    disabled={isPending}
                    className={cn(
                      'px-2 py-1 text-[10px] font-medium rounded transition-colors',
                      'text-slate-600 bg-slate-100 hover:bg-slate-200',
                      'dark:text-slate-400 dark:bg-slate-800 dark:hover:bg-slate-700',
                      'disabled:opacity-50 disabled:cursor-not-allowed'
                    )}
                  >
                    Нет
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={isPending}
                  className={cn(
                    'flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded transition-colors',
                    'text-red-600 hover:text-red-700 hover:bg-red-50',
                    'dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-950/30',
                    'disabled:opacity-50 disabled:cursor-not-allowed'
                  )}
                >
                  <Trash2 className="w-3 h-3" />
                  Удалить
                </button>
              )}
            </div>

            {/* Save/Cancel buttons (right side) */}
            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                disabled={isPending}
                className={cn(
                  'px-3 py-1.5 text-[11px] font-medium rounded border transition-colors',
                  'text-slate-600 border-slate-300 bg-white',
                  'hover:text-slate-700 hover:border-slate-400 hover:bg-slate-50',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                  'dark:text-slate-400 dark:border-slate-700 dark:bg-slate-800/50',
                  'dark:hover:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-800'
                )}
              >
                Отмена
              </button>
              <button
                onClick={handleSave}
                disabled={!hasChanges || isPending}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded transition-colors',
                  'text-slate-900 bg-amber-500 hover:bg-amber-400',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                  'disabled:bg-slate-200 disabled:text-slate-400',
                  'dark:disabled:bg-slate-700 dark:disabled:text-slate-500'
                )}
              >
                {updateProject.isPending ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Сохранение...
                  </>
                ) : (
                  <>
                    <Check className="w-3 h-3" />
                    Сохранить
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ProjectQuickEditModal

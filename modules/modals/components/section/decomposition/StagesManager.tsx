'use client'

/**
 * StagesManager - Главный компонент управления этапами декомпозиции
 * Рефакторинг: более компактный дизайн, исправлены баги
 */

import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import {
  Plus,
  Loader2,
  ChevronsDown,
  ChevronsUp,
  FileText,
  Save,
} from 'lucide-react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { StageCard } from './StageCard'
import { AssignResponsiblesDialog, DeleteConfirmDialog } from './dialogs'
import type { Stage, Decomposition, StagesManagerProps } from './types'
import { calculateTotalStats, generateTempId } from './utils'
import { DEFAULT_STAGE, DEFAULT_DECOMPOSITION } from './constants'

// Templates - new modals from modals module
import {
  TemplateSelectModal,
  TemplateSaveModal,
} from '@/modules/modals'
import type { TemplateStage } from '@/modules/dec-templates'

// Permissions and User
import { useHasPermission } from '@/modules/permissions'
import { useUserStore } from '@/stores'

// Hooks
import {
  useDecompositionData,
  useWorkLogsAggregate,
  useCreateDecompositionStage,
  useUpdateDecompositionStage,
  useDeleteDecompositionStage,
  useReorderDecompositionStages,
  useCreateDecompositionItem,
  useUpdateDecompositionItem,
  useDeleteDecompositionItem,
  useMoveDecompositionItems,
  useReorderDecompositionItems,
} from '../../../hooks'

// ============================================================================
// Component
// ============================================================================

export function StagesManager({ sectionId }: StagesManagerProps) {
  const { toast } = useToast()

  // ============================================================================
  // Data Fetching - Unified hook с кешированием из resourceGraph
  // ============================================================================

  const {
    stages: initialStages,
    workCategories,
    difficultyLevels,
    stageStatuses,
    employees,
    isLoading: isLoadingData,
    dataSource,
  } = useDecompositionData(sectionId)

  // Local state for stages (optimistic updates)
  const [stages, setStages] = useState<Stage[]>([])

  // Track if initial sync is complete for current section
  const initializedForSectionRef = useRef<string | null>(null)

  // Sync data to local state only on INITIAL load for this section
  // After initial sync, mutations manage state optimistically
  useEffect(() => {
    // Only sync if we haven't initialized for this section yet
    if (
      initializedForSectionRef.current !== sectionId &&
      (initialStages.length > 0 || dataSource !== 'none')
    ) {
      initializedForSectionRef.current = sectionId
      setStages(initialStages)
    }
  }, [initialStages, dataSource, sectionId])

  // Get all item IDs for work logs - memoize to prevent re-renders
  const allItemIds = useMemo(() => {
    return stages.flatMap((stage) => stage.decompositions.map((d) => d.id))
  }, [stages])

  const { data: actualHoursByItemId = {} } = useWorkLogsAggregate(allItemIds)

  // ============================================================================
  // Mutations
  // ============================================================================

  const createStageMutation = useCreateDecompositionStage()
  const updateStageMutation = useUpdateDecompositionStage()
  const deleteStageMutation = useDeleteDecompositionStage()
  const reorderStagesMutation = useReorderDecompositionStages()
  const createItemMutation = useCreateDecompositionItem()
  const updateItemMutation = useUpdateDecompositionItem()
  const deleteItemMutation = useDeleteDecompositionItem()
  const moveItemsMutation = useMoveDecompositionItems()
  const reorderItemsMutation = useReorderDecompositionItems()

  // ============================================================================
  // UI State
  // ============================================================================

  // Expand/collapse state - track if user has interacted
  const [expandedStages, setExpandedStages] = useState<Set<string>>(new Set())
  const [hasUserInteracted, setHasUserInteracted] = useState(false)

  // Initialize expanded state when stages load (only once)
  useEffect(() => {
    if (stages.length > 0 && !hasUserInteracted) {
      setExpandedStages(new Set(stages.map(s => s.id)))
    }
  }, [stages, hasUserInteracted])

  // Responsibles dialog state
  const [responsiblesDialog, setResponsiblesDialog] = useState<{
    isOpen: boolean
    stageId: string | null
  }>({ isOpen: false, stageId: null })

  // Delete confirm dialog state
  const [deleteDialog, setDeleteDialog] = useState<{
    isOpen: boolean
    stageId: string | null
    stageName: string
    tasksCount: number
  }>({ isOpen: false, stageId: null, stageName: '', tasksCount: 0 })

  // Templates state
  const [templatesDialogOpen, setTemplatesDialogOpen] = useState(false)
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const hasManageTemplatesPermission = useHasPermission('dec.templates.manage')
  const userDepartmentId = useUserStore((state) => state.profile?.department_id || state.profile?.departmentId)

  // Template stages for save modal (memoized to avoid re-renders)
  const templateStagesForSave = useMemo((): TemplateStage[] => {
    return stages.map((stage, index) => ({
      name: stage.name,
      order: index,
      items: stage.decompositions.map((d) => {
        const workCat = workCategories.find((c) => c.work_category_name === d.typeOfWork)
        const diffLevel = difficultyLevels.find((dl) => dl.difficulty_abbr === d.difficulty)
        return {
          description: d.description,
          workCategoryId: workCat?.work_category_id || '',
          workCategoryName: d.typeOfWork,
          difficultyId: diffLevel?.difficulty_id || null,
          difficultyName: d.difficulty || null,
          plannedHours: d.plannedHours,
        }
      }),
    }))
  }, [stages, workCategories, difficultyLevels])

  // ============================================================================
  // DnD Sensors
  // ============================================================================

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // ============================================================================
  // Stage Operations
  // ============================================================================

  const handleAddStage = useCallback(async () => {
    const order = stages.length
    const tempId = generateTempId()

    // Optimistic update
    const newStage: Stage = {
      ...DEFAULT_STAGE,
      id: tempId,
      name: `Этап ${order + 1}`,
      decompositions: [],
    }
    setStages((prev) => [...prev, newStage])
    setExpandedStages((prev) => new Set([...prev, tempId]))

    try {
      const result = await createStageMutation.mutateAsync({
        sectionId,
        name: newStage.name,
        order,
      })

      // Replace temp ID with real ID
      setStages((prev) =>
        prev.map((s) =>
          s.id === tempId
            ? { ...s, id: result.id }
            : s
        )
      )
      setExpandedStages((prev) => {
        const next = new Set(prev)
        next.delete(tempId)
        next.add(result.id)
        return next
      })
    } catch (error) {
      // Rollback
      setStages((prev) => prev.filter((s) => s.id !== tempId))
      setExpandedStages((prev) => {
        const next = new Set(prev)
        next.delete(tempId)
        return next
      })
      toast({
        title: 'Ошибка',
        description: 'Не удалось создать этап',
        variant: 'destructive',
      })
    }
  }, [stages.length, sectionId, createStageMutation, toast])

  const handleUpdateStage = useCallback(
    async (stageId: string, updates: Partial<Stage>) => {
      // Optimistic update
      setStages((prev) =>
        prev.map((s) => (s.id === stageId ? { ...s, ...updates } : s))
      )

      try {
        await updateStageMutation.mutateAsync({
          stageId,
          sectionId,
          ...updates,
        })
      } catch (error) {
        toast({
          title: 'Ошибка',
          description: 'Не удалось обновить этап',
          variant: 'destructive',
        })
      }
    },
    [sectionId, updateStageMutation, toast]
  )

  const handleDeleteStage = useCallback(
    (stageId: string) => {
      const stageToDelete = stages.find((s) => s.id === stageId)
      if (!stageToDelete) return

      // Открываем диалог подтверждения
      setDeleteDialog({
        isOpen: true,
        stageId,
        stageName: stageToDelete.name,
        tasksCount: stageToDelete.decompositions.length,
      })
    },
    [stages]
  )

  const confirmDeleteStage = useCallback(
    async () => {
      const { stageId, stageName } = deleteDialog
      if (!stageId) return

      const stageToDelete = stages.find((s) => s.id === stageId)
      if (!stageToDelete) return

      // Закрываем диалог
      setDeleteDialog({ isOpen: false, stageId: null, stageName: '', tasksCount: 0 })

      // Optimistic update
      setStages((prev) => prev.filter((s) => s.id !== stageId))

      try {
        await deleteStageMutation.mutateAsync({ stageId, sectionId })
        toast({
          title: 'Этап удалён',
          description: `Этап "${stageName}" был удалён`,
        })
      } catch (error) {
        // Rollback
        setStages((prev) => {
          const index = prev.findIndex((s) => s.id > stageId)
          const newStages = [...prev]
          newStages.splice(index === -1 ? prev.length : index, 0, stageToDelete)
          return newStages
        })
        toast({
          title: 'Ошибка',
          description: error instanceof Error ? error.message : 'Не удалось удалить этап',
          variant: 'destructive',
        })
      }
    },
    [deleteDialog, stages, sectionId, deleteStageMutation, toast]
  )

  const handleReorderStages = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return

      const oldIndex = stages.findIndex((s) => s.id === active.id)
      const newIndex = stages.findIndex((s) => s.id === over.id)

      if (oldIndex === -1 || newIndex === -1) return

      const reordered = arrayMove(stages, oldIndex, newIndex)

      // Optimistic update
      setStages(reordered)

      try {
        await reorderStagesMutation.mutateAsync({
          stages: reordered.map((s, i) => ({ stageId: s.id, order: i })),
          sectionId,
        })
      } catch (error) {
        // Rollback
        setStages(stages)
        toast({
          title: 'Ошибка',
          description: 'Не удалось изменить порядок этапов',
          variant: 'destructive',
        })
      }
    },
    [stages, sectionId, reorderStagesMutation, toast]
  )

  // ============================================================================
  // Responsibles Operations
  // ============================================================================

  const handleOpenResponsiblesDialog = useCallback((stageId: string) => {
    setResponsiblesDialog({ isOpen: true, stageId })
  }, [])

  const handleCloseResponsiblesDialog = useCallback(() => {
    setResponsiblesDialog({ isOpen: false, stageId: null })
  }, [])

  const handleAssignResponsibles = useCallback(
    async (userIds: string[]) => {
      const { stageId } = responsiblesDialog
      if (!stageId) return

      handleUpdateStage(stageId, { responsibles: userIds })
      handleCloseResponsiblesDialog()
    },
    [responsiblesDialog, handleUpdateStage, handleCloseResponsiblesDialog]
  )

  // ============================================================================
  // Decomposition Operations
  // ============================================================================

  const handleAddDecomposition = useCallback(
    async (stageId: string) => {
      const stage = stages.find((s) => s.id === stageId)
      if (!stage) return

      const order = stage.decompositions.length
      const tempId = generateTempId()
      const defaultCategory = workCategories[0]

      // Optimistic update
      const newDecomp: Decomposition = {
        ...DEFAULT_DECOMPOSITION,
        id: tempId,
        typeOfWork: defaultCategory?.work_category_name || '',
      }

      setStages((prev) =>
        prev.map((s) =>
          s.id === stageId
            ? { ...s, decompositions: [...s.decompositions, newDecomp] }
            : s
        )
      )

      try {
        const result = await createItemMutation.mutateAsync({
          sectionId,
          stageId,
          description: '',
          workCategoryId: defaultCategory?.work_category_id || '',
          plannedHours: 0,
          order,
        })

        // Replace temp ID
        setStages((prev) =>
          prev.map((s) =>
            s.id === stageId
              ? {
                  ...s,
                  decompositions: s.decompositions.map((d) =>
                    d.id === tempId ? { ...d, id: result.id } : d
                  ),
                }
              : s
          )
        )
      } catch (error) {
        // Rollback
        setStages((prev) =>
          prev.map((s) =>
            s.id === stageId
              ? { ...s, decompositions: s.decompositions.filter((d) => d.id !== tempId) }
              : s
          )
        )
        toast({
          title: 'Ошибка',
          description: 'Не удалось создать задачу',
          variant: 'destructive',
        })
      }
    },
    [stages, workCategories, sectionId, createItemMutation, toast]
  )

  const handleUpdateDecomposition = useCallback(
    async (stageId: string, decompositionId: string, updates: Partial<Decomposition>) => {
      // Find the work category ID if typeOfWork is being updated
      let workCategoryId: string | undefined
      if (updates.typeOfWork) {
        const cat = workCategories.find((c) => c.work_category_name === updates.typeOfWork)
        workCategoryId = cat?.work_category_id
      }

      // Find the difficulty ID if difficulty is being updated
      let difficultyId: string | undefined
      if (updates.difficulty) {
        const diff = difficultyLevels.find((d) => d.difficulty_abbr === updates.difficulty)
        difficultyId = diff?.difficulty_id
      }

      // Optimistic update
      setStages((prev) =>
        prev.map((s) =>
          s.id === stageId
            ? {
                ...s,
                decompositions: s.decompositions.map((d) =>
                  d.id === decompositionId ? { ...d, ...updates } : d
                ),
              }
            : s
        )
      )

      try {
        await updateItemMutation.mutateAsync({
          itemId: decompositionId,
          sectionId,
          ...(updates.description !== undefined && { description: updates.description }),
          ...(workCategoryId && { workCategoryId }),
          ...(difficultyId && { difficultyId }),
          ...(updates.plannedHours !== undefined && { plannedHours: updates.plannedHours }),
          ...(updates.progress !== undefined && { progress: updates.progress }),
        })
      } catch (error) {
        toast({
          title: 'Ошибка',
          description: 'Не удалось обновить задачу',
          variant: 'destructive',
        })
      }
    },
    [workCategories, difficultyLevels, sectionId, updateItemMutation, toast]
  )

  const handleDeleteDecomposition = useCallback(
    async (stageId: string, decompositionId: string) => {
      const stage = stages.find((s) => s.id === stageId)
      const decompToDelete = stage?.decompositions.find((d) => d.id === decompositionId)
      if (!decompToDelete) return

      // Optimistic update
      setStages((prev) =>
        prev.map((s) =>
          s.id === stageId
            ? { ...s, decompositions: s.decompositions.filter((d) => d.id !== decompositionId) }
            : s
        )
      )

      try {
        await deleteItemMutation.mutateAsync({ itemId: decompositionId, sectionId })
      } catch (error) {
        // Rollback
        setStages((prev) =>
          prev.map((s) =>
            s.id === stageId
              ? { ...s, decompositions: [...s.decompositions, decompToDelete] }
              : s
          )
        )
        toast({
          title: 'Ошибка',
          description: 'Не удалось удалить задачу',
          variant: 'destructive',
        })
      }
    },
    [stages, sectionId, deleteItemMutation, toast]
  )

  const handleReorderDecompositions = useCallback(
    async (stageId: string, reordered: Decomposition[]) => {
      const originalStage = stages.find((s) => s.id === stageId)
      if (!originalStage) return

      // Optimistic update
      setStages((prev) =>
        prev.map((s) =>
          s.id === stageId ? { ...s, decompositions: reordered } : s
        )
      )

      try {
        await reorderItemsMutation.mutateAsync({
          items: reordered.map((d, i) => ({ itemId: d.id, order: i })),
          sectionId,
        })
      } catch (error) {
        // Rollback
        setStages((prev) =>
          prev.map((s) =>
            s.id === stageId ? { ...s, decompositions: originalStage.decompositions } : s
          )
        )
        toast({
          title: 'Ошибка',
          description: 'Не удалось изменить порядок задач',
          variant: 'destructive',
        })
      }
    },
    [stages, sectionId, reorderItemsMutation, toast]
  )

  // ============================================================================
  // Expand/Collapse Operations
  // ============================================================================

  const handleToggleExpand = useCallback((stageId: string) => {
    setExpandedStages((prev) => {
      const next = new Set(prev)
      if (next.has(stageId)) {
        next.delete(stageId)
      } else {
        next.add(stageId)
      }
      return next
    })
  }, [])

  const handleExpandAll = useCallback(() => {
    setHasUserInteracted(true)
    setExpandedStages(new Set(stages.map(s => s.id)))
  }, [stages])

  const handleCollapseAll = useCallback(() => {
    setHasUserInteracted(true)
    setExpandedStages(new Set())
  }, [])

  // ============================================================================
  // Template Operations (callbacks for new modals)
  // ============================================================================

  const handleTemplateApplied = useCallback(
    (newStages: Stage[]) => {
      // Add new stages to local state
      setStages((prev) => [...prev, ...newStages])

      // Expand new stages
      setExpandedStages((prev) => {
        const next = new Set(prev)
        newStages.forEach((s) => next.add(s.id))
        return next
      })

      toast({
        title: 'Шаблон применён',
        description: `Добавлено ${newStages.length} этап(ов)`,
      })
    },
    [toast]
  )

  const handleTemplateSaved = useCallback(() => {
    toast({
      title: 'Шаблон сохранён',
      description: 'Шаблон успешно создан',
    })
    setSaveDialogOpen(false)
  }, [toast])

  // ============================================================================
  // Computed Values
  // ============================================================================

  const totalStats = useMemo(
    () => calculateTotalStats(stages, actualHoursByItemId),
    [stages, actualHoursByItemId]
  )

  // Get current stage for responsibles dialog
  const currentStageForDialog = useMemo(() => {
    if (!responsiblesDialog.stageId) return null
    return stages.find(s => s.id === responsiblesDialog.stageId) || null
  }, [stages, responsiblesDialog.stageId])

  // ============================================================================
  // Loading State
  // ============================================================================

  if (isLoadingData) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div className="h-full flex flex-col">
      {/* Compact Toolbar */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-slate-800/50 bg-slate-900/30">
        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleAddStage}
            className="h-7 px-2 text-xs"
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Этап
          </Button>
        </div>

        <div className="flex items-center gap-3">
          {/* Stats - compact */}
          <div className="flex items-center gap-3 text-[10px] text-slate-500">
            <span>{totalStats.totalStages} эт.</span>
            <span>{totalStats.totalTasks} зад.</span>
            <span>{totalStats.totalActualHours.toFixed(0)}/{totalStats.totalPlannedHours} ч</span>
            <span>{totalStats.totalProgress}%</span>
          </div>

          {/* Template buttons - right aligned */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setTemplatesDialogOpen(true)}
              className="h-7 px-2 text-xs"
              title="Применить шаблон"
            >
              <FileText className="h-3.5 w-3.5 mr-1" />
              Шаблон
            </Button>
            {hasManageTemplatesPermission && stages.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSaveDialogOpen(true)}
                className="h-7 px-2 text-xs"
                title="Сохранить как шаблон"
              >
                <Save className="h-3.5 w-3.5 mr-1" />
                Сохранить как шаблон
              </Button>
            )}
          </div>

          <div className="flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleExpandAll}
              className="h-6 w-6 p-0"
              title="Развернуть все"
            >
              <ChevronsDown className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCollapseAll}
              className="h-6 w-6 p-0"
              title="Свернуть все"
            >
              <ChevronsUp className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Stages List */}
      <div className="flex-1 overflow-auto p-2">
        {stages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center">
            <p className="text-sm text-muted-foreground mb-3">Нет этапов</p>
            <Button variant="outline" size="sm" onClick={handleAddStage}>
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Создать этап
            </Button>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleReorderStages}
          >
            <SortableContext
              items={stages.map((s) => s.id)}
              strategy={verticalListSortingStrategy}
            >
              {stages.map((stage) => (
                <StageCard
                  key={stage.id}
                  stage={stage}
                  employees={employees}
                  workCategories={workCategories}
                  difficultyLevels={difficultyLevels}
                  stageStatuses={stageStatuses}
                  actualHoursByItemId={actualHoursByItemId}
                  isExpanded={expandedStages.has(stage.id)}
                  onToggleExpand={() => handleToggleExpand(stage.id)}
                  onUpdateStage={(updates) => handleUpdateStage(stage.id, updates)}
                  onDeleteStage={() => handleDeleteStage(stage.id)}
                  onOpenResponsiblesDialog={() => handleOpenResponsiblesDialog(stage.id)}
                  onRemoveResponsible={(userId) => {
                    handleUpdateStage(stage.id, {
                      responsibles: stage.responsibles.filter((r) => r !== userId),
                    })
                  }}
                  onAddDecomposition={() => handleAddDecomposition(stage.id)}
                  onUpdateDecomposition={(decompositionId, updates) =>
                    handleUpdateDecomposition(stage.id, decompositionId, updates)
                  }
                  onDeleteDecomposition={(decompositionId) =>
                    handleDeleteDecomposition(stage.id, decompositionId)
                  }
                  onReorderDecompositions={handleReorderDecompositions}
                />
              ))}
            </SortableContext>
          </DndContext>
        )}
      </div>

      {/* Responsibles Dialog */}
      <AssignResponsiblesDialog
        isOpen={responsiblesDialog.isOpen}
        onClose={handleCloseResponsiblesDialog}
        employees={employees}
        currentResponsibles={currentStageForDialog?.responsibles || []}
        onAssign={handleAssignResponsibles}
      />

      {/* Template Select Modal (new design) */}
      <TemplateSelectModal
        isOpen={templatesDialogOpen}
        onClose={() => setTemplatesDialogOpen(false)}
        onApply={handleTemplateApplied}
        sectionId={sectionId}
        hasManagePermission={hasManageTemplatesPermission}
        defaultDepartmentId={userDepartmentId || undefined}
      />

      {/* Template Save Modal (new design) */}
      <TemplateSaveModal
        isOpen={saveDialogOpen}
        onClose={() => setSaveDialogOpen(false)}
        onSuccess={handleTemplateSaved}
        stages={templateStagesForSave}
        defaultDepartmentId={userDepartmentId || undefined}
      />

      {/* Delete Confirm Dialog */}
      <DeleteConfirmDialog
        isOpen={deleteDialog.isOpen}
        onClose={() => setDeleteDialog({ isOpen: false, stageId: null, stageName: '', tasksCount: 0 })}
        onConfirm={confirmDeleteStage}
        title="Удаление этапа"
        description={`Вы уверены, что хотите удалить этап "${deleteDialog.stageName}"? Это действие необратимо.`}
        itemsCount={deleteDialog.tasksCount}
      />
    </div>
  )
}

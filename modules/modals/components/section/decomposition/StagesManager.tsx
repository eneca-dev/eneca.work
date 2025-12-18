'use client'

/**
 * StagesManager - Главный компонент управления этапами декомпозиции
 */

import { useState, useMemo, useCallback, useEffect } from 'react'
import {
  Plus,
  Trash2,
  Copy,
  ClipboardPaste,
  Loader2,
  ChevronsDown,
  ChevronsUp,
  FolderOpen,
  MoveRight,
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
import type { Stage, Decomposition, StagesManagerProps } from './types'
import { calculateTotalStats, generateTempId } from './utils'
import { DEFAULT_STAGE, DEFAULT_DECOMPOSITION } from './constants'

// Hooks
import {
  useDecompositionBootstrap,
  useWorkLogsAggregate,
  useEmployees,
  useWorkCategories,
  useDifficultyLevels,
  useStageStatuses,
  useCreateDecompositionStage,
  useUpdateDecompositionStage,
  useDeleteDecompositionStage,
  useReorderDecompositionStages,
  useCreateDecompositionItem,
  useUpdateDecompositionItem,
  useDeleteDecompositionItem,
  useMoveDecompositionItems,
  useReorderDecompositionItems,
  useBulkDeleteDecompositionItems,
} from '../../../hooks'

// ============================================================================
// Component
// ============================================================================

export function StagesManager({ sectionId, onOpenLog }: StagesManagerProps) {
  const { toast } = useToast()

  // ============================================================================
  // Data Fetching
  // ============================================================================

  const { data: bootstrapData, isLoading: isLoadingBootstrap } = useDecompositionBootstrap(sectionId)
  const { data: employees = [] } = useEmployees()
  const { data: workCategories = [] } = useWorkCategories()
  const { data: difficultyLevels = [] } = useDifficultyLevels()
  const { data: stageStatuses = [] } = useStageStatuses()

  // Local state for stages (optimistic updates)
  const [stages, setStages] = useState<Stage[]>([])

  // Sync bootstrap data to local state
  useEffect(() => {
    if (bootstrapData?.stages) {
      setStages(bootstrapData.stages)
    }
  }, [bootstrapData])

  // Get all item IDs for work logs
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
  const bulkDeleteItemsMutation = useBulkDeleteDecompositionItems()

  // ============================================================================
  // Selection State
  // ============================================================================

  const [selectedStages, setSelectedStages] = useState<Set<string>>(new Set())
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
  const [expandedAll, setExpandedAll] = useState(true)

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
    } catch (error) {
      // Rollback
      setStages((prev) => prev.filter((s) => s.id !== tempId))
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
        // Rollback would require storing previous state
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
    async (stageId: string) => {
      const stageToDelete = stages.find((s) => s.id === stageId)
      if (!stageToDelete) return

      // Optimistic update
      setStages((prev) => prev.filter((s) => s.id !== stageId))

      try {
        await deleteStageMutation.mutateAsync({ stageId, sectionId })
        toast({
          title: 'Этап удалён',
          description: `Этап "${stageToDelete.name}" был удалён`,
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
          description: 'Не удалось удалить этап',
          variant: 'destructive',
        })
      }
    },
    [stages, sectionId, deleteStageMutation, toast]
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
  // Selection Operations
  // ============================================================================

  const handleToggleSelectStage = useCallback((stageId: string) => {
    setSelectedStages((prev) => {
      const next = new Set(prev)
      if (next.has(stageId)) {
        next.delete(stageId)
      } else {
        next.add(stageId)
      }
      return next
    })
  }, [])

  const handleToggleSelectItem = useCallback((itemId: string) => {
    setSelectedItems((prev) => {
      const next = new Set(prev)
      if (next.has(itemId)) {
        next.delete(itemId)
      } else {
        next.add(itemId)
      }
      return next
    })
  }, [])

  const handleToggleSelectAllItems = useCallback((stageId: string) => {
    const stage = stages.find((s) => s.id === stageId)
    if (!stage) return

    const stageItemIds = stage.decompositions.map((d) => d.id)
    const allSelected = stageItemIds.every((id) => selectedItems.has(id))

    setSelectedItems((prev) => {
      const next = new Set(prev)
      if (allSelected) {
        stageItemIds.forEach((id) => next.delete(id))
      } else {
        stageItemIds.forEach((id) => next.add(id))
      }
      return next
    })
  }, [stages, selectedItems])

  const handleDeleteSelectedItems = useCallback(async () => {
    if (selectedItems.size === 0) return

    const itemIds = Array.from(selectedItems)

    // Optimistic update
    setStages((prev) =>
      prev.map((s) => ({
        ...s,
        decompositions: s.decompositions.filter((d) => !selectedItems.has(d.id)),
      }))
    )
    setSelectedItems(new Set())

    try {
      await bulkDeleteItemsMutation.mutateAsync({ itemIds, sectionId })
      toast({
        title: 'Задачи удалены',
        description: `Удалено ${itemIds.length} задач`,
      })
    } catch (error) {
      // Would need to restore from backup
      toast({
        title: 'Ошибка',
        description: 'Не удалось удалить задачи',
        variant: 'destructive',
      })
    }
  }, [selectedItems, sectionId, bulkDeleteItemsMutation, toast])

  // ============================================================================
  // Toolbar Actions
  // ============================================================================

  const handleExpandAll = useCallback(() => {
    setExpandedAll(true)
  }, [])

  const handleCollapseAll = useCallback(() => {
    setExpandedAll(false)
  }, [])

  // ============================================================================
  // Computed Values
  // ============================================================================

  const totalStats = useMemo(
    () => calculateTotalStats(stages, actualHoursByItemId),
    [stages, actualHoursByItemId]
  )

  // ============================================================================
  // Loading State
  // ============================================================================

  if (isLoadingBootstrap) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border/40 bg-muted/10">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleAddStage}>
            <Plus className="h-4 w-4 mr-1" />
            Этап
          </Button>

          {selectedItems.size > 0 && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDeleteSelectedItems}
                className="text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Удалить ({selectedItems.size})
              </Button>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Stats */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground mr-4">
            <span>{totalStats.totalStages} этапов</span>
            <span>{totalStats.totalTasks} задач</span>
            <span>{totalStats.totalPlannedHours} ч план</span>
            <span>{totalStats.totalActualHours.toFixed(1)} ч факт</span>
            <span>{totalStats.totalProgress}% готово</span>
          </div>

          <Button variant="ghost" size="sm" onClick={handleExpandAll} title="Развернуть все">
            <ChevronsDown className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={handleCollapseAll} title="Свернуть все">
            <ChevronsUp className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Stages List */}
      <div className="flex-1 overflow-auto p-4">
        {stages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <p className="text-muted-foreground mb-4">Нет этапов декомпозиции</p>
            <Button onClick={handleAddStage}>
              <Plus className="h-4 w-4 mr-2" />
              Создать первый этап
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
                  isSelected={selectedStages.has(stage.id)}
                  onToggleSelect={() => handleToggleSelectStage(stage.id)}
                  onUpdateStage={(updates) => handleUpdateStage(stage.id, updates)}
                  onDeleteStage={() => handleDeleteStage(stage.id)}
                  onAddResponsible={() => {
                    // TODO: Open AssignResponsiblesDialog
                  }}
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
                  onOpenLog={onOpenLog}
                  selectedItems={selectedItems}
                  onToggleSelectItem={handleToggleSelectItem}
                  onToggleSelectAllItems={() => handleToggleSelectAllItems(stage.id)}
                  defaultExpanded={expandedAll}
                />
              ))}
            </SortableContext>
          </DndContext>
        )}
      </div>
    </div>
  )
}

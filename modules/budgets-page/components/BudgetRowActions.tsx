/**
 * Budget Row Actions Component
 *
 * Кнопки действий для разных типов узлов иерархии.
 */

'use client'

import { Plus, Settings2, Trash2, RefreshCw, Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SyncStatus } from '../hooks'
import { StageInlineDelete } from './StageInlineDelete'
import { ItemCategorySelect } from './ItemCategorySelect'
import { ItemInlineDelete } from './ItemInlineDelete'
import type { HierarchyNodeType } from '../types'

interface BudgetRowActionsProps {
  /** Тип узла */
  nodeType: HierarchyNodeType
  /** ID узла */
  nodeId: string
  /** Название узла */
  nodeName: string
  /** Callback для обновления данных */
  onRefresh?: () => void
  /** Callbacks для открытия модалок */
  onProjectEdit?: () => void
  onObjectCreate?: () => void
  onObjectDelete?: () => void
  onSectionCreate?: () => void
  onSectionDelete?: () => void
  onStageCreate?: () => void
  onItemCreate?: () => void
  /** Callback для синхронизации с Worksection */
  onProjectSync?: () => void
  /** Статус синхронизации */
  syncStatus?: SyncStatus
  /** ID проекта который сейчас синхронизируется */
  syncingProjectId?: string | null
  /** Для items - category info */
  workCategoryId?: string | null
  workCategoryName?: string | null
}

export function BudgetRowActions({
  nodeType,
  nodeId,
  nodeName,
  onRefresh,
  onProjectEdit,
  onObjectCreate,
  onObjectDelete,
  onSectionCreate,
  onSectionDelete,
  onStageCreate,
  onItemCreate,
  onProjectSync,
  syncStatus = 'idle',
  syncingProjectId,
  workCategoryId,
  workCategoryName,
}: BudgetRowActionsProps) {
  const isProject = nodeType === 'project'
  const isObject = nodeType === 'object'
  const isSection = nodeType === 'section'
  const isDecompStage = nodeType === 'decomposition_stage'
  const isItem = nodeType === 'decomposition_item'

  return (
    <>
      {/* Project action buttons (sync + edit + add object) */}
      {isProject && (
        <div className="opacity-0 group-hover:opacity-100 ml-auto flex items-center gap-0.5">
          {/* Sync to Worksection button */}
          {(() => {
            const isSyncing = syncStatus === 'syncing' && syncingProjectId === nodeId
            const isSuccess = syncStatus === 'success' && syncingProjectId === nodeId
            const isError = syncStatus === 'error' && syncingProjectId === nodeId

            return (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onProjectSync?.()
                }}
                disabled={isSyncing}
                className={cn(
                  'p-1 rounded transition-all',
                  isSyncing && 'text-blue-400 cursor-wait',
                  isSuccess && 'text-green-400',
                  isError && 'text-destructive',
                  !isSyncing && !isSuccess && !isError && 'hover:bg-blue-500/20 text-muted-foreground hover:text-blue-400'
                )}
                title={
                  isSyncing
                    ? 'Синхронизация...'
                    : isSuccess
                    ? 'Синхронизация завершена'
                    : isError
                    ? 'Ошибка синхронизации'
                    : 'Синхронизировать с Worksection'
                }
              >
                {isSuccess ? (
                  <Check className="h-3.5 w-3.5" />
                ) : isError ? (
                  <X className="h-3.5 w-3.5" />
                ) : (
                  <RefreshCw className={cn('h-3.5 w-3.5', isSyncing && 'animate-spin')} />
                )}
              </button>
            )
          })()}
          <button
            onClick={(e) => {
              e.stopPropagation()
              onProjectEdit?.()
            }}
            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
            title="Редактировать проект"
          >
            <Settings2 className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onObjectCreate?.()
            }}
            className="p-1 rounded hover:bg-amber-500/20 text-muted-foreground hover:text-amber-400 transition-all"
            title="Добавить объект"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Object buttons: create section + delete (appear on hover) */}
      {isObject && (
        <div className="opacity-0 group-hover:opacity-100 ml-auto flex items-center gap-0.5">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onSectionCreate?.()
            }}
            className="p-1 rounded hover:bg-teal-500/20 text-muted-foreground hover:text-teal-400 transition-all"
            title="Добавить раздел"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onObjectDelete?.()
            }}
            className="p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-all"
            title="Удалить объект"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Section buttons: create stage + delete (appear on hover) */}
      {isSection && (
        <div className="opacity-0 group-hover:opacity-100 ml-auto flex items-center gap-0.5">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onStageCreate?.()
            }}
            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
            title="Добавить этап"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onSectionDelete?.()
            }}
            className="p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-all"
            title="Удалить раздел"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Stage buttons: create item + delete (appear on hover) */}
      {isDecompStage && (
        <div className="opacity-0 group-hover:opacity-100 ml-auto flex items-center gap-0.5">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onItemCreate?.()
            }}
            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
            title="Добавить задачу"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
          <StageInlineDelete
            stageId={nodeId}
            stageName={nodeName}
            onSuccess={onRefresh}
          />
        </div>
      )}

      {/* Item: category selector + delete button */}
      {isItem && (
        <div className="ml-auto flex items-center gap-1">
          <ItemCategorySelect
            itemId={nodeId}
            categoryId={workCategoryId || null}
            categoryName={workCategoryName || null}
            onSuccess={onRefresh}
          />
          <div className="opacity-0 group-hover:opacity-100">
            <ItemInlineDelete
              itemId={nodeId}
              itemName={nodeName}
              onSuccess={onRefresh}
            />
          </div>
        </div>
      )}
    </>
  )
}

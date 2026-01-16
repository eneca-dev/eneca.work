/**
 * Budget Row Component
 *
 * Строка иерархии с информацией о бюджетах.
 * Табличная структура с группами колонок и контрастными разделами.
 */

'use client'

import React, { useState } from 'react'
import { cn } from '@/lib/utils'
import { BudgetInlineEdit } from './BudgetInlineEdit'
import { ItemDifficultySelect } from './ItemDifficultySelect'
import { DeleteObjectModal, ObjectCreateModal, SectionCreateModal, DeleteSectionModal, ProjectQuickEditModal } from '@/modules/modals'
import { StageInlineCreate } from './StageInlineCreate'
import { ItemInlineCreate } from './ItemInlineCreate'
import { BudgetRowExpander } from './BudgetRowExpander'
import { BudgetRowBadges } from './BudgetRowBadges'
import { BudgetRowHours } from './BudgetRowHours'
import { BudgetRowActions } from './BudgetRowActions'
import { SectionRateEdit } from './SectionRateEdit'
import { ProgressCircle } from '@/modules/resource-graph'
import { MOCK_HOURLY_RATE, HOURS_ADJUSTMENT_FACTOR } from '../config/constants'
import { formatNumber } from '../utils'
import type { HierarchyNode, HierarchyNodeType, ExpandedState } from '../types'
import type { SyncStatus } from '../hooks'

// ============================================================================
// Types
// ============================================================================

interface BudgetRowProps {
  /** Узел иерархии */
  node: HierarchyNode
  /** Уровень вложенности (0 = корень) */
  level: number
  /** Развёрнутые узлы */
  expanded: ExpandedState
  /** Callback для toggle узла */
  onToggle: (nodeId: string) => void
  /** Callback для раскрытия всех детей узла */
  onExpandAll?: (nodeIds: string[]) => void
  /** Средняя ставка (BYN/час) - наследуется от корня */
  hourlyRate?: number
  /** Находимся ли внутри развёрнутого раздела */
  insideSection?: boolean
  /** Приведённые часы родителя (для расчёта % от общих) */
  parentAdjustedHours?: number
  /** Выделенный бюджет родителя (для расчёта % от родительского бюджета) */
  parentAllocatedBudget?: number
  /** Распределённый бюджет родителя (fallback для расчёта %) */
  parentDistributedBudget?: number
  /** Callback для обновления данных после удаления */
  onRefresh?: () => void
  /** ID текущего раздела (для создания items в stages) */
  currentSectionId?: string
  /** Callback для автоматического раскрытия при создании */
  onAutoExpand?: (nodeId: string) => void
  /** Callback для синхронизации проекта с Worksection */
  onProjectSync?: (projectId: string, projectName?: string) => Promise<unknown>
  /** Статус синхронизации */
  syncStatus?: SyncStatus
  /** ID проекта который сейчас синхронизируется */
  syncingProjectId?: string | null
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Собирает все ID детей узла рекурсивно
 */
function collectChildIds(node: HierarchyNode): string[] {
  const ids: string[] = []
  for (const child of node.children) {
    ids.push(child.id)
    ids.push(...collectChildIds(child))
  }
  return ids
}

// ============================================================================
// Main Component
// ============================================================================

export const BudgetRow = React.memo(function BudgetRow({
  node,
  level,
  expanded,
  onToggle,
  onExpandAll,
  hourlyRate = MOCK_HOURLY_RATE,
  insideSection = false,
  parentAdjustedHours = 0,
  parentAllocatedBudget = 0,
  parentDistributedBudget = 0,
  onRefresh,
  currentSectionId,
  onAutoExpand,
  onProjectSync,
  syncStatus,
  syncingProjectId,
}: BudgetRowProps) {
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [sectionCreateModalOpen, setSectionCreateModalOpen] = useState(false)
  const [sectionDeleteModalOpen, setSectionDeleteModalOpen] = useState(false)
  const [stageCreateOpen, setStageCreateOpen] = useState(false)
  const [itemCreateOpen, setItemCreateOpen] = useState(false)
  const [projectEditOpen, setProjectEditOpen] = useState(false)

  // Callback для успешного создания - раскрываем родителя
  const handleCreateSuccess = () => {
    onAutoExpand?.(node.id)
    onRefresh?.()
  }

  const hasChildren = node.children.length > 0
  const isExpanded = expanded[node.id] ?? false

  // Определяем тип строки
  const isSection = node.type === 'section'
  const isDecompStage = node.type === 'decomposition_stage'
  const isItem = node.type === 'decomposition_item'
  const isTopLevel = node.type === 'project' || node.type === 'object'

  // Плановые часы
  const plannedHours = node.plannedHours || 0

  // Приведённые часы = плановые * К
  const adjustedHours = plannedHours * HOURS_ADJUSTMENT_FACTOR

  // Эффективная ставка: для раздела берём из node.hourlyRate, для детей - наследуем от родителя
  const effectiveRate = isSection
    ? (node.hourlyRate ?? MOCK_HOURLY_RATE)
    : hourlyRate

  // Расчётный бюджет = приведённые часы * ставка
  const calcBudget = adjustedHours > 0 ? adjustedHours * effectiveRate : null

  // Выделенный бюджет (сумма planned_amount всех бюджетов)
  const allocatedBudget = node.budgets.reduce((sum, b) => sum + b.planned_amount, 0)

  // % часов от родителя (доля приведённых часов от родительских)
  const percentOfParentHours = parentAdjustedHours > 0
    ? Math.round((adjustedHours / parentAdjustedHours) * 100)
    : null

  // Распределено (сумма выделенных бюджетов только прямых детей)
  const distributedBudget = node.children.length > 0
    ? node.children.reduce((sum, child) => sum + child.budgets.reduce((s, b) => s + b.planned_amount, 0), 0)
    : allocatedBudget

  // Сравнение: перебор если выделено меньше чем расчётный
  const isOverBudget = calcBudget !== null && allocatedBudget < calcBudget
  // Распределено больше чем выделено
  const isOverDistributed = distributedBudget > allocatedBudget

  // Полная иерархия отступов (без stage — объекты напрямую под проектом)
  const INDENT_MAP: Record<HierarchyNodeType, number> = {
    project: 0,
    object: 16,
    section: 32,
    decomposition_stage: 48,
    decomposition_item: 64,
  }
  const indent = INDENT_MAP[node.type]

  // Стили строки в зависимости от типа
  const isProject = node.type === 'project'
  const isObject = node.type === 'object'

  const rowStyles = cn(
    'group flex items-center border-b transition-colors',
    // Проект - самый верхний уровень (светлее)
    isProject && 'bg-slate-700/40 border-slate-700 hover:bg-slate-700/60',
    // Объект (светлее)
    isObject && 'bg-slate-700/40 border-slate-700 hover:bg-slate-700/60',
    // Разделы (светлее)
    isSection && 'bg-slate-700/35 border-slate-700 hover:bg-slate-700/55',
    // Этапы декомпозиции внутри раздела (темнее)
    isDecompStage && insideSection && 'bg-slate-950/95 border-slate-700/60 hover:bg-slate-900/90',
    // Задачи внутри раздела (темнее)
    isItem && insideSection && 'bg-slate-950/95 border-slate-700/60 hover:bg-slate-900/90',
    // Высота строки
    'min-h-[32px]'
  )

  // Обработчик клика: для раздела раскрываем всё содержимое
  const handleToggle = () => {
    if (!hasChildren) return

    if (isSection && !isExpanded && onExpandAll) {
      // Раскрываем раздел и все его содержимое
      const allChildIds = collectChildIds(node)
      onExpandAll([node.id, ...allChildIds])
    } else {
      onToggle(node.id)
    }
  }

  return (
    <>
      {/* Main row */}
      <div className={rowStyles}>
        {/* ===== НАИМЕНОВАНИЕ ===== */}
        <div
          className="flex items-center gap-2 min-w-[400px] w-[400px] px-2 shrink-0"
          style={{ paddingLeft: `${8 + indent}px` }}
        >
          {/* Expand/collapse button */}
          <BudgetRowExpander
            indent={indent}
            hasChildren={hasChildren}
            isExpanded={isExpanded}
            onToggle={handleToggle}
          />

          {/* Type label and stage badges */}
          <BudgetRowBadges
            nodeType={node.type}
            stageName={node.stageName}
          />

          {/* Name */}
          <span
            className={cn(
              'truncate text-[12px]',
              isSection && 'font-medium text-slate-200',
              isDecompStage && 'text-slate-300',
              isItem && 'text-slate-400',
              isTopLevel && 'font-medium text-slate-200'
            )}
            title={node.stageName ? `${node.stageName}: ${node.name}` : node.name}
          >
            {node.name}
          </span>

          {/* Action buttons */}
          <BudgetRowActions
            nodeType={node.type}
            nodeId={node.id}
            nodeName={node.name}
            onRefresh={onRefresh}
            onProjectEdit={() => setProjectEditOpen(true)}
            onObjectCreate={() => setCreateModalOpen(true)}
            onObjectDelete={() => setDeleteModalOpen(true)}
            onSectionCreate={() => setSectionCreateModalOpen(true)}
            onSectionDelete={() => setSectionDeleteModalOpen(true)}
            onStageCreate={() => setStageCreateOpen(true)}
            onItemCreate={() => setItemCreateOpen(true)}
            onProjectSync={() => onProjectSync?.(node.id, node.name)}
            syncStatus={syncStatus}
            syncingProjectId={syncingProjectId}
            workCategoryId={node.workCategoryId}
            workCategoryName={node.workCategoryName}
          />
        </div>

        {/* ===== КАТЕГОРИЯ (сложность) ===== */}
        <div className="w-10 shrink-0 flex items-center justify-center">
          {isItem && (
            <ItemDifficultySelect
              itemId={node.id}
              difficulty={node.difficulty || null}
              onSuccess={onRefresh}
            />
          )}
        </div>

        {/* ===== ТРУДОЗАТРАТЫ ===== */}
        <BudgetRowHours
          nodeType={node.type}
          nodeId={node.id}
          plannedHours={plannedHours}
          adjustedHours={adjustedHours}
          percentOfParentHours={percentOfParentHours}
          onSuccess={onRefresh}
        />

        {/* ===== СТАВКА ===== */}
        <div className="flex items-center shrink-0 border-l border-slate-700/30">
          <div className="w-[72px] px-2 text-right">
            {isSection && (
              <SectionRateEdit
                sectionId={node.id}
                value={node.hourlyRate ?? null}
                onSuccess={onRefresh}
              />
            )}
          </div>
        </div>

        {/* ===== БЮДЖЕТЫ: Расчётный / Распределено / Выделенный ===== */}
        <div className="flex items-center flex-1 min-w-[340px] shrink-0 border-l border-slate-700/30">
          <div className="w-full flex items-center">
            {/* Расчётный */}
            <div className="w-[80px] px-1 text-right">
              {calcBudget !== null && calcBudget > 0 ? (
                <span className={cn(
                  'text-[12px] tabular-nums',
                  isSection || isTopLevel ? 'text-cyan-400 font-medium' : 'text-cyan-400/70'
                )}>
                  {formatNumber(Math.round(calcBudget))}
                </span>
              ) : (
                <span className="text-[12px] text-slate-600 tabular-nums">—</span>
              )}
            </div>
            {/* Слеш */}
            <div className="w-[10px] text-center">
              <span className="text-[11px] text-slate-700">/</span>
            </div>
            {/* Распределено + ProgressCircle */}
            <div className="w-[100px] px-1 flex items-center justify-start gap-1">
              {distributedBudget > 0 ? (
                <>
                  <span className={cn(
                    'text-[12px] tabular-nums font-medium',
                    isOverDistributed ? 'text-red-400' : 'text-slate-300'
                  )}>
                    {formatNumber(distributedBudget)}
                  </span>
                  {/* ProgressCircle только для не-задач (проект/объект/раздел/этап) */}
                  {allocatedBudget > 0 && !isItem && (
                    <ProgressCircle
                      progress={Math.round((distributedBudget / allocatedBudget) * 100)}
                      size={16}
                      strokeWidth={2}
                      showCheckmarkAt100={true}
                    />
                  )}
                </>
              ) : (
                <span className="text-[12px] text-slate-600 tabular-nums">—</span>
              )}
            </div>
            {/* Слеш */}
            <div className="w-[10px] text-center">
              <span className="text-[11px] text-slate-700">/</span>
            </div>
            {/* Выделенный - inline редактирование */}
            <div className="flex-1 px-1">
              <BudgetInlineEdit
                budgets={node.budgets}
                entityType={node.entityType}
                entityId={node.id}
                entityName={node.name}
                isOverBudget={isOverBudget}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Children (if expanded) */}
      {isExpanded &&
        node.children.map((child) => (
          <BudgetRow
            key={child.id}
            node={child}
            level={level + 1}
            expanded={expanded}
            onToggle={onToggle}
            onExpandAll={onExpandAll}
            hourlyRate={effectiveRate}
            insideSection={isSection || insideSection}
            parentAdjustedHours={adjustedHours}
            parentAllocatedBudget={allocatedBudget}
            parentDistributedBudget={distributedBudget}
            onRefresh={onRefresh}
            currentSectionId={isSection ? node.id : currentSectionId}
            onAutoExpand={onAutoExpand}
            onProjectSync={onProjectSync}
            syncStatus={syncStatus}
            syncingProjectId={syncingProjectId}
          />
        ))}

      {/* Inline stage creation (for sections) */}
      {isSection && stageCreateOpen && (
        <div
          className="flex items-center border-b border-slate-800/50 bg-slate-800/30 min-h-[32px]"
          style={{ paddingLeft: `${8 + 48}px` }}
        >
          <StageInlineCreate
            sectionId={node.id}
            sectionName={node.name}
            onCancel={() => setStageCreateOpen(false)}
            onSuccess={handleCreateSuccess}
          />
        </div>
      )}

      {/* Inline item creation (for stages) */}
      {isDecompStage && itemCreateOpen && currentSectionId && (
        <div
          className="flex items-center border-b border-slate-800/30 bg-slate-900/50 min-h-[32px]"
          style={{ paddingLeft: `${8 + 64}px` }}
        >
          <ItemInlineCreate
            stageId={node.id}
            sectionId={currentSectionId}
            onCancel={() => setItemCreateOpen(false)}
            onSuccess={handleCreateSuccess}
          />
        </div>
      )}

      {/* Create Object Modal (for projects) */}
      {isProject && (
        <ObjectCreateModal
          isOpen={createModalOpen}
          onClose={() => setCreateModalOpen(false)}
          projectId={node.id}
          projectName={node.name}
          onSuccess={onRefresh}
        />
      )}

      {/* Project Quick Edit Modal */}
      {isProject && (
        <ProjectQuickEditModal
          isOpen={projectEditOpen}
          onClose={() => setProjectEditOpen(false)}
          projectId={node.id}
          projectName={node.name}
          currentStatus={node.projectStatus}
          currentStageType={node.stageName}
          currentTags={node.projectTags}
          onSuccess={onRefresh}
        />
      )}

      {/* Delete Object Modal */}
      {isObject && (
        <DeleteObjectModal
          isOpen={deleteModalOpen}
          onClose={() => setDeleteModalOpen(false)}
          objectId={node.id}
          objectName={node.name}
          onSuccess={onRefresh}
        />
      )}

      {/* Create Section Modal (for objects) */}
      {isObject && (
        <SectionCreateModal
          isOpen={sectionCreateModalOpen}
          onClose={() => setSectionCreateModalOpen(false)}
          objectId={node.id}
          objectName={node.name}
          onSuccess={onRefresh}
        />
      )}

      {/* Delete Section Modal */}
      {isSection && (
        <DeleteSectionModal
          isOpen={sectionDeleteModalOpen}
          onClose={() => setSectionDeleteModalOpen(false)}
          sectionId={node.id}
          sectionName={node.name}
          onSuccess={onRefresh}
        />
      )}
    </>
  )
})

/**
 * Budget Row Component
 *
 * Строка иерархии с информацией о бюджетах.
 * Табличная структура с группами колонок и контрастными разделами.
 */

'use client'

import React, { useState } from 'react'
import { ChevronRight, Trash2, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { BudgetInlineEdit } from './BudgetInlineEdit'
import { HoursInput } from './HoursInput'
import { ItemHoursEdit } from './ItemHoursEdit'
import { ItemDifficultySelect } from './ItemDifficultySelect'
import { ItemCategorySelect } from './ItemCategorySelect'
import { DeleteObjectModal, ObjectCreateModal, SectionCreateModal, DeleteSectionModal } from '@/modules/modals'
import { StageInlineCreate } from './StageInlineCreate'
import { StageInlineDelete } from './StageInlineDelete'
import { ItemInlineCreate } from './ItemInlineCreate'
import { ItemInlineDelete } from './ItemInlineDelete'
import type { HierarchyNode, HierarchyNodeType, ExpandedState } from '../types'

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
}

// ============================================================================
// Constants
// ============================================================================

/** Мок средней ставки (BYN/час) */
const MOCK_HOURLY_RATE = 15

/** Мок коэффициента приведения часов (К) */
const HOURS_ADJUSTMENT_FACTOR = 1.2

/** Полные названия типов узлов */
const NODE_LABELS: Record<HierarchyNodeType, string> = {
  project: 'Проект',
  object: 'Объект',
  section: 'Раздел',
  decomposition_stage: 'Этап',
  decomposition_item: '',
}

/** Сокращения стадий проекта */
const STAGE_ABBREVIATIONS: Record<string, string> = {
  'Стадия А': 'А',
  'Стадия П': 'П',
  'Стадия ПП': 'ПП',
  'Стадия Р': 'Р',
  'Стадия С': 'С',
  'Э': 'Э',
  'Базовая стадия (РУО)': 'РУО',
  'Основные проекты': 'ОП',
  'Отпуск': 'ОТП',
  'Отчетная стадия': 'ОТЧ',
  'Прочие работы': 'ПР',
}

/** Получить сокращение стадии */
function getStageAbbreviation(stageName: string | null | undefined): string | null {
  if (!stageName) return null
  return STAGE_ABBREVIATIONS[stageName] || stageName.slice(0, 3).toUpperCase()
}

/** Цвета для бейджей типов */
const NODE_LABEL_COLORS: Record<HierarchyNodeType, string> = {
  project: 'bg-amber-500/20 text-amber-400',
  object: 'bg-violet-500/20 text-violet-400',
  section: 'bg-teal-500/20 text-teal-400',
  decomposition_stage: 'bg-slate-600/30 text-slate-400',
  decomposition_item: '',
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Форматирует число с разделителями тысяч
 */
function formatNumber(value: number): string {
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(value)
}

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
}: BudgetRowProps) {
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [sectionCreateModalOpen, setSectionCreateModalOpen] = useState(false)
  const [sectionDeleteModalOpen, setSectionDeleteModalOpen] = useState(false)
  const [stageCreateOpen, setStageCreateOpen] = useState(false)
  const [itemCreateOpen, setItemCreateOpen] = useState(false)

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

  // Расчётный бюджет = приведённые часы * ставка
  const calcBudget = adjustedHours > 0 ? adjustedHours * hourlyRate : null

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

  // Метка типа
  const typeLabel = NODE_LABELS[node.type]
  const labelColor = NODE_LABEL_COLORS[node.type]

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
    // Проект - самый верхний уровень
    isProject && 'bg-slate-800/50 border-slate-700 hover:bg-slate-800/70',
    // Объект
    isObject && 'bg-slate-900/50 border-slate-700 hover:bg-slate-900/70',
    // Разделы - бирюзовый оттенок с левой полоской
    isSection && 'bg-teal-950/40 border-slate-700 hover:bg-teal-950/60 border-l-2 border-l-teal-500/50',
    // Этапы декомпозиции внутри раздела
    isDecompStage && insideSection && 'bg-slate-800/30 border-slate-700/60 hover:bg-slate-800/50',
    // Задачи внутри раздела
    isItem && insideSection && 'bg-slate-900/60 border-slate-700/60 hover:bg-slate-900/80',
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
          <button
            onClick={handleToggle}
            className={cn(
              'w-4 h-4 flex items-center justify-center rounded transition-colors shrink-0',
              hasChildren ? 'hover:bg-slate-700 cursor-pointer' : 'opacity-0'
            )}
            disabled={!hasChildren}
          >
            {hasChildren && (
              <ChevronRight
                className={cn(
                  'h-3 w-3 text-slate-500 transition-transform duration-200',
                  isExpanded && 'rotate-90'
                )}
              />
            )}
          </button>

          {/* Type label badge (для всех кроме items) */}
          {typeLabel && (
            <span
              className={cn(
                'shrink-0 px-1.5 py-0.5 rounded text-[9px] font-medium',
                labelColor
              )}
            >
              {typeLabel}
            </span>
          )}

          {/* Stage badge for projects */}
          {isProject && node.stageName && (
            <span
              className="shrink-0 px-1.5 py-0.5 rounded text-[9px] font-medium bg-purple-500/20 text-purple-400"
              title={node.stageName}
            >
              ст. {getStageAbbreviation(node.stageName)}
            </span>
          )}

          {/* Name */}
          <span
            className={cn(
              'truncate text-[12px]',
              isSection && 'font-medium text-teal-200',
              isDecompStage && 'text-slate-300',
              isItem && 'text-slate-400',
              isTopLevel && 'font-medium text-slate-200'
            )}
            title={node.stageName ? `${node.stageName}: ${node.name}` : node.name}
          >
            {node.name}
          </span>

          {/* Create object button for projects (appears on hover) */}
          {isProject && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                setCreateModalOpen(true)
              }}
              className="opacity-0 group-hover:opacity-100 ml-auto p-1 rounded hover:bg-amber-500/20 text-slate-500 hover:text-amber-400 transition-all"
              title="Добавить объект"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          )}

          {/* Object buttons: create section + delete (appear on hover) */}
          {isObject && (
            <div className="opacity-0 group-hover:opacity-100 ml-auto flex items-center gap-0.5">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setSectionCreateModalOpen(true)
                }}
                className="p-1 rounded hover:bg-teal-500/20 text-slate-500 hover:text-teal-400 transition-all"
                title="Добавить раздел"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setDeleteModalOpen(true)
                }}
                className="p-1 rounded hover:bg-red-500/20 text-slate-500 hover:text-red-400 transition-all"
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
                  setStageCreateOpen(true)
                }}
                className="p-1 rounded hover:bg-slate-600/50 text-slate-500 hover:text-slate-300 transition-all"
                title="Добавить этап"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setSectionDeleteModalOpen(true)
                }}
                className="p-1 rounded hover:bg-red-500/20 text-slate-500 hover:text-red-400 transition-all"
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
                  setItemCreateOpen(true)
                }}
                className="p-1 rounded hover:bg-slate-600/50 text-slate-500 hover:text-slate-300 transition-all"
                title="Добавить задачу"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
              <StageInlineDelete
                stageId={node.id}
                stageName={node.name}
                onSuccess={onRefresh}
              />
            </div>
          )}

          {/* Item: category selector + delete button */}
          {isItem && (
            <div className="ml-auto flex items-center gap-1">
              <ItemCategorySelect
                itemId={node.id}
                categoryId={node.workCategoryId || null}
                categoryName={node.workCategoryName || null}
                onSuccess={onRefresh}
              />
              <div className="opacity-0 group-hover:opacity-100">
                <ItemInlineDelete
                  itemId={node.id}
                  itemName={node.name}
                  onSuccess={onRefresh}
                />
              </div>
            </div>
          )}
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
        <div className="flex items-center shrink-0 border-l border-slate-700/30">
          {/* Плановые часы */}
          <div className="w-[72px] px-2 text-right">
            {isItem ? (
              <ItemHoursEdit
                itemId={node.id}
                value={plannedHours}
                onSuccess={onRefresh}
              />
            ) : (
              <HoursInput
                value={plannedHours}
                readOnly
                dimIfZero
                bold={isSection || isTopLevel}
              />
            )}
          </div>

          {/* С коэффициентом (приведённые часы) */}
          <div className="w-[72px] px-2 text-right">
            {adjustedHours > 0 ? (
              <span className={cn(
                'text-[12px] tabular-nums',
                isSection || isTopLevel ? 'text-slate-300 font-medium' : 'text-slate-400'
              )}>
                {formatNumber(Math.round(adjustedHours))}
              </span>
            ) : (
              <span className="text-[12px] text-slate-600 tabular-nums">0</span>
            )}
          </div>

          {/* % от родителя (доля часов от родительских) */}
          <div className="w-[52px] px-1 text-right">
            {percentOfParentHours !== null ? (
              <span className="text-[11px] tabular-nums text-slate-500">
                {percentOfParentHours}%
              </span>
            ) : (
              <span className="text-[11px] text-slate-700">—</span>
            )}
          </div>
        </div>

        {/* ===== СТАВКА ===== */}
        <div className="flex items-center shrink-0 border-l border-slate-700/30">
          <div className="w-[72px] px-2 text-right">
            {isSection && (
              <span className="text-[11px] text-slate-500 tabular-nums">
                {hourlyRate}
              </span>
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
            {/* Распределено */}
            <div className="w-[80px] px-1 text-center">
              {distributedBudget > 0 ? (
                <span className={cn(
                  'text-[12px] tabular-nums font-medium',
                  isOverDistributed ? 'text-red-400' : 'text-slate-300'
                )}>
                  {formatNumber(distributedBudget)}
                </span>
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
            hourlyRate={hourlyRate}
            insideSection={isSection || insideSection}
            parentAdjustedHours={adjustedHours}
            parentAllocatedBudget={allocatedBudget}
            parentDistributedBudget={distributedBudget}
            onRefresh={onRefresh}
            currentSectionId={isSection ? node.id : currentSectionId}
            onAutoExpand={onAutoExpand}
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

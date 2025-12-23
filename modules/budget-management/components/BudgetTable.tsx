/**
 * Budget Management - Main Table Component
 *
 * Логика распределения бюджета:
 * 1. Общий бюджет проекта распределяется по разделам в %
 * 2. Задачи оцениваются в часах по категориям (К, ВС, ГС)
 * 3. Часы приводятся к категории К через коэффициенты
 * 4. Бюджет по трудозатратам = Приведённые часы × Ставка К
 * 5. Сравнение выделенного бюджета и бюджета по трудозатратам
 */

'use client'

import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import {
  ChevronRight,
  ChevronDown,
  Download,
  AlertTriangle,
  CheckCircle2,
  Settings2,
  Pencil,
  Check,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ============================================================================
// Types
// ============================================================================

/** Категория специалиста */
type EmployeeCategory = 'К' | 'ВС' | 'ГС'

/** Коэффициенты приведения к категории К */
interface ConversionRates {
  К: number   // всегда 1.0
  ВС: number  // например 1.3
  ГС: number  // например 1.6
}

/** Задача декомпозиции */
interface Task {
  id: string
  name: string
  category: EmployeeCategory
  plannedHours: number
}

/** Этап декомпозиции */
interface Stage {
  id: string
  name: string
  tasks: Task[]
}

/** Раздел проекта */
interface Section {
  id: string
  code: string
  name: string
  budgetPercent: number      // % от общего бюджета
  rateK: number              // Ставка категории К (BYN/час)
  conversionRates: ConversionRates
  stages: Stage[]
}

/** Проект */
interface Project {
  id: string
  name: string
  totalBudget: number        // Общий бюджет проекта
  sections: Section[]
}

// ============================================================================
// Mock Data
// ============================================================================

const MOCK_PROJECT: Project = {
  id: 'p1',
  name: 'П-28/24 Жилой комплекс',
  totalBudget: 145000,
  sections: [
    {
      id: 's1',
      code: 'АР',
      name: 'Архитектурные решения',
      budgetPercent: 31,
      rateK: 28.5,
      conversionRates: { К: 1.0, ВС: 1.35, ГС: 1.65 },
      stages: [
        {
          id: 'st1',
          name: '1.1 Курирование',
          tasks: [
            { id: 't1', name: 'Совещания и координация', category: 'ГС', plannedHours: 80 },
            { id: 't2', name: 'Контроль качества', category: 'ГС', plannedHours: 40 },
          ],
        },
        {
          id: 'st2',
          name: '1.2 Моделирование LOD200',
          tasks: [
            { id: 't3', name: 'Объёмно-планировочное решение', category: 'ВС', plannedHours: 160 },
            { id: 't4', name: 'Функциональное зонирование', category: 'ВС', plannedHours: 80 },
            { id: 't5', name: 'Координационная основа', category: 'К', plannedHours: 40 },
          ],
        },
        {
          id: 'st3',
          name: '1.3 Моделирование LOD300',
          tasks: [
            { id: 't6', name: 'Детализация отделки', category: 'ВС', plannedHours: 120 },
            { id: 't7', name: 'Корректировка по смежникам', category: 'К', plannedHours: 60 },
          ],
        },
        {
          id: 'st4',
          name: '1.4 Оформление',
          tasks: [
            { id: 't8', name: 'Оформление чертежей', category: 'К', plannedHours: 200 },
            { id: 't9', name: 'Спецификации', category: 'К', plannedHours: 80 },
          ],
        },
      ],
    },
    {
      id: 's2',
      code: 'КР',
      name: 'Конструктивные решения',
      budgetPercent: 42,
      rateK: 32.0,
      conversionRates: { К: 1.0, ВС: 1.30, ГС: 1.55 },
      stages: [
        {
          id: 'st5',
          name: '2.1 Расчёт несущих конструкций',
          tasks: [
            { id: 't10', name: 'Статический расчёт', category: 'ВС', plannedHours: 200 },
            { id: 't11', name: 'Динамический расчёт', category: 'ВС', plannedHours: 120 },
            { id: 't12', name: 'Расчёт фундаментов', category: 'ВС', plannedHours: 80 },
          ],
        },
        {
          id: 'st6',
          name: '2.2 Проектирование узлов',
          tasks: [
            { id: 't13', name: 'Узлы сопряжения', category: 'К', plannedHours: 160 },
            { id: 't14', name: 'Типовые решения', category: 'К', plannedHours: 80 },
          ],
        },
        {
          id: 'st7',
          name: '2.3 Оформление',
          tasks: [
            { id: 't15', name: 'Оформление чертежей КЖ', category: 'К', plannedHours: 240 },
            { id: 't16', name: 'Оформление чертежей КМ', category: 'К', plannedHours: 160 },
            { id: 't17', name: 'Спецификации', category: 'К', plannedHours: 60 },
          ],
        },
      ],
    },
    {
      id: 's3',
      code: 'ОВ',
      name: 'Отопление и вентиляция',
      budgetPercent: 27,
      rateK: 26.8,
      conversionRates: { К: 1.0, ВС: 1.25, ГС: 1.50 },
      stages: [
        {
          id: 'st8',
          name: '3.1 Расчёт систем',
          tasks: [
            { id: 't18', name: 'Теплотехнический расчёт', category: 'ВС', plannedHours: 60 },
            { id: 't19', name: 'Аэродинамический расчёт', category: 'ВС', plannedHours: 80 },
          ],
        },
        {
          id: 'st9',
          name: '3.2 Проектирование',
          tasks: [
            { id: 't20', name: 'Схема отопления', category: 'К', plannedHours: 120 },
            { id: 't21', name: 'Схема вентиляции', category: 'К', plannedHours: 160 },
            { id: 't22', name: 'Спецификации оборудования', category: 'К', plannedHours: 40 },
          ],
        },
      ],
    },
  ],
}

// ============================================================================
// Utility Functions
// ============================================================================

function formatCurrency(value: number): string {
  return value.toLocaleString('ru-RU', { maximumFractionDigits: 0 })
}

function formatHours(value: number): string {
  return value.toLocaleString('ru-RU', { maximumFractionDigits: 1 })
}

/** Рассчитать приведённые часы К для задачи */
function calcConvertedHours(task: Task, rates: ConversionRates): number {
  return task.plannedHours * rates[task.category]
}

/** Рассчитать итоги по этапу */
function calcStageStats(stage: Stage, rates: ConversionRates) {
  let totalHours = 0
  let convertedHoursK = 0
  const hoursByCategory: Record<EmployeeCategory, number> = { К: 0, ВС: 0, ГС: 0 }

  stage.tasks.forEach((task) => {
    totalHours += task.plannedHours
    convertedHoursK += calcConvertedHours(task, rates)
    hoursByCategory[task.category] += task.plannedHours
  })

  return { totalHours, convertedHoursK, hoursByCategory }
}

/** Рассчитать итоги по разделу */
function calcSectionStats(section: Section, totalBudget: number) {
  let totalHours = 0
  let convertedHoursK = 0
  const hoursByCategory: Record<EmployeeCategory, number> = { К: 0, ВС: 0, ГС: 0 }

  section.stages.forEach((stage) => {
    const stats = calcStageStats(stage, section.conversionRates)
    totalHours += stats.totalHours
    convertedHoursK += stats.convertedHoursK
    hoursByCategory.К += stats.hoursByCategory.К
    hoursByCategory.ВС += stats.hoursByCategory.ВС
    hoursByCategory.ГС += stats.hoursByCategory.ГС
  })

  const allocatedBudget = (totalBudget * section.budgetPercent) / 100
  const laborBudget = convertedHoursK * section.rateK
  const difference = allocatedBudget - laborBudget

  return {
    totalHours,
    convertedHoursK,
    hoursByCategory,
    allocatedBudget,
    laborBudget,
    difference,
  }
}

// ============================================================================
// Editable Cell Component
// ============================================================================

interface EditableCellProps {
  value: number
  onChange: (value: number) => void
  format?: 'number' | 'percent' | 'currency'
  suffix?: string
  className?: string
  textClassName?: string
  min?: number
  max?: number
  step?: number
}

function EditableCell({
  value,
  onChange,
  format = 'number',
  suffix = '',
  className = '',
  textClassName = '',
  min = 0,
  max = 999999,
  step = 1,
}: EditableCellProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(value.toString())
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  const handleSave = useCallback(() => {
    const parsed = parseFloat(editValue.replace(',', '.'))
    if (!isNaN(parsed) && parsed >= min && parsed <= max) {
      onChange(parsed)
    }
    setIsEditing(false)
  }, [editValue, onChange, min, max])

  const handleCancel = useCallback(() => {
    setEditValue(value.toString())
    setIsEditing(false)
  }, [value])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave()
    } else if (e.key === 'Escape') {
      handleCancel()
    }
  }, [handleSave, handleCancel])

  const displayValue = useMemo(() => {
    if (format === 'percent') return `${value}%`
    if (format === 'currency') return formatCurrency(value)
    return value.toFixed(step < 1 ? 2 : 0)
  }, [value, format, step])

  if (isEditing) {
    return (
      <div className={cn('flex items-center gap-1', className)}>
        <input
          ref={inputRef}
          type="number"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleSave}
          min={min}
          max={max}
          step={step}
          className="w-full bg-white/10 border border-white/20 rounded px-1.5 py-0.5 text-[11px] tabular-nums text-white outline-none focus:border-blue-500"
        />
      </div>
    )
  }

  return (
    <div
      className={cn(
        'group flex items-center gap-1 cursor-pointer rounded px-1 -mx-1 hover:bg-white/5 transition-colors',
        className
      )}
      onClick={() => {
        setEditValue(value.toString())
        setIsEditing(true)
      }}
    >
      <span className={cn('text-[11px] tabular-nums', textClassName)}>
        {displayValue}{suffix}
      </span>
      <Pencil size={10} className="opacity-0 group-hover:opacity-50 transition-opacity shrink-0" />
    </div>
  )
}

// ============================================================================
// Sub-Components
// ============================================================================

/** Цветной индикатор категории */
function CategoryBadge({ category }: { category: EmployeeCategory }) {
  const colors: Record<EmployeeCategory, string> = {
    К: '#3b82f6',
    ВС: '#8b5cf6',
    ГС: '#f59e0b',
  }
  const color = colors[category]

  return (
    <span
      className="inline-flex items-center justify-center w-6 h-5 rounded text-[10px] font-semibold"
      style={{ backgroundColor: `${color}20`, color }}
    >
      {category}
    </span>
  )
}

/** Индикатор разницы бюджетов */
function BudgetDiff({ value }: { value: number }) {
  const isPositive = value >= 0
  const color = isPositive ? '#22c55e' : '#ef4444'
  const Icon = isPositive ? CheckCircle2 : AlertTriangle

  return (
    <div className="flex items-center gap-1">
      <Icon size={12} style={{ color }} />
      <span
        className="text-[11px] tabular-nums font-medium"
        style={{ color }}
      >
        {isPositive ? '+' : ''}{formatCurrency(value)}
      </span>
    </div>
  )
}

/** Прогресс-бар заполнения бюджета */
function BudgetBar({ allocated, labor }: { allocated: number; labor: number }) {
  const percentage = allocated > 0 ? Math.min((labor / allocated) * 100, 150) : 0
  const isOver = labor > allocated
  const color = isOver ? '#ef4444' : '#22c55e'

  return (
    <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-300"
        style={{
          width: `${Math.min(percentage, 100)}%`,
          backgroundColor: color,
        }}
      />
    </div>
  )
}

// ============================================================================
// Main Component
// ============================================================================

export function BudgetTable() {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['s1', 's2', 's3'])
  )
  const [expandedStages, setExpandedStages] = useState<Set<string>>(
    new Set(['st1', 'st2'])
  )

  // Editable state
  const [totalBudget, setTotalBudget] = useState(MOCK_PROJECT.totalBudget)
  const [sectionData, setSectionData] = useState(() =>
    MOCK_PROJECT.sections.map((s) => ({
      id: s.id,
      budgetPercent: s.budgetPercent,
      rateK: s.rateK,
    }))
  )

  // Create project with current editable values
  const project = useMemo(() => ({
    ...MOCK_PROJECT,
    totalBudget,
    sections: MOCK_PROJECT.sections.map((s) => {
      const data = sectionData.find((d) => d.id === s.id)
      return {
        ...s,
        budgetPercent: data?.budgetPercent ?? s.budgetPercent,
        rateK: data?.rateK ?? s.rateK,
      }
    }),
  }), [totalBudget, sectionData])

  // Update handlers
  const updateSectionPercent = useCallback((sectionId: string, value: number) => {
    setSectionData((prev) =>
      prev.map((s) => (s.id === sectionId ? { ...s, budgetPercent: value } : s))
    )
  }, [])

  const updateSectionRate = useCallback((sectionId: string, value: number) => {
    setSectionData((prev) =>
      prev.map((s) => (s.id === sectionId ? { ...s, rateK: value } : s))
    )
  }, [])

  // Рассчитать общие итоги
  const totals = useMemo(() => {
    let totalHours = 0
    let totalConvertedK = 0
    let totalAllocated = 0
    let totalLabor = 0

    project.sections.forEach((section) => {
      const stats = calcSectionStats(section, project.totalBudget)
      totalHours += stats.totalHours
      totalConvertedK += stats.convertedHoursK
      totalAllocated += stats.allocatedBudget
      totalLabor += stats.laborBudget
    })

    const percentUsed = project.sections.reduce((sum, s) => sum + s.budgetPercent, 0)

    return {
      hours: totalHours,
      convertedK: totalConvertedK,
      allocated: totalAllocated,
      labor: totalLabor,
      difference: totalAllocated - totalLabor,
      percentUsed,
    }
  }, [project])

  const toggleSection = (id: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleStage = (id: string) => {
    setExpandedStages((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  return (
    <div className="h-full flex flex-col bg-zinc-950">
      {/* ================================================================== */}
      {/* Header */}
      {/* ================================================================== */}
      <header className="shrink-0 border-b border-white/10 bg-zinc-900/80 backdrop-blur-sm">
        <div className="px-4 py-2 flex items-center justify-between">
          <div>
            <h1 className="text-sm font-semibold text-white/90">
              {project.name}
            </h1>
            <div className="flex items-center gap-3 text-[11px] text-white/50">
              <span className="flex items-center gap-1.5">
                Общий бюджет:
                <EditableCell
                  value={totalBudget}
                  onChange={setTotalBudget}
                  format="currency"
                  suffix=" BYN"
                  textClassName="text-emerald-400 font-semibold"
                  min={0}
                  max={10000000}
                  step={1000}
                />
              </span>
              <span>·</span>
              <span>
                Распределено: <span className={cn(
                  'font-medium',
                  totals.percentUsed === 100 ? 'text-emerald-400' : 'text-amber-400'
                )}>{totals.percentUsed}%</span>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button className="flex items-center gap-1.5 px-2 py-1 rounded text-[11px] text-white/60 hover:text-white/90 hover:bg-white/5 transition-colors">
              <Settings2 size={12} />
              Коэффициенты
            </button>
            <button className="flex items-center gap-1.5 px-2 py-1 rounded text-[11px] text-white/60 hover:text-white/90 hover:bg-white/5 transition-colors">
              <Download size={12} />
              Экспорт
            </button>
          </div>
        </div>

        {/* Column Group Headers */}
        <div className="flex border-t border-white/5 bg-zinc-900/60 text-[8px] font-medium text-white/30 uppercase tracking-wider">
          <div className="w-[280px] shrink-0 px-3 py-1 border-r border-white/5" />
          <div className="w-[200px] shrink-0 px-2 py-1 text-center border-r border-white/10 bg-blue-500/5">
            Трудозатраты
          </div>
          <div className="w-[150px] shrink-0 px-2 py-1 text-center border-r border-white/10 bg-emerald-500/5">
            Бюджет
          </div>
          <div className="flex-1 min-w-[200px] px-2 py-1 text-center bg-amber-500/5">
            Сравнение
          </div>
        </div>

        {/* Column Headers */}
        <div className="flex border-t border-white/5 bg-zinc-900/50 text-[8px] font-medium text-white/40 tracking-wide">
          {/* Структура */}
          <div className="w-[280px] shrink-0 px-3 py-1.5 border-r border-white/5">
            Раздел / Этап / Задача
          </div>

          {/* Трудозатраты */}
          <div className="w-[40px] shrink-0 px-1 py-1.5 text-center">
            Кат.
          </div>
          <div className="w-[80px] shrink-0 px-2 py-1.5 text-right">
            Плановые, чел-ч
          </div>
          <div className="w-[80px] shrink-0 px-2 py-1.5 text-right border-r border-white/10">
            Приведённые, чел-ч
          </div>

          {/* Бюджет */}
          <div className="w-[50px] shrink-0 px-2 py-1.5 text-center">
            %
          </div>
          <div className="w-[100px] shrink-0 px-2 py-1.5 text-right border-r border-white/10">
            Ставка, BYN/ч
          </div>

          {/* Сравнение */}
          <div className="w-[200px] shrink-0 px-2 py-1.5 text-center">
            Запрашиваемый / Максимальный
          </div>
          <div className="flex-1 min-w-[100px] px-2 py-1.5">
            Разница, BYN
          </div>
        </div>
      </header>

      {/* ================================================================== */}
      {/* Table Body */}
      {/* ================================================================== */}
      <div className="flex-1 overflow-auto">
        {project.sections.map((section) => {
          const isExpanded = expandedSections.has(section.id)
          const stats = calcSectionStats(section, project.totalBudget)

          return (
            <div key={section.id}>
              {/* Section Row */}
              <div
                className={cn(
                  'flex items-center h-9 border-b border-white/5',
                  'bg-gradient-to-r from-white/[0.04] to-transparent',
                  'hover:from-white/[0.06] transition-colors'
                )}
              >
                {/* Структура */}
                <div
                  className="w-[280px] shrink-0 flex items-center gap-2 px-3 border-r border-white/5 cursor-pointer"
                  onClick={() => toggleSection(section.id)}
                >
                  <button className="shrink-0 w-4 h-4 flex items-center justify-center text-white/40">
                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </button>
                  <span className="shrink-0 px-1.5 py-0.5 rounded bg-white/10 text-[10px] font-mono text-white/70">
                    {section.code}
                  </span>
                  <span className="truncate text-[12px] font-medium text-white/90">
                    {section.name}
                  </span>
                </div>

                {/* Трудозатраты: Кат. */}
                <div className="w-[40px] shrink-0 px-1" />

                {/* Трудозатраты: Плановые */}
                <div className="w-[80px] shrink-0 px-2 text-right">
                  <span className="text-[11px] tabular-nums font-semibold text-white/90">
                    {formatHours(stats.totalHours)}
                  </span>
                </div>

                {/* Трудозатраты: Приведённые */}
                <div className="w-[80px] shrink-0 px-2 text-right border-r border-white/10">
                  <span className="text-[11px] tabular-nums font-semibold text-blue-400">
                    {formatHours(stats.convertedHoursK)}
                  </span>
                </div>

                {/* Бюджет: % по разделу (editable) */}
                <div className="w-[50px] shrink-0 px-1 flex justify-center" onClick={(e) => e.stopPropagation()}>
                  <EditableCell
                    value={section.budgetPercent}
                    onChange={(v) => updateSectionPercent(section.id, v)}
                    format="percent"
                    textClassName="font-semibold text-amber-400"
                    min={0}
                    max={100}
                    step={1}
                  />
                </div>

                {/* Бюджет: Ставка (editable) */}
                <div className="w-[100px] shrink-0 px-2 flex justify-end border-r border-white/10" onClick={(e) => e.stopPropagation()}>
                  <EditableCell
                    value={section.rateK}
                    onChange={(v) => updateSectionRate(section.id, v)}
                    textClassName="text-white/70"
                    min={0}
                    max={500}
                    step={0.5}
                  />
                </div>

                {/* Сравнение: Запрашиваемый / Максимальный */}
                <div className="w-[200px] shrink-0 px-3 flex items-center justify-center gap-1">
                  <span className="text-[11px] tabular-nums font-semibold text-violet-400">
                    {formatCurrency(stats.laborBudget)}
                  </span>
                  <span className="text-white/30">/</span>
                  <span className="text-[11px] tabular-nums font-semibold text-emerald-400">
                    {formatCurrency(stats.allocatedBudget)}
                  </span>
                </div>

                {/* Сравнение: Разница */}
                <div className="flex-1 min-w-[100px] px-2 flex items-center gap-2">
                  <BudgetDiff value={stats.difference} />
                  <div className="flex-1 max-w-[80px]">
                    <BudgetBar allocated={stats.allocatedBudget} labor={stats.laborBudget} />
                  </div>
                </div>
              </div>

              {/* Stages */}
              {isExpanded &&
                section.stages.map((stage) => {
                  const stageExpanded = expandedStages.has(stage.id)
                  const stageStats = calcStageStats(stage, section.conversionRates)

                  return (
                    <div key={stage.id}>
                      {/* Stage Row */}
                      <div
                        className={cn(
                          'flex items-center h-8 border-b border-white/5',
                          'hover:bg-white/[0.02] cursor-pointer transition-colors'
                        )}
                        onClick={() => toggleStage(stage.id)}
                      >
                        {/* Структура */}
                        <div className="w-[280px] shrink-0 flex items-center gap-2 pl-8 pr-3 border-r border-white/5">
                          <button className="shrink-0 w-4 h-4 flex items-center justify-center text-white/30">
                            {stageExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                          </button>
                          <span className="truncate text-[11px] text-white/70">
                            {stage.name}
                          </span>
                        </div>

                        {/* Трудозатраты: Кат. - empty */}
                        <div className="w-[40px] shrink-0 px-1" />

                        {/* Трудозатраты: Плановые */}
                        <div className="w-[80px] shrink-0 px-2 text-right">
                          <span className="text-[11px] tabular-nums text-white/70">
                            {formatHours(stageStats.totalHours)}
                          </span>
                        </div>

                        {/* Трудозатраты: Приведённые */}
                        <div className="w-[80px] shrink-0 px-2 text-right border-r border-white/10">
                          <span className="text-[11px] tabular-nums text-blue-400/70">
                            {formatHours(stageStats.convertedHoursK)}
                          </span>
                        </div>

                        {/* Empty cells for budget columns */}
                        <div className="w-[50px] shrink-0 px-1" />
                        <div className="w-[100px] shrink-0 px-2 border-r border-white/10" />
                        <div className="w-[200px] shrink-0 px-3" />
                        <div className="flex-1 min-w-[100px] px-2" />
                      </div>

                      {/* Tasks */}
                      {stageExpanded &&
                        stage.tasks.map((task) => {
                          const convertedHours = calcConvertedHours(task, section.conversionRates)

                          return (
                            <div
                              key={task.id}
                              className="flex items-center h-7 border-b border-white/5 hover:bg-white/[0.015] transition-colors"
                            >
                              {/* Структура */}
                              <div className="w-[280px] shrink-0 pl-14 pr-3 border-r border-white/5">
                                <span className="truncate text-[11px] text-white/50">
                                  {task.name}
                                </span>
                              </div>

                              {/* Трудозатраты: Кат. */}
                              <div className="w-[40px] shrink-0 px-1 flex justify-center">
                                <CategoryBadge category={task.category} />
                              </div>

                              {/* Трудозатраты: Плановые */}
                              <div className="w-[80px] shrink-0 px-2 text-right">
                                <span className="text-[11px] tabular-nums text-white/60">
                                  {formatHours(task.plannedHours)}
                                </span>
                              </div>

                              {/* Трудозатраты: Приведённые */}
                              <div className="w-[80px] shrink-0 px-2 text-right border-r border-white/10">
                                <span className="text-[11px] tabular-nums text-blue-400/60">
                                  {formatHours(convertedHours)}
                                </span>
                              </div>

                              {/* Empty cells for budget columns at task level */}
                              <div className="w-[50px] shrink-0 px-1" />
                              <div className="w-[100px] shrink-0 px-2 border-r border-white/10" />
                              <div className="w-[200px] shrink-0 px-3" />
                              <div className="flex-1 min-w-[100px] px-2" />
                            </div>
                          )
                        })}
                    </div>
                  )
                })}
            </div>
          )
        })}
      </div>

      {/* ================================================================== */}
      {/* Footer - Totals */}
      {/* ================================================================== */}
      <footer className="shrink-0 border-t border-white/10 bg-zinc-900/90 backdrop-blur-sm">
        <div className="flex items-center h-10">
          {/* Структура */}
          <div className="w-[280px] shrink-0 px-3 border-r border-white/5">
            <span className="text-[11px] font-semibold text-white/70 uppercase tracking-wider">
              Итого по проекту
            </span>
          </div>

          {/* Трудозатраты: Кат. */}
          <div className="w-[40px] shrink-0 px-1" />

          {/* Трудозатраты: Плановые */}
          <div className="w-[80px] shrink-0 px-2 text-right">
            <span className="text-[12px] tabular-nums font-bold text-white">
              {formatHours(totals.hours)}
            </span>
          </div>

          {/* Трудозатраты: Приведённые */}
          <div className="w-[80px] shrink-0 px-2 text-right border-r border-white/10">
            <span className="text-[12px] tabular-nums font-bold text-blue-400">
              {formatHours(totals.convertedK)}
            </span>
          </div>

          {/* Бюджет: % */}
          <div className="w-[50px] shrink-0 px-1 text-center">
            <span className={cn(
              'text-[11px] tabular-nums font-bold',
              totals.percentUsed === 100 ? 'text-emerald-400' : 'text-amber-400'
            )}>
              {totals.percentUsed}%
            </span>
          </div>

          {/* Бюджет: Ставка */}
          <div className="w-[100px] shrink-0 px-2 text-right border-r border-white/10">
            <span className="text-[11px] text-white/40">—</span>
          </div>

          {/* Сравнение: Запрашиваемый / Максимальный */}
          <div className="w-[200px] shrink-0 px-3 flex items-center justify-center gap-1">
            <span className="text-[12px] tabular-nums font-bold text-violet-400">
              {formatCurrency(totals.labor)}
            </span>
            <span className="text-white/30">/</span>
            <span className="text-[12px] tabular-nums font-bold text-emerald-400">
              {formatCurrency(totals.allocated)}
            </span>
          </div>

          {/* Сравнение: Разница */}
          <div className="flex-1 min-w-[100px] px-2">
            <BudgetDiff value={totals.difference} />
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 px-3 py-1.5 border-t border-white/5 text-[9px] text-white/40">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#3b82f6]" />
            <span>К — Конструктор</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#8b5cf6]" />
            <span>ВС — Ведущий специалист</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#f59e0b]" />
            <span>ГС — Главный специалист</span>
          </div>
          <div className="ml-auto flex items-center gap-2 text-white/30">
            <Pencil size={10} />
            <span>Кликните для редактирования % и ставок</span>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default BudgetTable

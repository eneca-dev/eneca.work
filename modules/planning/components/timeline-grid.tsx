"use client"

import { useMemo, useRef, useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import type { Section, Department } from "../types"
import { useSettingsStore } from "@/stores/useSettingsStore"
import { useTheme } from "next-themes"
import { generateTimeUnits } from "../utils/date-utils"
import { TimelineHeader } from "./timeline/timeline-header"
import { TimelineRow } from "./timeline/timeline-row"
import { DepartmentRow } from "./timeline/department-row" // Новый компонент для отделов
import { DepartmentLoadingSkeleton } from "./timeline/department-loading-skeleton"
import { SectionLoadingSkeleton } from "./timeline/section-loading-skeleton"
import { ScrollbarStyles } from "./timeline/scrollbar-styles"
import { usePlanningColumnsStore } from "../stores/usePlanningColumnsStore"
import { usePlanningStore } from "../stores/usePlanningStore"
import { ChevronDown, ChevronRight, Loader2, Milestone, Building2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useProjectsStore } from "@/modules/projects/store"


// Обновляем интерфейс TimelineGridProps, добавляя отделы
interface TimelineGridProps {
  sections: Section[]
  departments: Department[] // Добавляем отделы
  showSections: boolean // Флаг для показа/скрытия разделов
  showDepartments: boolean // Флаг для показа/скрытия отделов
  startDate: Date
  daysToShow: number
  theme?: string // Делаем необязательным, будем использовать useSettingsStore если не передано
  isLoading: boolean
  isLoadingDepartments: boolean // Добавляем флаг загрузки отделов
  enableShadow?: boolean
  useAbsoluteColumns?: boolean
  cellWidth?: number
  windowWidth?: number // Добавляем ширину окна для перерисовки
  hasActiveFilters?: boolean // Добавляем новый пропс
  onOpenSectionPanel?: (sectionId: string, initialTab?: 'overview' | 'comments' | 'decomposition' | 'tasks' | 'reports' | 'loadings') => void // Добавляем обработчик открытия панели раздела
  expandAllDepartments: () => void
  collapseAllDepartments: () => void
  refreshCounter?: number // Добавляем счетчик для обновления без сброса состояния
  hideHeader?: boolean // Флаг для скрытия встроенного заголовка (когда используется внешний sticky header)
}

export function TimelineGrid({
  sections,
  departments,
  showSections,
  showDepartments,
  startDate,
  daysToShow,
  theme: propTheme, // Переименовываем параметр
  isLoading,
  isLoadingDepartments,
  enableShadow,
  useAbsoluteColumns = true, // Устанавливаем true по умолчанию
  cellWidth = 22,
  windowWidth = 0, // Значение по умолчанию
  hasActiveFilters = false, // Добавляем с значением по умолчанию
  onOpenSectionPanel, // Добавляем обработчик открытия панели раздела
  expandAllDepartments,
  collapseAllDepartments,
  refreshCounter = 0, // Добавляем с значением по умолчанию
  hideHeader = false, // По умолчанию заголовок показываем (для обратной совместимости)
}: TimelineGridProps) {
  // Используем тему из useSettingsStore, если не передана через props
  const { theme: settingsTheme } = useSettingsStore()
  const { resolvedTheme } = useTheme()
  const router = useRouter()
  const focusProject = useProjectsStore((s) => s.focusProject)
  
  // Определяем эффективную тему
  const getEffectiveTheme = (resolvedTheme: string | null) => {
    if (settingsTheme === 'system') {
      return resolvedTheme === 'dark' ? 'dark' : 'light'
    }
    return settingsTheme
  }
  
  const theme = propTheme || getEffectiveTheme(resolvedTheme || null)

  // Получаем видимость столбцов из стора
  const { columnVisibility } = usePlanningColumnsStore()

  // Получаем состояние раскрытия разделов и отделов
  const expandedSections = usePlanningStore((state) => state.expandedSections)
  const expandedDepartments = usePlanningStore((state) => state.expandedDepartments)
  const groupByProject = usePlanningStore((state) => state.groupByProject)
  const expandedProjectGroups = usePlanningStore((state) => state.expandedProjectGroups)
  const projectSummaries = usePlanningStore((state) => state.projectSummaries)
  const toggleProjectGroupById = usePlanningStore((state) => state.toggleProjectGroupById)
  const ensureProjectSectionsLoaded = usePlanningStore((state) => state.ensureProjectSectionsLoaded)
  const allSectionsStore = usePlanningStore((state) => state.allSections)
  const projectSectionsLoading = usePlanningStore((state) => state.projectSectionsLoading)
  
  // Локальные раскрытия для уровней стадия и объект
  const [expandedStages, setExpandedStages] = useState<Record<string, boolean>>({})
  const [expandedObjects, setExpandedObjects] = useState<Record<string, boolean>>({})

  const toggleStageExpanded = (key: string) =>
    setExpandedStages((prev) => ({ ...prev, [key]: !prev[key] }))
  const toggleObjectExpanded = (key: string) =>
    setExpandedObjects((prev) => ({ ...prev, [key]: !prev[key] }))

  // Получаем функции переключения видимости
  const toggleShowSections = usePlanningStore((state) => state.toggleShowSections)
  const toggleShowDepartments = usePlanningStore((state) => state.toggleShowDepartments)

  // Константы для размеров и отступов
  const ROW_HEIGHT = 60 // Увеличиваем высоту строки для размещения дополнительной информации
  const HEADER_HEIGHT = 40 // Высота заголовка
  const PADDING = 12 // Единый отступ для всех элементов
  const LEFT_OFFSET = 0 // Смещение влево на 105px
  const DIVIDER_HEIGHT = 32 // Уменьшенная высота разделителя между разделами и отделами (было 48)

  // Канонические ширины колонок - единый источник истины
  const COLUMN_WIDTHS = {
    section: 430,  // Ширина для раздела (уменьшена на 10px)
    object: 120,   // Фиксированная ширина для объекта (скрыт по умолчанию)
    stage: 80,     // Фиксированная ширина для стадии
  } as const

  // Ссылка на контейнер таймлайна
  const timelineContainerRef = useRef<HTMLDivElement>(null)

  // Генерируем массив дат для отображения
  const timeUnits = useMemo(() => {
    return generateTimeUnits(startDate, daysToShow)
  }, [startDate, daysToShow])

  // Обновляем стиль для тени при прокрутке (делаем его более заметным)
  const stickyColumnShadow = ""

  // Добавляем эффект для принудительной перерисовки при изменении размера окна
  useEffect(() => {
    if (timelineContainerRef.current) {
      // Форсируем перерисовку, обновляя стиль
      const container = timelineContainerRef.current
      const currentWidth = container.style.width
      container.style.width = `${Number.parseInt(currentWidth || "100%") - 1}px`

      // Возвращаем исходную ширину в следующем кадре
      requestAnimationFrame(() => {
        container.style.width = currentWidth
      })
    }
  }, [windowWidth, columnVisibility]) // Добавляем columnVisibility в зависимости для перерисовки при изменении видимости столбцов

  // Эффект для отслеживания обновлений данных без сброса состояния
  useEffect(() => {
    if (refreshCounter > 0) {
      console.log("🔄 Timeline Grid обновлен (без сброса состояния):", refreshCounter)
    }
  }, [refreshCounter])

  // Рассчитываем общую ширину фиксированных столбцов
  const totalFixedWidth = useMemo(() => {
    return (
      COLUMN_WIDTHS.section + 
      (columnVisibility.object ? COLUMN_WIDTHS.object : 0)
      // Убираем отсюда stage, startDate, endDate и sectionResponsible, так как они теперь в ячейке раздела
    )
  }, [columnVisibility.object])

  // Вычисляем общую ширину таблицы
  const totalWidth = useMemo(() => {
    return totalFixedWidth + cellWidth * daysToShow
  }, [totalFixedWidth, cellWidth, daysToShow])

  // Предвычисляем индексы разделов для O(1) доступа вместо sections.indexOf(section)
  const sectionIndexMap = useMemo(() => {
    return new Map(sections.map((s, i) => [s, i] as const))
  }, [sections])
  const allSectionIndexMap = useMemo(() => {
    return new Map((allSectionsStore || []).map((s, i) => [s, i] as const))
  }, [allSectionsStore])

  // Вычисляем уменьшенную высоту строки (примерно на 25%)
  const reducedRowHeight = Math.floor(ROW_HEIGHT * 0.75)

  // Вычисляем количество вложенных строк (этапы + фактические загрузки) для каждого раздела
  const loadingCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    sections.forEach((section) => {
      if (expandedSections[section.id]) {
        const loadingsCount = section.loadings ? section.loadings.length : 0
        const stagesCount = section.decompositionStages ? section.decompositionStages.length : 0
        counts[section.id] = loadingsCount + stagesCount
      } else {
        counts[section.id] = 0
      }
    })
    return counts
  }, [sections, expandedSections])

  // Вычисляем количество сотрудников для каждого отдела
  const employeeCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    departments.forEach((department) => {
      if (expandedDepartments[department.id]) {
        // Считаем общее количество сотрудников во всех командах отдела
        counts[department.id] = department.teams.reduce((sum, team) => sum + team.employees.length, 0)
      } else {
        counts[department.id] = 0
      }
    })
    return counts
  }, [departments, expandedDepartments])

  // Вычисляем общее количество вложенных строк перед каждым разделом (этапы + фактические загрузки)
  const loadingsBeforeSection = useMemo(() => {
    const counts: Record<number, number> = {}
    let totalLoadings = 0

    sections.forEach((section, index) => {
      counts[index] = totalLoadings
      if (expandedSections[section.id]) {
        const loadingsCount = section.loadings ? section.loadings.length : 0
        const stagesCount = section.decompositionStages ? section.decompositionStages.length : 0
        totalLoadings += loadingsCount + stagesCount
      }
    })

    return counts
  }, [sections, expandedSections])

  // Вычисляем общее количество сотрудников перед каждым отделом
  const employeesBeforeDepartment = useMemo(() => {
    const counts: Record<number, number> = {}
    let totalEmployees = 0

    departments.forEach((department, index) => {
      counts[index] = totalEmployees
      if (expandedDepartments[department.id]) {
        totalEmployees += department.teams.reduce((sum, team) => sum + team.employees.length, 0)
      }
    })

    return counts
  }, [departments, expandedDepartments])

  // Вычисляем общее количество раскрытых разделов
  const totalExpandedSections = useMemo(() => {
    return Object.keys(expandedSections).filter((id) => expandedSections[id]).length
  }, [expandedSections])

  // Вычисляем общее количество раскрытых отделов
  const totalExpandedDepartments = useMemo(() => {
    return Object.keys(expandedDepartments).filter((id) => expandedDepartments[id]).length
  }, [expandedDepartments])

  // Вычисляем общую высоту для разделов и их загрузок
  const sectionsHeight = useMemo(() => {
    return (
      sections.length * ROW_HEIGHT +
      Object.values(loadingCounts).reduce((sum, count) => sum + count * reducedRowHeight, 0)
    )
  }, [sections.length, ROW_HEIGHT, loadingCounts, reducedRowHeight])

  // Вычисляем позицию строки отдела с учетом загрузок предыдущих разделов и высоты разделителя
  const departmentPosition = useMemo(() => {
    if (sections.length === 0) {
      return HEADER_HEIGHT * 2 // Если нет разделов, размещаем сразу после заголовка
    }

    // Иначе позиционируем после всех разделов и их загрузок + высота разделителя
    return (
      HEADER_HEIGHT * 2 +
      sections.length * ROW_HEIGHT +
      Object.values(loadingCounts).reduce((sum, count) => sum + count * reducedRowHeight, 0) +
      (showDepartments && departments.length > 0 ? DIVIDER_HEIGHT : 0)
    )
  }, [
    HEADER_HEIGHT,
    sections.length,
    ROW_HEIGHT,
    loadingCounts,
    reducedRowHeight,
    showDepartments,
    departments.length,
    DIVIDER_HEIGHT,
  ])

  // Вычисляем общую высоту для отделов и их сотрудников с учетом отступа после разделов
  const departmentsHeight = useMemo(() => {
    if (!showDepartments || departments.length === 0) return 0

    return (
      departments.length * ROW_HEIGHT +
      Object.values(employeeCounts).reduce((sum, count) => sum + count * reducedRowHeight, 0)
    )
  }, [showDepartments, departments.length, ROW_HEIGHT, employeeCounts, reducedRowHeight])

  return (
    <div
      className="w-full"
      ref={timelineContainerRef}
      style={{
        borderCollapse: "collapse" /* Добавляем для лучшего отображения границ */,
        minWidth: "100%" /* Гарантируем, что контейнер не будет меньше 100% ширины */,
      }}
    >
      <div className="w-full" style={{ minWidth: `${totalWidth}px` }}>
        <div style={{ borderCollapse: "collapse" }}>
          {/* Заголовок таблицы - скрываем если используется внешний sticky header */}
          {!hideHeader && (
            <TimelineHeader
              timeUnits={timeUnits}
              theme={theme}
              headerHeight={HEADER_HEIGHT}
              columnWidth={COLUMN_WIDTHS.section}
              padding={PADDING}
              leftOffset={LEFT_OFFSET}
              cellWidth={cellWidth}
              stickyColumnShadow={stickyColumnShadow}
              showDepartments={showDepartments}
              showSections={showSections}
              toggleShowSections={toggleShowSections}
              toggleShowDepartments={toggleShowDepartments}
              expandAllDepartments={expandAllDepartments}
              collapseAllDepartments={collapseAllDepartments}
              scrollbarWidth={14}
            />
          )}

          {/* Строки с разделами (возможна группировка по проектам) */}
          {showSections && (!groupByProject ? (
            <>
              {isLoading && sections.length === 0 ? (
                <SectionLoadingSkeleton
                  theme={theme}
                  rowHeight={ROW_HEIGHT}
                  cellWidth={cellWidth}
                  totalFixedWidth={totalFixedWidth}
                  timeUnitsCount={timeUnits.length}
                  count={5}
                />
              ) : (
                sections.map((section, index) => (
                  <TimelineRow
                    key={section.id}
                    section={section}
                    sectionIndex={index}
                    timeUnits={timeUnits}
                    theme={theme}
                    rowHeight={ROW_HEIGHT}
                    headerHeight={HEADER_HEIGHT}
                    columnWidth={COLUMN_WIDTHS.section}
                    padding={PADDING}
                    leftOffset={LEFT_OFFSET}
                    cellWidth={cellWidth}
                    stickyColumnShadow={stickyColumnShadow}
                    totalExpandedSections={totalExpandedSections}
                    totalLoadingsBeforeSection={loadingsBeforeSection[index] || 0}
                    onOpenSectionPanel={onOpenSectionPanel}
                  />
                ))
              )}
            </>
          ) : (
            // Группировка по проектам из саммари (ленивая подзагрузка секций)
            <>
              {isLoading && (!projectSummaries || projectSummaries.length === 0) ? (
                <SectionLoadingSkeleton
                  theme={theme}
                  rowHeight={ROW_HEIGHT}
                  cellWidth={cellWidth}
                  totalFixedWidth={totalFixedWidth}
                  timeUnitsCount={timeUnits.length}
                  count={3}
                />
              ) : (
                (projectSummaries || []).slice().sort((a, b) => a.projectName.localeCompare(b.projectName, 'ru')).map((summary) => {
              const projectIdForGroup = summary.projectId
              const projectName = summary.projectName || 'Без проекта'
              const isExpanded = expandedProjectGroups[projectIdForGroup] === true
              const projectSections = (allSectionsStore || []).filter(s => s.projectId === projectIdForGroup)
              return (
              <div key={projectIdForGroup}>
                {/* Заголовок группы проекта */}
                  <div
                  className={cn(
                    "flex items-center font-semibold border-b cursor-pointer select-none",
                    theme === "dark" ? "border-slate-700" : "border-slate-200"
                  )}
                  style={{ height: `${HEADER_HEIGHT}px` }}
                  onClick={() => toggleProjectGroupById(projectIdForGroup)}
                >
                  <div
                    className={cn(
                    "sticky left-0 z-30 border-r border-b flex items-center",
                    theme === "dark" ? "bg-slate-900 border-slate-700" : "bg-slate-50 border-slate-200"
                    )}
                    style={{
                      height: `${HEADER_HEIGHT}px`,
                      width: `${totalFixedWidth}px`,
                      minWidth: `${totalFixedWidth}px`,
                      padding: `${PADDING}px`,
                  borderBottom: "0.25px solid",
                    borderBottomColor: theme === "dark" ? "rgb(51, 65, 85)" : "rgb(226, 232, 240)",
                  borderTop: "0.25px solid",
                  borderTopColor: theme === "dark" ? "rgb(51, 65, 85)" : "rgb(226, 232, 240)",
                    }}
                  >
                    <span className="mr-2">
                      {isExpanded ? (
                        <ChevronDown className={cn("h-4 w-4", theme === "dark" ? "text-slate-300" : "text-slate-600")} />
                      ) : (
                        <ChevronRight className={cn("h-4 w-4", theme === "dark" ? "text-slate-300" : "text-slate-600")} />
                      )}
                    </span>
                    {projectSectionsLoading[projectIdForGroup] && (
                      <Loader2 className={cn("h-4 w-4 mr-2 animate-spin", theme === "dark" ? "text-slate-400" : "text-slate-500")} />
                    )}
                    <span
                      className={cn(
                        "text-sm cursor-pointer hover:underline",
                        theme === "dark" ? "text-slate-200 hover:text-teal-300" : "text-slate-800 hover:text-teal-600",
                      )}
                      title={projectIdForGroup ? "Перейти к проекту" : undefined}
                      onClick={(e) => {
                        e.stopPropagation()
                        if (projectIdForGroup) {
                          focusProject(projectIdForGroup)
                          router.push("/dashboard/projects")
                        }
                      }}
                    >
                      {projectName}
                    </span>
                  </div>
                  {/* Заполнитель для правой части, чтобы выровнять сетку */}
                  <div className="flex-1 flex items-center">
                    {/* Саммари на сетке при свернутой группе проекта (из view_project_summary) */}
                    {!isExpanded && (() => {
                      const chipClass = cn(
                        "ml-2 text-xs px-2 py-0.5 rounded whitespace-nowrap",
                        theme === "dark" ? "bg-slate-700 text-slate-200" : "bg-slate-200 text-slate-700"
                      )
                      const fmt = new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit" })
                      const periodLabel = summary.projectStartDate && summary.projectEndDate
                        ? `${fmt.format(summary.projectStartDate)}—${fmt.format(summary.projectEndDate)}`
                        : "—"
                      const rateLabel = summary.totalLoadingRateActive > 0
                        ? (Number.isInteger(summary.totalLoadingRateActive) ? `${summary.totalLoadingRateActive} ставки` : `${summary.totalLoadingRateActive.toFixed(1)} ставки`)
                        : null
                      return (
                        <div className="flex items-center pl-2">
                          <span className={chipClass} title="Количество разделов">Разделы: {summary.sectionsCount}</span>
                          {summary.loadingsCountActive > 0 && (
                            <span className={chipClass} title="Количество активных загрузок">Загрузки: {summary.loadingsCountActive}</span>
                          )}
                          {rateLabel && (
                            <span className={chipClass} title="Суммарные активные ставки">{rateLabel}</span>
                          )}
                          {summary.employeesWithLoadingsActive > 0 && (
                            <span className={chipClass} title="Сотрудников в активных загрузках">Сотр: {summary.employeesWithLoadingsActive}</span>
                          )}
                          <span className={chipClass} title="Период по разделам">Период: {periodLabel}</span>
                        </div>
                      )
                    })()}
                  </div>
                </div>
                {isExpanded && (() => {
                  // Группируем разделы проекта по стадии → объекту
                  type ObjGroup = { objectId: string; objectName: string; sections: Section[] }
                  type StageGroup = { stageId: string; stageName: string; objects: ObjGroup[] }
                  const stageMap = new Map<string, { name: string; objects: Map<string, { name: string; sections: Section[] }> }>()

                  projectSections.forEach(s => {
                    const sId = s.stageId || "__no_stage__"
                    const sName = s.stageName || "Без стадии"
                    if (!stageMap.has(sId)) stageMap.set(sId, { name: sName, objects: new Map() })
                    const objectMap = stageMap.get(sId)!.objects

                    const oId = s.objectId || "__no_object__"
                    const oName = s.objectName || "Без объекта"
                    if (!objectMap.has(oId)) objectMap.set(oId, { name: oName, sections: [] })
                    objectMap.get(oId)!.sections.push(s)
                  })

                  const stageGroups: StageGroup[] = Array.from(stageMap.entries()).map(([stageId, data]) => ({
                    stageId,
                    stageName: data.name,
                    objects: Array.from(data.objects.entries()).map(([objectId, obj]) => ({
                      objectId,
                      objectName: obj.name,
                      sections: obj.sections,
                    })),
                  }))

                  // Рендер: выпадающий список стадий
                  return stageGroups.flatMap((stage) => {
                    const stageKey = `${projectIdForGroup}:${stage.stageId}`
                    const isStageExpanded = expandedStages[stageKey] ?? false
                    const stageHeader = (
                      <div key={`stage-header-${projectIdForGroup}-${stage.stageId}`} className="flex w-full cursor-pointer select-none" onClick={() => toggleStageExpanded(stageKey)}>
                        {/* Фиксированные столбцы */}
                        <div
                          className={cn("sticky left-0 z-20", "flex")}
                          style={{ height: `${reducedRowHeight}px`, width: `${totalFixedWidth}px`, borderBottom: "1px solid", borderColor: theme === "dark" ? "rgb(51, 65, 85)" : "rgb(226, 232, 240)" }}
                        >
                          <div
                            className={cn(
                              "p-2 font-medium border-r flex items-center transition-colors h-full",
                              theme === "dark" ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-white",
                            )}
                            style={{ width: `${totalFixedWidth}px`, minWidth: `${totalFixedWidth}px`, padding: `${PADDING - 1}px`, borderRight: "1px solid", borderRightColor: theme === "dark" ? "rgb(51, 65, 85)" : "rgb(226, 232, 240)" }}
                          >
                            <div className="flex items-center w-full" style={{ paddingLeft: '20px' }}>
                              <span className="mr-2">
                                {isStageExpanded ? (
                                  <ChevronDown className={cn("h-4 w-4", theme === "dark" ? "text-slate-300" : "text-slate-600")} />
                                ) : (
                                  <ChevronRight className={cn("h-4 w-4", theme === "dark" ? "text-slate-300" : "text-slate-600")} />
                                )}
                              </span>
                              <div className="flex-shrink-0 w-7 h-7 flex items-center justify-center mr-2">
                                <Milestone className={cn("h-4 w-4", theme === "dark" ? "text-slate-300" : "text-slate-600")} />
                              </div>
                              <div className={cn("text-xs font-medium", theme === "dark" ? "text-slate-200" : "text-slate-700")}>{stage.stageName}</div>
                            </div>
                          </div>
                        </div>
                        {/* Полотно таймлайна */}
                        <div className="flex-1 flex w-full">
                          {timeUnits.map((unit, i) => {
                            const isMonthStart = unit && unit.date ? (new Date(unit.date).getDate() === 1) : false
                            return (
                              <div
                                key={i}
                                className={cn(
                                  "border-r border-b relative",
                                  theme === "dark" ? "border-slate-700" : "border-slate-200",
                                  isMonthStart ? (theme === "dark" ? "border-l border-l-slate-600" : "border-l border-l-slate-300") : "",
                                )}
                                style={{ height: `${reducedRowHeight}px`, width: `${cellWidth}px`, borderRight: "1px solid", borderBottom: "1px solid", borderLeft: isMonthStart ? "1px solid" : "none", borderLeftColor: isMonthStart ? (theme === "dark" ? "rgb(71, 85, 105)" : "rgb(203, 213, 225)") : "transparent", borderRightColor: theme === "dark" ? "rgb(51, 65, 85)" : "rgb(226, 232, 240)", borderBottomColor: theme === "dark" ? "rgb(51, 65, 85)" : "rgb(226, 232, 240)" }}
                              />
                            )
                          })}
                        </div>
                      </div>
                    )

                    const objectBlocks = isStageExpanded ? stage.objects.flatMap((obj) => {
                      const objectKey = `${projectIdForGroup}:${stage.stageId}:${obj.objectId}`
                      const isObjectExpanded = expandedObjects[objectKey] ?? false
                      const objectHeader = (
                        <div key={`object-header-${projectIdForGroup}-${stage.stageId}-${obj.objectId}`} className="flex w-full cursor-pointer select-none" onClick={() => toggleObjectExpanded(objectKey)}>
                          <div className={cn("sticky left-0 z-20", "flex")} style={{ height: `${reducedRowHeight}px`, width: `${totalFixedWidth}px`, borderBottom: "1px solid", borderColor: theme === "dark" ? "rgb(51, 65, 85)" : "rgb(226, 232, 240)" }}>
                            <div
                              className={cn(
                                "p-2 font-medium border-r flex items-center transition-colors h-full",
                                theme === "dark" ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-white",
                              )}
                              style={{ width: `${totalFixedWidth}px`, minWidth: `${totalFixedWidth}px`, padding: `${PADDING - 1}px`, borderRight: "1px solid", borderRightColor: theme === "dark" ? "rgb(51, 65, 85)" : "rgb(226, 232, 240)" }}
                            >
                              <div className="flex items-center w-full" style={{ paddingLeft: '40px' }}>
                                <span className="mr-2">
                                  {isObjectExpanded ? (
                                    <ChevronDown className={cn("h-4 w-4", theme === "dark" ? "text-slate-300" : "text-slate-600")} />
                                  ) : (
                                    <ChevronRight className={cn("h-4 w-4", theme === "dark" ? "text-slate-300" : "text-slate-600")} />
                                  )}
                                </span>
                                <div className="flex-shrink-0 w-7 h-7 flex items-center justify-center mr-2">
                                  <Building2 className={cn("h-4 w-4", theme === "dark" ? "text-slate-300" : "text-slate-600")} />
                                </div>
                                <div className={cn("text-xs font-medium", theme === "dark" ? "text-slate-200" : "text-slate-700")}>{obj.objectName}</div>
                              </div>
                            </div>
                          </div>
                          <div className="flex-1 flex w-full">
                            {timeUnits.map((unit, i) => {
                              const isMonthStart = unit && unit.date ? (new Date(unit.date).getDate() === 1) : false
                              return (
                                <div key={i} className={cn("border-r border-b relative", theme === "dark" ? "border-slate-700" : "border-slate-200", isMonthStart ? (theme === "dark" ? "border-l border-l-slate-600" : "border-l border-l-slate-300") : "")} style={{ height: `${reducedRowHeight}px`, width: `${cellWidth}px`, borderRight: "1px solid", borderBottom: "1px solid", borderLeft: isMonthStart ? "1px solid" : "none", borderLeftColor: isMonthStart ? (theme === "dark" ? "rgb(71, 85, 105)" : "rgb(203, 213, 225)") : "transparent", borderRightColor: theme === "dark" ? "rgb(51, 65, 85)" : "rgb(226, 232, 240)", borderBottomColor: theme === "dark" ? "rgb(51, 65, 85)" : "rgb(226, 232, 240)" }} />
                              )
                            })}
                          </div>
                        </div>
                      )

                      const sectionRows = isObjectExpanded ? obj.sections.map((section) => {
                        const index = (allSectionIndexMap.get(section) ?? 0)
                        return (
                          <TimelineRow
                            key={section.id}
                            section={section}
                            sectionIndex={index}
                            timeUnits={timeUnits}
                            theme={theme}
                            rowHeight={ROW_HEIGHT}
                            headerHeight={HEADER_HEIGHT}
                            columnWidth={COLUMN_WIDTHS.section}
                            padding={PADDING}
                            leftOffset={LEFT_OFFSET}
                            cellWidth={cellWidth}
                            stickyColumnShadow={stickyColumnShadow}
                            totalExpandedSections={totalExpandedSections}
                            totalLoadingsBeforeSection={0}
                            onOpenSectionPanel={onOpenSectionPanel}
                          />
                        )
                      }) : []

                      return [objectHeader, ...sectionRows]
                    }) : []

                    return [stageHeader, ...objectBlocks]
                  })
                })()}
              </div>
            )
            })
              )}
            </>
          ))}

          {/* Если нет разделов по критериям фильтрации */}
          {showSections && sections.length === 0 && !isLoading && hasActiveFilters && (
            <div
              className={cn(
                "flex justify-start items-center p-8 border-b",
                theme === "dark" ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-white",
              )}
            >
              <p className={cn("text-sm", theme === "dark" ? "text-slate-400" : "text-slate-500")}>
                Нет элементов, подходящих по критериям фильтрации
              </p>
            </div>
          )}

          {/* Разделитель между разделами и отделами, если показаны и разделы, и отделы */}
          {showSections && showDepartments && (departments.length > 0 || isLoadingDepartments) && (
            <div
              className={cn(
                "relative",
                theme === "dark" ? "bg-slate-800" : "bg-white",
              )}
              style={{ height: `${HEADER_HEIGHT * 2}px` }}
            >
              {/* Фиксированный контейнер для надписи */}
              <div
                className={cn(
                  "sticky left-0 z-30 border-r border-b flex items-center px-3",
                  theme === "dark" ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200",
                )}
                style={{
                  width: `${COLUMN_WIDTHS.section}px`,
                  minWidth: `${COLUMN_WIDTHS.section}px`,
                  height: `${HEADER_HEIGHT * 2}px`,
                  borderRight: "1px solid",
                  borderRightColor: theme === "dark" ? "rgb(51, 65, 85)" : "rgb(226, 232, 240)",
                  borderBottom: "1px solid",
                  borderBottomColor: theme === "dark" ? "rgb(51, 65, 85)" : "rgb(226, 232, 240)",
                }}
              >
                <span className={cn("font-semibold", theme === "dark" ? "text-slate-200" : "text-slate-800")}>
                  Отделы и сотрудники
                </span>
                {isLoadingDepartments && (
                  <Loader2 className={cn("ml-2 h-4 w-4 animate-spin", theme === "dark" ? "text-teal-400" : "text-teal-500")} />
                )}
              </div>
            </div>
          )}

          {/* Строки с отделами, если они должны быть показаны */}
          {showDepartments && (
            <>
              {isLoadingDepartments && departments.length === 0 ? (
                <DepartmentLoadingSkeleton
                  theme={theme}
                  rowHeight={ROW_HEIGHT}
                  cellWidth={cellWidth}
                  totalFixedWidth={totalFixedWidth}
                  timeUnitsCount={timeUnits.length}
                  count={3}
                />
              ) : (
                departments.map((department, index) => (
                  <DepartmentRow
                    key={department.id}
                    department={department}
                    departmentIndex={index}
                    timeUnits={timeUnits}
                    theme={theme}
                    rowHeight={ROW_HEIGHT}
                    headerHeight={HEADER_HEIGHT}
                    columnWidth={COLUMN_WIDTHS.section}
                    padding={PADDING}
                    leftOffset={LEFT_OFFSET}
                    cellWidth={cellWidth}
                    stickyColumnShadow={stickyColumnShadow}
                    totalExpandedDepartments={totalExpandedDepartments}
                    totalEmployeesBeforeDepartment={employeesBeforeDepartment[index] || 0}
                  />
                ))
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

"use client"

import { useMemo, useRef, useEffect } from "react"
import { cn } from "@/lib/utils"
import type { Section, Department } from "../types"
import { useSettingsStore } from "@/stores/useSettingsStore"
import { useTheme } from "next-themes"
import { generateTimeUnits } from "../utils/date-utils"
import { TimelineHeader } from "./timeline/timeline-header"
import { TimelineRow } from "./timeline/timeline-row"
import { DepartmentRow } from "./timeline/department-row" // Новый компонент для отделов
import { ScrollbarStyles } from "./timeline/scrollbar-styles"
import { usePlanningColumnsStore } from "../stores/usePlanningColumnsStore"
import { usePlanningStore } from "../stores/usePlanningStore"
import { ChevronDown, ChevronRight } from "lucide-react"


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
  onOpenSectionPanel?: (sectionId: string) => void // Добавляем обработчик открытия панели раздела
  expandAllDepartments: () => void
  collapseAllDepartments: () => void
  refreshCounter?: number // Добавляем счетчик для обновления без сброса состояния
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
}: TimelineGridProps) {
  // Используем тему из useSettingsStore, если не передана через props
  const { theme: settingsTheme } = useSettingsStore()
  const { resolvedTheme } = useTheme()
  
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
  const toggleProjectGroup = usePlanningStore((state) => state.toggleProjectGroup)
  
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
    project: 170,  // Ширина для проекта (увеличена на 10px)
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
      (columnVisibility.project ? COLUMN_WIDTHS.project : 0) + 
      (columnVisibility.object ? COLUMN_WIDTHS.object : 0)
      // Убираем отсюда stage, startDate, endDate и sectionResponsible, так как они теперь в ячейке раздела
    )
  }, [columnVisibility.project, columnVisibility.object])

  // Вычисляем общую ширину таблицы
  const totalWidth = useMemo(() => {
    return totalFixedWidth + cellWidth * daysToShow
  }, [totalFixedWidth, cellWidth, daysToShow])

  // Вычисляем уменьшенную высоту строки (примерно на 25%)
  const reducedRowHeight = Math.floor(ROW_HEIGHT * 0.75)

  // Вычисляем количество вложенных строк (этапы + загрузки) для каждого раздела
  const loadingCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    sections.forEach((section) => {
      if (expandedSections[section.id]) {
        const loadingsCount = section.loadings ? section.loadings.length : 0
        const plannedCount = (section as any).plannedLoadings ? (section as any).plannedLoadings.length : 0
        const stagesCount = section.decompositionStages ? section.decompositionStages.length : 0
        counts[section.id] = loadingsCount + plannedCount + stagesCount
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

  // Вычисляем общее количество вложенных строк перед каждым разделом (этапы + загрузки)
  const loadingsBeforeSection = useMemo(() => {
    const counts: Record<number, number> = {}
    let totalLoadings = 0

    sections.forEach((section, index) => {
      counts[index] = totalLoadings
      if (expandedSections[section.id]) {
        const loadingsCount = section.loadings ? section.loadings.length : 0
        const plannedCount = (section as any).plannedLoadings ? (section as any).plannedLoadings.length : 0
        const stagesCount = section.decompositionStages ? section.decompositionStages.length : 0
        totalLoadings += loadingsCount + plannedCount + stagesCount
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
      className="w-full overflow-x-auto scrollbar-thin"
      ref={timelineContainerRef}
      style={{
        scrollbarWidth: "thin" /* Firefox */,
        scrollbarColor:
          theme === "dark"
            ? "rgba(51, 65, 85, 0.5) rgba(30, 41, 59, 0.2)"
            : "rgba(203, 213, 225, 0.5) rgba(241, 245, 249, 0.2)" /* Firefox */,
        borderCollapse: "collapse" /* Добавляем для лучшего отображения границ */,
        minWidth: "100%" /* Гарантируем, что контейнер не будет меньше 100% ширины */,
      }}
    >
      <ScrollbarStyles theme={theme} />
      <div className="w-full" style={{ minWidth: `${totalWidth}px` }}>
        <div style={{ borderCollapse: "collapse" }}>
          {/* Заголовок таблицы */}
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
          />

          {/* Строки с разделами (возможна группировка по проектам) */}
          {showSections && (!groupByProject ? (
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
          ) : (
            // Группировка по названию проекта
            Object.entries(
              sections.reduce((acc, s) => {
                const key = s.projectName || "Без проекта"
                if (!acc[key]) acc[key] = [] as typeof sections
                acc[key].push(s)
                return acc
              }, {} as Record<string, typeof sections>)
            ).sort((a, b) => a[0].localeCompare(b[0])).map(([projectName, projectSections]) => (
              <div key={projectName}>
                {/* Заголовок группы проекта */}
                <div
                  className={cn(
                    "sticky left-0 z-10 flex items-center font-semibold border-b cursor-pointer select-none",
                    theme === "dark" ? "bg-slate-900 border-slate-700" : "bg-slate-50 border-slate-200"
                  )}
                  style={{ height: `${HEADER_HEIGHT}px` }}
                  onClick={() => toggleProjectGroup(projectName)}
                >
                  <div
                    className={cn(
                      "border-r flex items-center",
                      theme === "dark" ? "border-slate-700" : "border-slate-200"
                    )}
                    style={{
                      width: `${totalFixedWidth}px`,
                      minWidth: `${totalFixedWidth}px`,
                      padding: `${PADDING}px`,
                    }}
                  >
                    <span className="mr-2">
                      {expandedProjectGroups[projectName] ? (
                        <ChevronDown className={cn("h-4 w-4", theme === "dark" ? "text-slate-300" : "text-slate-600")} />
                      ) : (
                        <ChevronRight className={cn("h-4 w-4", theme === "dark" ? "text-slate-300" : "text-slate-600")} />
                      )}
                    </span>
                    <span className={cn("text-sm", theme === "dark" ? "text-slate-200" : "text-slate-800")}>{projectName}</span>
                  </div>
                  {/* Заполнитель для правой части, чтобы выровнять сетку */}
                  <div className="flex-1" />
                </div>
                {(expandedProjectGroups[projectName] ?? true) && projectSections.map((section) => {
                  const index = sections.indexOf(section)
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
                      totalLoadingsBeforeSection={loadingsBeforeSection[index] || 0}
                      onOpenSectionPanel={onOpenSectionPanel}
                    />
                  )
                })}
              </div>
            ))
          ))}

          {/* Если нет разделов или идет загрузка */}
          {showSections && sections.length === 0 && !isLoading && (
            <div
              className={cn(
                "flex justify-start items-center p-8 border-b",
                theme === "dark" ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-white",
              )}
            >
              <p className={cn("text-sm", theme === "dark" ? "text-slate-400" : "text-slate-500")}>
                {hasActiveFilters ? "Нет элементов, подходящих по критериям фильтрации" : "Разделы не найдены"}
              </p>
            </div>
          )}

          {/* Разделитель между разделами и отделами, если показаны и разделы, и отделы */}
          {showSections && showDepartments && sections.length > 0 && departments.length > 0 && (
            <div
              className={cn(
                "relative border-b", // Убираем padding
                theme === "dark" ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200",
              )}
              style={{ height: `${DIVIDER_HEIGHT}px` }} // Явно задаем высоту разделителя
            >
              {/* Фиксированный контейнер для надписи на всю высоту */}
              <div
                className={cn(
                  "sticky left-0 top-0 bottom-0 py-1 px-2 font-medium z-30 flex items-center",
                  theme === "dark" ? "bg-slate-800 border-b border-slate-700" : "bg-white border-b border-slate-200",
                )}
                style={{
                  width: `${totalFixedWidth}px`,
                  height: "32px",
                }}
              >
                <div className="flex items-center h-full">
                  <span className={cn("font-semibold", theme === "dark" ? "text-slate-200" : "text-slate-800")}>
                    Отделы и сотрудники
                  </span>
                </div>
              </div>

              {/* Пустой контейнер для сохранения структуры */}
              <div className="flex items-center justify-between h-full opacity-0">
                <div className="flex items-center">
                  <span className="font-semibold">Отделы и сотрудники</span>
                </div>
              </div>
            </div>
          )}

          {/* Строки с отделами, если они должны быть показаны */}
          {showDepartments &&
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
            ))}
        </div>
      </div>
    </div>
  )
}

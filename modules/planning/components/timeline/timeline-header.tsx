"use client"

import type React from "react"

import { cn } from "@/lib/utils"
import { useMemo, useState, useEffect } from "react"
// Обновляем импорт функций
import { groupDatesByMonth, isToday, isFirstDayOfMonth } from "../../utils/date-utils"
import { usePlanningColumnsStore } from "../../stores/usePlanningColumnsStore"
import { usePlanningStore } from "../../stores/usePlanningStore"
import { Search, Eye, EyeOff, Expand, Minimize, Columns3, Users } from "lucide-react"

interface TimelineHeaderProps {
  timeUnits: { date: Date; label: string; isWeekend?: boolean }[]
  theme: string
  headerHeight: number
  columnWidth: number
  padding: number
  leftOffset: number
  cellWidth: number
  stickyColumnShadow: string
  showDepartments: boolean
  showSections: boolean
  toggleShowSections: () => void
  toggleShowDepartments: () => void
  expandAllDepartments: () => void
  collapseAllDepartments: () => void
}

export function TimelineHeader({
  timeUnits,
  theme,
  headerHeight,
  columnWidth,
  padding,
  leftOffset,
  cellWidth,
  stickyColumnShadow,
  showDepartments,
  showSections,
  toggleShowSections,
  toggleShowDepartments,
  expandAllDepartments,
  collapseAllDepartments,
}: TimelineHeaderProps) {
  // Состояние для поискового запроса
  const [searchQuery, setSearchQuery] = useState("")
  // Состояние для поискового запроса по проектам
  const [projectSearchQuery, setProjectSearchQuery] = useState("")

  // Получаем функцию для фильтрации разделов из стора
  const filterSectionsByName = usePlanningStore((state) => state.filterSectionsByName)
  // Получаем функцию для фильтрации разделов по проекту из стора
  const filterSectionsByProject = usePlanningStore((state) => state.filterSectionsByProject)

  // Обработчик изменения поискового запроса
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value
    setSearchQuery(query)
    filterSectionsByName(query)
  }

  // Обработчик изменения поискового запроса по проектам
  const handleProjectSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value
    setProjectSearchQuery(query)
    filterSectionsByProject(query)
  }

  // Сбрасываем поиск при размонтировании компонента
  useEffect(() => {
    return () => {
      filterSectionsByName("")
      filterSectionsByProject("")
    }
  }, [filterSectionsByName, filterSectionsByProject])

  // Получаем видимость столбцов из стора
  const { columnVisibility, toggleColumnVisibility } = usePlanningColumnsStore()

  // Слушаем глобальное событие от верхней панели для переключения колонки "Проект"
  useEffect(() => {
    const handler = () => toggleColumnVisibility('project')
    window.addEventListener('planning:toggleProjectColumn', handler)
    return () => window.removeEventListener('planning:toggleProjectColumn', handler)
  }, [toggleColumnVisibility])

  // Заменяем сложные расчеты ширины на фиксированные значения
  // Заменяем эти строки:
  // const sectionWidth = columnWidth + 80
  // const projectWidth = columnWidth * columnWidths.project
  // const objectWidth = columnWidth * columnWidths.object

  // На фиксированные значения:
  const sectionWidth = 430 // Ширина для раздела (уменьшена на 10px)
  const projectWidth = 170 // Ширина для проекта (увеличена на 10px)
  const objectWidth = 120 // Фиксированная ширина для объекта (скрыт по умолчанию)

  // Также упрощаем расчет общей ширины фиксированных столбцов
  const totalFixedWidth =
    sectionWidth + (columnVisibility.project ? projectWidth : 0) + (columnVisibility.object ? objectWidth : 0)

  // Общие стили для ячеек заголовка
  const headerCellStyle = cn(
    "flex items-center justify-center border-r",
    theme === "dark" ? "border-slate-700" : "border-slate-200",
  )

  // Общие стили для ячеек с фиксированной шириной
  const fixedColumnStyle = cn(
    "p-3 border-r flex items-center justify-center",
    theme === "dark" ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-white",
  )

  // Группируем даты по месяцам
  const monthGroups = useMemo(() => {
    return groupDatesByMonth(timeUnits)
  }, [timeUnits])

  return (
    <>
      {/* Строка с названиями месяцев и заголовками столбцов */}
      <div className={cn("flex", theme === "dark" ? "" : "")}>
        {/* Фиксированные заголовки столбцов */}
        <div
          className={cn("sticky left-0 z-20 flex", theme === "dark" ? "border-slate-700" : "border-slate-200")}
          style={{ height: `${headerHeight}px` }}
        >
          {/* Заголовок "Раздел" (всегда видимый) */}
          <div
            className={cn(
              fixedColumnStyle,
              theme === "dark" ? "bg-slate-800" : "bg-white",
            )}
            style={{
              width: `${sectionWidth}px`,
              minWidth: `${sectionWidth}px`,
              height: `${headerHeight}px`,
              padding: `${padding}px`,
              borderRight: "1px solid",
              borderRightColor: theme === "dark" ? "rgb(51, 65, 85)" : "rgb(226, 232, 240)",
            }}
          >
            <div className="flex items-center justify-between w-full">
              <div className={cn("text-sm font-medium", theme === "dark" ? "text-slate-200" : "text-slate-800")}>
                Раздел
              </div>
              {/* Кнопки управления */}
              <div className="flex gap-1">
                {/* Кнопки переключения видимости */}
                <button
                  onClick={toggleShowSections}
                  title={showSections ? 'Скрыть разделы' : 'Показать разделы'}
                  className={cn(
                    "px-2 py-1 rounded hover:bg-opacity-80 transition-colors text-xs flex items-center gap-1",
                    showSections
                      ? theme === "dark" 
                        ? "text-teal-400 hover:text-teal-300" 
                        : "text-teal-600 hover:text-teal-700"
                      : theme === "dark" 
                        ? "text-gray-400 hover:text-gray-300" 
                        : "text-gray-600 hover:text-gray-700"
                  )}
                >
                  {showSections ? <Eye size={12} /> : <EyeOff size={12} />}
                  <span>Разделы</span>
                </button>

                <button
                  onClick={toggleShowDepartments}
                  title={showDepartments ? 'Скрыть отделы' : 'Показать отделы'}
                  className={cn(
                    "px-2 py-1 rounded hover:bg-opacity-80 transition-colors text-xs flex items-center gap-1",
                    showDepartments
                      ? theme === "dark" 
                        ? "text-teal-400 hover:text-teal-300" 
                        : "text-teal-600 hover:text-teal-700"
                      : theme === "dark" 
                        ? "text-gray-400 hover:text-gray-300" 
                        : "text-gray-600 hover:text-gray-700"
                  )}
                >
                  {showDepartments ? <Eye size={12} /> : <EyeOff size={12} />}
                  <span>Отделы</span>
                </button>

                <button
                  onClick={() => toggleColumnVisibility('project')}
                  title={columnVisibility.project ? 'Скрыть колонку "Проект"' : 'Показать колонку "Проект"'}
                  className={cn(
                    "p-1 rounded hover:bg-opacity-80 transition-colors",
                    theme === "dark" 
                      ? "hover:bg-slate-700 text-blue-400 hover:text-blue-300" 
                      : "hover:bg-slate-100 text-blue-600 hover:text-blue-700"
                  )}
                >
                  <Columns3 size={14} />
                </button>

                <button
                  onClick={expandAllDepartments}
                  title="Развернуть все отделы"
                  className={cn(
                    "p-1 rounded hover:bg-opacity-80 transition-colors",
                    theme === "dark" 
                      ? "hover:bg-slate-700 text-emerald-400 hover:text-emerald-300" 
                      : "hover:bg-slate-100 text-emerald-600 hover:text-emerald-700"
                  )}
                >
                  <Expand size={14} />
                </button>

                <button
                  onClick={collapseAllDepartments}
                  title="Свернуть все отделы"
                  className={cn(
                    "p-1 rounded hover:bg-opacity-80 transition-colors",
                    theme === "dark" 
                      ? "hover:bg-slate-700 text-orange-400 hover:text-orange-300" 
                      : "hover:bg-slate-100 text-orange-600 hover:text-orange-700"
                  )}
                >
                  <Minimize size={14} />
                </button>
              </div>
            </div>
          </div>

          {/* Заголовок "Проект" (может быть скрыт) */}
          {columnVisibility.project && (
            <div
              className={cn(
                fixedColumnStyle,
                theme === "dark" ? "bg-slate-800" : "bg-white",
              )}
              style={{
                width: `${projectWidth}px`,
                minWidth: `${projectWidth}px`,
                height: `${headerHeight}px`,
                padding: `${padding}px`,
                borderRight: "1px solid",
                borderRightColor: theme === "dark" ? "rgb(51, 65, 85)" : "rgb(226, 232, 240)",
              }}
            >
              <div className="flex items-center justify-between w-full">
                <div className={cn("text-sm font-medium", theme === "dark" ? "text-slate-200" : "text-slate-800")}>
                  Проект
                </div>
                <button
                  onClick={() => toggleColumnVisibility('project')}
                  title='Скрыть колонку "Проект"'
                  className={cn(
                    "p-1 rounded hover:bg-opacity-80 transition-colors",
                    theme === "dark" 
                      ? "hover:bg-slate-700 text-blue-400 hover:text-blue-300" 
                      : "hover:bg-slate-100 text-blue-600 hover:text-blue-700"
                  )}
                >
                  <Columns3 size={12} />
                </button>
              </div>
            </div>
          )}

          {/* Заголовок "Объект" (может быть скрыт) */}
          {columnVisibility.object && (
            <div
              className={cn(
                fixedColumnStyle,
                theme === "dark" ? "bg-slate-800" : "bg-white",
              )}
              style={{
                width: `${objectWidth}px`,
                minWidth: `${objectWidth}px`,
                height: `${headerHeight}px`,
                padding: `${padding}px`,
                borderRight: "1px solid",
                borderRightColor: theme === "dark" ? "rgb(51, 65, 85)" : "rgb(226, 232, 240)",
              }}
            >
              <div className={cn("text-sm font-medium", theme === "dark" ? "text-slate-200" : "text-slate-800")}>
                Объект
              </div>
            </div>
          )}
        </div>

        {/* Названия месяцев */}
        <div className="flex-1 flex">
          {monthGroups.map((month, i) => {
            const width = month.length * cellWidth
            const isFirstMonth = i === 0

            return (
              <div
                key={`month-${i}`}
                className={cn(
                  headerCellStyle,
                  theme === "dark" ? "bg-slate-800" : "bg-slate-50",
                  !isFirstMonth
                    ? theme === "dark"
                      ? "border-l border-l-slate-600"
                      : "border-l border-l-slate-300"
                    : "",
                )}
                style={{
                  height: `${headerHeight}px`,
                  width: `${width}px`,
                  minWidth: 0, // Добавляем это, чтобы разрешить сжатие
                  padding: `${Math.max(1, padding - 2)}px`, // Уменьшаем отступы при маленькой ширине
                  borderBottom: "none",
                }}
              >
                <span
                  className={cn("font-medium", theme === "dark" ? "text-slate-300" : "text-slate-600")}
                  style={{
                    fontSize: "13px", // Увеличенный размер шрифта для ячеек шириной 22px
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {month.name}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Заголовок с датами */}
      <div className={cn("flex", theme === "dark" ? "" : "")}>
        {/* Фиксированные заголовки для поиска */}
        <div
          className={cn("sticky left-0 z-10 flex", stickyColumnShadow)}
          style={{
            height: `${headerHeight}px`,
          }}
        >
          {/* Поле поиска для "Раздел" */}
          <div
            className={cn(
              "border-r border-b border-t flex items-center justify-between px-3",
              theme === "dark" ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200",
            )}
            style={{
              width: `${sectionWidth}px`,
              minWidth: `${sectionWidth}px`,
              height: `${headerHeight}px`,
            }}
          >
            {/* Добавляем поле поиска */}
            <div className="relative flex-1">
              <div
                className={cn(
                  "absolute inset-y-0 left-0 flex items-center pl-2",
                  theme === "dark" ? "text-slate-400" : "text-slate-500",
                )}
              >
                <Search size={14} />
              </div>
              <input
                type="text"
                placeholder="Поиск раздела..."
                value={searchQuery}
                onChange={handleSearchChange}
                className={cn(
                  "w-full py-1 pl-8 pr-2 text-xs rounded border",
                  theme === "dark"
                    ? "bg-slate-700 border-slate-600 text-slate-200 placeholder-slate-400 focus:border-teal-500"
                    : "bg-white border-slate-300 text-slate-800 placeholder-slate-400 focus:border-teal-500",
                  "focus:outline-none focus:ring-1 focus:ring-teal-500",
                )}
              />
            </div>
          </div>

          {/* Поле поиска для "Проект" */}
          {columnVisibility.project && (
            <div
              className={cn(
                "border-r border-b border-t flex items-center justify-between px-3",
                theme === "dark" ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200",
              )}
              style={{
                width: `${projectWidth}px`,
                minWidth: `${projectWidth}px`,
                height: `${headerHeight}px`,
              }}
            >
              {/* Добавляем поле поиска по проектам */}
              <div className="relative flex-1">
                <div
                  className={cn(
                    "absolute inset-y-0 left-0 flex items-center pl-2",
                    theme === "dark" ? "text-slate-400" : "text-slate-500",
                  )}
                >
                  <Search size={14} />
                </div>
                <input
                  type="text"
                  placeholder="Поиск проекта..."
                  value={projectSearchQuery}
                  onChange={handleProjectSearchChange}
                  className={cn(
                    "w-full py-1 pl-8 pr-2 text-xs rounded border",
                    theme === "dark"
                      ? "bg-slate-700 border-slate-600 text-slate-200 placeholder-slate-400 focus:border-teal-500"
                      : "bg-white border-slate-300 text-slate-800 placeholder-slate-400 focus:border-teal-500",
                    "focus:outline-none focus:ring-1 focus:ring-teal-500",
                  )}
                />
              </div>
            </div>
          )}

          {/* Пустая ячейка для "Объект" */}
          {columnVisibility.object && (
            <div
              className={cn(
                "border-r border-b border-t flex items-center justify-center",
                theme === "dark" ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200",
              )}
              style={{
                width: `${objectWidth}px`,
                minWidth: `${objectWidth}px`,
                height: `${headerHeight}px`,
              }}
            >
              <span className="text-transparent">Объект</span>
            </div>
          )}
        </div>

        {/* Даты */}
        <div className="flex-1 flex">
          {timeUnits.map((unit, i) => {
            const isTodayDate = isToday(unit.date)
            const isMonthStart = isFirstDayOfMonth(unit.date)

            // Обновляем стиль для выходных дней в заголовке с датами
            return (
              <div
                key={i}
                className={cn(
                  headerCellStyle,
                  theme === "dark" ? "bg-slate-800" : "bg-slate-50",
                  unit.isWeekend ? (theme === "dark" ? "bg-slate-900" : "bg-slate-100") : "",
                  isTodayDate ? (theme === "dark" ? "bg-teal-900/40" : "bg-teal-100") : "",
                  isMonthStart
                    ? theme === "dark"
                      ? "border-l border-l-slate-600"
                      : "border-l border-l-slate-300"
                    : "",
                )}
                style={{
                  height: `${headerHeight}px`,
                  width: `${cellWidth}px`,
                  minWidth: 0, // Добавляем это, чтобы разрешить сжатие
                  padding: `${Math.max(1, padding - 2)}px`, // Уменьшаем отступы при маленькой ширине
                  borderBottom: "none",
                  borderLeft: isMonthStart ? "1px solid" : "none",
                  borderLeftColor: isMonthStart
                    ? theme === "dark"
                      ? "rgb(71, 85, 105)" // slate-600
                      : "rgb(203, 213, 225)" // slate-300
                    : "transparent",
                }}
              >
                <span
                  className={cn(
                    "flex items-center justify-center rounded-full text-xs",
                    "min-w-[10px] min-h-[10px] w-auto h-auto",
                    isTodayDate
                      ? theme === "dark"
                        ? "bg-teal-500 text-white font-bold ring-1 ring-teal-400 ring-opacity-50"
                        : "bg-teal-500 text-white font-bold ring-1 ring-teal-400 ring-opacity-50"
                      : theme === "dark"
                        ? "text-slate-300"
                        : "text-slate-600",
                  )}
                  style={{
                    width: "12px", // Увеличенный размер для ячеек шириной 22px
                    height: "12px", // Увеличенный размер для ячеек шириной 22px
                    fontSize: "11px", // Увеличенный размер шрифта для ячеек шириной 22px
                  }}
                >
                  {unit.label}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}

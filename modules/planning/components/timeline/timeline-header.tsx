"use client"

import type React from "react"

import { cn } from "@/lib/utils"
import { useMemo, useState, useEffect } from "react"
// Обновляем импорт функций
import { groupDatesByMonth, isToday, isFirstDayOfMonth } from "../../utils/date-utils"
import { usePlanningColumnsStore } from "../../stores/usePlanningColumnsStore"
import { usePlanningStore } from "../../stores/usePlanningStore"
import { Search } from "lucide-react"

interface TimelineHeaderProps {
  timeUnits: { date: Date; label: string; isWeekend?: boolean }[]
  theme: string
  headerHeight: number
  columnWidth: number
  padding: number
  leftOffset: number
  cellWidth: number
  stickyColumnShadow: string
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
  const { columnVisibility } = usePlanningColumnsStore()

  // Заменяем сложные расчеты ширины на фиксированные значения
  // Заменяем эти строки:
  // const sectionWidth = columnWidth + 80
  // const projectWidth = columnWidth * columnWidths.project
  // const objectWidth = columnWidth * columnWidths.object

  // На фиксированные значения:
  const sectionWidth = 320 // Фиксированная ширина для раздела
  const projectWidth = 160 // Фиксированная ширина для проекта
  const objectWidth = 120 // Фиксированная ширина для объекта

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
              "shadow-[5px_0_10px_-2px_rgba(0,0,0,0.1)]",
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
            <div className={cn("text-sm font-medium", theme === "dark" ? "text-slate-200" : "text-slate-800")}>
              Раздел
            </div>
          </div>

          {/* Заголовок "Проект" (может быть скрыт) */}
          {columnVisibility.project && (
            <div
              className={cn(
                fixedColumnStyle,
                theme === "dark" ? "bg-slate-800" : "bg-white",
                "shadow-[5px_0_10px_-2px_rgba(0,0,0,0.1)]",
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
              <div className={cn("text-sm font-medium", theme === "dark" ? "text-slate-200" : "text-slate-800")}>
                Проект
              </div>
            </div>
          )}

          {/* Заголовок "Объект" (может быть скрыт) */}
          {columnVisibility.object && (
            <div
              className={cn(
                fixedColumnStyle,
                theme === "dark" ? "bg-slate-800" : "bg-white",
                // Удалена тень "shadow-[5px_0_10px_-2px_rgba(0,0,0,0.1)]"
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

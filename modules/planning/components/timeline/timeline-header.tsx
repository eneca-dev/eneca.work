"use client"

import type React from "react"

import { cn } from "@/lib/utils"
import { useMemo, useState, useEffect } from "react"
// Обновляем импорт функций
import { groupDatesByMonth, isToday, isFirstDayOfMonth } from "../../utils/date-utils"
import { usePlanningColumnsStore } from "../../stores/usePlanningColumnsStore"
import { usePlanningStore } from "../../stores/usePlanningStore"
import { Search, Eye, EyeOff, Expand, Minimize, Users, X } from "lucide-react"

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
  headerRightScrollRef?: React.RefObject<HTMLDivElement> // Новый проп для скролла правой части
  scrollbarWidth: number // Ширина вертикального скроллбара контента
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
  headerRightScrollRef,
  scrollbarWidth,
}: TimelineHeaderProps) {
  // Состояние для поискового запроса
  const [searchQuery, setSearchQuery] = useState("")


  // Получаем функцию для фильтрации разделов из стора
  const filterSectionsByName = usePlanningStore((state) => state.filterSectionsByName)


  // Обработчик изменения поискового запроса
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value
    setSearchQuery(query)
    filterSectionsByName(query)
  }



  // Сбрасываем поиск при размонтировании компонента
  useEffect(() => {
    return () => {
      filterSectionsByName("")
    }
  }, [filterSectionsByName])

  // Получаем видимость столбцов из стора
  const { columnVisibility } = usePlanningColumnsStore()


  // Фиксированные значения ширины столбцов
  const sectionWidth = 430 // Ширина для раздела
  const objectWidth = 120 // Фиксированная ширина для объекта



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
    <div className="flex">
      {/* ЛЕВАЯ ЧАСТЬ: Фиксированные столбцы (не скроллятся) */}
      <div className="flex-shrink-0">
        {/* Строка 1: Заголовки "Раздел" и "Объект" */}
        <div className="flex" style={{ height: `${headerHeight}px` }}>
          {/* Заголовок "Раздел" */}
          <div
            className={cn(
              fixedColumnStyle,
              theme === "dark" ? "bg-slate-800" : "bg-white",
              "relative", // Для позиционирования overlay
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
            </div>
            {/* Overlay для скрытия текста "Раздел" когда разделы выключены, а отделы включены */}
            {!showSections && showDepartments && (
              <div
                className={cn(
                  "absolute inset-0",
                  theme === "dark" ? "bg-slate-800" : "bg-white",
                )}
              />
            )}
          </div>

          {/* Заголовок "Объект" */}
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

        {/* Строка 2: Поле поиска и пустая ячейка для объекта */}
        <div className="flex" style={{ height: `${headerHeight}px` }}>
          {/* Поле поиска */}
          <div
            className={cn(
              "border-r border-b border-t flex items-center justify-between px-3",
              theme === "dark" ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200",
              "relative", // Для позиционирования overlay
            )}
            style={{
              width: `${sectionWidth}px`,
              minWidth: `${sectionWidth}px`,
              height: `${headerHeight}px`,
            }}
          >
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
                  "w-full py-1 pl-8 pr-6 text-xs rounded border",
                  theme === "dark"
                    ? "bg-slate-700 border-slate-600 text-slate-200 placeholder-slate-400 focus:border-teal-500"
                    : "bg-white border-slate-300 text-slate-800 placeholder-slate-400 focus:border-teal-500",
                  "focus:outline-none focus:ring-1 focus:ring-teal-500",
                )}
              />
              {searchQuery && (
                <button
                  type="button"
                  aria-label="Очистить"
                  title="Очистить"
                  onClick={() => {
                    setSearchQuery("")
                    filterSectionsByName("")
                  }}
                  className={cn(
                    "absolute inset-y-0 right-0 flex items-center pr-2",
                    theme === "dark" ? "text-slate-400 hover:text-slate-300" : "text-slate-400 hover:text-slate-600",
                  )}
                >
                  <X size={14} />
                </button>
              )}
            </div>
            {/* Overlay для скрытия поля поиска когда разделы выключены, а отделы включены */}
            {!showSections && showDepartments && (
              <div
                className={cn(
                  "absolute inset-0",
                  theme === "dark" ? "bg-slate-800" : "bg-white",
                )}
              />
            )}
          </div>

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
      </div>

      {/* ПРАВАЯ ЧАСТЬ: Скроллящиеся столбцы (месяцы и даты) */}
      <div
        ref={headerRightScrollRef}
        className="flex-1 overflow-x-auto overflow-y-hidden"
        style={{
          scrollbarWidth: "none", // Firefox: скрываем скроллбар
          msOverflowStyle: "none", // IE/Edge: скрываем скроллбар
        }}
      >
        {/* Скрываем скроллбар в Webkit через CSS */}
        <style jsx>{`
          div::-webkit-scrollbar {
            display: none;
          }
        `}</style>

        {/* Обертка для контента и spacer'а */}
        <div className="flex">
          {/* Контент: строки месяцев и дат */}
          <div>
            {/* Строка 1: Названия месяцев */}
            <div className="flex" style={{ height: `${headerHeight}px` }}>
              {monthGroups.map((month, i) => {
                const width = month.length * cellWidth
                const isFirstMonth = i === 0

                return (
                  <div
                    key={`month-${i}`}
                    className={cn(
                      headerCellStyle,
                      theme === "dark" ? "bg-slate-800" : "bg-slate-50",
                    )}
                    style={{
                      height: `${headerHeight}px`,
                      width: `${width}px`,
                      minWidth: `${width}px`,
                      padding: `${Math.max(1, padding - 2)}px`,
                      borderBottom: "none",
                      borderLeft: !isFirstMonth ? "1px solid" : "none",
                      borderLeftColor: !isFirstMonth
                        ? theme === "dark"
                          ? "rgb(71, 85, 105)" // slate-600
                          : "rgb(203, 213, 225)" // slate-300
                        : "transparent",
                    }}
                  >
                    <span
                      className={cn("font-medium", theme === "dark" ? "text-slate-300" : "text-slate-600")}
                      style={{
                        fontSize: "13px",
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

            {/* Строка 2: Даты */}
            <div className="flex" style={{ height: `${headerHeight}px` }}>
              {timeUnits.map((unit, i) => {
                const isTodayDate = isToday(unit.date)
                const isMonthStart = isFirstDayOfMonth(unit.date)

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
                      minWidth: `${cellWidth}px`,
                      padding: `${Math.max(1, padding - 2)}px`,
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
                        width: "12px",
                        height: "12px",
                        fontSize: "11px",
                      }}
                    >
                      {unit.label}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Spacer для компенсации ширины вертикального скроллбара */}
          {scrollbarWidth > 0 && (
            <div
              className={cn(
                "flex-shrink-0",
                theme === "dark" ? "bg-slate-900" : "bg-white"
              )}
              style={{
                width: `${scrollbarWidth}px`,
                minWidth: `${scrollbarWidth}px`,
                height: `${headerHeight * 2}px`,
              }}
            />
          )}
        </div>
      </div>
    </div>
  )
}

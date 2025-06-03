"use client"

import type React from "react"

import { cn } from "@/lib/utils"
import { ChevronDown, ChevronRight, PlusCircle, Calendar, CalendarRange, Users, Milestone } from "lucide-react"
import type { Section, Loading } from "../../types"
import { isSectionActiveInPeriod, getSectionStatusColor } from "../../utils/section-utils"
import { isToday, isFirstDayOfMonth } from "../../utils/date-utils"
import { usePlanningColumnsStore } from "../../stores/usePlanningColumnsStore"
import { usePlanningStore } from "../../stores/usePlanningStore"
import { useState } from "react"
import { Avatar, Tooltip } from "../avatar"
import { AssignResponsibleModal } from "./assign-responsible-modal"

interface TimelineRowProps {
  section: Section
  sectionIndex: number
  timeUnits: { date: Date; label: string; isWeekend?: boolean }[]
  theme: string
  rowHeight: number
  headerHeight: number
  columnWidth: number
  padding: number
  leftOffset: number
  cellWidth: number
  stickyColumnShadow: string
  totalExpandedSections: number // Добавляем счетчик раскрытых разделов
  totalLoadingsBeforeSection: number // Добавляем счетчик загрузок перед текущим разделом
}

export function TimelineRow({
  section,
  sectionIndex,
  timeUnits,
  theme,
  rowHeight,
  headerHeight,
  columnWidth,
  padding,
  leftOffset,
  cellWidth,
  stickyColumnShadow,
  totalExpandedSections,
  totalLoadingsBeforeSection,
}: TimelineRowProps) {
  // Состояние для отслеживания наведения на аватары
  const [hoveredSpecialist, setHoveredSpecialist] = useState(false)
  const [hoveredAddButton, setHoveredAddButton] = useState(false)
  const [showAssignResponsibleModal, setShowAssignResponsibleModal] = useState(false)

  // Получаем видимость и ширину столбцов из стора
  const { columnVisibility, columnWidths } = usePlanningColumnsStore()

  // Получаем функцию для переключения состояния раскрытия
  const toggleSectionExpanded = usePlanningStore((state) => state.toggleSectionExpanded)
  const expandedSections = usePlanningStore((state) => state.expandedSections)

  // Проверяем, раскрыт ли раздел
  const isExpanded = expandedSections[section.id] || false

  // Проверяем, есть ли у раздела загрузки
  const hasLoadings = section.hasLoadings || false

  // Увеличиваем ширину столбца "Раздел" для размещения аватара
  // Заменяем сложные расчеты ширины на фиксированные значения
  // Заменяем эти строки:
  // const sectionWidth = (columnWidth + 80) * 1.5
  // const projectWidth = columnWidth * columnWidths.project
  // const objectWidth = columnWidth * columnWidths.object
  // const stageWidth = columnWidth * columnWidths.stage
  // const startDateWidth = columnWidth * columnWidths.startDate
  // const endDateWidth = columnWidth * columnWidths.endDate
  // const sectionResponsibleWidth = columnWidth * columnWidths.sectionResponsible

  // На фиксированные значения:
  const sectionWidth = 320 // Фиксированная ширина для раздела
  const projectWidth = 160 // Фиксированная ширина для проекта
  const objectWidth = 120 // Фиксированная ширина для объекта
  const stageWidth = 80 // Фиксированная ширина для стадии

  // Также упрощаем расчет общей ширины фиксированных столбцов
  const totalFixedWidth =
    sectionWidth + (columnVisibility.project ? projectWidth : 0) + (columnVisibility.object ? objectWidth : 0)
  const startDateWidth = columnWidth * columnWidths.startDate
  const endDateWidth = columnWidth * columnWidths.endDate
  const sectionResponsibleWidth = columnWidth * columnWidths.sectionResponsible

  // Функция для форматирования даты в российском формате
  const formatDate = (date: Date | null | undefined): string => {
    if (!date) return "-"

    try {
      // Получаем день и месяц в формате ДД.ММ
      const day = date.getDate().toString().padStart(2, "0")
      const month = (date.getMonth() + 1).toString().padStart(2, "0")
      // Получаем только последние две цифры года
      const year = date.getFullYear().toString().slice(-2)

      return `${day}.${month}.${year}`
    } catch (error) {
      console.error("Ошибка форматирования даты:", error, date)
      return "-"
    }
  }

  // Обработчик клика по разделу для раскрытия/скрытия
  const handleToggleExpand = () => {
    if (hasLoadings) {
      toggleSectionExpanded(section.id)
    }
  }

  // Заглушка для обработчика добавления ответственного
  const handleAddResponsible = (e: React.MouseEvent) => {
    e.stopPropagation() // Предотвращаем раскрытие раздела при клике на кнопку
    setShowAssignResponsibleModal(true)
  }

  // Получаем загрузки раздела
  const loadings = section.loadings || []

  // Вычисляем уменьшенную высоту строки (примерно на 25%)
  const reducedRowHeight = Math.floor(rowHeight * 0.75)

  // Вычисляем позицию строки раздела с учетом загрузок предыдущих разделов
  const sectionPosition = headerHeight * 2 + sectionIndex * rowHeight + totalLoadingsBeforeSection * reducedRowHeight

  return (
    <>
      <div className="group/row w-full relative">
        <div
          className={cn("flex transition-colors", hasLoadings ? "cursor-pointer" : "cursor-default", "w-full")}
          style={{ height: `${rowHeight}px` }}
          onClick={handleToggleExpand}
        >
          {/* Фиксированные столбцы с sticky позиционированием */}
          <div
            className={cn("sticky left-0 z-20", "flex")}
            style={{
              height: `${rowHeight}px`,
              width: `${totalFixedWidth}px`,
              borderBottom: "1px solid",
              borderColor: theme === "dark" ? "rgb(51, 65, 85)" : "rgb(226, 232, 240)",
            }}
          >
            {/* Столбец "Раздел" (всегда видимый) с аватаром */}
            <div
              className={cn(
                "p-2 font-medium border-r flex flex-col justify-between transition-colors h-full", // Уменьшаем padding с p-3 до p-2
                theme === "dark"
                  ? "border-slate-700 bg-slate-800 group-hover/row:bg-slate-700"
                  : "border-slate-200 bg-white group-hover/row:bg-slate-50",
              )}
              style={{
                width: `${sectionWidth}px`,
                minWidth: `${sectionWidth}px`,
                padding: `${padding}px`,
                borderRight: "1px solid",
                borderRightColor: theme === "dark" ? "rgb(51, 65, 85)" : "rgb(226, 232, 240)",
              }}
            >
              {/* Компактное отображение в одну строку с аватаром слева */}
              <div className="flex items-center w-full">
                {/* Аватар или кнопка добавления */}
                <div className="flex-shrink-0 mr-2">
                  {section.responsibleName ? (
                    // Если есть ответственный, показываем аватар
                    <div
                      className="flex items-center justify-center h-full"
                      onMouseEnter={() => setHoveredSpecialist(true)}
                      onMouseLeave={() => setHoveredSpecialist(false)}
                    >
                      <Tooltip content={section.responsibleName} isVisible={hoveredSpecialist}>
                        <Avatar
                          name={section.responsibleName}
                          avatarUrl={section.responsibleAvatarUrl}
                          theme={theme === "dark" ? "dark" : "light"}
                          size="sm" // Уменьшаем размер аватара
                        />
                      </Tooltip>
                    </div>
                  ) : (
                    // Если нет ответственного, показываем кнопку добавления
                    <div
                      className="cursor-pointer w-6 h-6 flex items-center justify-center relative"
                      onClick={handleAddResponsible}
                      onMouseEnter={() => setHoveredAddButton(true)}
                      onMouseLeave={() => setHoveredAddButton(false)}
                    >
                      <Tooltip content="Добавить ответственного" isVisible={hoveredAddButton} position="bottom">
                        <PlusCircle
                          size={16}
                          className={cn(
                            theme === "dark"
                              ? "text-slate-400 hover:text-teal-400"
                              : "text-slate-400 hover:text-teal-500",
                          )}
                        />
                      </Tooltip>
                    </div>
                  )}
                </div>

                {/* Иконка раскрытия и название раздела */}
                <div className="flex items-center mr-3">
                  <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center mr-1">
                    {hasLoadings ? (
                      isExpanded ? (
                        <ChevronDown className={cn("h-4 w-4", theme === "dark" ? "text-teal-400" : "text-teal-500")} />
                      ) : (
                        <ChevronRight className={cn("h-4 w-4", theme === "dark" ? "text-teal-400" : "text-teal-500")} />
                      )
                    ) : (
                      <ChevronRight className={cn("h-4 w-4", theme === "dark" ? "text-slate-400" : "text-slate-300")} />
                    )}
                  </div>
                  <span
                    className={cn(
                      "font-semibold truncate whitespace-nowrap overflow-hidden max-w-[120px]",
                      theme === "dark" ? "text-slate-200" : "text-slate-800",
                    )}
                  >
                    {section.name}
                  </span>
                </div>

                {/* Дополнительная информация в компактном виде */}
                <div className="flex flex-col gap-1 ml-auto text-xs">
                  {/* Первая строка - только даты */}
                  <div className="flex items-center gap-2">
                    {/* Даты */}
                    <div className="flex items-center">
                      {/* Дата начала */}
                      {columnVisibility.startDate && (
                        <div
                          className={cn("flex items-center", theme === "dark" ? "text-slate-400" : "text-slate-500")}
                        >
                          <Calendar size={10} className="mr-1" />
                          <span>{formatDate(section.startDate)}</span>
                        </div>
                      )}

                      {/* Разделитель между датами */}
                      {columnVisibility.startDate && columnVisibility.endDate && (
                        <span className={cn("mx-1", theme === "dark" ? "text-slate-500" : "text-slate-400")}>-</span>
                      )}

                      {/* Дата окончания */}
                      {columnVisibility.endDate && (
                        <div
                          className={cn("flex items-center", theme === "dark" ? "text-slate-400" : "text-slate-500")}
                        >
                          <CalendarRange size={10} className="mr-1" />
                          <span>{formatDate(section.endDate)}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Вторая строка - стадия и отдел */}
                  <div className="flex items-center gap-2">
                    {/* Стадия */}
                    {columnVisibility.stage && (
                      <div className={cn("flex items-center", theme === "dark" ? "text-slate-400" : "text-slate-500")}>
                        <Milestone size={10} className="mr-1" />
                        <span className="truncate max-w-[80px]">{section.stageName || "-"}</span>
                      </div>
                    )}

                    {/* Отдел */}
                    {columnVisibility.sectionResponsible && (
                      <div className={cn("flex items-center", theme === "dark" ? "text-slate-400" : "text-slate-500")}>
                        <Users size={10} className="mr-1" />
                        <span className="truncate max-w-[80px]">{section.departmentName || "-"}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Столбец "Проект" (может быть скрыт) */}
            {columnVisibility.project && (
              <div
                className={cn(
                  "p-3 border-r transition-colors h-full",
                  theme === "dark"
                    ? "border-slate-700 bg-slate-800 group-hover/row:bg-slate-700"
                    : "border-slate-200 bg-white group-hover/row:bg-slate-50",
                )}
                style={{
                  width: `${projectWidth}px`,
                  minWidth: `${projectWidth}px`,
                  padding: `${padding}px`,
                  borderRight: "1px solid",
                  borderRightColor: theme === "dark" ? "rgb(51, 65, 85)" : "rgb(226, 232, 240)",
                }}
              >
                <span className={cn("text-xs truncate block", theme === "dark" ? "text-slate-400" : "text-slate-500")}>
                  {section.projectName || "-"}
                </span>
              </div>
            )}

            {/* Столбец "Объект" (может быть скрыт) */}
            {columnVisibility.object && (
              <div
                className={cn(
                  "p-3 border-r transition-colors h-full",
                  theme === "dark"
                    ? "border-slate-700 bg-slate-800 group-hover/row:bg-slate-700"
                    : "border-slate-200 bg-white group-hover/row:bg-slate-50",
                )}
                style={{
                  width: `${objectWidth}px`,
                  minWidth: `${objectWidth}px`,
                  padding: `${padding}px`,
                  borderRight: "1px solid",
                  borderRightColor: theme === "dark" ? "rgb(51, 65, 85)" : "rgb(226, 232, 240)",
                }}
              >
                <span className={cn("text-xs truncate block", theme === "dark" ? "text-slate-400" : "text-slate-500")}>
                  {section.objectName || "-"}
                </span>
              </div>
            )}
          </div>

          {/* Ячейки для каждого периода - сдвигаем влево */}
          <div className="flex-1 flex w-full">
            {timeUnits.map((unit, i) => {
              const isWeekendDay = unit.isWeekend
              const isTodayDate = isToday(unit.date)
              const isActive = isSectionActiveInPeriod(section, unit.date)
              const isMonthStart = isFirstDayOfMonth(unit.date)

              return (
                <div
                  key={i}
                  className={cn(
                    "border-r border-b relative",
                    theme === "dark" ? "border-slate-700" : "border-slate-200",
                    isWeekendDay ? (theme === "dark" ? "bg-slate-900" : "bg-slate-100") : "",
                    isTodayDate ? (theme === "dark" ? "bg-teal-900/20" : "bg-teal-100/40") : "",
                    theme === "dark" ? "group-hover/row:bg-slate-700/50" : "group-hover/row:bg-slate-50/70",
                    isMonthStart
                      ? theme === "dark"
                        ? "border-l border-l-slate-600"
                        : "border-l border-l-slate-300"
                      : "",
                  )}
                  style={{
                    height: `${rowHeight}px`,
                    width: `${cellWidth}px`,
                    borderRight: "1px solid",
                    borderBottom: "1px solid",
                    borderLeft: isMonthStart ? "1px solid" : "none",
                    borderLeftColor: isMonthStart
                      ? theme === "dark"
                        ? "rgb(71, 85, 105)" // slate-600
                        : "rgb(203, 213, 225)" // slate-300
                      : "transparent",
                    borderRightColor: theme === "dark" ? "rgb(51, 65, 85)" : "rgb(226, 232, 240)",
                    borderBottomColor: theme === "dark" ? "rgb(51, 65, 85)" : "rgb(226, 232, 240)",
                  }}
                >
                  {isActive && (
                    <div
                      className={cn(
                        "absolute inset-1 rounded-sm",
                        getSectionStatusColor(section.status),
                        theme === "dark" ? "opacity-70" : "opacity-50",
                      )}
                    ></div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Отображаем загрузки, если раздел раскрыт */}
      {isExpanded &&
        loadings.map((loading, loadingIndex) => (
          <LoadingRow
            key={loading.id}
            loading={loading}
            sectionPosition={sectionPosition}
            loadingIndex={loadingIndex}
            timeUnits={timeUnits}
            theme={theme}
            rowHeight={rowHeight}
            padding={padding}
            leftOffset={leftOffset}
            cellWidth={cellWidth}
            stickyColumnShadow={stickyColumnShadow}
            totalFixedWidth={totalFixedWidth}
          />
        ))}
      {/* Модальное окно назначения ответственного */}
      {showAssignResponsibleModal && (
        <AssignResponsibleModal section={section} setShowAssignModal={setShowAssignResponsibleModal} theme={theme} />
      )}
    </>
  )
}

// Компонент для отображения строки загрузки
interface LoadingRowProps {
  loading: Loading
  sectionPosition: number
  loadingIndex: number
  timeUnits: { date: Date; label: string; isWeekend?: boolean }[]
  theme: string
  rowHeight: number
  padding: number
  leftOffset: number
  cellWidth: number
  stickyColumnShadow: string
  totalFixedWidth: number
}

function LoadingRow({
  loading,
  sectionPosition,
  loadingIndex,
  timeUnits,
  theme,
  rowHeight,
  padding,
  leftOffset,
  cellWidth,
  stickyColumnShadow,
  totalFixedWidth,
}: LoadingRowProps) {
  // Состояние для отслеживания наведения на аватар
  const [hoveredAvatar, setHoveredAvatar] = useState(false)

  // Вычисляем уменьшенную высоту строки (примерно на 25%)
  const reducedRowHeight = Math.floor(rowHeight * 0.75)

  // Функция для форматирования даты в российском формате (без года)
  const formatShortDate = (date: Date | null | undefined): string => {
    if (!date) return "-"

    try {
      return new Intl.DateTimeFormat("ru-RU", {
        day: "2-digit",
        month: "2-digit",
      }).format(date)
    } catch (error) {
      console.error("Ошибка форматирования даты:", error, date)
      return "-"
    }
  }

  // Функция для проверки, активна ли загрузка в указанную дату
  const isLoadingActiveInPeriod = (loading: Loading, date: Date): boolean => {
    try {
      const loadingStart = new Date(loading.startDate)
      const loadingEnd = new Date(loading.endDate)

      // Сбрасываем время для корректного сравнения
      loadingStart.setHours(0, 0, 0, 0)
      loadingEnd.setHours(23, 59, 59, 999)

      const periodDate = new Date(date)
      periodDate.setHours(0, 0, 0, 0)

      return periodDate >= loadingStart && periodDate <= loadingEnd
    } catch (error) {
      console.error("Ошибка при проверке активности загрузки:", error)
      return false
    }
  }

  // Вычисляем позицию строки загрузки
  // Базовая позиция раздела + высота раздела + (индекс загрузки * уменьшенная высота строки)
  const topPosition = sectionPosition + rowHeight + loadingIndex * reducedRowHeight

  return (
    <div className="group/loading w-full">
      <div className="flex transition-colors w-full" style={{ height: `${reducedRowHeight}px` }}>
        {/* Пустое пространство для фиксированных столбцов */}
        <div style={{ width: `${totalFixedWidth}px`, minWidth: `${totalFixedWidth}px` }}></div>

        {/* Абсолютно позиционированные фиксированные столбцы */}
        <div
          className={cn("absolute left-0 z-20", "flex")}
          style={{
            top: `${topPosition}px`,
            height: `${reducedRowHeight}px`,
            width: `${totalFixedWidth}px`,
            borderBottom: "1px solid",
            borderColor: theme === "dark" ? "rgb(51, 65, 85)" : "rgb(226, 232, 240)",
          }}
        >
          {/* Столбец с информацией о загрузке */}
          <div
            className={cn(
              "p-2 font-medium border-r flex items-center transition-colors h-full",
              theme === "dark"
                ? "border-slate-700 bg-slate-800 group-hover/loading:bg-slate-700"
                : "border-slate-200 bg-white group-hover/loading:bg-slate-50",
            )}
            style={{
              width: `${totalFixedWidth}px`,
              minWidth: `${totalFixedWidth}px`,
              padding: `${padding - 1}px`,
              borderRight: "1px solid",
              borderRightColor: theme === "dark" ? "rgb(51, 65, 85)" : "rgb(226, 232, 240)",
            }}
          >
            <div className="flex items-center justify-between w-full">
              {/* Левая часть с аватаром, именем и датами */}
              <div className="flex items-center">
                <div className="flex-shrink-0 w-7 h-7 flex items-center justify-center mr-2">
                  {/* Пустое место для отступа */}
                </div>
                <div
                  className="flex items-center justify-center h-full"
                  onMouseEnter={() => setHoveredAvatar(true)}
                  onMouseLeave={() => setHoveredAvatar(false)}
                >
                  <Tooltip content={loading.responsibleName} isVisible={hoveredAvatar}>
                    <Avatar
                      name={loading.responsibleName}
                      avatarUrl={loading.responsibleAvatarUrl}
                      theme={theme === "dark" ? "dark" : "light"}
                      size="md"
                    />
                  </Tooltip>
                  <div className="ml-2">
                    {/* Имя ответственного - уменьшаем размер шрифта */}
                    <div className={cn("text-xs font-medium", theme === "dark" ? "text-slate-200" : "text-slate-700")}>
                      {loading.responsibleName || "Не указан"}
                    </div>
                    {/* Команда ответственного - еще меньший размер */}
                    <div className={cn("text-[10px]", theme === "dark" ? "text-slate-400" : "text-slate-500")}>
                      {loading.responsibleTeamName || "Без команды"}
                    </div>
                  </div>
                </div>

                {/* Даты - перемещаем сюда, сразу после имени */}
                <div className="flex items-center ml-4">
                  <span className={cn("text-xs", theme === "dark" ? "text-slate-300" : "text-slate-600")}>
                    {formatShortDate(loading.startDate)}
                  </span>
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={cn("mx-1", theme === "dark" ? "text-slate-500" : "text-slate-400")}
                  >
                    <path d="M5 12h14"></path>
                    <path d="m12 5 7 7-7 7"></path>
                  </svg>
                  <span className={cn("text-xs", theme === "dark" ? "text-slate-300" : "text-slate-600")}>
                    {formatShortDate(loading.endDate)}
                  </span>
                </div>
              </div>

              {/* Правая часть со ставкой */}
              <div>
                <span
                  className={cn(
                    "text-xs font-medium px-2 py-0.5 rounded",
                    theme === "dark" ? "bg-teal-900/50 text-teal-300" : "bg-teal-100 text-teal-700",
                  )}
                >
                  {loading.rate} ставка
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Ячейки для каждого периода - сдвигаем влево */}
        <div className="flex-1 flex w-full">
          {timeUnits.map((unit, i) => {
            const isWeekendDay = unit.isWeekend
            const isTodayDate = isToday(unit.date)
            const isActive = isLoadingActiveInPeriod(loading, unit.date)
            const isMonthStart = isFirstDayOfMonth(unit.date)

            return (
              <div
                key={i}
                className={cn(
                  "border-r border-b relative",
                  theme === "dark" ? "border-slate-700" : "border-slate-200",
                  isWeekendDay ? (theme === "dark" ? "bg-slate-900" : "bg-slate-100") : "",
                  isTodayDate ? (theme === "dark" ? "bg-teal-900/20" : "bg-teal-100/40") : "",
                  theme === "dark" ? "group-hover/loading:bg-slate-700/50" : "group-hover/loading:bg-slate-50/70",
                  isMonthStart
                    ? theme === "dark"
                      ? "border-l border-l-slate-600"
                      : "border-l border-l-slate-300"
                    : "",
                )}
                style={{
                  height: `${reducedRowHeight}px`,
                  width: `${cellWidth}px`,
                  borderRight: "1px solid",
                  borderBottom: "1px solid",
                  borderLeft: isMonthStart ? "1px solid" : "none",
                  borderLeftColor: isMonthStart
                    ? theme === "dark"
                      ? "rgb(71, 85, 105)" // slate-600
                      : "rgb(203, 213, 225)" // slate-300
                    : "transparent",
                  borderRightColor: theme === "dark" ? "rgb(51, 65, 85)" : "rgb(226, 232, 240)",
                  borderBottomColor: theme === "dark" ? "rgb(51, 65, 85)" : "rgb(226, 232, 240)",
                }}
              >
                {isActive && (
                  <div
                    className={cn(
                      "absolute inset-1 rounded-sm",
                      theme === "dark" ? "bg-blue-500 opacity-70" : "bg-blue-500 opacity-50",
                    )}
                  ></div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

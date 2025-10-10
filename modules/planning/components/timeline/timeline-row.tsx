"use client"

import React, { useState } from "react"

import { cn } from "@/lib/utils"
import { ChevronDown, ChevronRight, PlusCircle, Calendar, CalendarRange, Users, Milestone, Edit3, TrendingUp } from "lucide-react"
import type { Section, Loading, DecompositionStage, PlannedLoading } from "../../types"
import { isSectionActiveInPeriod, getSectionStatusColor } from "../../utils/section-utils"
import { isToday, isFirstDayOfMonth } from "../../utils/date-utils"
import { usePlanningColumnsStore } from "../../stores/usePlanningColumnsStore"
import { usePlanningStore } from "../../stores/usePlanningStore"
// useState уже импортирован выше
import { Avatar, Tooltip } from "../avatar"
import { AssignResponsibleModal } from "./assign-responsible-modal"
import { CreateLoadingBySectionModal } from "./create-loading-by-section-modal"

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
  onOpenSectionPanel?: (sectionId: string) => void // Добавляем обработчик открытия панели раздела
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
  onOpenSectionPanel,
}: TimelineRowProps) {
  // Состояние для отслеживания наведения на аватары
  const [hoveredSpecialist, setHoveredSpecialist] = useState(false)
  const [hoveredAddButton, setHoveredAddButton] = useState(false)
  // Убрали ховер для создания по разделу
  const [hoveredStagesCounter, setHoveredStagesCounter] = useState(false)
  const [showAssignResponsibleModal, setShowAssignResponsibleModal] = useState(false)
  // Создание перенесено на уровень этапа/плана

  // Получаем видимость и ширину столбцов из стора
  const { columnVisibility } = usePlanningColumnsStore()

  // Получаем функцию для переключения состояния раскрытия
  const toggleSectionExpanded = usePlanningStore((state) => state.toggleSectionExpanded)
  const expandedSections = usePlanningStore((state) => state.expandedSections)

  // Проверяем, раскрыт ли раздел
  const isExpanded = expandedSections[section.id] || false

  // Проверяем, есть ли у раздела загрузки и/или этапы
  const hasLoadings = section.hasLoadings || (section.loadings && section.loadings.length > 0) || false
  const stages: DecompositionStage[] = section.decompositionStages || []
  const planned: PlannedLoading[] = (section as any).plannedLoadings || []
  const hasStages = stages.length > 0
  const hasPlanned = planned.length > 0
  const hasChildren = hasLoadings || hasStages || hasPlanned

  // На фиксированные значения:
  const sectionWidth = 430 // Ширина для раздела (уменьшена на 10px)
  const projectWidth = 170 // Ширина для проекта (увеличена на 10px)
  const objectWidth = 120 // Фиксированная ширина для объекта (скрыт по умолчанию)
  const stageWidth = 80 // Фиксированная ширина для стадии

  // Также упрощаем расчет общей ширины фиксированных столбцов
  const totalFixedWidth =
    sectionWidth + (columnVisibility.project ? projectWidth : 0) + (columnVisibility.object ? objectWidth : 0)
  const startDateWidth = 100 // Фиксированная ширина для даты начала
  const endDateWidth = 100 // Фиксированная ширина для даты окончания
  const sectionResponsibleWidth = 120 // Фиксированная ширина для ответственного

  // Функция для форматирования даты в российском формате
  const formatDate = (date: Date | null | undefined): string => {
    if (!date) return "-"

    try {
      // Получаем день и месяц в формате ДД.ММ (без года)
      const day = date.getDate().toString().padStart(2, "0")
      const month = (date.getMonth() + 1).toString().padStart(2, "0")

      return `${day}.${month}`
    } catch (error) {
      console.error("Ошибка форматирования даты:", error, date)
      return "-"
    }
  }

  // Обработчик клика по разделу для раскрытия/скрытия
  const handleToggleExpand = () => {
    if (hasChildren) {
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
  
  // Фильтруем дубликаты загрузок по ID для избежания проблем с React ключами
  // Убираем дубликаты и сортируем загрузки так, чтобы записи одного человека шли рядом
  const uniqueLoadings = loadings
    .filter((loading, index, array) => array.findIndex(l => l.id === loading.id) === index)
    .sort((a, b) => {
      // Сначала ответственный за раздел
      const aIsSectionResponsible = a.responsibleId && section && (a.responsibleId === (section as any).responsibleId)
      const bIsSectionResponsible = b.responsibleId && section && (b.responsibleId === (section as any).responsibleId)
      if (aIsSectionResponsible && !bIsSectionResponsible) return -1
      if (!aIsSectionResponsible && bIsSectionResponsible) return 1
      const nameA = (a.responsibleName || "").toLowerCase()
      const nameB = (b.responsibleName || "").toLowerCase()
      if (nameA !== nameB) return nameA.localeCompare(nameB, "ru")
      // внутри одного сотрудника сортируем по дате начала
      const aStart = new Date(a.startDate).getTime()
      const bStart = new Date(b.startDate).getTime()
      return aStart - bStart
    })

  // Вычисляем уменьшенную высоту строки (примерно на 25%)
  const reducedRowHeight = Math.floor(rowHeight * 0.75)

  // Функция для расчета суммы ставок по загрузкам в разделе
  const calculateTotalRate = (): number => {
    if (!uniqueLoadings || uniqueLoadings.length === 0) return 0
    return uniqueLoadings.reduce((total, loading) => total + (loading.rate || 0), 0)
  }

  // Вычисляем суммарную ставку
  const totalRate = calculateTotalRate()

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

  // Функция для расчета суммарной нагрузки раздела на конкретную дату
  const getSectionWorkloadForDate = (date: Date): number => {
    if (!uniqueLoadings || uniqueLoadings.length === 0) return 0
    
    return uniqueLoadings.reduce((total, loading) => {
      if (isLoadingActiveInPeriod(loading, date)) {
        return total + (loading.rate || 0)
      }
      return total
    }, 0)
  }

  // Функция для получения этапов активных в указанную дату
  const getActiveStagesForDate = (date: Date) => {
    const stages = section.decompositionStages || []
    if (stages.length === 0) return []

    return stages.filter(stage => {
      if (!stage.start || !stage.finish) return false
      
      const stageStart = new Date(stage.start)
      const stageFinish = new Date(stage.finish)
      
      stageStart.setHours(0, 0, 0, 0)
      stageFinish.setHours(23, 59, 59, 999)
      
      const checkDate = new Date(date)
      checkDate.setHours(0, 0, 0, 0)
      
      return checkDate >= stageStart && checkDate <= stageFinish
    })
  }

  // Генерируем цвет для этапа по его индексу
  const getStageColor = (stageIndex: number, isDark: boolean): string => {
    const colors = isDark
      ? ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ec4899', '#06b6d4', '#f97316', '#14b8a6']
      : ['#2563eb', '#059669', '#7c3aed', '#d97706', '#db2777', '#0891b2', '#ea580c', '#0d9488']
    
    return colors[stageIndex % colors.length]
  }

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
                "p-2 font-medium border-r flex items-center transition-colors h-full", // Изменяем на flex items-center для горизонтального выравнивания
                theme === "dark"
                  ? "border-slate-700 bg-slate-800 group-hover/row:bg-emerald-900"
                  : "border-slate-200 bg-white group-hover/row:bg-emerald-50",
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
                    // Если есть ответственный, показываем кликабельный аватар
                    <div
                      className="flex items-center justify-center h-full cursor-pointer hover:opacity-80 transition-opacity relative"
                      onClick={handleAddResponsible}
                      onMouseEnter={() => setHoveredSpecialist(true)}
                      onMouseLeave={() => setHoveredSpecialist(false)}
                    >
                      <Tooltip content={`${section.responsibleName} (кликните для изменения)`} isVisible={hoveredSpecialist}>
                        <Avatar
                          name={section.responsibleName}
                          avatarUrl={section.responsibleAvatarUrl}
                          theme={theme === "dark" ? "dark" : "light"}
                          size="sm" // Уменьшаем размер аватара
                        />
                      </Tooltip>
                      {/* Иконка редактирования появляется при наведении */}
                      {hoveredSpecialist && (
                        <div className="absolute -top-1 -right-1 bg-teal-500 rounded-full p-0.5">
                          <Edit3 size={8} className="text-white" />
                        </div>
                      )}
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

                {/* Счетчик загрузок справа от аватара (без кнопки создания на уровне раздела) */}
                <div>
                  <span
                    className={cn(
                      "text-xs mr-2 px-1 py-0.5 rounded bg-opacity-20 flex-shrink-0",
                      theme === "dark" 
                        ? "text-slate-400 bg-slate-600" 
                        : "text-slate-500 bg-slate-200"
                    )}
                  >
                    {uniqueLoadings.length}
                  </span>
                </div>

                {/* Счетчик этапов (показываем только когда раздел свернут) */}
                {hasStages && !isExpanded && (
                  <div
                    className="cursor-default"
                    onMouseEnter={() => setHoveredStagesCounter(true)}
                    onMouseLeave={() => setHoveredStagesCounter(false)}
                  >
                    <Tooltip 
                      content={`Этапов: ${stages.length}`} 
                      isVisible={hoveredStagesCounter}
                      position="top"
                    >
                      <span
                        className={cn(
                          "text-xs mr-2 px-1 py-0.5 rounded bg-opacity-20 inline-flex items-center gap-1 flex-shrink-0 transition-colors",
                          theme === "dark" 
                            ? "text-slate-400 bg-slate-600" 
                            : "text-slate-500 bg-slate-200"
                        )}
                      >
                        <Milestone size={10} className={cn(theme === "dark" ? "text-slate-300" : "text-slate-600")} />
                        {stages.length}
                      </span>
                    </Tooltip>
                  </div>
                )}

                {/* Иконка раскрытия и название раздела */}
                <div className="flex items-center mr-3">
                  <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center mr-1">
                    {hasChildren ? (
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
                      "text-sm font-medium truncate whitespace-nowrap overflow-hidden max-w-[165px] cursor-pointer hover:underline",
                      theme === "dark" ? "text-slate-200 hover:text-teal-300" : "text-slate-800 hover:text-teal-600",
                    )}
                    onClick={(e) => {
                      e.stopPropagation()
                      onOpenSectionPanel?.(section.id)
                    }}
                  >
                    {section.name}
                  </span>
                </div>

                {/* Дополнительная информация в две строки */}
                <div className="flex flex-col gap-1 ml-auto text-xs justify-center">
                  {/* Первая строка - даты */}
                  <div className="flex items-center justify-start gap-2">
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

                  {/* Вторая строка - стадия и отдел */}
                  <div className="flex items-center justify-start gap-2">
                    {/* Стадия */}
                    {columnVisibility.stage && (
                      <div className={cn("flex items-center", theme === "dark" ? "text-slate-400" : "text-slate-500")}>
                        <Milestone size={10} className="mr-1" />
                        <span className="truncate max-w-[60px]">{section.stageName || "-"}</span>
                      </div>
                    )}

                    {/* Отдел */}
                    {columnVisibility.sectionResponsible && (
                      <div className={cn("flex items-center", theme === "dark" ? "text-slate-400" : "text-slate-500")}>
                        <Users size={10} className="mr-1" />
                        <span className="truncate max-w-[60px]">{section.departmentName || "-"}</span>
                      </div>
                    )}
                  </div>

                  {/* Третья строка - общая нагрузка (сумма ставок) */}
                  {totalRate > 0 && (
                    <div className="flex items-center justify-start">
                      <div className={cn("flex items-center", theme === "dark" ? "text-teal-400" : "text-teal-600")}>
                        <TrendingUp size={10} className="mr-1" />
                        <span className="text-xs font-medium">
                          {totalRate === 1 ? '1 ставка' : 
                           totalRate > 1 && totalRate === Math.floor(totalRate) ? `${totalRate} ставки` : 
                           `${totalRate.toFixed(1)} ставки`}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Столбец "Проект" (может быть скрыт) */}
            {columnVisibility.project && (
              <div
                className={cn(
                  "p-3 border-r transition-colors h-full flex flex-col justify-center",
                  theme === "dark"
                    ? "border-slate-700 bg-slate-800 group-hover/row:bg-emerald-900"
                    : "border-slate-200 bg-white group-hover/row:bg-emerald-50",
                )}
                style={{
                  width: `${projectWidth}px`,
                  minWidth: `${projectWidth}px`,
                  padding: `${padding}px`,
                  borderRight: "1px solid",
                  borderRightColor: theme === "dark" ? "rgb(51, 65, 85)" : "rgb(226, 232, 240)",
                }}
              >
                {/* Первая строка - проект */}
                <span className={cn("text-xs truncate block", theme === "dark" ? "text-slate-300" : "text-slate-600")}>
                  {section.projectName || "-"}
                </span>
                {/* Вторая строка - объект */}
                <span className={cn("text-xs truncate block mt-0.5 opacity-75", theme === "dark" ? "text-slate-400" : "text-slate-500")}>
                  {section.objectName || "-"}
                </span>
              </div>
            )}

            {/* Столбец "Объект" (может быть скрыт) */}
            {columnVisibility.object && (
              <div
                className={cn(
                  "p-3 border-r transition-colors h-full",
                  theme === "dark"
                    ? "border-slate-700 bg-slate-800 group-hover/row:bg-emerald-900"
                    : "border-slate-200 bg-white group-hover/row:bg-emerald-50",
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
              
              // Получаем суммарную нагрузку на эту дату
              const sectionWorkload = getSectionWorkloadForDate(unit.date)

              return (
                <div
                  key={i}
                  className={cn(
                    "border-r border-b relative",
                    theme === "dark" ? "border-slate-700" : "border-slate-200",
                    isWeekendDay ? (theme === "dark" ? "bg-slate-900" : "bg-slate-100") : "",
                    isTodayDate ? (theme === "dark" ? "bg-teal-900/20" : "bg-teal-100/40") : "",
                    theme === "dark" ? "group-hover/row:bg-emerald-900/20" : "group-hover/row:bg-emerald-50",
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
                  {/* Фоновая подсветка активности раздела */}
                  {isActive && (
                    <div
                      className={cn(
                        "absolute inset-1 rounded-sm",
                        getSectionStatusColor(section.status),
                        theme === "dark" ? "opacity-70" : "opacity-50",
                      )}
                    ></div>
                  )}
                  
                  {/* Отображение этапов декомпозиции */}
                  {(() => {
                    const activeStages = getActiveStagesForDate(unit.date)
                    const allStages = section.decompositionStages || []
                    
                    if (activeStages.length === 0) return null
                    
                    const barHeight = Math.floor(rowHeight / Math.max(allStages.length, 1)) - 2
                    
                    return (
                      <div className="absolute inset-0 flex flex-col justify-center gap-0.5 p-1">
                        {activeStages.map((stage) => {
                          const stageIndex = allStages.findIndex(s => s.id === stage.id)
                          const color = getStageColor(stageIndex, theme === "dark")
                          
                          return (
                            <div
                              key={stage.id}
                              className="rounded-sm transition-all duration-200"
                              style={{
                                backgroundColor: color,
                                height: `${barHeight}px`,
                                minHeight: '3px',
                                opacity: theme === "dark" ? 0.8 : 0.7,
                              }}
                              title={`${stage.name}`}
                            />
                          )
                        })}
                      </div>
                    )
                  })()}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Отображаем этапы и загрузки, если раздел раскрыт */}
      {isExpanded && (
        <>
          {(() => {
            // Группируем плановые и фактические загрузки по stageId
            const plannedByStage: Record<string, PlannedLoading[]> = {}
            const loadingsByStage: Record<string, Loading[]> = {}

            planned.forEach((pl) => {
              const key = pl.stageId || "__no_stage__"
              ;(plannedByStage[key] ||= []).push(pl)
            })

            uniqueLoadings.forEach((ld) => {
              const key = (ld as any).stageId || "__no_stage__"
              ;(loadingsByStage[key] ||= []).push(ld)
            })

            // Подготавливаем список этапов, включая псевдо-этап "Без этапа", если есть неподвязанные записи
            const hasNoStageItems = Boolean(plannedByStage["__no_stage__"]?.length || loadingsByStage["__no_stage__"]?.length)
            const stagesWithNoStage = hasNoStageItems
              ? [...stages, { id: "__no_stage__", name: "Без этапа", start: null, finish: null } as DecompositionStage]
              : stages

            return stagesWithNoStage.map((stage, stageIndex) => (
              <React.Fragment key={`${stage.id}-${stageIndex}`}>
                {/* Строка этапа */}
                <StageRow
                  stage={stage}
                  sectionPosition={sectionPosition}
                  stageIndex={stageIndex}
                  timeUnits={timeUnits}
                  theme={theme}
                  rowHeight={rowHeight}
                  padding={padding}
                  leftOffset={leftOffset}
                  cellWidth={cellWidth}
                  stickyColumnShadow={stickyColumnShadow}
                  totalFixedWidth={totalFixedWidth}
                  section={section}
                />

                {/* Плановые загрузки для этого этапа */}
                {(plannedByStage[stage.id] || []).map((p, plannedIndex) => (
                  <PlannedRow
                    key={`planned-${stage.id}-${p.id}-${plannedIndex}`}
                    planned={p}
                    sectionPosition={sectionPosition}
                    plannedIndex={plannedIndex}
                    additionalOffsetRows={0}
                    timeUnits={timeUnits}
                    theme={theme}
                    rowHeight={rowHeight}
                    padding={padding}
                    leftOffset={leftOffset}
                    cellWidth={cellWidth}
                    stickyColumnShadow={stickyColumnShadow}
                    totalFixedWidth={totalFixedWidth}
                    sectionId={section.id}
                    section={section}
                    stageId={stage.id !== "__no_stage__" ? stage.id : null}
                    stageName={stage.name}
                  />
                ))}

                {/* Фактические загрузки для этого этапа */}
                {(loadingsByStage[stage.id] || []).map((loading, loadingIndex) => (
                  <LoadingRow
                    key={`loading-${stage.id}-${loading.id}-${loadingIndex}`}
                    loading={loading}
                    sectionPosition={sectionPosition}
                    loadingIndex={loadingIndex}
                    additionalOffsetRows={0}
                    timeUnits={timeUnits}
                    theme={theme}
                    rowHeight={rowHeight}
                    padding={padding}
                    leftOffset={leftOffset}
                    cellWidth={cellWidth}
                    stickyColumnShadow={stickyColumnShadow}
                    totalFixedWidth={totalFixedWidth}
                    sectionResponsibleId={(section as any)?.responsibleId || null}
                  />
                ))}
              </React.Fragment>
            ))
          })()}
        </>
      )}
      {/* Модальное окно назначения ответственного */}
      {showAssignResponsibleModal && (
        <AssignResponsibleModal section={section} setShowAssignModal={setShowAssignResponsibleModal} theme={theme} />
      )}

      {/* Создание загрузки перенесено на этап и план */}
    </>
  )
}

// Компонент для отображения строки загрузки
interface LoadingRowProps {
  loading: Loading
  sectionPosition: number
  loadingIndex: number
  additionalOffsetRows: number
  timeUnits: { date: Date; label: string; isWeekend?: boolean }[]
  theme: string
  rowHeight: number
  padding: number
  leftOffset: number
  cellWidth: number
  stickyColumnShadow: string
  totalFixedWidth: number
  sectionResponsibleId?: string | null
}

// Компонент строки плановой загрузки (по категории, серый, без ответственного)
interface PlannedRowProps {
  planned: PlannedLoading
  sectionPosition: number
  plannedIndex: number
  additionalOffsetRows: number
  timeUnits: { date: Date; label: string; isWeekend?: boolean }[]
  theme: string
  rowHeight: number
  padding: number
  leftOffset: number
  cellWidth: number
  stickyColumnShadow: string
  totalFixedWidth: number
  sectionId: string
  section: Section
  stageId?: string | null
  stageName?: string | null
}

function PlannedRow({
  planned,
  sectionPosition,
  plannedIndex,
  additionalOffsetRows,
  timeUnits,
  theme,
  rowHeight,
  padding,
  leftOffset,
  cellWidth,
  stickyColumnShadow,
  totalFixedWidth,
  sectionId,
  section,
  stageId,
  stageName,
}: PlannedRowProps) {
  const [hovered, setHovered] = useState(false)
  const reducedRowHeight = Math.floor(rowHeight * 0.75)

  const isDateInPlan = (date: Date): boolean => {
    const start = new Date(planned.startDate)
    const finish = new Date(planned.endDate)
    start.setHours(0, 0, 0, 0)
    finish.setHours(23, 59, 59, 999)
    const d = new Date(date)
    d.setHours(0, 0, 0, 0)
    return d >= start && d <= finish
  }

  // Открытие модалки создания загрузки c предзаполнением
  const [createOpen, setCreateOpen] = useState(false)

  return (
    <div className="group/planned w-full">
      <div className="flex transition-colors w-full" style={{ height: `${reducedRowHeight}px` }}>
        {/* Фиксированные столбцы */}
        <div
          className={cn("sticky left-0 z-20", "flex")}
          style={{
            height: `${reducedRowHeight}px`,
            width: `${totalFixedWidth}px`,
            borderBottom: "1px solid",
            borderColor: theme === "dark" ? "rgb(51, 65, 85)" : "rgb(226, 232, 240)",
          }}
        >
          <div
            className={cn(
              "p-2 font-medium border-r flex items-center transition-colors h-full",
              theme === "dark"
                ? "border-slate-700 bg-slate-900/60 group-hover/planned:bg-emerald-900/30"
                : "border-slate-200 bg-slate-100 group-hover/planned:bg-emerald-50",
            )}
            style={{
              width: `${totalFixedWidth}px`,
              minWidth: `${totalFixedWidth}px`,
              padding: `${padding - 1}px`,
              borderRight: "1px solid",
              borderRightColor: theme === "dark" ? "rgb(51, 65, 85)" : "rgb(226, 232, 240)",
            }}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
          >
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center">
                <div className="flex-shrink-0 w-7 h-7 flex items-center justify-center mr-2">
                  {/* Пусто для отступа */}
                </div>
                <div className={cn("text-xs font-medium", theme === "dark" ? "text-slate-300" : "text-slate-700")}> 
                  {planned.categoryName || "Категория"} — {planned.rate} ставка
                </div>
              </div>
              <button
                className={cn(
                  "text-xs px-2 py-0.5 rounded",
                  theme === "dark" ? "bg-slate-700 text-slate-200" : "bg-slate-200 text-slate-700"
                )}
                title="Создать загрузку на основе плана"
                onClick={(e) => { e.stopPropagation(); setCreateOpen(true) }}
              >
                Назначить
              </button>
            </div>
          </div>
        </div>

        {/* Ячейки для каждого периода */}
        <div className="flex-1 flex w-full">
          {timeUnits.map((unit, i) => {
            const isMonthStart = isFirstDayOfMonth(unit.date)
            const active = isDateInPlan(unit.date)
            return (
              <div
                key={i}
                className={cn(
                  "border-r border-b relative",
                  theme === "dark" ? "border-slate-700" : "border-slate-200",
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
                      ? "rgb(71, 85, 105)"
                      : "rgb(203, 213, 225)"
                    : "transparent",
                  borderRightColor: theme === "dark" ? "rgb(51, 65, 85)" : "rgb(226, 232, 240)",
                  borderBottomColor: theme === "dark" ? "rgb(51, 65, 85)" : "rgb(226, 232, 240)",
                }}
              >
                {active && (
                  <div
                    className="absolute inset-1 rounded-sm"
                    style={{ backgroundColor: theme === "dark" ? "rgb(100, 116, 139)" : "rgb(226, 232, 240)", opacity: theme === "dark" ? 0.45 : 1 }}
                  />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Открываем модалку создания загрузки с предзаполнением дат и ставки */}
      {createOpen && (
        <CreateLoadingBySectionModal
          section={section}
          setShowModal={setCreateOpen}
          theme={theme}
          defaultStartDate={planned.startDate}
          defaultEndDate={planned.endDate}
          defaultRate={planned.rate}
          stageId={stageId ?? planned.stageId ?? null}
          stageName={stageName}
          convertPlanId={planned.id}
        />
      )}
    </div>
  )
}

function LoadingRow({
  loading,
  sectionPosition,
  loadingIndex,
  additionalOffsetRows,
  timeUnits,
  theme,
  rowHeight,
  padding,
  leftOffset,
  cellWidth,
  stickyColumnShadow,
  totalFixedWidth,
  sectionResponsibleId,
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

  // Функция для получения стилей прямоугольника в зависимости от ставки
  const getLoadingBarStyles = (rate: number) => {
    let backgroundColor = ""
    let height = "calc(100% - 8px)" // inset-1 = 4px отступ сверху и снизу
    let opacity = ""

    if (rate === 1) {
      // Ставка = 1: синий цвет (как сейчас)
      backgroundColor = theme === "dark" ? "rgb(59, 130, 246)" : "rgb(59, 130, 246)" // blue-500
      opacity = theme === "dark" ? "0.7" : "0.5"
    } else if (rate < 1) {
      // Ставка < 1: жёлтый цвет, пропорционально уменьшенная высота
      backgroundColor = theme === "dark" ? "rgb(234, 179, 8)" : "rgb(234, 179, 8)" // yellow-500
      opacity = theme === "dark" ? "0.7" : "0.6"
      // Высота пропорционально ставке, но минимум 20%
      const heightPercent = Math.max(rate * 100, 20)
      height = `${heightPercent}%`
    } else {
      // Ставка > 1: красный цвет
      backgroundColor = theme === "dark" ? "rgb(239, 68, 68)" : "rgb(239, 68, 68)" // red-500
      opacity = theme === "dark" ? "0.7" : "0.6"
    }

    return {
      backgroundColor,
      opacity,
      height,
      // Для ставки < 1 выравниваем по нижнему краю
      ...(rate < 1 && {
        position: "absolute" as const,
        bottom: "4px", // inset-1
        left: "4px",   // inset-1
        right: "4px",  // inset-1
        top: "auto"
      })
    }
  }

  // Вертикальное расположение обеспечивается потоком DOM, без абсолютного позиционирования

  return (
    <div className="group/loading w-full">
      <div className="flex transition-colors w-full" style={{ height: `${reducedRowHeight}px` }}>
        {/* Фиксированные столбцы со sticky позиционированием */}
        <div
          className={cn("sticky left-0 z-20", "flex")}
          style={{
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
                ? "border-slate-700 bg-slate-800 group-hover/loading:bg-emerald-900"
                : "border-slate-200 bg-white group-hover/loading:bg-emerald-50",
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
                    <div className={cn("text-xs font-medium flex items-center gap-1", theme === "dark" ? "text-slate-200" : "text-slate-700")}> 
                      {loading.responsibleName || "Не указан"}
                      {/* Маркер ответственного за раздел */}
                      {sectionResponsibleId && (loading.responsibleId === sectionResponsibleId) && (
                        <span
                          className={cn(
                            "inline-flex items-center justify-center rounded-sm text-[10px] px-1 py-0.5",
                            theme === "dark" ? "bg-amber-900/60 text-amber-300" : "bg-amber-100 text-amber-700"
                          )}
                          title="Ответственный за раздел"
                        >
                          ★
                        </span>
                      )}
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

        {/* Ячейки для каждого периода */}
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
                  theme === "dark" ? "group-hover/loading:bg-emerald-900/20" : "group-hover/loading:bg-emerald-50",
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
                    className="rounded-sm"
                    style={{
                      ...getLoadingBarStyles(loading.rate),
                      // Для полной ставки (= 1) и переработки (> 1) используем inset-1
                      ...(loading.rate >= 1 && {
                        position: "absolute",
                        top: "4px",
                        bottom: "4px", 
                        left: "4px",
                        right: "4px"
                      })
                    }}
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

// Компонент строки этапа
interface StageRowProps {
  stage: DecompositionStage
  sectionPosition: number
  stageIndex: number
  timeUnits: { date: Date; label: string; isWeekend?: boolean }[]
  theme: string
  rowHeight: number
  padding: number
  leftOffset: number
  cellWidth: number
  stickyColumnShadow: string
  totalFixedWidth: number
  section: Section
}

function StageRow({
  stage,
  sectionPosition,
  stageIndex,
  timeUnits,
  theme,
  rowHeight,
  padding,
  leftOffset,
  cellWidth,
  stickyColumnShadow,
  totalFixedWidth,
  section,
}: StageRowProps) {
  const reducedRowHeight = Math.floor(rowHeight * 0.75)
  const [createOpen, setCreateOpen] = useState(false)

  const isDateInStage = (date: Date): boolean => {
    if (!stage.start || !stage.finish) return false
    const start = new Date(stage.start)
    const finish = new Date(stage.finish)
    start.setHours(0, 0, 0, 0)
    finish.setHours(23, 59, 59, 999)
    const d = new Date(date)
    d.setHours(0, 0, 0, 0)
    return d >= start && d <= finish
  }

  return (
    <div className="group/stage w-full">
      <div className="flex transition-colors w-full" style={{ height: `${reducedRowHeight}px` }}>
        {/* Фиксированные столбцы со sticky позиционированием */}
        <div
          className={cn("sticky left-0 z-20", "flex")}
          style={{
            height: `${reducedRowHeight}px`,
            width: `${totalFixedWidth}px`,
            borderBottom: "1px solid",
            borderColor: theme === "dark" ? "rgb(51, 65, 85)" : "rgb(226, 232, 240)",
          }}
        >
          <div
            className={cn(
              "p-2 font-medium border-r flex items-center transition-colors h-full",
              theme === "dark"
                ? "border-slate-700 bg-slate-800 group-hover/stage:bg-emerald-900"
                : "border-slate-200 bg-white group-hover/stage:bg-emerald-50",
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
              <div className="flex items-center">
                <div className="flex-shrink-0 w-7 h-7 flex items-center justify-center mr-2">
                  <Milestone className={cn("h-4 w-4", theme === "dark" ? "text-slate-300" : "text-slate-600")} />
                </div>
                <div className={cn("text-xs font-medium", theme === "dark" ? "text-slate-200" : "text-slate-700")}>{stage.name || "Этап"}</div>
              </div>
              <button
                className={cn(
                  "text-xs px-2 py-0.5 rounded inline-flex items-center gap-1",
                  theme === "dark" ? "bg-slate-700 text-slate-200" : "bg-slate-200 text-slate-700"
                )}
                title="Создать загрузку в этом этапе"
                onClick={(e) => { e.stopPropagation(); setCreateOpen(true) }}
              >
                <PlusCircle size={12} /> Создать
              </button>
            </div>
          </div>
        </div>

        {/* Ячейки таймлайна для этапа */}
        <div className="flex-1 flex w-full">
          {timeUnits.map((unit, i) => {
            const isMonthStart = isFirstDayOfMonth(unit.date)
            const active = isDateInStage(unit.date)
            return (
              <div
                key={i}
                className={cn(
                  "border-r border-b relative",
                  theme === "dark" ? "border-slate-700" : "border-slate-200",
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
                      ? "rgb(71, 85, 105)"
                      : "rgb(203, 213, 225)"
                    : "transparent",
                  borderRightColor: theme === "dark" ? "rgb(51, 65, 85)" : "rgb(226, 232, 240)",
                  borderBottomColor: theme === "dark" ? "rgb(51, 65, 85)" : "rgb(226, 232, 240)",
                }}
              >
                {active && (
                  <div
                    className="absolute inset-1 rounded-sm"
                    style={{
                      backgroundColor: stage.color || (theme === "dark" ? "rgb(56, 189, 248)" : "rgb(14, 165, 233)"),
                      opacity: theme === "dark" ? 0.6 : 0.4,
                    }}
                  />
                )}
              </div>
            )
          })}
        </div>
      </div>
      {createOpen && (
        <CreateLoadingBySectionModal
          section={section}
          setShowModal={setCreateOpen}
          theme={theme}
          stageId={stage.id}
          stageName={stage.name}
          defaultStartDate={stage.start || undefined}
          defaultEndDate={stage.finish || undefined}
          defaultRate={1}
        />
      )}
    </div>
  )
}

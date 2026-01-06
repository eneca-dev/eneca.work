"use client"

import { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react"
import { useTaskTransferStore } from "@/modules/task-transfer/store"
import type { Assignment } from "@/modules/task-transfer/types"

interface CompactTaskScheduleProps {
  sectionId: string
}

export function CompactTaskSchedule({ sectionId }: CompactTaskScheduleProps) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const { assignments } = useTaskTransferStore()

  // Фильтрованные задания для данного раздела
  const sectionAssignments = useMemo(() => {
    return assignments.filter(a => 
      a.from_section_id === sectionId || a.to_section_id === sectionId
    )
  }, [assignments, sectionId])

  // Информация о текущем месяце
  const getCurrentMonthInfo = () => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const monthNames = [
      "январь", "февраль", "март", "апрель", "май", "июнь",
      "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь"
    ]

    return {
      year,
      month,
      daysInMonth,
      monthName: monthNames[month]
    }
  }

  // Навигация по месяцам
  const goToPreviousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))
  }

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))
  }

  const goToToday = () => {
    setCurrentDate(new Date())
  }

  // Обработка заданий для отображения
  const { year, month, daysInMonth } = getCurrentMonthInfo()
  const currentMonthStart = new Date(year, month, 1)
  const currentMonthEnd = new Date(year, month + 1, 0)

  const assignmentRows = sectionAssignments
    .map((assignment) => {
      const createdDate = new Date(assignment.created_at)
      const transmittedDate = assignment.actual_transmitted_date ? new Date(assignment.actual_transmitted_date) : null
      // Плановая продолжительность: считаем по рабочим дням (без выходных)
      const isWeekend = (d: Date) => d.getDay() === 0 || d.getDay() === 6
      const addBusinessDays = (start: Date, days: number) => {
        if (!days || days <= 0) return new Date(start)
        const date = new Date(start)
        let added = 0
        while (added < days) {
          date.setDate(date.getDate() + 1)
          if (!isWeekend(date)) added++
        }
        return date
      }
      const plannedEndDate = assignment.planned_duration && transmittedDate ? 
        addBusinessDays(transmittedDate, assignment.planned_duration) : 
        (assignment.planned_duration ? addBusinessDays(createdDate, assignment.planned_duration) : null)
      const dueDate = assignment.due_date ? new Date(assignment.due_date) : null

      // Проверяем, попадает ли задание в текущий месяц
      const assignmentInCurrentMonth = 
        (createdDate <= currentMonthEnd && (!plannedEndDate || plannedEndDate >= currentMonthStart)) ||
        (dueDate && dueDate >= currentMonthStart && dueDate <= currentMonthEnd)

      if (!assignmentInCurrentMonth) return null

      // Вычисляем диапазон планового периода в текущем месяце
      const plannedStartDay = createdDate.getMonth() === month && createdDate.getFullYear() === year 
        ? createdDate.getDate() : 1
      const plannedEndDay = plannedEndDate && plannedEndDate.getMonth() === month && plannedEndDate.getFullYear() === year 
        ? plannedEndDate.getDate() : (plannedEndDate && plannedEndDate < currentMonthStart ? 0 : daysInMonth)

      // Получаем фактические даты статусов
      const actualDates = {
        transmitted: assignment.actual_transmitted_date ? new Date(assignment.actual_transmitted_date) : null,
        accepted: assignment.actual_accepted_date ? new Date(assignment.actual_accepted_date) : null,
        worked_out: assignment.actual_worked_out_date ? new Date(assignment.actual_worked_out_date) : null,
        agreed: assignment.actual_agreed_date ? new Date(assignment.actual_agreed_date) : null,
      }

      return {
        assignment,
        plannedStartDay,
        plannedEndDay,
        dueDate,
        actualDates,
      }
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)

  if (sectionAssignments.length === 0) {
    return (
      <div className="p-6 text-center">
        <CalendarIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground text-sm">Нет заданий для отображения в графике</p>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Компактная легенда (без планового периода) */}
      <div className="flex flex-wrap gap-2 p-3 border-b text-xs">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 bg-amber-500 rotate-45"></div>
          <span>Плановая передача</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 bg-orange-500 rotate-45"></div>
          <span>Передано</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 bg-blue-500 rotate-45"></div>
          <span>Принято</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 bg-green-500 rotate-45"></div>
          <span>Выполнено</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 bg-purple-500 rotate-45"></div>
          <span>Согласовано</span>
        </div>
        {/* Дедлайн скрыт по требованиям */}
      </div>

      {/* Навигация по месяцам - компактная */}
      <div className="flex justify-between items-center p-3 border-b bg-muted/50">
        <Button variant="ghost" size="sm" onClick={goToPreviousMonth} className="h-7 w-7 p-0">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="text-center">
          <div className="text-sm font-semibold text-foreground capitalize">
            {getCurrentMonthInfo().monthName} {getCurrentMonthInfo().year}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={goToToday}
            className="text-xs text-primary hover:text-primary/80 h-5 px-1"
          >
            Сегодня
          </Button>
        </div>
        <Button variant="ghost" size="sm" onClick={goToNextMonth} className="h-7 w-7 p-0">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* График - адаптированный под панель */}
      <div className="flex-1 overflow-x-auto overflow-y-auto p-2">
        <div className="min-w-full">
          {/* Сетка дней месяца - компактная */}
          <div 
            className="grid gap-px mb-4 text-xs"
            style={{ 
              gridTemplateColumns: `120px repeat(${getCurrentMonthInfo().daysInMonth}, minmax(20px, 1fr))` 
            }}
          >
            <div></div>
            {Array.from({ length: getCurrentMonthInfo().daysInMonth }, (_, i) => {
              const day = i + 1
              const date = new Date(getCurrentMonthInfo().year, getCurrentMonthInfo().month, day)
              const weekDay = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"][date.getDay()]
              const isToday = new Date().toDateString() === date.toDateString()
              const isWeekend = date.getDay() === 0 || date.getDay() === 6

              return (
                <div
                  key={day}
                  className={`text-center p-1 text-xs ${
                    isToday
                      ? "bg-primary/20 border border-primary rounded-sm"
                      : isWeekend
                        ? "bg-destructive/10 text-destructive"
                        : "hover:bg-muted"
                  }`}
                >
                  <div className={`text-muted-foreground text-[10px] ${isWeekend ? "text-destructive" : ""}`}>
                    {weekDay}
                  </div>
                  <div
                    className={`font-medium text-[11px] ${
                      isToday ? "text-primary font-bold" : isWeekend ? "text-destructive" : "text-foreground"
                    }`}
                  >
                    {day}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Строки с заданиями - компактные */}
          <div className="space-y-1">
            {assignmentRows.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground text-sm">
                Нет заданий в этом месяце
              </div>
            ) : (
              assignmentRows.map((row) => (
                <div
                  key={row.assignment.assignment_id}
                  className="grid gap-px items-center min-h-[32px]"
                  style={{
                    gridTemplateColumns: `120px repeat(${getCurrentMonthInfo().daysInMonth}, minmax(20px, 1fr))`
                  }}
                >
                  {/* Информация о задании - компактная */}
                  <div className="pr-2 text-xs overflow-hidden">
                    <div className="font-medium truncate text-foreground text-[11px] leading-tight">
                      {row.assignment.title}
                    </div>
                    <div className="text-[10px] text-muted-foreground truncate">
                      {row.assignment.from_section_id === sectionId 
                        ? `→ ${row.assignment.to_section_name || '?'}`
                        : `← ${row.assignment.from_section_name || '?'}`
                      }
                    </div>
                  </div>

                  {/* Временная линия */}
                  {Array.from({ length: getCurrentMonthInfo().daysInMonth }, (_, dayIndex) => {
                    const currentDay = dayIndex + 1
                    const currentDate = new Date(year, month, currentDay)

                    // Проверяем, попадает ли день в плановый период (выходные исключаем)
                    const isWeekendCell = currentDate.getDay() === 0 || currentDate.getDay() === 6
                    const isInPlannedPeriod = row.plannedEndDay > 0 && 
                      currentDay >= row.plannedStartDay && currentDay <= row.plannedEndDay && !isWeekendCell

                    // Проверяем статусы в этот день
                    const statusMarkers = []

                    // Плановая дата передачи
                    if (row.assignment.planned_transmitted_date) {
                      const ptd = new Date(row.assignment.planned_transmitted_date)
                      if (
                        ptd.getDate() === currentDay &&
                        ptd.getMonth() === month &&
                        ptd.getFullYear() === year
                      ) {
                        statusMarkers.push({ color: "bg-amber-500", label: "Плановая передача" })
                      }
                    }

                    // Дедлайн скрыт по требованиям

                    // Фактические даты статусов
                    if (row.actualDates.transmitted && 
                        row.actualDates.transmitted.getDate() === currentDay && 
                        row.actualDates.transmitted.getMonth() === month && 
                        row.actualDates.transmitted.getFullYear() === year) {
                      statusMarkers.push({ color: "bg-orange-500", label: "Передано" })
                    }

                    if (row.actualDates.accepted && 
                        row.actualDates.accepted.getDate() === currentDay && 
                        row.actualDates.accepted.getMonth() === month && 
                        row.actualDates.accepted.getFullYear() === year) {
                      statusMarkers.push({ color: "bg-blue-500", label: "Принято" })
                    }

                    if (row.actualDates.worked_out && 
                        row.actualDates.worked_out.getDate() === currentDay && 
                        row.actualDates.worked_out.getMonth() === month && 
                        row.actualDates.worked_out.getFullYear() === year) {
                      statusMarkers.push({ color: "bg-green-500", label: "Выполнено" })
                    }

                    if (row.actualDates.agreed && 
                        row.actualDates.agreed.getDate() === currentDay && 
                        row.actualDates.agreed.getMonth() === month && 
                        row.actualDates.agreed.getFullYear() === year) {
                      statusMarkers.push({ color: "bg-purple-500", label: "Согласовано" })
                    }

                    return (
                      <div key={dayIndex} className="relative h-6 flex items-center justify-center">
                        {/* Плановый период скрыт по требованиям */}

                        {/* Маркеры статусов (компактные ромбики) */}
                        {statusMarkers.map((marker, markerIndex) => (
                          <div
                            key={markerIndex}
                            className={`absolute w-2 h-2 ${marker.color} rotate-45 z-10`}
                            style={{
                              top: `${markerIndex * 4 + 8}px`, // Компактные отступы
                            }}
                            title={marker.label}
                          />
                        ))}
                      </div>
                    )
                  })}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

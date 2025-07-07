"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ZoomIn, ZoomOut, RotateCcw } from "lucide-react"
import { useTaskTransferStore } from "../store"
import { getFilteredAssignments } from "../utils"
import type { TaskFilters, AssignmentDirection, Assignment } from "../types"

interface TaskScheduleProps {
  filters?: TaskFilters
  direction: AssignmentDirection
  currentUserSectionId?: string
}

export function TaskSchedule({ filters = {}, direction, currentUserSectionId }: TaskScheduleProps) {
  const [zoomLevel, setZoomLevel] = useState(1)
  const [currentDate, setCurrentDate] = useState(new Date()) // текущий месяц
  const filteredAssignments = getFilteredAssignments(filters)

  // Функция для получения информации о текущем месяце
  const getCurrentMonthInfo = () => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const monthNames = [
      "январь", "февраль", "март", "апрель", "май", "июнь",
      "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь",
    ]

    return {
      year,
      month,
      daysInMonth,
      monthName: monthNames[month],
    }
  }

  // Функции навигации по месяцам
  const goToPreviousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))
  }

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))
  }

  const goToToday = () => {
    setCurrentDate(new Date())
  }

  // Группируем задания для отображения
  const { year, month, daysInMonth } = getCurrentMonthInfo()
  const currentMonthStart = new Date(year, month, 1)
  const currentMonthEnd = new Date(year, month + 1, 0)

  const assignmentRows = filteredAssignments
    .map((assignment) => {
      const createdDate = new Date(assignment.created_at)
      const transmittedDate = assignment.actual_transmitted_date ? new Date(assignment.actual_transmitted_date) : null
      const plannedEndDate = assignment.planned_duration && transmittedDate ? 
        new Date(transmittedDate.getTime() + assignment.planned_duration * 24 * 60 * 60 * 1000) : 
        (assignment.planned_duration ? new Date(createdDate.getTime() + assignment.planned_duration * 24 * 60 * 60 * 1000) : null)
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

  const handleZoomIn = () => setZoomLevel((prev) => Math.min(prev + 0.2, 2))
  const handleZoomOut = () => setZoomLevel((prev) => Math.max(prev - 0.2, 0.5))
  const handleReset = () => setZoomLevel(1)

  if (filteredAssignments.length === 0) {
    return (
      <div className="bg-card p-8 rounded-lg border text-center">
        <p className="text-muted-foreground">Нет заданий для отображения в графике.</p>
      </div>
    )
  }

  return (
    <Card className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-foreground">График заданий</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleZoomOut}>
            <ZoomOut className="h-4 w-4 mr-1" />
            Уменьшить
          </Button>
          <Button variant="outline" size="sm" onClick={handleReset}>
            <RotateCcw className="h-4 w-4 mr-1" />
            Сбросить
          </Button>
          <Button variant="outline" size="sm" onClick={handleZoomIn}>
            <ZoomIn className="h-4 w-4 mr-1" />
            Увеличить
          </Button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 mb-6 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-3 border-2 border-primary/30 bg-primary/10 rounded"></div>
          <span className="text-foreground">Плановый период</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-orange-500 rotate-45"></div>
          <span className="text-foreground">Передано</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-blue-500 rotate-45"></div>
          <span className="text-foreground">Принято</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-green-500 rotate-45"></div>
          <span className="text-foreground">Выполнено</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-purple-500 rotate-45"></div>
          <span className="text-foreground">Согласовано</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-destructive rotate-45"></div>
          <span className="text-foreground">Дедлайн</span>
        </div>
      </div>

      {/* Schedule */}
      <div className="overflow-x-auto" style={{ transform: `scale(${zoomLevel})`, transformOrigin: "top left" }}>
        <div className="min-w-[1200px]">
          {/* Calendar Header */}
                      <div className="mb-6">
            {/* Month Navigation */}
            <div className="flex justify-between items-center mb-4 p-4 bg-gradient-to-r from-primary/5 to-primary/10 rounded-lg border border-border">
              <Button variant="outline" size="sm" onClick={goToPreviousMonth}>
                ←
              </Button>
              <div className="text-center">
                <div className="text-2xl font-bold text-foreground capitalize">
                  {getCurrentMonthInfo().monthName} {getCurrentMonthInfo().year}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={goToToday}
                  className="text-sm text-primary hover:text-primary/80"
                >
                  Сегодня
                </Button>
              </div>
              <Button variant="outline" size="sm" onClick={goToNextMonth}>
                →
              </Button>
            </div>

            {/* Days Grid */}
            <div
              className="grid gap-1"
              style={{ gridTemplateColumns: `250px repeat(${getCurrentMonthInfo().daysInMonth}, 1fr)` }}
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
                    className={`text-center text-xs p-2 rounded ${
                      isToday
                        ? "bg-primary/20 border-2 border-primary"
                        : isWeekend
                          ? "bg-destructive/10 text-destructive"
                          : "hover:bg-muted"
                    }`}
                  >
                    <div className={`text-muted-foreground ${isWeekend ? "text-destructive" : ""}`}>{weekDay}</div>
                    <div
                      className={`font-medium ${isToday ? "text-primary font-bold" : isWeekend ? "text-destructive" : "text-foreground"}`}
                    >
                      {day}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Assignment Rows */}
          <div className="space-y-2">
            <div className="text-sm font-medium text-foreground mb-2">Задания</div>
            {assignmentRows.map((row, index) => (
              <div
                key={row.assignment.assignment_id}
                  className="items-center min-h-[40px]"
                  style={{
                    display: "grid",
                  gridTemplateColumns: `250px repeat(${getCurrentMonthInfo().daysInMonth}, 1fr)`,
                    gap: "4px",
                  }}
                >
                {/* Assignment Info */}
                  <div className="pr-4 text-sm">
                  <div className="font-medium truncate text-foreground">{row.assignment.title}</div>
                    <div className="text-xs text-muted-foreground truncate">
                    {row.assignment.from_section_name || `Раздел ${row.assignment.from_section_id}`} → {row.assignment.to_section_name || `Раздел ${row.assignment.to_section_id}`}
                  </div>
                  <div className="text-xs text-muted-foreground/70 truncate">
                    {row.assignment.project_name || `Проект ${row.assignment.project_id}`}
                    </div>
                  </div>

                  {/* Timeline */}
                  {Array.from({ length: getCurrentMonthInfo().daysInMonth }, (_, dayIndex) => {
                    const currentDay = dayIndex + 1
                  const currentDate = new Date(year, month, currentDay)

                  // Проверяем, попадает ли день в плановый период
                  const isInPlannedPeriod = row.plannedEndDay > 0 && currentDay >= row.plannedStartDay && currentDay <= row.plannedEndDay

                  // Проверяем статусы в этот день
                  const statusMarkers = []

                  // Дедлайн
                  if (row.dueDate && 
                      row.dueDate.getDate() === currentDay && 
                      row.dueDate.getMonth() === month && 
                      row.dueDate.getFullYear() === year) {
                    statusMarkers.push({ color: "bg-destructive", label: "Дедлайн" })
                  }

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
                      <div key={dayIndex} className="relative h-8 flex items-center justify-center">
                      {/* Плановый период */}
                      {isInPlannedPeriod && (
                        <div className="absolute inset-x-0 h-6 border-2 border-primary/30 bg-primary/10 rounded-sm" />
                      )}

                      {/* Маркеры статусов (цветные ромбики) */}
                      {statusMarkers.map((marker, markerIndex) => (
                        <div
                          key={markerIndex}
                          className={`absolute w-3 h-3 ${marker.color} rotate-45 z-10`}
                          style={{
                            top: `${markerIndex * 8 + 10}px`, // Смещаем маркеры по вертикали если их несколько
                          }}
                          title={marker.label}
                        />
                      ))}
                      </div>
                    )
                  })}
                </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  )
}
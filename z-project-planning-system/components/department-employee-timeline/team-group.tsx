"use client"

import { useState, useEffect } from "react"
import { ChevronDown, ChevronRight } from "lucide-react"
import { getFullName, getPositionName } from "@/data/mock-profiles"
import type { Profile } from "@/types/project-types"

// Обновляем интерфейс TeamGroupProps, добавляя onExpandToggle
interface TeamGroupProps {
  team: {
    id: string
    team_name: string
    employees: Profile[]
  }
  workloads: Record<string, Record<string, number>>
  isExpanded?: boolean
  onExpandToggle?: (teamId: string, isExpanded: boolean) => void
}

export function TeamGroup({ team, workloads, isExpanded = true, onExpandToggle }: TeamGroupProps) {
  const [localIsExpanded, setLocalIsExpanded] = useState(isExpanded)

  // Обновляем состояние при изменении внешнего состояния
  useEffect(() => {
    setLocalIsExpanded(isExpanded)
  }, [isExpanded])

  // Обработчик переключения состояния
  const toggleExpanded = () => {
    const newState = !localIsExpanded
    setLocalIsExpanded(newState)
    if (onExpandToggle) {
      onExpandToggle(team.id, newState)
    }
  }

  // Рассчитываем общую загрузку команды
  const teamTotalWorkload = team.employees.reduce((total, employee) => {
    const employeeWorkload = workloads[employee.user_id] || {}
    const employeeTotal = Object.values(employeeWorkload || {}).reduce((sum, value) => sum + (value || 0), 0)
    return total + employeeTotal
  }, 0)

  // Форматируем название команды (убираем "Команда " из названия)
  const formattedTeamName =
    team.team_name && typeof team.team_name === "string" ? team.team_name.replace(/^Команда\s+/i, "") : "Без названия"

  // Обновляем стили для заголовка команды и списка сотрудников
  return (
    <div>
      {/* Заголовок команды в отдельной строке - улучшенный стиль */}
      <div
        className="flex items-center px-4 py-1 bg-slate-100 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700/50 transition-colors"
        onClick={toggleExpanded}
        style={{ height: "32px" }}
      >
        <div className="mr-2 text-primary">
          {localIsExpanded ? (
            <ChevronDown size={14} className="text-primary" />
          ) : (
            <ChevronRight size={14} className="text-primary" />
          )}
        </div>
        <div className="flex-1">
          <span className="font-medium text-slate-700 dark:text-slate-300 text-sm">{formattedTeamName}</span>
          <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">({team.employees.length})</span>
        </div>
        {teamTotalWorkload > 0 && (
          <div className="text-xs font-medium px-1.5 py-0.5 rounded bg-primary/10 text-primary">
            {teamTotalWorkload.toFixed(1)}
          </div>
        )}
      </div>

      {/* Список сотрудников - улучшенный стиль */}
      {localIsExpanded && (
        <div>
          {team.employees.map((employee) => {
            return (
              <div
                key={employee.user_id}
                className="flex items-center px-4 py-1 border-b border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/30"
                style={{ height: "40px" }}
              >
                <div className="flex-1">
                  <div className="font-medium text-slate-800 dark:text-slate-200 text-sm">{getFullName(employee)}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">{getPositionName(employee)}</div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}


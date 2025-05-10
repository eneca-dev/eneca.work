"use client"

import { SectionResponsibleCard } from "./section-responsible-card"
import { DepartmentBadge } from "./department-badge"
import { DepartmentSelector } from "./department-selector"
import { ResponsibleSelector } from "./responsible-selector"
import { TeamBadge } from "./team-badge"
import type { SectionResponsible, Department } from "@/types/project-types"
import { mockProfiles, mockTeams } from "@/data/mock-profiles"

interface SectionInfoCardProps {
  responsible?: SectionResponsible
  department?: Department
  onResponsibleChange?: (responsible: SectionResponsible) => void
  onDepartmentChange?: (department: Department) => void
  isCollapsed?: boolean
  isEditable?: boolean
}

export function SectionInfoCard({
  responsible,
  department,
  onResponsibleChange,
  onDepartmentChange,
  isCollapsed = false,
  isEditable = false,
}: SectionInfoCardProps) {
  // Получаем информацию о команде ответственного
  const profile = responsible ? mockProfiles.find((p) => p.user_id === responsible.id) : null
  const team = profile ? mockTeams.find((t) => t.team_id === profile.team_id) : null
  const teamName = team?.team_name || ""

  // Если столбец свернут, показываем только иконки
  if (isCollapsed) {
    return (
      <div className="flex flex-col items-center justify-center h-full w-full">
        <div className="flex flex-col items-center justify-center gap-2 py-2">
          {isEditable && onDepartmentChange ? (
            <DepartmentSelector value={department} onChange={onDepartmentChange} isCollapsed={true} />
          ) : (
            department && <DepartmentBadge department={department} size="sm" />
          )}

          {isEditable && onResponsibleChange ? (
            <ResponsibleSelector value={responsible?.id} onChange={onResponsibleChange} isCollapsed={true} />
          ) : (
            <SectionResponsibleCard responsible={responsible} isCollapsed={true} />
          )}
        </div>
      </div>
    )
  }

  // Если столбец развернут, показываем полную информацию
  return (
    <div className="flex flex-col gap-2 w-full p-2">
      <div className="flex flex-col">
        <div className="flex items-center gap-2 flex-wrap">
          {isEditable && onDepartmentChange ? (
            <DepartmentSelector value={department} onChange={onDepartmentChange} />
          ) : department ? (
            <DepartmentBadge department={department} />
          ) : (
            <span className="text-xs text-slate-400">Отдел не назначен</span>
          )}

          {/* Отображаем информацию о команде, если есть ответственный и команда */}
          {teamName && <TeamBadge teamName={teamName} />}
        </div>
      </div>

      <div className="flex flex-col mt-1">
        {isEditable && onResponsibleChange ? (
          <ResponsibleSelector value={responsible?.id} onChange={onResponsibleChange} />
        ) : (
          <SectionResponsibleCard responsible={responsible} />
        )}
      </div>
    </div>
  )
}


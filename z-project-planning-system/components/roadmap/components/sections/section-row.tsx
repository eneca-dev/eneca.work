"use client"

import { useRoadmap } from "../../context/roadmap-context"
import { SectionCharts } from "./section-charts"
import { SectionDifferenceChart } from "./section-difference-chart"
import { StagesList } from "../stages/stages-list"
import { ChevronDown, ChevronRight } from "lucide-react"
import type { Section, SectionResponsible, Department } from "@/types/project-types"
import { memo, useCallback } from "react"
import { SectionInfoCard } from "@/components/section-info-card"

interface SectionRowProps {
  section: Section
  projectName?: string
  onResponsibleChange?: (sectionId: string, responsible: SectionResponsible) => void
  onDepartmentChange?: (sectionId: string, department: Department) => void
}

// Use memo to prevent unnecessary re-renders
export const SectionRow = memo(function SectionRow({
  section,
  projectName,
  onResponsibleChange,
  onDepartmentChange,
}: SectionRowProps) {
  const {
    expandedSections,
    onToggleSection,
    sidebarWidth = 264,
    showPlanCharts,
    showFactCharts,
    responsibleColumnWidth = 150,
    isResponsibleColumnCollapsed = false,
  } = useRoadmap()

  // Use callback for toggle section to prevent unnecessary re-renders
  const handleToggleSection = useCallback(() => {
    onToggleSection(section.id)
  }, [onToggleSection, section.id])

  // Добавим обработчик изменения ответственного
  const handleResponsibleChange = useCallback(
    (responsible: SectionResponsible) => {
      if (onResponsibleChange) {
        onResponsibleChange(section.id, responsible)
      }
    },
    [section.id, onResponsibleChange],
  )

  // Добавим обработчик изменения отдела
  const handleDepartmentChange = useCallback(
    (department: Department) => {
      if (onDepartmentChange) {
        onDepartmentChange(section.id, department)
      }
    },
    [section.id, onDepartmentChange],
  )

  // Обновим JSX в return, добавив столбец ответственного
  return (
    <div key={section.id} className="group">
      {/* Section header row - shows difference chart */}
      <div
        className="flex items-center hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
        onClick={handleToggleSection}
      >
        <div
          className="p-3 font-medium border-r border-slate-200 dark:border-slate-800 flex items-center group-hover:bg-slate-50 dark:group-hover:bg-slate-800/50 transition-colors"
          style={{ width: `${sidebarWidth}px`, minWidth: `${sidebarWidth}px` }}
        >
          <div className="flex flex-col">
            <div className="flex items-center">
              {expandedSections[section.id] ? (
                <ChevronDown className="h-5 w-5 mr-2 text-gray-500 dark:text-gray-400" />
              ) : (
                <ChevronRight className="h-5 w-5 mr-2 text-gray-500 dark:text-gray-400" />
              )}
              <span className="font-semibold text-slate-800 dark:text-slate-200">{section.name}</span>
            </div>

            {(section.projectName || projectName) && (
              <div className="ml-7 mt-0.5">
                <div
                  className="text-xs px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-md border border-slate-200 dark:border-slate-700 inline-block max-w-[180px]"
                  title={section.projectName || projectName}
                >
                  <span className="text-slate-600 dark:text-slate-300 truncate block">
                    {section.projectName || projectName}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Столбец ответственного и отдела */}
        <div
          className="border-r border-slate-200 dark:border-slate-800 flex items-center justify-center"
          style={{ width: `${responsibleColumnWidth}px`, minWidth: `${responsibleColumnWidth}px` }}
          onClick={(e) => e.stopPropagation()} // Предотвращаем всплытие события клика
        >
          <SectionInfoCard
            responsible={section.responsible}
            department={section.department}
            onResponsibleChange={onResponsibleChange ? handleResponsibleChange : undefined}
            onDepartmentChange={onDepartmentChange ? handleDepartmentChange : undefined}
            isCollapsed={isResponsibleColumnCollapsed}
            isEditable={!!onResponsibleChange || !!onDepartmentChange}
          />
        </div>

        <div className="flex-1 relative h-16 bg-white dark:bg-slate-900">
          <div
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage: "radial-gradient(var(--primary) 1px, transparent 1px)",
              backgroundSize: "8px 8px",
            }}
          ></div>

          <SectionDifferenceChart section={section} />
        </div>
      </div>

      {/* Expanded content */}
      {expandedSections[section.id] && (
        <>
          {/* Plan row - conditionally rendered */}
          {showPlanCharts && (
            <div className="flex border-t border-slate-200 dark:border-slate-800">
              <div
                className="p-3 pl-12 border-r border-slate-200 dark:border-slate-800 flex items-center"
                style={{ width: `${sidebarWidth}px`, minWidth: `${sidebarWidth}px` }}
              >
                <span className="text-blue-600 dark:text-blue-400 font-medium">План</span>
              </div>

              {/* Пустая ячейка для столбца ответственного */}
              <div
                className="border-r border-slate-200 dark:border-slate-800"
                style={{ width: `${responsibleColumnWidth}px`, minWidth: `${responsibleColumnWidth}px` }}
              ></div>

              <div className="flex-1 relative h-16 bg-white dark:bg-slate-900">
                <div
                  className="absolute inset-0 opacity-10"
                  style={{
                    backgroundImage: "radial-gradient(var(--primary) 1px, transparent 1px)",
                    backgroundSize: "8px 8px",
                  }}
                ></div>

                <SectionCharts section={section} type="Plan" />
              </div>
            </div>
          )}

          {/* Fact row - conditionally rendered */}
          {showFactCharts && (
            <div className="flex border-t border-slate-200 dark:border-slate-800">
              <div
                className="p-3 pl-12 border-r border-slate-200 dark:border-slate-800 flex items-center"
                style={{ width: `${sidebarWidth}px`, minWidth: `${sidebarWidth}px` }}
              >
                <span className="text-orange-600 dark:text-orange-400 font-medium">Факт</span>
              </div>

              {/* Пустая ячейка для столбца ответственного */}
              <div
                className="border-r border-slate-200 dark:border-slate-800"
                style={{ width: `${responsibleColumnWidth}px`, minWidth: `${responsibleColumnWidth}px` }}
              ></div>

              <div className="flex-1 relative h-16 bg-white dark:bg-slate-900">
                <div
                  className="absolute inset-0 opacity-10"
                  style={{
                    backgroundImage: "radial-gradient(var(--primary) 1px, transparent 1px)",
                    backgroundSize: "8px 8px",
                  }}
                ></div>

                <SectionCharts section={section} type="Fact" />
              </div>
            </div>
          )}

          {/* Stage rows */}
          <StagesList section={section} responsibleColumnWidth={responsibleColumnWidth} />
        </>
      )}
    </div>
  )
})


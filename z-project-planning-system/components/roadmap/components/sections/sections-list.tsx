import { useRoadmap } from "../../context/roadmap-context"
import { SectionRow } from "./section-row"
import type { SectionResponsible, Department } from "@/types/project-types"

interface SectionsListProps {
  onResponsibleChange?: (sectionId: string, responsible: SectionResponsible) => void
  onDepartmentChange?: (sectionId: string, department: Department) => void
  projectName?: string
}

export function SectionsList({ onResponsibleChange, onDepartmentChange, projectName }: SectionsListProps) {
  const { project } = useRoadmap()

  return (
    <div className="divide-y divide-gray-300 border-b border-gray-300">
      {project.sections.map((section) => (
        <SectionRow
          key={section.id}
          section={section}
          projectName={projectName}
          onResponsibleChange={onResponsibleChange}
          onDepartmentChange={onDepartmentChange}
        />
      ))}
    </div>
  )
}


import { StageRow } from "./stage-row"
import type { Section } from "@/types/project-types"

interface StagesListProps {
  section: Section
  responsibleColumnWidth?: number
}

export function StagesList({ section, responsibleColumnWidth = 150 }: StagesListProps) {
  return (
    <>
      {section.stages.map((stage) => (
        <StageRow key={stage.id} stage={stage} responsibleColumnWidth={responsibleColumnWidth} />
      ))}
    </>
  )
}


"use client"

import type React from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { DecompositionItem, SectionHierarchy } from "../types"

interface DecompositionListProps {
  sections: SectionHierarchy[]
  filteredSections: SectionHierarchy[]
  selectedSectionId: string | null
  onSelectSection: (sectionId: string) => void
  projects: { id: string; name: string }[]
  stages: { id: string; name: string }[]
  objects: { id: string; name: string }[]
  selectedProjectId: string | null
  selectedStageId: string | null
  selectedObjectId: string | null
  handleProjectSelect: (projectId: string) => void
  handleStageSelect: (stageId: string) => void
  handleObjectSelect: (objectId: string) => void
  items: DecompositionItem[]
  isLoading: boolean
  department: string
  userName: string
  userAvatar?: string
}

export const DecompositionList: React.FC<DecompositionListProps> = ({
  sections,
  filteredSections,
  selectedSectionId,
  onSelectSection,
  projects,
  stages,
  objects,
  selectedProjectId,
  selectedStageId,
  selectedObjectId,
  handleProjectSelect,
  handleStageSelect,
  handleObjectSelect,
  items,
  isLoading,
  department,
  userName,
  userAvatar,
}) => {
  const selectedSection = sections.find((s) => s.section_id === selectedSectionId)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Проект</label>
          <Select value={selectedProjectId || ""} onValueChange={handleProjectSelect}>
            <SelectTrigger>
              <SelectValue placeholder="Выберите проект" />
            </SelectTrigger>
            <SelectContent>
              {projects.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Стадия</label>
          <Select value={selectedStageId || ""} onValueChange={handleStageSelect} disabled={!selectedProjectId}>
            <SelectTrigger>
              <SelectValue placeholder="Выберите стадию" />
            </SelectTrigger>
            <SelectContent>
              {stages.map((stage) => (
                <SelectItem key={stage.id} value={stage.id}>
                  {stage.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Объект</label>
          <Select value={selectedObjectId || ""} onValueChange={handleObjectSelect} disabled={!selectedStageId}>
            <SelectTrigger>
              <SelectValue placeholder="Выберите объект" />
            </SelectTrigger>
            <SelectContent>
              {objects.map((object) => (
                <SelectItem key={object.id} value={object.id}>
                  {object.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Раздел</label>
          <Select
            value={selectedSectionId || ""}
            onValueChange={(value) => {
              // Проверяем, что значение не пустое
              if (value) {
                onSelectSection(value)
              }
            }}
            disabled={!selectedObjectId}
          >
            <SelectTrigger>
              <SelectValue placeholder="Выберите раздел" />
            </SelectTrigger>
            <SelectContent>
              {filteredSections.map((section) => (
                <SelectItem key={section.section_id} value={section.section_id}>
                  {section.section_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Отображаем информационный блок, если выбран раздел */}
      {/* DecompositionHeader удален так как возвращает null */}

      <div>
        <h3 className="text-lg font-medium mb-4">Декомпозиция работ</h3>

        {isLoading ? (
          <div className="text-center py-8">Загрузка...</div>
        ) : items.length === 0 ? (
          <div className="text-center py-8">Нет данных для отображения</div>
        ) : (
          <div className="border rounded-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px]">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-2 sm:px-4 py-2 text-left font-medium">#</th>
                    <th className="px-4 py-2 text-left font-medium">Группа работ</th>
                    <th className="px-4 py-2 text-left font-medium">Наименование задачи</th>
                    <th className="px-4 py-2 text-left font-medium">Уровень сложности</th>
                    <th className="px-4 py-2 text-left font-medium">Часов</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => (
                    <tr key={index} className="border-t">
                      <td className="px-2 sm:px-4 py-2">{index + 1}</td>
                      <td className="px-4 py-2">{item.work_type}</td>
                      <td className="px-4 py-2">{item.work_content}</td>
                      <td className="px-4 py-2">{item.complexity_level?.toString() || "-"}</td>
                      <td className="px-4 py-2">{item.labor_costs}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

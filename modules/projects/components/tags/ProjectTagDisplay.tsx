'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Plus } from 'lucide-react'
import type { ProjectTag } from '../../types'
import { ProjectTagSelector } from './ProjectTagSelector'
import { useUserStore } from '@/stores/useUserStore'
import { useProjectTagsPermissions } from '@/modules/permissions/hooks/usePermissions'
import { getContrastColor } from '../../utils/color'

interface ProjectTagDisplayProps {
  projectId: string
  projectName: string
  tags: ProjectTag[]
  managerId?: string | null
  leadEngineerId?: string | null
  onUpdate?: () => void
}

export function ProjectTagDisplay({
  projectId,
  projectName,
  tags,
  managerId,
  leadEngineerId,
}: ProjectTagDisplayProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [displayTags, setDisplayTags] = useState<ProjectTag[]>(tags)
  const containerRef = useRef<HTMLDivElement>(null)

  // Получаем текущего пользователя и разрешения
  const currentUserId = useUserStore((state) => state.id)
  const { canAssignTagsAll, canAssignTagsManaged, canAssignTagsLead } = useProjectTagsPermissions()

  // Проверка прав на назначение тегов
  const canAssignTags =
    canAssignTagsAll ||
    (canAssignTagsManaged && currentUserId === managerId) ||
    (canAssignTagsLead && currentUserId === leadEngineerId)

  // Синхронизировать displayTags с props при изменении извне
  useEffect(() => {
    setDisplayTags(tags)
  }, [tags])

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsOpen(true)
  }

  // Мгновенное обновление отображаемых тегов
  const handleTagsChange = (newTags: ProjectTag[]) => {
    setDisplayTags(newTags)
  }

  // Если нет прав — показываем только читаемые теги без кнопки
  if (!canAssignTags) {
    if (displayTags.length === 0) return null

    return (
      <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
        {displayTags.map((tag) => (
          <div
            key={tag.tag_id}
            className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full shadow-sm"
            style={{
              backgroundColor: tag.color,
              color: getContrastColor(tag.color),
            }}
          >
            {tag.name}
          </div>
        ))}
      </div>
    )
  }

  return (
    <>
      <div
        ref={containerRef}
        className="flex items-center gap-1.5 flex-wrap mt-0.5"
        onClick={(e) => e.stopPropagation()}
      >
        {displayTags.length > 0 ? (
          <>
            {displayTags.map((tag) => (
              <div
                key={tag.tag_id}
                className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full cursor-pointer hover:opacity-90 transition-opacity shadow-sm"
                style={{
                  backgroundColor: tag.color,
                  color: getContrastColor(tag.color),
                }}
                onClick={handleClick}
              >
                {tag.name}
              </div>
            ))}
          </>
        ) : (
          <button
            onClick={handleClick}
            className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full border border-input text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            <Plus className="h-3 w-3" />
            Теги
          </button>
        )}
      </div>

      <ProjectTagSelector
        projectId={projectId}
        projectName={projectName}
        selectedTags={displayTags}
        onTagsChange={handleTagsChange}
        open={isOpen}
        onOpenChange={setIsOpen}
        anchorRef={containerRef}
      />
    </>
  )
}

'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Plus } from 'lucide-react'
import type { ProjectTag } from '../../types'
import { ProjectTagSelector } from './ProjectTagSelector'
import { useUserStore } from '@/stores/useUserStore'
import { useProjectTagsPermissions } from '@/modules/permissions/hooks/usePermissions'

interface ProjectTagDisplayProps {
  projectId: string
  projectName: string
  tags: ProjectTag[]
  managerId?: string | null
  leadEngineerId?: string | null
  onUpdate: () => void
}

export function ProjectTagDisplay({
  projectId,
  projectName,
  tags,
  managerId,
  leadEngineerId,
  onUpdate,
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
      <div className="flex items-center gap-1.5 flex-wrap">
        {displayTags.map((tag) => (
          <div
            key={tag.tag_id}
            className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full shadow-sm"
            style={{
              backgroundColor: tag.color,
              color: 'white',
              textShadow: '0 1px 1px rgba(0, 0, 0, 0.15)',
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
        className="flex items-center gap-1.5 flex-wrap"
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
                  color: 'white',
                  textShadow: '0 1px 1px rgba(0, 0, 0, 0.15)',
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
        onUpdate={onUpdate}
        onTagsChange={handleTagsChange}
        open={isOpen}
        onOpenChange={setIsOpen}
        anchorRef={containerRef}
      />
    </>
  )
}

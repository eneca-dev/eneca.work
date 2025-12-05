'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Tag } from 'lucide-react'
import { useTheme } from 'next-themes'
import type { ProjectTag } from '../../types'
import { ProjectTagSelector } from './ProjectTagSelector'
import { useUserStore } from '@/stores/useUserStore'
import { useProjectTagsPermissions } from '@/modules/permissions/hooks/usePermissions'
import { getTagStyles } from '../../utils/color'

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

  const currentUserId = useUserStore((state) => state.id)
  const { canAssignTagsAll, canAssignTagsManaged, canAssignTagsLead } = useProjectTagsPermissions()
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const canAssignTags =
    canAssignTagsAll ||
    (canAssignTagsManaged && currentUserId === managerId) ||
    (canAssignTagsLead && currentUserId === leadEngineerId)

  useEffect(() => {
    setDisplayTags(tags)
  }, [tags])

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsOpen(true)
  }

  const handleTagsChange = (newTags: ProjectTag[]) => {
    setDisplayTags(newTags)
  }

  // Компонент тега со стилем как у статусов + диагональные полоски
  const TagChip = ({ tag, interactive = false }: { tag: ProjectTag; interactive?: boolean }) => {
    const styles = getTagStyles(tag.color, isDark)
    return (
      <div
        className={`
          group/tag relative overflow-hidden inline-flex items-center gap-1
          px-2 py-0.5 text-[11px] font-medium
          rounded-md border
          transition-all duration-200 ease-out
          ${interactive ? 'cursor-pointer hover:shadow-sm active:scale-[0.98]' : ''}
        `}
        style={{
          backgroundColor: styles.backgroundColor,
          borderColor: styles.borderColor,
          color: styles.color,
        }}
        onClick={interactive ? handleClick : undefined}
      >
        {/* Diagonal stripes overlay */}
        <span
          className="absolute inset-0 pointer-events-none opacity-[0.08]"
          style={{
            backgroundImage: `repeating-linear-gradient(
              -45deg,
              ${styles.stripeColor},
              ${styles.stripeColor} 1px,
              transparent 1px,
              transparent 5px
            )`,
          }}
        />
        <span className="relative z-10">{tag.name}</span>
      </div>
    )
  }

  // Read-only view
  if (!canAssignTags) {
    if (displayTags.length === 0) return null

    return (
      <div className="flex items-center gap-1.5 flex-wrap mt-1">
        {displayTags.map((tag) => (
          <TagChip key={tag.tag_id} tag={tag} />
        ))}
      </div>
    )
  }

  return (
    <>
      <div
        ref={containerRef}
        className="flex items-center gap-1.5 flex-wrap mt-1"
        onClick={(e) => e.stopPropagation()}
      >
        {displayTags.length > 0 ? (
          displayTags.map((tag) => (
            <TagChip key={tag.tag_id} tag={tag} interactive />
          ))
        ) : (
          <button
            onClick={handleClick}
            className="
              group inline-flex items-center gap-1.5
              px-2.5 py-1 text-xs font-medium
              rounded-md
              border border-dashed border-muted-foreground/30
              text-muted-foreground
              bg-transparent
              hover:border-primary/50 hover:text-primary hover:bg-primary/5
              transition-all duration-200
              active:scale-[0.98]
            "
          >
            <Tag className="h-3 w-3 transition-transform group-hover:rotate-12" />
            <span>Добавить тег</span>
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

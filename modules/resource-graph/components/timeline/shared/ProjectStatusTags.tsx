'use client'

import { useTheme } from 'next-themes'
import type { ProjectStatusType, ProjectTag } from '../../../types'
import {
  getProjectStatusLabel,
  getProjectStatusBadgeClasses,
} from '@/modules/projects/constants/project-status'
import { getTagStyles } from '@/modules/projects/utils/color'

interface ProjectStatusTagsProps {
  /** Project status from DB */
  status: ProjectStatusType | null
  /** Project tags */
  tags?: ProjectTag[]
  /** Max number of tags to show (rest shown as +N) */
  maxTags?: number
}

/**
 * Compact display of project status and tags for resource-graph sidebar
 * Read-only version optimized for timeline rows
 */
export function ProjectStatusTags({
  status,
  tags = [],
  maxTags = 2,
}: ProjectStatusTagsProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const visibleTags = tags.slice(0, maxTags)
  const hiddenCount = tags.length - maxTags

  return (
    <div className="flex items-center gap-1.5 flex-shrink-0">
      {/* Status badge */}
      {status && (
        <span
          className={`
            px-1.5 py-0.5 text-[10px] font-medium
            rounded border whitespace-nowrap
            ${getProjectStatusBadgeClasses(status)}
          `}
        >
          {getProjectStatusLabel(status)}
        </span>
      )}

      {/* Tags */}
      {visibleTags.map((tag) => (
        <TagChip key={tag.id} tag={tag} isDark={isDark} />
      ))}

      {/* Hidden count */}
      {hiddenCount > 0 && (
        <span
          className="
            px-1 py-0.5 text-[10px] font-medium
            rounded bg-muted text-muted-foreground
            whitespace-nowrap
          "
          title={tags.slice(maxTags).map(t => t.name).join(', ')}
        >
          +{hiddenCount}
        </span>
      )}
    </div>
  )
}

interface TagChipProps {
  tag: ProjectTag
  isDark: boolean
}

/**
 * Single tag chip with diagonal stripes pattern
 */
function TagChip({ tag, isDark }: TagChipProps) {
  const styles = getTagStyles(tag.color || '#6b7280', isDark)

  return (
    <span
      className="
        relative overflow-hidden inline-flex items-center
        px-1.5 py-0.5 text-[10px] font-medium
        rounded border whitespace-nowrap
      "
      style={{
        backgroundColor: styles.backgroundColor,
        borderColor: styles.borderColor,
        color: styles.color,
      }}
      title={tag.name}
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
            transparent 4px
          )`,
        }}
      />
      <span className="relative z-10 truncate max-w-[60px]">{tag.name}</span>
    </span>
  )
}

'use client'

/**
 * OverviewTab - Вкладка с описанием и комментариями раздела
 */

import { useState, useRef, useCallback } from 'react'
import { UseFormReturn } from 'react-hook-form'
import { MessageSquare, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CommentsPanel } from '@/modules/comments/components/CommentsPanel'

// ============================================================================
// Types
// ============================================================================

interface OverviewTabProps {
  sectionId: string
  form: UseFormReturn<{
    name: string
    description?: string | undefined
    statusId?: string | null | undefined
    responsibleId?: string | null | undefined
    startDate?: string | null | undefined
    endDate?: string | null | undefined
  }>
  savingField: string | null
  onSaveDescription: (description: string | null) => Promise<void>
}

// ============================================================================
// Component
// ============================================================================

export function OverviewTab({
  sectionId,
  form,
  savingField,
  onSaveDescription,
}: OverviewTabProps) {
  const [isDescriptionFocused, setIsDescriptionFocused] = useState(false)
  const originalDescription = useRef<string>('')

  const handleDescriptionFocus = useCallback(() => {
    setIsDescriptionFocused(true)
    originalDescription.current = form.getValues('description') || ''
  }, [form])

  const handleDescriptionBlur = useCallback(async () => {
    setIsDescriptionFocused(false)
    const description = form.getValues('description')?.trim() || null
    const original = originalDescription.current || null
    if (description !== original) {
      await onSaveDescription(description)
    }
  }, [form, onSaveDescription])

  return (
    <div className="px-5 py-5 space-y-5">
      {/* Description */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label
            htmlFor="section-description"
            className="text-[10px] font-medium text-slate-400 uppercase tracking-wider"
          >
            Описание
          </label>
          {savingField === 'description' && (
            <div className="flex items-center gap-1.5 text-xs text-amber-400">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>Сохранение...</span>
            </div>
          )}
        </div>

        <div className="relative">
          <textarea
            id="section-description"
            {...form.register('description')}
            onFocus={handleDescriptionFocus}
            onBlur={handleDescriptionBlur}
            placeholder="Описание раздела..."
            disabled={savingField === 'description'}
            className={cn(
              'w-full px-4 py-3',
              'text-sm leading-relaxed',
              'bg-slate-800/30 rounded-xl',
              'border transition-all duration-200',
              'resize-none',
              'h-[140px]',
              'placeholder:text-slate-600',
              !isDescriptionFocused && 'border-slate-800/50 text-slate-300',
              isDescriptionFocused &&
                'border-amber-500/50 ring-2 ring-amber-500/15 text-slate-200 bg-slate-800/50',
              savingField === 'description' && 'opacity-60 cursor-wait'
            )}
            style={{
              wordBreak: 'break-word',
              overflowWrap: 'anywhere',
            }}
          />
          {isDescriptionFocused && (
            <div className="absolute bottom-2.5 right-3 text-[10px] text-slate-600">
              Esc для отмены
            </div>
          )}
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-slate-800/50" aria-hidden="true" />

      {/* Comments */}
      <section aria-labelledby="comments-heading">
        <div className="flex items-center gap-2 mb-3">
          <MessageSquare className="w-4 h-4 text-slate-500" aria-hidden="true" />
          <h3
            id="comments-heading"
            className="text-[10px] font-medium text-slate-400 uppercase tracking-wider"
          >
            Комментарии
          </h3>
        </div>
        <div className="bg-slate-800/20 rounded-xl border border-slate-800/40 overflow-hidden">
          <CommentsPanel
            sectionId={sectionId}
            autoScrollOnMount={false}
            autoScrollOnNewComment={true}
          />
        </div>
      </section>
    </div>
  )
}

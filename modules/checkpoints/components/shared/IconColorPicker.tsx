'use client'

import { useState } from 'react'
import * as LucideIcons from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { PRESET_COLORS, CHECKPOINT_ICONS } from './constants'
import type { IconColorPickerProps } from './types'

export function IconColorPicker({
  selectedIcon,
  selectedColor,
  onIconChange,
  onColorChange,
}: IconColorPickerProps) {
  const [open, setOpen] = useState(false)

  const IconComponent = (LucideIcons as unknown as Record<string, LucideIcon>)[selectedIcon]

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex items-center justify-center w-5 h-5 rounded hover:bg-amber-500/10 transition-colors"
        >
          {IconComponent && <IconComponent size={12} style={{ color: selectedColor }} />}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className={cn(
          'w-[320px] p-2 border',
          'bg-white border-slate-300',
          'dark:bg-slate-900 dark:border-slate-700'
        )}
        align="start"
      >
        {/* Выбор иконки */}
        <div className="space-y-2">
          <div className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
            Иконка
          </div>
          <ScrollArea className="h-[200px]">
            <div className="grid grid-cols-8 gap-1 p-1">
              {CHECKPOINT_ICONS.map((iconName) => {
                const IconComp = (LucideIcons as unknown as Record<string, LucideIcon>)[iconName]
                if (!IconComp) return null
                return (
                  <button
                    key={iconName}
                    type="button"
                    onClick={() => onIconChange(iconName)}
                    className={cn(
                      'p-1.5 rounded transition-colors border',
                      selectedIcon === iconName
                        ? 'bg-amber-500/20 border-amber-500/50'
                        : cn(
                            'border-transparent hover:bg-slate-100',
                            'dark:hover:bg-slate-800'
                          )
                    )}
                    title={iconName}
                  >
                    <IconComp
                      size={14}
                      color={selectedIcon === iconName ? selectedColor : '#94a3b8'}
                    />
                  </button>
                )
              })}
            </div>
          </ScrollArea>
        </div>

        {/* Выбор цвета */}
        <div
          className={cn(
            'mt-2 pt-2 space-y-2 border-t',
            'border-slate-200 dark:border-slate-700/50'
          )}
        >
          <div className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
            Цвет
          </div>
          <div className="grid grid-cols-10 gap-1.5">
            {PRESET_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => onColorChange(color)}
                className={cn(
                  'w-6 h-6 rounded-md border-2 transition-all',
                  selectedColor === color
                    ? 'border-amber-500 scale-110'
                    : 'border-transparent hover:border-slate-400 dark:hover:border-slate-500'
                )}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

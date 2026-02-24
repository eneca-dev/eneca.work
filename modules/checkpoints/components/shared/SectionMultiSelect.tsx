'use client'

import { useState, useMemo } from 'react'
import { X, Loader2, Check, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { SectionMultiSelectProps } from './types'

export function SectionMultiSelect({
  selectedIds,
  onChange,
  sections,
  excludeId,
  isLoading,
}: SectionMultiSelectProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  // Фильтрация: исключаем excludeId
  // Защита от undefined/null - sections может быть не загружен
  const availableSections = useMemo(() => {
    if (!sections || !Array.isArray(sections)) return []
    return sections.filter((s) => s.id !== excludeId)
  }, [sections, excludeId])

  // Поиск
  const filteredSections = useMemo(() => {
    if (!search) return availableSections
    const searchLower = search.toLowerCase()
    return availableSections.filter((s) => s.name.toLowerCase().includes(searchLower))
  }, [search, availableSections])

  // Выбранные разделы
  const selectedSections = useMemo(() => {
    return availableSections.filter((s) => selectedIds.includes(s.id))
  }, [availableSections, selectedIds])

  const toggleSection = (sectionId: string) => {
    if (selectedIds.includes(sectionId)) {
      onChange(selectedIds.filter((id) => id !== sectionId))
    } else {
      onChange([...selectedIds, sectionId])
    }
  }

  const removeSection = (sectionId: string) => {
    onChange(selectedIds.filter((id) => id !== sectionId))
  }

  return (
    <div className="space-y-1.5">
      {/* Selected chips */}
      {selectedSections.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedSections.map((section) => (
            <div
              key={section.id}
              className={cn(
                'flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border',
                'bg-amber-100 border-amber-300 text-amber-700',
                'dark:bg-amber-500/10 dark:border-amber-500/30 dark:text-amber-400'
              )}
            >
              <span className="truncate max-w-[100px]">{section.name}</span>
              <button
                type="button"
                onClick={() => removeSection(section.id)}
                className="p-0.5 hover:bg-amber-500/20 rounded"
              >
                <X size={8} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Trigger button */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={isLoading}
            className={cn(
              'w-full flex items-center justify-between px-2 py-1 text-[11px] rounded transition-colors border',
              'bg-white border-slate-300 text-slate-700',
              'hover:border-slate-400',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'dark:bg-slate-800/50 dark:border-slate-700 dark:text-slate-200',
              'dark:hover:border-slate-600'
            )}
          >
            {isLoading ? (
              <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                <Loader2 size={10} className="animate-spin" />
                <span className="text-[10px]">Загрузка...</span>
              </span>
            ) : (
              <span className="text-[10px] text-slate-500 dark:text-slate-400">
                {selectedIds.length > 0
                  ? `Выбрано: ${selectedIds.length}`
                  : 'Связанные разделы...'}
              </span>
            )}
            <ChevronDown size={10} className="text-slate-500 dark:text-slate-400" />
          </button>
        </PopoverTrigger>

        {/* Dropdown content */}
        <PopoverContent
          className={cn(
            'w-[260px] p-0 border',
            'bg-white border-slate-300',
            'dark:bg-slate-900 dark:border-slate-700'
          )}
          align="start"
        >
          <Command className="bg-transparent">
            <CommandInput
              placeholder="Поиск..."
              value={search}
              onValueChange={setSearch}
              className={cn(
                'text-[11px] border-b h-7',
                'text-slate-700 border-slate-200',
                'dark:text-slate-200 dark:border-slate-700'
              )}
            />
            <CommandList>
              <CommandEmpty className="py-3 text-center text-[10px] text-slate-400 dark:text-slate-500">
                Не найдено
              </CommandEmpty>
              <CommandGroup>
                <ScrollArea className="h-[140px]">
                  {filteredSections.map((section) => {
                    const isSelected = selectedIds.includes(section.id)
                    return (
                      <CommandItem
                        key={section.id}
                        value={section.id}
                        onSelect={() => toggleSection(section.id)}
                        className={cn(
                          'flex items-center gap-1.5 px-2 py-1 cursor-pointer text-[11px]',
                          isSelected && 'bg-amber-500/10'
                        )}
                      >
                        <div
                          className={cn(
                            'w-3 h-3 rounded border flex items-center justify-center shrink-0',
                            isSelected
                              ? 'bg-amber-500 border-amber-500'
                              : 'border-slate-400 bg-white dark:border-slate-600 dark:bg-slate-800/50'
                          )}
                        >
                          {isSelected && <Check size={8} className="text-slate-900" />}
                        </div>
                        <span className="truncate text-slate-700 dark:text-slate-200">
                          {section.name}
                        </span>
                      </CommandItem>
                    )
                  })}
                </ScrollArea>
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}

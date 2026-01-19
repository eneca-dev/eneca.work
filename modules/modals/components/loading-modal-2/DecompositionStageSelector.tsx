'use client'

/**
 * Селектор этапа декомпозиции для модалки создания загрузки
 */

import { Check, ChevronsUpDown, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useState } from 'react'
import { useDecompositionStages } from '../../hooks'

export interface DecompositionStageSelectorProps {
  /** ID раздела для загрузки этапов */
  sectionId: string | null
  /** Текущее значение */
  value: string
  /** Callback при изменении */
  onChange: (value: string) => void
  /** Сообщение об ошибке */
  error?: string
  /** Disabled состояние */
  disabled?: boolean
  /** Placeholder */
  placeholder?: string
}

export function DecompositionStageSelector({
  sectionId,
  value,
  onChange,
  error,
  disabled = false,
  placeholder = 'Выберите этап',
}: DecompositionStageSelectorProps) {
  const [open, setOpen] = useState(false)

  // Загрузка этапов декомпозиции
  const { data: stages = [], isLoading } = useDecompositionStages({
    sectionId,
    enabled: Boolean(sectionId),
  })

  const selectedStage = stages.find((s) => s.id === value)

  return (
    <div className="space-y-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled || !sectionId}
            className={cn(
              'w-full justify-between',
              error && 'border-red-500',
              !value && 'text-muted-foreground'
            )}
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {selectedStage ? selectedStage.name : placeholder}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[400px] p-0">
          <Command>
            <CommandInput placeholder="Поиск этапа..." />
            <CommandList>
              <CommandEmpty>Этапы не найдены</CommandEmpty>
              <CommandGroup>
                {stages.map((stage) => (
                  <CommandItem
                    key={stage.id}
                    value={stage.name}
                    onSelect={() => {
                      onChange(stage.id)
                      setOpen(false)
                    }}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        value === stage.id ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    <div className="flex-1">
                      <div className="font-medium">{stage.name}</div>
                      {stage.description && (
                        <div className="text-xs text-muted-foreground line-clamp-1">
                          {stage.description}
                        </div>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {error && <p className="text-sm text-red-500">{error}</p>}

      {!sectionId && !error && (
        <p className="text-xs text-muted-foreground">
          Сначала выберите раздел в дереве слева
        </p>
      )}

      {sectionId && stages.length === 0 && !isLoading && (
        <p className="text-xs text-amber-600 dark:text-amber-500">
          В этом разделе нет этапов декомпозиции
        </p>
      )}
    </div>
  )
}

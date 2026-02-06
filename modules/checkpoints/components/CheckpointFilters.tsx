'use client'

// MOCK DATA - prototype only
// Компонент фильтров чекпоинтов по типам и флагу проблемы

import { useMemo } from 'react'
import { AlertTriangle, Filter, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useCheckpointFilters } from '../stores/checkpoint-filter-store'
import { getIcon } from '../constants/icon-map'
import type { CheckpointType } from '../actions/checkpoint-types'
import type { Checkpoint } from '../actions/checkpoints'

interface CheckpointFiltersProps {
  /** Доступные типы чекпоинтов */
  checkpointTypes: CheckpointType[]
  /** Все чекпоинты (для подсчета) */
  checkpoints: Checkpoint[]
  /** Отфильтрованные чекпоинты (для подсчета) */
  filteredCheckpoints: Checkpoint[]
}

export function CheckpointFilters({
  checkpointTypes,
  checkpoints,
  filteredCheckpoints,
}: CheckpointFiltersProps) {
  const { selectedTypeIds, showProblemsOnly, setSelectedTypes, toggleProblemsOnly, resetFilters } =
    useCheckpointFilters()

  // Есть ли активные фильтры
  const hasActiveFilters = selectedTypeIds.length > 0 || showProblemsOnly

  // Toggle выбора типа
  const toggleType = (typeId: string) => {
    if (selectedTypeIds.includes(typeId)) {
      setSelectedTypes(selectedTypeIds.filter((id) => id !== typeId))
    } else {
      setSelectedTypes([...selectedTypeIds, typeId])
    }
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-background/50 border-b border-border">
      {/* Dropdown фильтр по типам */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 gap-2">
            <Filter className="h-3.5 w-3.5" />
            <span className="text-xs">
              Типы
              {selectedTypeIds.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded bg-primary/20 text-primary">
                  {selectedTypeIds.length}
                </span>
              )}
            </span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[280px]">
          <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
            Фильтр по типам
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <div className="max-h-[300px] overflow-y-auto">
            {checkpointTypes.map((type) => {
              const Icon = getIcon(type.icon)
              const isSelected = selectedTypeIds.includes(type.type_id)

              return (
                <DropdownMenuItem
                  key={type.type_id}
                  className="flex items-center gap-2 cursor-pointer"
                  onSelect={(e) => {
                    e.preventDefault()
                    toggleType(type.type_id)
                  }}
                >
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => toggleType(type.type_id)}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: type.color }}
                  />
                  <Icon
                    className="flex-shrink-0"
                    size={14}
                    style={{ color: type.color }}
                  />
                  <span className="text-xs flex-1">{type.name}</span>
                </DropdownMenuItem>
              )
            })}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Чекбокс "Только проблемные" */}
      <Button
        variant={showProblemsOnly ? 'default' : 'outline'}
        size="sm"
        className="h-8 gap-2"
        onClick={toggleProblemsOnly}
      >
        <AlertTriangle className="h-3.5 w-3.5" />
        <span className="text-xs">Только проблемные</span>
      </Button>

      {/* Кнопка сброса фильтров */}
      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5"
          onClick={resetFilters}
        >
          <X className="h-3.5 w-3.5" />
          <span className="text-xs">Сбросить</span>
        </Button>
      )}

      {/* Счетчик чекпоинтов */}
      <div className="ml-auto text-xs text-muted-foreground tabular-nums">
        {filteredCheckpoints.length} / {checkpoints.length} чекпоинтов
      </div>
    </div>
  )
}

'use client'

import { useMemo } from 'react'
import { Flag, Check, CircleDashed, type LucideIcon } from 'lucide-react'
import * as LucideIcons from 'lucide-react'
import { cn } from '@/lib/utils'
import { IconColorPicker } from './IconColorPicker'
import type { CheckpointTypeSelectorProps } from './types'

export function CheckpointTypeSelector({
  types,
  selectedTypeId,
  onSelect,
  customIcon,
  customColor,
  onCustomIconChange,
  onCustomColorChange,
  isLoading,
}: CheckpointTypeSelectorProps) {
  const selectedType = useMemo(() => {
    return types.find((t) => t.type_id === selectedTypeId)
  }, [types, selectedTypeId])

  if (isLoading) {
    return <div className="text-xs text-slate-500 dark:text-slate-400">Загрузка типов...</div>
  }

  return (
    <div className="space-y-1.5">
      <div className="grid grid-cols-2 gap-1.5">
        {types.map((type) => {
          const isSelected = selectedTypeId === type.type_id
          const IconComponent =
            (LucideIcons as unknown as Record<string, LucideIcon>)[type.icon] || Flag

          // Кастомный тип - особое отображение
          if (type.is_custom) {
            const CustomIconComponent =
              (LucideIcons as unknown as Record<string, LucideIcon>)[customIcon] || Flag

            return (
              <div
                key={type.type_id}
                className={cn(
                  'col-span-2 flex items-center gap-1 px-1.5 py-1 rounded-md',
                  'border-2 border-dashed transition-all duration-150',
                  !isSelected &&
                    cn(
                      'border-slate-300 bg-white',
                      'hover:border-slate-400 hover:bg-slate-50',
                      'dark:border-slate-600 dark:bg-slate-800/30',
                      'dark:hover:border-slate-500 dark:hover:bg-slate-800/50'
                    )
                )}
                style={
                  isSelected
                    ? {
                        borderColor: `${customColor}80`,
                        backgroundColor: `${customColor}10`,
                      }
                    : undefined
                }
              >
                {/* Левая часть - иконка с выпадающим списком */}
                {isSelected ? (
                  <IconColorPicker
                    selectedIcon={customIcon}
                    selectedColor={customColor}
                    onIconChange={onCustomIconChange}
                    onColorChange={onCustomColorChange}
                  />
                ) : (
                  <div className="flex items-center justify-center w-5 h-5">
                    <CircleDashed size={10} className="text-slate-400 dark:text-slate-500" />
                  </div>
                )}

                {/* Средняя часть - кнопка выбора типа */}
                <button
                  type="button"
                  onClick={() => onSelect(type.type_id)}
                  className="flex items-center min-w-0 flex-1"
                >
                  <span
                    className={cn(
                      'truncate text-[9px] font-medium',
                      !isSelected && 'text-slate-600 dark:text-slate-400'
                    )}
                    style={isSelected ? { color: customColor } : undefined}
                  >
                    Создать свой тип
                  </span>
                </button>
              </div>
            )
          }

          // Обычный тип
          return (
            <button
              key={type.type_id}
              type="button"
              onClick={() => onSelect(type.type_id)}
              className={cn(
                'flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium',
                'border transition-all duration-150',
                isSelected
                  ? 'shadow-sm'
                  : cn(
                      'border-slate-200 bg-white text-slate-700',
                      'hover:border-slate-300 hover:shadow-sm',
                      'dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-300',
                      'dark:hover:border-slate-600 dark:hover:bg-slate-800/60'
                    )
              )}
              style={
                isSelected
                  ? {
                      borderColor: `${type.color}60`,
                      backgroundColor: `${type.color}10`,
                      color: type.color,
                    }
                  : undefined
              }
            >
              <IconComponent
                size={12}
                className="shrink-0"
                style={{ color: type.color || '#6b7280' }}
              />
              <span className="truncate">{type.name}</span>
              {isSelected && <Check className="w-3 h-3 ml-0.5 shrink-0" style={{ color: type.color }} />}
            </button>
          )
        })}
      </div>

      {/* Подсказка для кастомного типа */}
      {selectedType?.is_custom && (
        <div className="text-[9px] text-slate-500 dark:text-slate-400 italic">
          Кликните на иконку, чтобы её сменить
        </div>
      )}
    </div>
  )
}

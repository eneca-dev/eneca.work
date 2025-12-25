import type { CheckpointType } from '@/modules/checkpoints/actions/checkpoint-types'

/**
 * Опция раздела для мультиселекта
 */
export interface SectionOption {
  id: string
  name: string
  objectId: string | null
}

/**
 * Пропсы для CheckpointTypeSelector
 */
export interface CheckpointTypeSelectorProps {
  /** Список доступных типов чекпоинтов */
  types: CheckpointType[]
  /** ID выбранного типа */
  selectedTypeId: string
  /** Callback при выборе типа */
  onSelect: (typeId: string) => void
  /** Иконка для кастомного типа */
  customIcon: string
  /** Цвет для кастомного типа */
  customColor: string
  /** Callback при изменении иконки кастомного типа */
  onCustomIconChange: (icon: string) => void
  /** Callback при изменении цвета кастомного типа */
  onCustomColorChange: (color: string) => void
  /** Флаг загрузки */
  isLoading?: boolean
}

/**
 * Пропсы для IconColorPicker
 */
export interface IconColorPickerProps {
  /** Выбранная иконка */
  selectedIcon: string
  /** Выбранный цвет */
  selectedColor: string
  /** Callback при изменении иконки */
  onIconChange: (icon: string) => void
  /** Callback при изменении цвета */
  onColorChange: (color: string) => void
  /** Controlled open state */
  open?: boolean
  /** Callback for open state change */
  onOpenChange?: (open: boolean) => void
  /** Custom trigger render function */
  renderTrigger?: (props: { icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }> | undefined; color: string }) => React.ReactNode
}

/**
 * Пропсы для SectionMultiSelect
 */
export interface SectionMultiSelectProps {
  /** Массив ID выбранных разделов */
  selectedIds: string[]
  /** Callback при изменении выбора */
  onChange: (ids: string[]) => void
  /** Доступные разделы для выбора */
  sections: SectionOption[]
  /** ID раздела, который нужно исключить из списка */
  excludeId?: string
  /** Флаг загрузки */
  isLoading?: boolean
}

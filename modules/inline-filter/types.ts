/**
 * Модуль inline-filter
 * Типы для инлайн-фильтров в стиле GitHub Projects
 */

import type { LucideIcon } from 'lucide-react'

/**
 * Конфигурация одного ключа фильтра
 */
export interface FilterKeyConfig {
  /** Поле в БД (subdivision_id, project_id, etc.) */
  field: string
  /** Отображаемое имя для автокомплита */
  label?: string
  /** Можно ли несколько значений (для меток) */
  multiple?: boolean

  // === Визуальные настройки ===
  /** Иконка для ключа (Lucide icon component) */
  icon?: LucideIcon
  /** Цвет ключа: 'violet' | 'blue' | 'amber' | 'emerald' | 'rose' | 'cyan' | 'gray' */
  color?: FilterKeyColor
}

/**
 * Доступные цвета для ключей фильтров
 */
export type FilterKeyColor = 'violet' | 'blue' | 'amber' | 'emerald' | 'rose' | 'cyan' | 'gray'

/**
 * Конфигурация фильтра (передаётся в компонент)
 */
export interface FilterConfig {
  /** Маппинг ключей: 'подразделение' -> config */
  keys: Record<string, FilterKeyConfig>
  /** Placeholder для инпута */
  placeholder?: string
}

/**
 * Один распарсенный токен
 */
export interface ParsedToken {
  /** Ключ фильтра ('подразделение', 'проект', etc.) */
  key: string
  /** Значение фильтра */
  value: string
  /** Исходная строка токена ('подразделение:"ОВ"') */
  raw: string
}

/**
 * Результат парсинга строки фильтров
 */
export interface ParsedFilter {
  /** Распарсенные токены */
  tokens: ParsedToken[]
  /** Исходная строка */
  raw: string
}

/**
 * Опция для автокомплита
 */
export interface FilterOption {
  /** ID записи */
  id: string
  /** Отображаемое имя */
  name: string
  /** К какому ключу относится ('подразделение', 'проект', etc.) */
  key: string
}

/**
 * Параметры запроса после преобразования токенов
 */
export type FilterQueryParams = Record<string, string | string[]>

/**
 * Модуль inline-filter
 *
 * Инлайн-фильтры в стиле GitHub Projects
 * Синтаксис: ключ:"значение" или ключ:значение
 *
 * @example
 * import { InlineFilter, useInlineFilter, parseFilterString } from '@/modules/inline-filter'
 *
 * const config = {
 *   keys: {
 *     'подразделение': { field: 'subdivision_id', label: 'Подразделение' },
 *     'проект': { field: 'project_id', label: 'Проект' },
 *     'метка': { field: 'tag_id', label: 'Метка', multiple: true },
 *   }
 * }
 *
 * // Компонент
 * <InlineFilter
 *   config={config}
 *   value={filter}
 *   onChange={setFilter}
 *   options={filterOptions}
 * />
 *
 * // Хук для управления состоянием
 * const { value, parsedTokens, queryParams, addToken, removeToken } = useInlineFilter({ config })
 */

// Types
export type {
  FilterConfig,
  FilterKeyConfig,
  ParsedToken,
  ParsedFilter,
  FilterOption,
  FilterQueryParams,
} from './types'

// Parser utilities
export {
  parseFilterString,
  serializeFilter,
  tokensToQueryParams,
  addOrUpdateToken,
  removeToken,
  hasActiveFilters,
  getValuesForKey,
} from './parser'

// Components
export { InlineFilter } from './components'
export type { InlineFilterProps } from './components'

// Hooks
export { useInlineFilter } from './hooks'
export type { UseInlineFilterOptions, UseInlineFilterReturn } from './hooks'

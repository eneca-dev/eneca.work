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
  FilterValueType,
  FilterOperator,
  FilterEnumValue,
  FilterKeyColor,
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

// Internal components (for advanced usage - not recommended for general use)
export { FilterSuggestions, COLOR_MAP, DEFAULT_COLOR } from './components'
export type { FilterSuggestion, FilterSuggestionsProps } from './components'

// Hooks
export { useInlineFilter, useFilterContext } from './hooks'
export type { UseInlineFilterOptions, UseInlineFilterReturn, FilterInputContext, UseFilterContextOptions } from './hooks'

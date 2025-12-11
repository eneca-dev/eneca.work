/**
 * Модуль inline-filter
 *
 * Инлайн-фильтры в стиле GitHub Projects
 * Синтаксис: ключ:"значение" или ключ:значение
 *
 * @example
 * import { parseFilterString, InlineFilter } from '@/modules/inline-filter'
 *
 * const config = {
 *   keys: {
 *     'подразделение': { field: 'subdivision_id' },
 *     'проект': { field: 'project_id' },
 *     'метка': { field: 'tag_id', multiple: true },
 *   }
 * }
 *
 * // Парсинг
 * const parsed = parseFilterString('подразделение:"ОВ"', config)
 *
 * // Компонент
 * <InlineFilter config={config} value={filter} onChange={setFilter} />
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

import { assertEmploymentBoardDate } from './board-date'

interface LoadingFilterQuery<T> {
  eq(column: string, value: string | boolean): T
  lte(column: string, value: string): T
  gte(column: string, value: string): T
}

/** Единый контракт серверных фильтров загрузок для выбранного дня. */
export function applyEmploymentBoardLoadingFilters<
  T extends LoadingFilterQuery<T>,
>(query: T, selectedDate: string): T {
  assertEmploymentBoardDate(selectedDate)
  return query
    .eq('loading_status', 'active')
    .eq('is_shortage', false)
    .lte('loading_start', selectedDate)
    .gte('loading_finish', selectedDate)
}

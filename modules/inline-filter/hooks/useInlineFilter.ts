/**
 * Хук для работы с инлайн-фильтром
 */

import { useState, useMemo, useCallback } from 'react'
import type { FilterConfig, ParsedToken, FilterQueryParams } from '../types'
import {
  parseFilterString,
  serializeFilter,
  tokensToQueryParams,
  hasActiveFilters,
  addOrUpdateToken,
  removeToken as removeTokenUtil,
} from '../parser'

export interface UseInlineFilterOptions {
  config: FilterConfig
  initialValue?: string
  onChange?: (value: string) => void
}

export interface UseInlineFilterReturn {
  /** Текущая строка фильтра */
  value: string
  /** Установить строку фильтра */
  setValue: (value: string) => void
  /** Распарсенные токены */
  parsedTokens: ParsedToken[]
  /** Параметры для запроса к БД */
  queryParams: FilterQueryParams
  /** Есть ли активные фильтры */
  hasFilters: boolean
  /** Очистить все фильтры */
  clear: () => void
  /** Добавить или обновить токен */
  addToken: (key: string, value: string) => void
  /** Удалить токен */
  removeToken: (key: string, value?: string | null) => void
}

export function useInlineFilter({
  config,
  initialValue = '',
  onChange,
}: UseInlineFilterOptions): UseInlineFilterReturn {
  const [value, setValueInternal] = useState(initialValue)

  const setValue = useCallback(
    (newValue: string) => {
      setValueInternal(newValue)
      onChange?.(newValue)
    },
    [onChange]
  )

  const parsedTokens = useMemo(
    () => parseFilterString(value, config).tokens,
    [value, config]
  )

  const queryParams = useMemo(
    () => tokensToQueryParams(parsedTokens, config),
    [parsedTokens, config]
  )

  const hasFilters = useMemo(
    () => hasActiveFilters(value, config),
    [value, config]
  )

  const clear = useCallback(() => {
    setValue('')
  }, [setValue])

  const addToken = useCallback(
    (key: string, tokenValue: string) => {
      const newValue = addOrUpdateToken(value, key, tokenValue, config)
      setValue(newValue)
    },
    [value, config, setValue]
  )

  const removeToken = useCallback(
    (key: string, tokenValue?: string | null) => {
      const newValue = removeTokenUtil(value, key, tokenValue ?? null, config)
      setValue(newValue)
    },
    [value, config, setValue]
  )

  return {
    value,
    setValue,
    parsedTokens,
    queryParams,
    hasFilters,
    clear,
    addToken,
    removeToken,
  }
}

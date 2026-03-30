/**
 * Модуль inline-filter
 * Парсер и сериализатор строки фильтров
 */

import type { FilterConfig, ParsedToken, ParsedFilter, FilterQueryParams } from './types'

// ============================================================================
// Константы
// ============================================================================

/** Максимальное количество токенов в строке фильтра */
export const MAX_TOKENS = 20

/** Максимальная длина значения фильтра */
export const MAX_VALUE_LENGTH = 500

/** Максимальная длина всей строки фильтра */
export const MAX_FILTER_STRING_LENGTH = 2000

// ============================================================================
// Регулярные выражения
// ============================================================================

/**
 * Регулярное выражение для парсинга токенов
 * Матчит: ключ:"значение с пробелами" или ключ:значение
 * Также поддерживает исключающий префикс: -ключ:"значение"
 *
 * Группы:
 * 1 - опциональный минус (исключающий фильтр)
 * 2 - ключ (все символы до двоеточия)
 * 3 - значение в кавычках (без кавычек)
 * 4 - значение без кавычек
 *
 * @internal Используется только внутри модуля
 */
const TOKEN_REGEX = /(-?)([^\s:]+):(?:"([^"]+)"|([^\s]+))/g

// ============================================================================
// Вспомогательные функции
// ============================================================================

/**
 * Экранирует специальные символы в значении фильтра
 *
 * @internal
 */
function escapeFilterValue(value: string): string {
  // Экранируем обратные слеши и кавычки
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

/**
 * Разэкранирует специальные символы в значении фильтра
 *
 * @internal
 */
function unescapeFilterValue(value: string): string {
  // Разэкранируем кавычки и обратные слеши
  return value.replace(/\\"/g, '"').replace(/\\\\/g, '\\')
}

// ============================================================================
// Основные функции
// ============================================================================

/**
 * Парсит строку фильтров в структурированный объект
 *
 * Включает защиту от слишком длинных строк и большого количества токенов.
 *
 * @example
 * parseFilterString('подразделение:"ОВ" проект:Солнечный', config)
 * // { tokens: [{ key: 'подразделение', value: 'ОВ', raw: 'подразделение:"ОВ"' }, ...], raw: '...' }
 */
export function parseFilterString(input: string, config: FilterConfig): ParsedFilter {
  const tokens: ParsedToken[] = []

  // Защита от слишком длинных строк
  const trimmedInput = input.trim().slice(0, MAX_FILTER_STRING_LENGTH)

  if (!trimmedInput) {
    return { tokens: [], raw: '' }
  }

  // Получаем список допустимых ключей
  const validKeys = new Set(Object.keys(config.keys))

  let match: RegExpExecArray | null
  // Сбрасываем lastIndex перед использованием (важно для глобального regex)
  TOKEN_REGEX.lastIndex = 0

  while ((match = TOKEN_REGEX.exec(trimmedInput)) !== null) {
    // Лимит на количество токенов
    if (tokens.length >= MAX_TOKENS) break

    const negated = match[1] === '-'
    const key = match[2]
    const rawValue = match[3] ?? match[4] // Значение в кавычках или без
    // Разэкранируем значение для правильного round-trip
    const value = rawValue ? unescapeFilterValue(rawValue) : ''

    // Игнорируем неизвестные ключи
    if (!validKeys.has(key)) {
      continue
    }

    // Игнорируем слишком длинные значения
    if (value.length > MAX_VALUE_LENGTH) {
      continue
    }

    tokens.push({
      key,
      value,
      raw: match[0],
      negated,
    })
  }

  return {
    tokens,
    raw: trimmedInput,
  }
}

/**
 * Сериализует токены обратно в строку
 *
 * - Автоматически добавляет кавычки если значение содержит пробелы или спецсимволы
 * - Экранирует кавычки внутри значений
 *
 * @example
 * serializeFilter([{ key: 'подразделение', value: 'ОВ и К' }])
 * // 'подразделение:"ОВ и К"'
 *
 * @example
 * serializeFilter([{ key: 'проект', value: 'Тест "Альфа"' }])
 * // 'проект:"Тест \"Альфа\""'
 */
export function serializeFilter(tokens: ParsedToken[]): string {
  return tokens
    .map((token) => {
      const hasSpaces = token.value.includes(' ')
      const hasQuotes = token.value.includes('"')
      const hasBackslash = token.value.includes('\\')
      const prefix = token.negated ? '-' : ''

      // Нужны кавычки если есть пробелы или спецсимволы
      const needsQuotes = hasSpaces || hasQuotes || hasBackslash

      if (needsQuotes) {
        const escapedValue = escapeFilterValue(token.value)
        return `${prefix}${token.key}:"${escapedValue}"`
      }

      return `${prefix}${token.key}:${token.value}`
    })
    .join(' ')
}

/**
 * Преобразует токены в объект параметров для запроса к БД
 *
 * @example
 * tokensToQueryParams([{ key: 'подразделение', value: 'ОВ' }], config)
 * // { subdivision_id: 'ОВ' }
 *
 * Для ключей с multiple: true значения собираются в массив
 */
export function tokensToQueryParams(
  tokens: ParsedToken[],
  config: FilterConfig
): FilterQueryParams {
  const params: FilterQueryParams = {}

  for (const token of tokens) {
    const keyConfig = config.keys[token.key]
    if (!keyConfig) continue

    // Исключающие фильтры используют префикс "!" в ключе параметра
    const field = token.negated ? `!${keyConfig.field}` : keyConfig.field

    const existing = params[field]
    if (existing !== undefined) {
      // Уже есть значение — собираем в массив (иммутабельно)
      params[field] = Array.isArray(existing)
        ? [...existing, token.value]
        : [existing, token.value]
    } else {
      params[field] = token.value
    }
  }

  return params
}

/**
 * Добавляет или обновляет токен в строке фильтра
 */
export function addOrUpdateToken(
  currentFilter: string,
  key: string,
  value: string,
  config: FilterConfig,
  negated?: boolean,
): string {
  const parsed = parseFilterString(currentFilter, config)
  const keyConfig = config.keys[key]

  if (!keyConfig) return currentFilter

  const isNegated = negated ?? false

  if (keyConfig.multiple) {
    // Для множественных — добавляем новый токен
    const newToken: ParsedToken = { key, value, raw: '', negated: isNegated }
    return serializeFilter([...parsed.tokens, newToken])
  } else {
    // Для одиночных — заменяем существующий с тем же negated или добавляем
    const existingIndex = parsed.tokens.findIndex((t) => t.key === key && !!t.negated === isNegated)
    const newToken: ParsedToken = { key, value, raw: '', negated: isNegated }

    if (existingIndex >= 0) {
      const newTokens = [...parsed.tokens]
      newTokens[existingIndex] = newToken
      return serializeFilter(newTokens)
    } else {
      return serializeFilter([...parsed.tokens, newToken])
    }
  }
}

/**
 * Удаляет токен из строки фильтра
 */
export function removeToken(
  currentFilter: string,
  key: string,
  value: string | null,
  config: FilterConfig
): string {
  const parsed = parseFilterString(currentFilter, config)

  const newTokens = parsed.tokens.filter((t) => {
    if (t.key !== key) return true
    // Если value указан, удаляем только конкретное значение
    if (value !== null) return t.value !== value
    // Если value не указан, удаляем все токены с этим ключом
    return false
  })

  return serializeFilter(newTokens)
}

/**
 * Проверяет, есть ли активные фильтры
 */
export function hasActiveFilters(input: string, config: FilterConfig): boolean {
  const parsed = parseFilterString(input, config)
  return parsed.tokens.length > 0
}

/**
 * Получает значения для конкретного ключа
 */
export function getValuesForKey(
  input: string,
  key: string,
  config: FilterConfig
): string[] {
  const parsed = parseFilterString(input, config)
  return parsed.tokens.filter((t) => t.key === key).map((t) => t.value)
}

/**
 * Извлекает значение исключающего фильтра из query params (первое значение)
 *
 * @example
 * getNegatedParam(params, 'project_id') // → 'uuid' | undefined
 */
export function getNegatedParam(
  params: FilterQueryParams | undefined,
  field: string
): string | undefined {
  if (!params) return undefined
  const val = params[`!${field}`]
  if (!val) return undefined
  return Array.isArray(val) ? val[0] : val
}

/**
 * Извлекает ВСЕ значения исключающего фильтра из query params
 *
 * @example
 * getNegatedParams(params, 'department_id') // → ['КР гражд', 'БИМ отдел'] | []
 */
export function getNegatedParams(
  params: FilterQueryParams | undefined,
  field: string
): string[] {
  if (!params) return []
  const val = params[`!${field}`]
  if (!val) return []
  return Array.isArray(val) ? val : [val]
}

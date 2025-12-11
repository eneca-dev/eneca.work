/**
 * Модуль inline-filter
 * Парсер и сериализатор строки фильтров
 */

import type { FilterConfig, ParsedToken, ParsedFilter, FilterQueryParams } from './types'

/**
 * Регулярное выражение для парсинга токенов
 * Матчит: ключ:"значение с пробелами" или ключ:значение
 *
 * Группы:
 * 1 - ключ (все символы до двоеточия)
 * 2 - значение в кавычках (без кавычек)
 * 3 - значение без кавычек
 */
const TOKEN_REGEX = /([^\s:]+):(?:"([^"]+)"|([^\s]+))/g

/**
 * Парсит строку фильтров в структурированный объект
 *
 * @example
 * parseFilterString('подразделение:"ОВ" проект:Солнечный', config)
 * // { tokens: [{ key: 'подразделение', value: 'ОВ', raw: 'подразделение:"ОВ"' }, ...], raw: '...' }
 */
export function parseFilterString(input: string, config: FilterConfig): ParsedFilter {
  const tokens: ParsedToken[] = []
  const trimmedInput = input.trim()

  if (!trimmedInput) {
    return { tokens: [], raw: '' }
  }

  // Получаем список допустимых ключей
  const validKeys = new Set(Object.keys(config.keys))

  let match: RegExpExecArray | null
  // Сбрасываем lastIndex перед использованием
  TOKEN_REGEX.lastIndex = 0

  while ((match = TOKEN_REGEX.exec(trimmedInput)) !== null) {
    const key = match[1]
    const value = match[2] ?? match[3] // Значение в кавычках или без

    // Игнорируем неизвестные ключи
    if (!validKeys.has(key)) {
      continue
    }

    tokens.push({
      key,
      value,
      raw: match[0],
    })
  }

  return {
    tokens,
    raw: trimmedInput,
  }
}

/**
 * Сериализует токены обратно в строку
 * Автоматически добавляет кавычки если значение содержит пробелы
 *
 * @example
 * serializeFilter([{ key: 'подразделение', value: 'ОВ и К' }])
 * // 'подразделение:"ОВ и К"'
 */
export function serializeFilter(tokens: ParsedToken[]): string {
  return tokens
    .map((token) => {
      const needsQuotes = token.value.includes(' ')
      const value = needsQuotes ? `"${token.value}"` : token.value
      return `${token.key}:${value}`
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

    const field = keyConfig.field

    if (keyConfig.multiple) {
      // Для множественных значений собираем в массив
      const existing = params[field]
      if (Array.isArray(existing)) {
        existing.push(token.value)
      } else if (typeof existing === 'string') {
        params[field] = [existing, token.value]
      } else {
        params[field] = [token.value]
      }
    } else {
      // Для одиночных значений перезаписываем (последнее значение побеждает)
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
  config: FilterConfig
): string {
  const parsed = parseFilterString(currentFilter, config)
  const keyConfig = config.keys[key]

  if (!keyConfig) return currentFilter

  if (keyConfig.multiple) {
    // Для множественных — добавляем новый токен
    const newToken: ParsedToken = { key, value, raw: '' }
    return serializeFilter([...parsed.tokens, newToken])
  } else {
    // Для одиночных — заменяем существующий или добавляем
    const existingIndex = parsed.tokens.findIndex((t) => t.key === key)
    const newToken: ParsedToken = { key, value, raw: '' }

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

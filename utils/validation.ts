export interface ValidationResult {
  isValid: boolean
  errors: string[]
  normalizedValue: string
}

/**
 * Валидация названий сущностей (отделы, команды, должности, категории, роли)
 */
export function validateEntityName(value: string): ValidationResult {
  const errors: string[] = []
  let normalizedValue = value

  // 1. Проверка на пустоту
  if (!value || value.trim().length === 0) {
    errors.push("Название не может быть пустым")
    return { isValid: false, errors, normalizedValue: "" }
  }

  // 2. Нормализация пробелов
  normalizedValue = value
    .trim() // убираем ведущие и завершающие пробелы
    .replace(/\s+/g, ' ') // заменяем множественные пробелы на одинарные

  // 3. Проверка длины
  if (normalizedValue.length < 2) {
    errors.push("Название должно содержать минимум 2 символа")
  }

  if (normalizedValue.length > 40) {
    errors.push("Название не может быть длиннее 40 символов")
  }

  // 4. Проверка алфавита (кириллица + цифры + пробелы + дефисы)
  const allowedPattern = /^[А-Яа-яЁё0-9\s\-]+$/
  if (!allowedPattern.test(normalizedValue)) {
    errors.push("Название должно содержать только русские буквы, цифры, пробелы и дефисы")
  }

  return {
    isValid: errors.length === 0,
    errors,
    normalizedValue
  }
}

/**
 * Проверка дубликатов названий
 */
export function checkDuplicateName(
  value: string,
  existingNames: string[],
  excludeName?: string
): boolean {
  // Более тщательная нормализация: убираем все пробелы и приводим к нижнему регистру
  const normalizedValue = value.trim().toLowerCase().replace(/\s+/g, '')
  
  return existingNames.some(name => {
    const normalizedExisting = name.trim().toLowerCase().replace(/\s+/g, '')
    
    // Исключаем текущее значение при редактировании
    if (excludeName) {
      const normalizedExclude = excludeName.trim().toLowerCase().replace(/\s+/g, '')
      if (normalizedExisting === normalizedExclude) {
        return false
      }
    }
    
    return normalizedExisting === normalizedValue
  })
}

/**
 * Валидация названий ролей (разрешены любые символы, только минимальная длина)
 */
export function validateRoleName(value: string): ValidationResult {
  const errors: string[] = []
  let normalizedValue = value

  // 1. Проверка на пустоту
  if (!value || value.trim().length === 0) {
    errors.push("Название не может быть пустым")
    return { isValid: false, errors, normalizedValue: "" }
  }

  // 2. Нормализация пробелов
  normalizedValue = value
    .trim() // убираем ведущие и завершающие пробелы
    .replace(/\s+/g, ' ') // заменяем множественные пробелы на одинарные

  // 3. Проверка минимальной длины
  if (normalizedValue.length < 2) {
    errors.push("Название должно содержать минимум 2 символа")
  }

  return {
    isValid: errors.length === 0,
    errors,
    normalizedValue
  }
}

/**
 * Валидация названий категорий (минимум 1 символ)
 */
export function validateCategoryName(value: string): ValidationResult {
  const errors: string[] = []
  let normalizedValue = value

  // 1. Проверка на пустоту
  if (!value || value.trim().length === 0) {
    errors.push("Название не может быть пустым")
    return { isValid: false, errors, normalizedValue: "" }
  }

  // 2. Нормализация пробелов
  normalizedValue = value
    .trim() // убираем ведущие и завершающие пробелы
    .replace(/\s+/g, ' ') // заменяем множественные пробелы на одинарные

  // 3. Проверка минимальной длины (для категорий - 1 символ)
  if (normalizedValue.length < 1) {
    errors.push("Название должно содержать минимум 1 символ")
  }

  // 4. Проверка максимальной длины
  if (normalizedValue.length > 20) {
    errors.push("Название не может быть длиннее 20 символов")
  }

  // 5. Проверка алфавита (кириллица + цифры + пробелы + дефисы)
  const allowedPattern = /^[А-Яа-яЁё0-9\s\-]+$/
  if (!allowedPattern.test(normalizedValue)) {
    errors.push("Название должно содержать только русские буквы, цифры, пробелы и дефисы")
  }

  return {
    isValid: errors.length === 0,
    errors,
    normalizedValue
  }
}

/**
 * Валидация названий должностей (минимум 5 символов)
 */
export function validatePositionName(value: string): ValidationResult {
  const errors: string[] = []
  let normalizedValue = value

  // 1. Проверка на пустоту
  if (!value || value.trim().length === 0) {
    errors.push("Название не может быть пустым")
    return { isValid: false, errors, normalizedValue: "" }
  }

  // 2. Нормализация пробелов
  normalizedValue = value
    .trim() // убираем ведущие и завершающие пробелы
    .replace(/\s+/g, ' ') // заменяем множественные пробелы на одинарные

  // 3. Проверка минимальной длины (для должностей - 5 символов)
  if (normalizedValue.length < 5) {
    errors.push("Название должно содержать минимум 5 символов")
  }

  // 4. Проверка максимальной длины
  if (normalizedValue.length > 20) {
    errors.push("Название не может быть длиннее 20 символов")
  }

  // 5. Проверка алфавита (кириллица + цифры + пробелы + дефисы)
  const allowedPattern = /^[А-Яа-яЁё0-9\s\-]+$/
  if (!allowedPattern.test(normalizedValue)) {
    errors.push("Название должно содержать только русские буквы, цифры, пробелы и дефисы")
  }

  return {
    isValid: errors.length === 0,
    errors,
    normalizedValue
  }
}

/**
 * Получить сообщение об ошибке дубликата
 */
export function getDuplicateErrorMessage(entityType: string): string {
  return "Такое название уже существует"
} 
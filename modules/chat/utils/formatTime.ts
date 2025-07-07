 /**
 * Безопасное форматирование времени для сообщений чата
 * Обрабатывает как Date объекты, так и строки
 */
export function formatMessageTime(timestamp: Date | string | number): string {
  try {
    const date = timestamp instanceof Date ? timestamp : new Date(timestamp)
    
    // Проверяем, что дата корректная
    if (isNaN(date.getTime())) {
      console.warn('Invalid timestamp:', timestamp)
      return new Date().toLocaleTimeString('ru-RU', { 
        hour: '2-digit', 
        minute: '2-digit' 
      })
    }
    
    return date.toLocaleTimeString('ru-RU', { 
      hour: '2-digit', 
      minute: '2-digit' 
    })
  } catch (error) {
    console.warn('Error formatting timestamp:', error, timestamp)
    return new Date().toLocaleTimeString('ru-RU', { 
      hour: '2-digit', 
      minute: '2-digit' 
    })
  }
}

/**
 * Безопасное форматирование даты для отображения
 */
export function formatMessageDate(timestamp: Date | string | number): string {
  try {
    const date = timestamp instanceof Date ? timestamp : new Date(timestamp)
    
    if (isNaN(date.getTime())) {
      return new Date().toLocaleDateString('ru-RU')
    }
    
    return date.toLocaleDateString('ru-RU')
  } catch (error) {
    console.warn('Error formatting date:', error, timestamp)
    return new Date().toLocaleDateString('ru-RU')
  }
}

/**
 * Форматирование полной даты и времени
 */
export function formatMessageDateTime(timestamp: Date | string | number): string {
  try {
    const date = timestamp instanceof Date ? timestamp : new Date(timestamp)
    
    if (isNaN(date.getTime())) {
      return new Date().toLocaleString('ru-RU')
    }
    
    return date.toLocaleString('ru-RU', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch (error) {
    console.warn('Error formatting datetime:', error, timestamp)
    return new Date().toLocaleString('ru-RU')
  }
} 
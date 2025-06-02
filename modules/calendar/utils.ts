import { format, addMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isToday } from 'date-fns';
import { ru } from 'date-fns/locale';
import { CalendarEvent, WorkSchedule } from '@/modules/calendar/types';

// Форматирование дат
export function formatDate(date: Date, formatStr: string = "dd.MM.yyyy"): string {
  return format(date, formatStr, { locale: ru });
}

// Функция для правильного форматирования даты в строку YYYY-MM-DD без проблем с часовыми поясами
export function formatDateToString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Функция для безопасного парсинга даты из строки
export function parseDateFromString(dateString: string): Date {
  // Если строка уже содержит время, используем её как есть
  if (dateString.includes('T')) {
    return new Date(dateString);
  }
  
  // Если это только дата в формате YYYY-MM-DD, добавляем время полуночи
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    return new Date(dateString + 'T00:00:00');
  }
  
  // Для других форматов пытаемся парсить как есть
  const date = new Date(dateString);
  
  // Проверяем, что дата валидна
  if (isNaN(date.getTime())) {
    console.error(`Некорректная дата: ${dateString}`);
    throw new Error(`Invalid date string: ${dateString}`);
  }
  
  return date;
}

export function formatMonthYear(date: Date): string {
  return format(date, "LLLL yyyy", { locale: ru });
}

export function addMonthsToDate(date: Date, amount: number): Date {
  return addMonths(date, amount);
}

export function formatTime(time: string): string {
  return time.slice(0, 5); // Убираем секунды из времени
}

// Работа с календарными периодами
export function getMonthDays(date: Date): Date[] {
  const monthStart = startOfMonth(date);
  const monthEnd = endOfMonth(date);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 }); // Неделя начинается с понедельника
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  
  return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
}

export function getWeekDays(date: Date): Date[] {
  const weekStart = startOfWeek(date, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(date, { weekStartsOn: 1 });
  
  return eachDayOfInterval({ start: weekStart, end: weekEnd });
}

// Проверки дат
export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6; // Воскресенье или суббота
}

export function isWorkingDay(date: Date, workSchedules: WorkSchedule[]): boolean {
  const dayOfWeek = date.getDay();
  const schedule = workSchedules.find(s => s.day_of_week === dayOfWeek);
  return schedule?.is_working_day || false;
}

// Работа с событиями
export function getEventsForDate(date: Date, events: CalendarEvent[]): CalendarEvent[] {
  const dateString = formatDateToString(date);
  
  return events.filter(event => {
    const eventStart = event.calendar_event_date_start;
    const eventEnd = event.calendar_event_date_end;
    return dateString >= eventStart && (eventEnd ? dateString <= eventEnd : dateString === eventStart);
  });
}

export function getEventsForDateRange(startDate: Date, endDate: Date, events: CalendarEvent[]): CalendarEvent[] {
  const start = formatDateToString(startDate);
  const end = formatDateToString(endDate);
  
  return events.filter(event => {
    const eventStart = event.calendar_event_date_start;
    const eventEnd = event.calendar_event_date_end || eventStart;
    return (eventStart <= end && eventEnd >= start);
  });
}

// Цвета для событий
export function getEventColor(eventType: string): string {
  switch (eventType) {
    case "Отгул":
      return "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900 dark:text-orange-200 dark:border-orange-700";
    case "Больничный":
      return "bg-red-100 text-red-800 border-red-200 dark:bg-red-900 dark:text-red-200 dark:border-red-700";
    case "Отпуск":
      return "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900 dark:text-blue-200 dark:border-blue-700";
    case "Праздник":
      return "bg-green-100 text-green-800 border-green-200 dark:bg-green-900 dark:text-green-200 dark:border-green-700";
    case "Перенос":
      return "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900 dark:text-purple-200 dark:border-purple-700";
    case "Событие":
      return "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900 dark:text-yellow-200 dark:border-yellow-700";
    case "График работы":
      return "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900 dark:text-blue-200 dark:border-blue-700";
    case "День рождения":
      return "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900 dark:text-purple-200 dark:border-purple-700";
    // Поддержка английских названий для совместимости
    case "personal":
      return "bg-green-100 text-green-800 border-green-200 dark:bg-green-900 dark:text-green-200 dark:border-green-700";
    case "work":
      return "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900 dark:text-blue-200 dark:border-blue-700";
    case "global":
      return "bg-red-100 text-red-800 border-red-200 dark:bg-red-900 dark:text-red-200 dark:border-red-700";
    default:
      return "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600";
  }
}

export function getEventTypeLabel(eventType: string): string {
  switch (eventType) {
    case "personal":
      return "Личное";
    case "work":
      return "Рабочее";
    case "global":
      return "Общее";
    default:
      return "Неизвестно";
  }
}

// Валидация времени
export function isValidTimeRange(startTime: string, endTime: string): boolean {
  if (!startTime || !endTime) return false;
  
  const start = new Date(`2000-01-01T${startTime}`);
  const end = new Date(`2000-01-01T${endTime}`);
  
  return start < end;
}

/**
 * Проверяет пересечение двух временных интервалов.
 * 
 * @param start1 - Время начала первого интервала (формат HH:MM или HH:MM:SS)
 * @param end1 - Время окончания первого интервала (формат HH:MM или HH:MM:SS)
 * @param start2 - Время начала второго интервала (формат HH:MM или HH:MM:SS)
 * @param end2 - Время окончания второго интервала (формат HH:MM или HH:MM:SS)
 * @returns true если интервалы пересекаются, false если нет
 */
export function doTimeIntervalsOverlap(
  start1: string, 
  end1: string, 
  start2: string, 
  end2: string
): boolean {
  // Используем базовую дату для корректного сравнения времени
  const baseDate = '2000-01-01T';
  
  try {
    const startTime1 = new Date(baseDate + start1);
    const endTime1 = new Date(baseDate + end1);
    const startTime2 = new Date(baseDate + start2);
    const endTime2 = new Date(baseDate + end2);
    
    // Проверяем валидность времени
    if (isNaN(startTime1.getTime()) || isNaN(endTime1.getTime()) || 
        isNaN(startTime2.getTime()) || isNaN(endTime2.getTime())) {
      console.warn('Некорректное время при проверке пересечения интервалов');
      return true; // Консервативный подход - считаем что есть пересечение
    }
    
    // Интервалы пересекаются если: start1 < end2 && start2 < end1
    return startTime1 < endTime2 && startTime2 < endTime1;
  } catch (error) {
    console.warn('Ошибка при проверке пересечения временных интервалов:', error);
    return true; // Консервативный подход
  }
}

// Проверка пересечения событий
/**
 * Проверяет наличие конфликтов между новым событием и существующими событиями.
 * 
 * Логика проверки:
 * 1. Сначала проверяется пересечение дат
 * 2. Если даты пересекаются и у обоих событий указано время, проверяется пересечение времени
 * 3. Если время не указано у одного или обоих событий, считается что есть конфликт (date-based detection)
 * 
 * Ограничения:
 * - Текущая схема CalendarEvent не содержит поля времени (start_time, end_time)
 * - Функция готова к будущему расширению с поддержкой времени
 * - При отсутствии полей времени может давать ложные срабатывания (false positives)
 * 
 * @param newEvent - Новое событие с датами и опциональным временем
 * @param existingEvents - Массив существующих событий для проверки
 * @returns true если обнаружен конфликт, false если конфликта нет
 */
export function hasEventConflict(
  newEvent: { start_date: string; end_date: string; start_time?: string; end_time?: string },
  existingEvents: CalendarEvent[]
): boolean {
  return existingEvents.some(event => {
    // Проверяем пересечение дат
    const newStart = newEvent.start_date;
    const newEnd = newEvent.end_date;
    const eventStart = event.calendar_event_date_start;
    const eventEnd = event.calendar_event_date_end || eventStart;
    
    const datesOverlap = newStart <= eventEnd && newEnd >= eventStart;
    
    if (!datesOverlap) return false;
    
    // Если даты пересекаются, проверяем время (если указано у обоих событий)
    const newHasTime = newEvent.start_time && newEvent.end_time;
    // Примечание: в текущей схеме CalendarEvent нет полей времени
    // Для будущего расширения можно будет добавить:
    // const eventHasTime = event.calendar_event_time_start && event.calendar_event_time_end;
    const eventHasTime = false; // Временно false, пока нет полей времени в CalendarEvent
    
    // Если у обоих событий есть время, проверяем пересечение времени
    if (newHasTime && eventHasTime) {
      // Для будущего расширения, когда в CalendarEvent появятся поля времени:
      // return doTimeIntervalsOverlap(
      //   newEvent.start_time!, 
      //   newEvent.end_time!, 
      //   event.calendar_event_time_start!, 
      //   event.calendar_event_time_end!
      // );
      
      // Пока возвращаем false, так как у существующих событий нет времени
      return false;
    }
    
    // Если время не указано у одного или обоих событий, 
    // считаем что есть конфликт (консервативный подход)
    // Это может давать ложные срабатывания, но предотвращает пропуск реальных конфликтов
    return true;
  });
}

// Генерация уникального ID
export function generateEventId(): string {
  return `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Дни недели
export const WEEKDAYS = [
  { value: 1, label: 'Понедельник', short: 'Пн' },
  { value: 2, label: 'Вторник', short: 'Вт' },
  { value: 3, label: 'Среда', short: 'Ср' },
  { value: 4, label: 'Четверг', short: 'Чт' },
  { value: 5, label: 'Пятница', short: 'Пт' },
  { value: 6, label: 'Суббота', short: 'Сб' },
  { value: 0, label: 'Воскресенье', short: 'Вс' },
];

export function getWeekdayLabel(dayOfWeek: number): string {
  const weekday = WEEKDAYS.find(day => day.value === dayOfWeek);
  return weekday?.label || 'Неизвестный день';
}

export function getWeekdayShort(dayOfWeek: number): string {
  const weekday = WEEKDAYS.find(day => day.value === dayOfWeek);
  return weekday?.short || '??';
}

// Функция для сравнения дат без учета времени
export function isSameDateOnly(date1: Date, date2: Date): boolean {
  return date1.getFullYear() === date2.getFullYear() &&
         date1.getMonth() === date2.getMonth() &&
         date1.getDate() === date2.getDate();
}

export function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

export function isSameMonth(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth()
  );
}

// Функция для проверки, находится ли дата в диапазоне (включительно)
export function isDateInRange(date: Date, startDate: Date, endDate: Date): boolean {
  const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const startOnly = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  const endOnly = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
  
  return dateOnly >= startOnly && dateOnly <= endOnly;
}

/*
ПРИМЕРЫ ИСПОЛЬЗОВАНИЯ ФУНКЦИЙ ПРОВЕРКИ КОНФЛИКТОВ:

// Пример 1: Проверка пересечения временных интервалов
const overlap1 = doTimeIntervalsOverlap('09:00', '12:00', '11:00', '14:00'); // true - пересекаются
const overlap2 = doTimeIntervalsOverlap('09:00', '12:00', '13:00', '15:00'); // false - не пересекаются
const overlap3 = doTimeIntervalsOverlap('09:00', '12:00', '10:00', '11:00'); // true - второй интервал внутри первого

// Пример 2: Проверка конфликтов событий (текущая реализация - только по датам)
const newEvent = {
  start_date: '2024-01-15',
  end_date: '2024-01-15',
  start_time: '10:00',
  end_time: '12:00'
};

const existingEvents = [
  {
    calendar_event_id: '1',
    calendar_event_date_start: '2024-01-15',
    calendar_event_date_end: '2024-01-15',
    // Примечание: поля времени пока отсутствуют в CalendarEvent
    // calendar_event_time_start: '11:00',
    // calendar_event_time_end: '13:00'
  }
];

const hasConflict = hasEventConflict(newEvent, existingEvents); 
// Результат: true (конфликт по дате, время не учитывается)

// Пример 3: Когда в будущем добавят поля времени в CalendarEvent
// const futureEvent = {
//   calendar_event_id: '2',
//   calendar_event_date_start: '2024-01-15',
//   calendar_event_date_end: '2024-01-15',
//   calendar_event_time_start: '14:00',
//   calendar_event_time_end: '16:00'
// };
// 
// const hasTimeConflict = hasEventConflict(newEvent, [futureEvent]);
// Результат: false (даты совпадают, но время не пересекается)

// Пример 4: Валидация временного диапазона
const isValid1 = isValidTimeRange('09:00', '17:00'); // true
const isValid2 = isValidTimeRange('17:00', '09:00'); // false - конец раньше начала
const isValid3 = isValidTimeRange('', '17:00'); // false - пустое время
*/ 
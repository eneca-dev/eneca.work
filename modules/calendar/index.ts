// Основные компоненты модуля
export { default as CalendarPage } from '@/modules/calendar/CalendarPage';
export { CalendarMenu } from '@/modules/calendar/CalendarMenu';
export { Calendar } from '@/modules/calendar/components/Calendar';

// Хуки модуля
export { useCalendarEvents } from '@/modules/calendar/hooks/useCalendarEvents';
export { useWorkSchedule } from '@/modules/calendar/hooks/useWorkSchedule';

// Хранилище состояния
export { useCalendarStore } from '@/modules/calendar/store';

// Типы данных
export type {
  CalendarEvent,
  WorkSchedule,
  CalendarView,
  CalendarState,
  EventFormData,
  WorkScheduleFormData,
} from '@/modules/calendar/types';

// Утилиты
export {
  formatDate,
  formatDateToString,
  parseDateFromString,
  isSameDateOnly,
  isDateInRange,
  formatMonthYear,
  formatTime,
  getMonthDays,
  getWeekDays,
  isWeekend,
  isWorkingDay,
  getEventsForDate,
  getEventsForDateRange,
  getEventColor,
  getEventTypeLabel,
  isValidTimeRange,
  hasEventConflict,
  generateEventId,
  getWeekdayLabel,
  getWeekdayShort,
  WEEKDAYS,
} from '@/modules/calendar/utils'; 
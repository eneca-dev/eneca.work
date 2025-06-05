export interface BaseEventData {
  calendar_event_type: "Отгул" | "Больничный" | "Перенос" | "Отпуск" | "Праздник" | "Событие";
  calendar_event_comment?: string;
  calendar_event_is_global: boolean;
  calendar_event_is_weekday: boolean | null;
  calendar_event_created_by: string;
  calendar_event_date_start: string;
  calendar_event_date_end?: string;
}

export interface CalendarEvent extends BaseEventData {
  calendar_event_id: string;
}

export interface WorkSchedule {
  id: string;
  user_id: string;
  day_of_week: number; // 0-6 (воскресенье-суббота)
  start_time: string;
  end_time: string;
  is_working_day: boolean;
  created_at: string;
  updated_at: string;
}

export interface CalendarView {
  type: 'month' | 'week' | 'day';
  date: Date;
}

export interface CalendarState {
  currentDate: Date;
  view: CalendarView['type'];
  selectedDate: Date | null;
  events: CalendarEvent[];
  workSchedules: WorkSchedule[];
  isLoading: boolean;
  error: string | null;
}

export interface EventFormData extends BaseEventData {
}

export interface WorkScheduleFormData {
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_working_day: boolean;
} 
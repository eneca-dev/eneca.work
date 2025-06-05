import { useEffect, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useCalendarStore } from '@/modules/calendar/store';
import { CalendarEvent, EventFormData } from '@/modules/calendar/types';
import { toast } from 'sonner';
import { formatDateToString, parseDateFromString, isSameDateOnly, isDateInRange } from '@/modules/calendar/utils';

export function useCalendarEvents() {
  const {
    events,
    setEvents,
    addEvent,
    updateEvent,
    deleteEvent,
    setLoading,
    setError,
  } = useCalendarStore();

  const supabase = createClient();

  // Загрузка событий для авторизованного пользователя
  const fetchEvents = useCallback(async (userId?: string) => {
    try {
      setLoading(true);
      setError(null);

      // Загружаем все события без фильтрации на сервере
      // Фильтрация будет происходить на клиенте: глобальные события + события текущего пользователя
      const { data, error } = await supabase
        .from('calendar_events')
        .select('*')
        .order('calendar_event_date_start', { ascending: true });

      if (error) throw error;

      setEvents(data || []);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Ошибка загрузки событий';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [supabase, setEvents, setLoading, setError]);

  // Создание события
  const createEvent = useCallback(async (eventData: EventFormData, userId: string) => {
    try {
      setLoading(true);
      setError(null);

      const newEvent = {
        ...eventData,
        calendar_event_created_by: userId,
      };

      const { data, error } = await supabase
        .from('calendar_events')
        .insert([newEvent])
        .select()
        .single();

      if (error) throw error;

      // Перезагружаем все события после создания
      await fetchEvents(userId);
      toast.success('Событие создано успешно');
      return data;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Ошибка создания события';
      setError(message);
      toast.error(message);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [supabase, fetchEvents, setLoading, setError]);

  // Обновление события
  const editEvent = useCallback(async (id: string, eventData: Partial<EventFormData>, userId: string) => {
    try {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('calendar_events')
        .update(eventData)
        .eq('calendar_event_id', id)
        .select()
        .single();

      if (error) throw error;

      // Перезагружаем все события после обновления
      await fetchEvents(userId);
      toast.success('Событие обновлено успешно');
      return data;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Ошибка обновления события';
      setError(message);
      toast.error(message);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [supabase, fetchEvents, setLoading, setError]);

  // Удаление события
  const removeEvent = useCallback(async (id: string, userId: string) => {
    try {
      setLoading(true);
      setError(null);

      const { error } = await supabase
        .from('calendar_events')
        .delete()
        .eq('calendar_event_id', id);

      if (error) throw error;

      // Перезагружаем все события после удаления
      await fetchEvents(userId);
      toast.success('Событие удалено успешно');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Ошибка удаления события';
      setError(message);
      toast.error(message);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [supabase, fetchEvents, setLoading, setError]);

  // Получение событий для определенной даты с фильтрацией по пользователю
  const getEventsForDate = useCallback((date: Date, userId?: string): CalendarEvent[] => {
    return events.filter(event => {
      const eventStart = parseDateFromString(event.calendar_event_date_start);
      
      // Проверяем дату
      const isDateMatch = event.calendar_event_date_end 
        ? isDateInRange(date, eventStart, parseDateFromString(event.calendar_event_date_end))
        : isSameDateOnly(date, eventStart);
      
      if (!isDateMatch) return false;
      
      // Фильтрация по пользователю: показываем глобальные события + события текущего пользователя
      return event.calendar_event_is_global || (userId && event.calendar_event_created_by === userId);
    });
  }, [events]);

  // Получение событий для диапазона дат с фильтрацией по пользователю
  const getEventsForDateRange = useCallback((startDate: Date, endDate: Date, userId?: string): CalendarEvent[] => {
    return events.filter(event => {
      const eventStart = parseDateFromString(event.calendar_event_date_start);
      const eventEnd = event.calendar_event_date_end 
        ? parseDateFromString(event.calendar_event_date_end) 
        : eventStart;
      
      // Проверяем пересечение диапазонов
      const isDateRangeMatch = isDateInRange(eventStart, startDate, endDate) || 
             isDateInRange(eventEnd, startDate, endDate) ||
             isDateInRange(startDate, eventStart, eventEnd) ||
             isDateInRange(endDate, eventStart, eventEnd);
             
      if (!isDateRangeMatch) return false;
      
      // Фильтрация по пользователю: показываем глобальные события + события текущего пользователя
      return event.calendar_event_is_global || (userId && event.calendar_event_created_by === userId);
    });
  }, [events]);

  return {
    events,
    fetchEvents,
    createEvent,
    editEvent,
    removeEvent,
    getEventsForDate,
    getEventsForDateRange,
  };
} 
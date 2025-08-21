import { useEffect, useCallback } from 'react';
import * as Sentry from "@sentry/nextjs";
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
    return Sentry.startSpan(
      {
        op: "calendar.fetch_events",
        name: "Fetch Calendar Events",
      },
      async (span) => {
        try {
          setLoading(true);
          setError(null);

          span.setAttribute("user.id", userId || "anonymous")
          span.setAttribute("fetch.has_user", !!userId)

          // Загружаем все события без фильтрации на сервере
          // Фильтрация будет происходить на клиенте: глобальные события + события текущего пользователя
          const { data, error } = await supabase
            .from('calendar_events')
            .select('*')
            .order('calendar_event_date_start', { ascending: true });

          if (error) {
            span.setAttribute("fetch.success", false)
            span.setAttribute("fetch.error", error.message)
            Sentry.captureException(error, {
              tags: {
                module: 'calendar',
                action: 'fetch_events',
                error_type: 'db_error'
              },
              extra: {
                component: 'useCalendarEvents',
                user_id: userId,
                timestamp: new Date().toISOString()
              }
            })
            throw error;
          }

          span.setAttribute("fetch.success", true)
          span.setAttribute("events.count", data?.length || 0)

          Sentry.addBreadcrumb({
            message: 'Calendar events fetched successfully',
            category: 'calendar',
            level: 'info',
            data: {
              user_id: userId,
              events_count: data?.length || 0
            }
          })

          setEvents(data || []);
        } catch (error) {
          span.setAttribute("fetch.success", false)
          span.recordException(error as Error)
          Sentry.captureException(error, {
            tags: {
              module: 'calendar',
              action: 'fetch_events',
              error_type: 'unexpected_error'
            },
            extra: {
              component: 'useCalendarEvents',
              user_id: userId,
              timestamp: new Date().toISOString()
            }
          })
          const message = error instanceof Error ? error.message : 'Ошибка загрузки событий';
          setError(message);
          toast.error(message);
        } finally {
          setLoading(false);
        }
      }
    )
  }, [supabase, setEvents, setLoading, setError]);

  // Создание события
  const createEvent = useCallback(async (eventData: EventFormData, userId: string) => {
    return Sentry.startSpan(
      {
        op: "calendar.create_event",
        name: "Create Calendar Event",
      },
      async (span) => {
        try {
          setLoading(true);
          setError(null);

          span.setAttribute("user.id", userId)
          span.setAttribute("event.type", eventData.calendar_event_type)
          span.setAttribute("event.is_global", eventData.calendar_event_is_global)
          span.setAttribute("event.has_comment", !!eventData.calendar_event_comment)
          span.setAttribute("event.has_end_date", !!eventData.calendar_event_date_end)

          const newEvent = {
            ...eventData,
            calendar_event_created_by: userId,
          };

          const { data, error } = await supabase
            .from('calendar_events')
            .insert([newEvent])
            .select()
            .single();

          if (error) {
            span.setAttribute("create.success", false)
            span.setAttribute("create.error", error.message)
            Sentry.captureException(error, {
              tags: {
                module: 'calendar',
                action: 'create_event',
                error_type: 'db_error'
              },
              extra: {
                component: 'useCalendarEvents',
                user_id: userId,
                event_type: eventData.calendar_event_type,
                is_global: eventData.calendar_event_is_global,
                timestamp: new Date().toISOString()
              }
            })
            throw error;
          }

          // Перезагружаем все события после создания
          await fetchEvents(userId);
          
          span.setAttribute("create.success", true)
          span.setAttribute("event.id", data.calendar_event_id)

          Sentry.addBreadcrumb({
            message: 'Calendar event created successfully',
            category: 'calendar',
            level: 'info',
            data: {
              user_id: userId,
              event_id: data.calendar_event_id,
              event_type: eventData.calendar_event_type,
              is_global: eventData.calendar_event_is_global
            }
          })

          toast.success('Событие создано успешно');
          return data;
        } catch (error) {
          span.setAttribute("create.success", false)
          span.recordException(error as Error)
          Sentry.captureException(error, {
            tags: {
              module: 'calendar',
              action: 'create_event',
              error_type: 'unexpected_error'
            },
            extra: {
              component: 'useCalendarEvents',
              user_id: userId,
              event_type: eventData.calendar_event_type,
              is_global: eventData.calendar_event_is_global,
              timestamp: new Date().toISOString()
            }
          })
          const message = error instanceof Error ? error.message : 'Ошибка создания события';
          setError(message);
          toast.error(message);
          throw error;
        } finally {
          setLoading(false);
        }
      }
    )
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
    return Sentry.startSpan(
      {
        op: "calendar.remove_event",
        name: "Remove Calendar Event",
      },
      async (span) => {
        try {
          setLoading(true);
          setError(null);

          span.setAttribute("user.id", userId)
          span.setAttribute("event.id", id)

          const { error } = await supabase
            .from('calendar_events')
            .delete()
            .eq('calendar_event_id', id);

          if (error) {
            span.setAttribute("remove.success", false)
            span.setAttribute("remove.error", error.message)
            Sentry.captureException(error, {
              tags: {
                module: 'calendar',
                action: 'remove_event',
                error_type: 'db_error'
              },
              extra: {
                component: 'useCalendarEvents',
                user_id: userId,
                event_id: id,
                timestamp: new Date().toISOString()
              }
            })
            throw error;
          }

          // Перезагружаем все события после удаления
          await fetchEvents(userId);
          
          span.setAttribute("remove.success", true)

          Sentry.addBreadcrumb({
            message: 'Calendar event removed successfully',
            category: 'calendar',
            level: 'info',
            data: {
              user_id: userId,
              event_id: id
            }
          })

          toast.success('Событие удалено успешно');
        } catch (error) {
          span.setAttribute("remove.success", false)
          span.recordException(error as Error)
          Sentry.captureException(error, {
            tags: {
              module: 'calendar',
              action: 'remove_event',
              error_type: 'unexpected_error'
            },
            extra: {
              component: 'useCalendarEvents',
              user_id: userId,
              event_id: id,
              timestamp: new Date().toISOString()
            }
          })
          const message = error instanceof Error ? error.message : 'Ошибка удаления события';
          setError(message);
          toast.error(message);
          throw error;
        } finally {
          setLoading(false);
        }
      }
    )
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
import { useCallback } from 'react';
import * as Sentry from "@sentry/nextjs";
import { createClient } from '@/utils/supabase/client';
import { useCalendarStore } from '@/modules/calendar/store';
import { WorkSchedule, WorkScheduleFormData } from '@/modules/calendar/types';
import { toast } from 'sonner';

export function useWorkSchedule() {
  const {
    workSchedules,
    setWorkSchedules,
    addWorkSchedule,
    updateWorkSchedule,
    deleteWorkSchedule,
    setLoading,
    setError,
  } = useCalendarStore();

  const supabase = createClient();

  // Загрузка рабочих расписаний
  const fetchWorkSchedules = useCallback(async (userId: string) => {
    return Sentry.startSpan(
      {
        op: "calendar.fetch_work_schedules",
        name: "Fetch Work Schedules",
      },
      async (span) => {
        try {
          setLoading(true);
          setError(null);

          span.setAttribute("user.id", userId)

          const { data, error } = await supabase
            .from('work_schedules')
            .select('*')
            .eq('user_id', userId)
            .order('day_of_week', { ascending: true });

          if (error) {
            span.setAttribute("fetch.success", false)
            span.setAttribute("fetch.error", error.message)
            Sentry.captureException(error, {
              tags: {
                module: 'calendar',
                action: 'fetch_work_schedules',
                error_type: 'db_error'
              },
              extra: {
                component: 'useWorkSchedule',
                user_id: userId,
                timestamp: new Date().toISOString()
              }
            })
            throw error;
          }

          span.setAttribute("fetch.success", true)
          span.setAttribute("schedules.count", data?.length || 0)

          Sentry.addBreadcrumb({
            message: 'Work schedules fetched successfully',
            category: 'calendar',
            level: 'info',
            data: {
              user_id: userId,
              schedules_count: data?.length || 0
            }
          })

          setWorkSchedules(data || []);
        } catch (error) {
          span.setAttribute("fetch.success", false)
          span.recordException(error as Error)
          Sentry.captureException(error, {
            tags: {
              module: 'calendar',
              action: 'fetch_work_schedules',
              error_type: 'unexpected_error'
            },
            extra: {
              component: 'useWorkSchedule',
              user_id: userId,
              timestamp: new Date().toISOString()
            }
          })
          const message = error instanceof Error ? error.message : 'Ошибка загрузки расписания';
          setError(message);
          toast.error(message);
        } finally {
          setLoading(false);
        }
      }
    )
  }, [supabase, setWorkSchedules, setLoading, setError]);

  // Создание рабочего расписания
  const createWorkSchedule = useCallback(async (scheduleData: WorkScheduleFormData, userId: string) => {
    try {
      setLoading(true);
      setError(null);

      const newSchedule = {
        ...scheduleData,
        user_id: userId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('work_schedules')
        .insert([newSchedule])
        .select()
        .single();

      if (error) throw error;

      addWorkSchedule(data);
      toast.success('Расписание создано успешно');
      return data;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Ошибка создания расписания';
      setError(message);
      toast.error(message);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [supabase, addWorkSchedule, setLoading, setError]);

  // Обновление рабочего расписания
  const editWorkSchedule = useCallback(async (id: string, scheduleData: Partial<WorkScheduleFormData>) => {
    try {
      setLoading(true);
      setError(null);

      const updateData = {
        ...scheduleData,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('work_schedules')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      updateWorkSchedule(id, data);
      toast.success('Расписание обновлено успешно');
      return data;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Ошибка обновления расписания';
      setError(message);
      toast.error(message);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [supabase, updateWorkSchedule, setLoading, setError]);

  // Удаление рабочего расписания
  const removeWorkSchedule = useCallback(async (id: string) => {
    try {
      setLoading(true);
      setError(null);

      const { error } = await supabase
        .from('work_schedules')
        .delete()
        .eq('id', id);

      if (error) throw error;

      deleteWorkSchedule(id);
      toast.success('Расписание удалено успешно');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Ошибка удаления расписания';
      setError(message);
      toast.error(message);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [supabase, deleteWorkSchedule, setLoading, setError]);

  // Получение расписания для определенного дня недели
  const getScheduleForDay = useCallback((dayOfWeek: number): WorkSchedule | undefined => {
    return workSchedules.find(schedule => schedule.day_of_week === dayOfWeek);
  }, [workSchedules]);

  // Проверка, является ли день рабочим
  const isWorkingDay = useCallback((dayOfWeek: number): boolean => {
    const schedule = getScheduleForDay(dayOfWeek);
    return schedule?.is_working_day || false;
  }, [getScheduleForDay]);

  // Получение рабочих часов для дня
  const getWorkingHours = useCallback((dayOfWeek: number): { start: string; end: string } | null => {
    const schedule = getScheduleForDay(dayOfWeek);
    if (!schedule || !schedule.is_working_day) {
      return null;
    }
    return {
      start: schedule.start_time,
      end: schedule.end_time,
    };
  }, [getScheduleForDay]);


  return {
    workSchedules,
    fetchWorkSchedules,
    createWorkSchedule,
    editWorkSchedule,
    removeWorkSchedule,
    getScheduleForDay,
    isWorkingDay,
    getWorkingHours,
  };
} 
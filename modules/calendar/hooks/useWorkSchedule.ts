import { useCallback } from 'react';
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
    try {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('work_schedules')
        .select('*')
        .eq('user_id', userId)
        .order('day_of_week', { ascending: true });

      if (error) throw error;

      setWorkSchedules(data || []);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Ошибка загрузки расписания';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
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
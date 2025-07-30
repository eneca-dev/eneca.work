import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';
import { SectionStatus, SectionStatusFormData } from '../types';

export function useSectionStatuses() {
  const [statuses, setStatuses] = useState<SectionStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadStatuses = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('section_statuses')
        .select('*')
        .order('name');

      if (error) throw error;
      setStatuses(data || []);
    } catch (err) {
      console.error('Ошибка загрузки статусов:', err);
      const errorMessage = err instanceof Error ? err.message : 'Ошибка загрузки статусов';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  const createStatus = useCallback(async (statusData: SectionStatusFormData): Promise<SectionStatus | null> => {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('section_statuses')
        .insert({
          name: statusData.name,
          color: statusData.color,
          description: statusData.description || null
        })
        .select()
        .single();

      if (error) throw error;
      
      // Обновляем список статусов
      await loadStatuses();
      return data;
    } catch (err) {
      console.error('Ошибка создания статуса:', err);
      setError(err instanceof Error ? err.message : 'Ошибка создания статуса');
      return null;
    } finally {
      setLoading(false);
    }
  }, [loadStatuses]);

  const updateStatus = useCallback(async (id: string, statusData: SectionStatusFormData): Promise<SectionStatus | null> => {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('section_statuses')
        .update({
          name: statusData.name,
          color: statusData.color,
          description: statusData.description || null
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      
      // Обновляем список статусов
      await loadStatuses();
      return data;
    } catch (err) {
      console.error('Ошибка обновления статуса:', err);
      setError(err instanceof Error ? err.message : 'Ошибка обновления статуса');
      return null;
    } finally {
      setLoading(false);
    }
  }, [loadStatuses]);

  const deleteStatus = useCallback(async (id: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('section_statuses')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      // Обновляем список статусов
      await loadStatuses();
      return true;
    } catch (err) {
      console.error('Ошибка удаления статуса:', err);
      setError(err instanceof Error ? err.message : 'Ошибка удаления статуса');
      return false;
    } finally {
      setLoading(false);
    }
  }, [loadStatuses]);

  useEffect(() => {
    loadStatuses();
  }, [loadStatuses]);

  return {
    statuses,
    loading,
    error,
    loadStatuses,
    createStatus,
    updateStatus,
    deleteStatus
  };
} 
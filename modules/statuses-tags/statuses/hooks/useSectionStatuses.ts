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
      
      // Уведомляем другие компоненты о создании статуса
      console.log('✅ Отправляем событие statusCreated:', {
        statusId: data.id,
        statusName: data.name,
        statusColor: data.color
      });
      window.dispatchEvent(new CustomEvent('statusCreated', {
        detail: {
          statusId: data.id,
          statusName: data.name,
          statusColor: data.color,
          statusDescription: data.description
        }
      }));
      
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
      
      // Уведомляем другие компоненты об изменении статуса
      console.log('🔄 Отправляем событие statusUpdated:', {
        statusId: data.id,
        statusName: data.name,
        statusColor: data.color
      });
      window.dispatchEvent(new CustomEvent('statusUpdated', {
        detail: {
          statusId: data.id,
          statusName: data.name,
          statusColor: data.color,
          statusDescription: data.description
        }
      }));
      
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
      
      // Сначала обновляем все разделы, которые используют этот статус, 
      // устанавливая им "Без статуса" (section_status_id = NULL)
      const { error: updateError } = await supabase
        .from('sections')
        .update({ section_status_id: null })
        .eq('section_status_id', id);

      if (updateError) {
        console.error('Ошибка обновления разделов:', updateError);
        throw new Error('Не удалось обновить разделы, использующие статус');
      }

      console.log(`🔄 Обновлены разделы: статус ${id} заменен на "Без статуса"`);

      // Затем удаляем сам статус
      const { error } = await supabase
        .from('section_statuses')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      // Обновляем список статусов
      await loadStatuses();
      
      // Уведомляем другие компоненты об удалении статуса
      window.dispatchEvent(new CustomEvent('statusDeleted', {
        detail: {
          statusId: id
        }
      }));
      
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
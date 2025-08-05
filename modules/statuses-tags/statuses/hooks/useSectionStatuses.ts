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

      if (error) {
        console.warn('Ошибка загрузки статусов из Supabase:', error);
        setError(error.message || 'Ошибка загрузки статусов');
        return;
      }
      
      setStatuses(data || []);
    } catch (err) {
      console.warn('Ошибка загрузки статусов:', err);
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
      
      // Уведомляем другие компоненты о создании статуса
      // loadStatuses() будет вызван автоматически из event listener'а
      console.log('✅ Отправляем событие statusCreated:', {
        statusId: data.id,
        statusName: data.name,
        statusColor: data.color
      });
      
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('statusCreated', {
          detail: {
            statusId: data.id,
            statusName: data.name,
            statusColor: data.color,
            statusDescription: data.description
          }
        }));
      }
      
      return data;
    } catch (err) {
      console.warn('Ошибка создания статуса:', err);
      setError(err instanceof Error ? err.message : 'Ошибка создания статуса');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

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
      
      // Уведомляем другие компоненты об изменении статуса
      // loadStatuses() будет вызван автоматически из event listener'а
      console.log('🔄 Отправляем событие statusUpdated:', {
        statusId: data.id,
        statusName: data.name,
        statusColor: data.color
      });
      
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('statusUpdated', {
          detail: {
            statusId: data.id,
            statusName: data.name,
            statusColor: data.color,
            statusDescription: data.description
          }
        }));
      }
      
      return data;
    } catch (err) {
      console.warn('Ошибка обновления статуса:', err);
      setError(err instanceof Error ? err.message : 'Ошибка обновления статуса');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

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
        console.warn('Ошибка обновления разделов:', updateError);
        throw new Error('Не удалось обновить разделы, использующие статус');
      }

      console.log(`🔄 Обновлены разделы: статус ${id} заменен на "Без статуса"`);

      // Затем удаляем сам статус
      const { error } = await supabase
        .from('section_statuses')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      // Уведомляем другие компоненты об удалении статуса
      // loadStatuses() будет вызван автоматически из event listener'а
      console.log('🗑️ Отправляем событие statusDeleted:', { statusId: id });
      
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('statusDeleted', {
          detail: {
            statusId: id
          }
        }));
      }
      
      return true;
    } catch (err) {
      console.warn('Ошибка удаления статуса:', err);
      setError(err instanceof Error ? err.message : 'Ошибка удаления статуса');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatuses();
  }, [loadStatuses]);

  // Слушаем глобальные события изменения статусов для автоматического обновления
  useEffect(() => {
    const handleStatusCreated = () => {
      console.log('📥 useSectionStatuses: получили событие statusCreated, обновляем список');
      loadStatuses();
    };

    const handleStatusUpdated = () => {
      console.log('📥 useSectionStatuses: получили событие statusUpdated, обновляем список');
      loadStatuses();
    };

    const handleStatusDeleted = () => {
      console.log('📥 useSectionStatuses: получили событие statusDeleted, обновляем список');
      loadStatuses();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('statusCreated', handleStatusCreated);
      window.addEventListener('statusUpdated', handleStatusUpdated);
      window.addEventListener('statusDeleted', handleStatusDeleted);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('statusCreated', handleStatusCreated);
        window.removeEventListener('statusUpdated', handleStatusUpdated);
        window.removeEventListener('statusDeleted', handleStatusDeleted);
      }
    };
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
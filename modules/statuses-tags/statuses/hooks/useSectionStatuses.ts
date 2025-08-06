import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';
import { SectionStatus, SectionStatusFormData } from '../types';

// Helper функция для отправки событий с логированием
const dispatchStatusEvent = (
  eventType: 'statusCreated' | 'statusUpdated' | 'statusDeleted',
  logData: any,
  eventDetail: any,
  logIcon: string = '📤'
) => {
  console.log(`${logIcon} Отправляем событие ${eventType}:`, logData);
  
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(eventType, {
      detail: eventDetail
    }));
  }
};

export function useSectionStatuses() {
  const [statuses, setStatuses] = useState<SectionStatus[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadStatuses = useCallback(async () => {
    setIsLoading(true);
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
      setIsLoading(false);
    }
  }, []);

  // Мемоизированные обработчики событий для предотвращения лишних перерегистраций
  const handleStatusCreated = useCallback(() => {
    console.log('📥 useSectionStatuses: получили событие statusCreated, обновляем список');
    loadStatuses();
  }, [loadStatuses]);

  const handleStatusUpdated = useCallback(() => {
    console.log('📥 useSectionStatuses: получили событие statusUpdated, обновляем список');
    loadStatuses();
  }, [loadStatuses]);

  const handleStatusDeleted = useCallback(() => {
    console.log('📥 useSectionStatuses: получили событие statusDeleted, обновляем список');
    loadStatuses();
  }, [loadStatuses]);

  const createStatus = useCallback(async (statusData: SectionStatusFormData): Promise<SectionStatus | null> => {
    setIsLoading(true);
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
      dispatchStatusEvent(
        'statusCreated',
        {
          statusId: data.id,
          statusName: data.name,
          statusColor: data.color
        },
        {
          statusId: data.id,
          statusName: data.name,
          statusColor: data.color,
          statusDescription: data.description
        },
        '✅'
      );
      
      return data;
    } catch (err) {
      console.warn('Ошибка создания статуса:', err);
      setError(err instanceof Error ? err.message : 'Ошибка создания статуса');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateStatus = useCallback(async (id: string, statusData: SectionStatusFormData): Promise<SectionStatus | null> => {
    setIsLoading(true);
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
      dispatchStatusEvent(
        'statusUpdated',
        {
          statusId: data.id,
          statusName: data.name,
          statusColor: data.color
        },
        {
          statusId: data.id,
          statusName: data.name,
          statusColor: data.color,
          statusDescription: data.description
        },
        '🔄'
      );
      
      return data;
    } catch (err) {
      console.warn('Ошибка обновления статуса:', err);
      setError(err instanceof Error ? err.message : 'Ошибка обновления статуса');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const deleteStatus = useCallback(async (id: string): Promise<boolean> => {
    setIsLoading(true);
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
      dispatchStatusEvent(
        'statusDeleted',
        { statusId: id },
        { statusId: id },
        '🗑️'
      );
      
      return true;
    } catch (err) {
      console.warn('Ошибка удаления статуса:', err);
      setError(err instanceof Error ? err.message : 'Ошибка удаления статуса');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatuses();
  }, [loadStatuses]);

  // Слушаем глобальные события изменения статусов для автоматического обновления
  useEffect(() => {
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
  }, [handleStatusCreated, handleStatusUpdated, handleStatusDeleted]);

  return {
    statuses,
    isLoading,
    error,
    loadStatuses,
    createStatus,
    updateStatus,
    deleteStatus
  };
} 
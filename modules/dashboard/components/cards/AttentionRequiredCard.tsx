"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, UserX, HelpCircle, Calendar, CalendarX } from 'lucide-react';
import { useDashboardStore } from '../../stores/useDashboardStore';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import { createClient } from '@/utils/supabase/client';
import { LoadingCard, ErrorCard } from '../ui/CardStates';

interface SectionIssue {
  section_id: string;
  section_name: string;
}

interface AttentionItem {
  id: string;
  title: string;
  sections: SectionIssue[];
  count: number;
  type: 'no_responsible' | 'no_status' | 'no_start_date' | 'no_end_date';
  icon: React.ReactNode;
  bgColor: string;
  borderColor: string;
  textColor: string;
}

// Компонент для отображения списка разделов
const SectionsList: React.FC<{ sections: SectionIssue[] }> = ({ sections }) => {
  const maxVisible = 8;
  const visibleSections = sections.slice(0, maxVisible);
  const remainingCount = sections.length - maxVisible;

  return (
    <div className="space-y-1 mt-1">
      {visibleSections.map((section) => (
        <div key={section.section_id} className="text-xs text-card-foreground/80 flex items-center">
          <span className="mr-1 text-muted-foreground flex-shrink-0">•</span>
          <span className="break-words leading-tight">{section.section_name}</span>
        </div>
      ))}
      {remainingCount > 0 && (
        <div className="text-xs text-muted-foreground italic mt-1">
          и еще {remainingCount} {
            remainingCount % 10 === 1 && remainingCount % 100 !== 11 ? 'раздел' :
            remainingCount % 10 >= 2 && remainingCount % 10 <= 4 && (remainingCount % 100 < 10 || remainingCount % 100 >= 20) ? 'раздела' :
            'разделов'
          }
        </div>
      )}
    </div>
  );
};

export const AttentionRequiredCard: React.FC = () => {
  const projectId = useDashboardStore((state) => state.projectId);
  const [attentionItems, setAttentionItems] = useState<AttentionItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async (abortSignal?: AbortSignal) => {
    if (!projectId) return;
    if (abortSignal?.aborted) return;

    setIsLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const QUERY_TIMEOUT = 30000; // 30 seconds
      
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Query timeout')), QUERY_TIMEOUT)
      );

      // Параллельные запросы для каждого типа проблемы
      const [
        noResponsibleResult,
        noStatusResult, 
        noStartDateResult,
        noEndDateResult
      ] = await Promise.race([
        Promise.allSettled([
        // Разделы без ответственного
        supabase
          .from('sections')
          .select('section_id, section_name')
          .eq('section_project_id', projectId)
          .is('section_responsible', null),
        
        // Разделы без статуса
        supabase
          .from('sections')
          .select('section_id, section_name')
          .eq('section_project_id', projectId)
          .is('section_status_id', null),
        
        // Разделы без дат начала
        supabase
          .from('sections')
          .select('section_id, section_name')
          .eq('section_project_id', projectId)
          .is('section_start_date', null),
        
        // Разделы без дат окончания
        supabase
          .from('sections')
          .select('section_id, section_name')
          .eq('section_project_id', projectId)
          .is('section_end_date', null)
        ]),
        timeoutPromise
      ]) as PromiseSettledResult<any>[];

      if (abortSignal?.aborted) return;

      // Обработка результатов
      const items: AttentionItem[] = [];

      // Разделы без ответственного
      if (noResponsibleResult.status === 'fulfilled' && noResponsibleResult.value.data) {
        const sections = noResponsibleResult.value.data as SectionIssue[];
        if (sections.length > 0) {
          items.push({
            id: 'no_responsible',
            title: 'Разделы без ответственного',
            sections,
            count: sections.length,
            type: 'no_responsible',
            icon: <UserX className="h-3 w-3 text-red-400" />,
            bgColor: 'bg-red-500/10',
            borderColor: 'border-red-500/20',
            textColor: 'text-red-400'
          });
        }
      }

      // Разделы без статуса
      if (noStatusResult.status === 'fulfilled' && noStatusResult.value.data) {
        const sections = noStatusResult.value.data as SectionIssue[];
        if (sections.length > 0) {
          items.push({
            id: 'no_status',
            title: 'Разделы без статуса',
            sections,
            count: sections.length,
            type: 'no_status',
            icon: <HelpCircle className="h-3 w-3 text-orange-400" />,
            bgColor: 'bg-orange-500/10',
            borderColor: 'border-orange-500/20',
            textColor: 'text-orange-400'
          });
        }
      }

      // Разделы без дат начала
      if (noStartDateResult.status === 'fulfilled' && noStartDateResult.value.data) {
        const sections = noStartDateResult.value.data as SectionIssue[];
        if (sections.length > 0) {
          items.push({
            id: 'no_start_date',
            title: 'Разделы без дат начала',
            sections,
            count: sections.length,
            type: 'no_start_date',
            icon: <Calendar className="h-3 w-3 text-yellow-400" />,
            bgColor: 'bg-yellow-500/10',
            borderColor: 'border-yellow-500/20',
            textColor: 'text-yellow-400'
          });
        }
      }

      // Разделы без дат окончания
      if (noEndDateResult.status === 'fulfilled' && noEndDateResult.value.data) {
        const sections = noEndDateResult.value.data as SectionIssue[];
        if (sections.length > 0) {
          items.push({
            id: 'no_end_date',
            title: 'Разделы без дат окончания',
            sections,
            count: sections.length,
            type: 'no_end_date',
            icon: <CalendarX className="h-3 w-3 text-blue-400" />,
            bgColor: 'bg-blue-500/10',
            borderColor: 'border-blue-500/20',
            textColor: 'text-blue-400'
          });
        }
      }

      if (!abortSignal?.aborted) {
        setAttentionItems(items);
      }

    } catch (err) {
      // Игнорируем ошибки отмены
      if ((err instanceof Error && err.name === 'AbortError') || abortSignal?.aborted) return;
      
      const errorMessage = err instanceof Error ? err.message : 'Не удалось загрузить элементы внимания.';
      // Логируем только в development режиме
      if (process.env.NODE_ENV === 'development') {
        console.error('Error fetching attention items:', err);
      }
      if (!abortSignal?.aborted) {
        setError(errorMessage);
      }
    } finally {
      if (!abortSignal?.aborted) {
        setIsLoading(false);
      }
    }
  };



  useEffect(() => {
    // 🔑 ИСПРАВЛЕНИЕ: Сброс данных при смене проекта
    setAttentionItems([]);
    setIsLoading(true);
    setError(null);
    
    // 🔑 ДОБАВЛЕНО: AbortController для отмены запросов
    const controller = new AbortController();
    
    fetchData(controller.signal);
    
    return () => {
      controller.abort();
    };
  }, [projectId]);

  // Создаем стабильную ссылку для auto-refresh с proper abort handling
  const autoRefreshCallback = useCallback(async () => {
    const controller = new AbortController();
    await fetchData(controller.signal);
  }, [projectId]);
  
  useAutoRefresh(projectId || '', autoRefreshCallback);

  if (isLoading) {
    return <LoadingCard title="Загрузка элементов внимания" />;
  }

  if (error) {
    return <ErrorCard message={error} onRetry={() => fetchData()} />;
  }

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 h-full flex flex-col shadow-lg hover:shadow-xl transition-all duration-300">
      <div className="flex items-center mb-3">
        <AlertTriangle className="h-3 w-3 text-muted-foreground mr-2" />
        <h3 className="text-muted-foreground text-sm">Внимание требуется</h3>
      </div>
      
      {/* Контейнер с прозрачным скроллом */}
      <div 
        className="space-y-2 flex-1 overflow-y-auto pr-1"
        style={{
          scrollbarWidth: 'none', /* Firefox */
          msOverflowStyle: 'none'  /* IE and Edge */
        }}
      >
        <style jsx>{`
          div::-webkit-scrollbar {
            display: none; /* Chrome, Safari, Opera */
          }
        `}</style>
        
        {attentionItems.length > 0 ? (
          attentionItems.map((item) => (
            <div 
              key={item.id} 
              className={`p-2 rounded-lg ${item.bgColor} border ${item.borderColor}`}
            >
              <div className="flex items-center space-x-2 mb-1">
                {item.icon}
                <span className={`${item.textColor} font-medium text-sm`}>
                  {item.title}
                </span>
              </div>
              <SectionsList sections={item.sections} />
            </div>
          ))
        ) : (
          <div className="text-center text-muted-foreground text-sm py-4">
            Все разделы корректно заполнены
          </div>
        )}
      </div>
    </div>
  );
};
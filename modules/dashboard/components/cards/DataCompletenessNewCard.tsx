"use client";

import React, { useState, useEffect } from 'react';
import { useDashboardStore } from '../../stores/useDashboardStore';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import { createClient } from '@/utils/supabase/client';
import { LoadingCard, ErrorCard } from '../ui/CardStates';

interface SectionCompleteness {
  category: string;
  progress: number;
}

export const DataCompletenessNewCard: React.FC = () => {
  const projectId = useDashboardStore((state) => state.projectId);
  const [sectionData, setSectionData] = useState<SectionCompleteness[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    if (!projectId) {
      setIsLoading(false);
      setError('Проект не выбран');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const { data: sections, error: sectionsError } = await supabase
        .from('sections')
        .select('section_id, section_status_id, section_responsible, section_start_date, section_end_date')
        .eq('section_project_id', projectId);

      if (sectionsError) {
        throw sectionsError;
      }

      const sectionsData = sections || [];
      const sectionCompleteness: SectionCompleteness[] = [
        {
          category: "Статусы",
          progress: calculateCompleteness(sectionsData, 'section_status_id'),
        },
        {
          category: "Ответственные", 
          progress: calculateCompleteness(sectionsData, 'section_responsible'),
        },
        {
          category: "Сроки",
          progress: calculateDatesCompleteness(sectionsData),
        },
      ];

      setSectionData(sectionCompleteness);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Не удалось загрузить данные разделов.';
      // Логируем только в development режиме
      if (process.env.NODE_ENV === 'development') {
        console.error('Error fetching section data:', err);
      }
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Функция для расчета процента заполненности поля
  const calculateCompleteness = (data: Array<Record<string, any>>, field: string): number => {
    if (!data || data.length === 0) return 0;
    
    const filledCount = data.filter(item => 
      item[field] !== null && 
      item[field] !== undefined && 
      item[field] !== ''
    ).length;
    
    return Math.round((filledCount / data.length) * 100);
  };

  // Функция для расчета процента заполненности дат (start_date и end_date)
  const calculateDatesCompleteness = (data: Array<Record<string, any>>): number => {
    if (!data || data.length === 0) return 0;
    
    const filledCount = data.filter(item => {
      const startField = item.section_start_date;
      const endField = item.section_end_date;
      
      return (startField !== null && startField !== undefined && startField !== '') &&
             (endField !== null && endField !== undefined && endField !== '');
    }).length;
    
    return Math.round((filledCount / data.length) * 100);
  };

  // Функция для определения цвета прогресс-бара на основе процента
  const getProgressColor = (progress: number): string => {
    if (progress >= 80) return 'bg-green-600'; // Темно-зеленый: ≥80%
    if (progress >= 60) return 'bg-yellow-500'; // Желтый: 60-79%
    if (progress >= 30) return 'bg-orange-500'; // Оранжевый: 30-59%
    return 'bg-red-500'; // Красный: <30%
  };

  useEffect(() => {
    let isMounted = true;

    const fetchDataWithCleanup = async () => {
      if (!projectId) {
        if (isMounted) {
          setIsLoading(false);
          setError('Проект не выбран');
        }
        return;
      }

      if (isMounted) {
        setIsLoading(true);
        setError(null);
      }

      try {
        const supabase = createClient();
        const { data: sections, error: sectionsError } = await supabase
          .from('sections')
          .select('section_id, section_status_id, section_responsible, section_start_date, section_end_date')
          .eq('section_project_id', projectId);

        if (!isMounted) return;

        if (sectionsError) {
          throw sectionsError;
        }

        const sectionsData = sections || [];
        const sectionCompleteness: SectionCompleteness[] = [
          {
            category: "Статусы",
            progress: calculateCompleteness(sectionsData, 'section_status_id'),
          },
          {
            category: "Ответственные", 
            progress: calculateCompleteness(sectionsData, 'section_responsible'),
          },
          {
            category: "Сроки",
            progress: calculateDatesCompleteness(sectionsData),
          },
        ];

        if (isMounted) {
          setSectionData(sectionCompleteness);
          setIsLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          const errorMessage = err instanceof Error ? err.message : 'Не удалось загрузить данные разделов.';
          // Логируем только в development режиме
          if (process.env.NODE_ENV === 'development') {
            console.error('Error fetching section data:', err);
          }
          setError(errorMessage);
          setIsLoading(false);
        }
      }
    };

    // Сброс данных при смене проекта
    setSectionData([]);
    fetchDataWithCleanup();

    return () => {
      isMounted = false;
    };
  }, [projectId]);

  // Авто-обновление данных
  useAutoRefresh(projectId || '', fetchData);

  if (isLoading) {
    return <LoadingCard title="Загрузка заполненности" />;
  }

  if (error) {
    return <ErrorCard message={error} onRetry={() => fetchData()} />;
  }

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 h-full flex flex-col shadow-lg hover:shadow-xl transition-all duration-300">
      <h3 className="text-muted-foreground text-sm mb-4">Заполненность иерархии</h3>
      
      <div className="space-y-4 flex-1">
        {sectionData.map((item, index) => (
          <div key={index} className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-card-foreground font-medium text-sm">{item.category}</span>
              <span className="text-muted-foreground text-sm font-medium">{item.progress}%</span>
            </div>
            <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2.5">
              <div
                className={`h-2.5 rounded-full transition-all duration-300 ${getProgressColor(item.progress)}`}
                style={{ width: `${Math.max(item.progress, 3)}%` }} // Минимум 3% для видимости
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
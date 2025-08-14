"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useDashboardStore } from '../../stores/useDashboardStore';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import { createClient } from '@/utils/supabase/client';
import { LoadingCard, ErrorCard } from '../ui/CardStates';
import { ChartDataItem } from '../../types';

export const SectionStatusesCard: React.FC = () => {
  const projectId = useDashboardStore((state) => state.projectId);
  const [statusData, setStatusData] = useState<ChartDataItem[]>([]);
  const [totalSections, setTotalSections] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!projectId) return;

    setIsLoading(true);
    setError(null);

    try {
      const supabase = createClient();

      // Получаем разделы проекта с их статусами
      const { data: sections, error: sectionsError } = await supabase
        .from('sections')
        .select(`
          section_id,
          section_status_id,
          statuses:section_statuses!inner(name, color)
        `)
        .eq('section_project_id', projectId);

      if (sectionsError) {
        throw new Error(sectionsError.message);
      }

      if (!sections || sections.length === 0) {
        setStatusData([]);
        setTotalSections(0);
        return;
      }

      // Группируем по статусам
      const statusCounts: { [key: string]: { count: number; color: string } } = {};
      
      sections.forEach((section: Record<string, any>) => {
        const statusName = section.statuses?.name || 'Не указан';
        const color = section.statuses?.color || '#6B7280';
        
        if (statusCounts[statusName]) {
          statusCounts[statusName].count++;
        } else {
          statusCounts[statusName] = { count: 1, color };
        }
      });

      const formattedData: ChartDataItem[] = Object.entries(statusCounts)
        .map(([name, data]) => ({
          name,
          value: data.count,
          color: data.color,
        }))
        .sort((a, b) => b.value - a.value); // Сортируем по убыванию для лучшего отображения

      const total = formattedData.reduce((sum, item) => sum + item.value, 0);
      setTotalSections(total);
      setStatusData(formattedData);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Не удалось загрузить статусы разделов.';
      // Логируем только в development режиме
      if (process.env.NODE_ENV === 'development') {
        console.error('Error fetching section statuses:', err);
      }
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    let mounted = true;
    
    // 🔑 ИСПРАВЛЕНИЕ: Сброс данных при смене проекта
    setStatusData([]);
    setTotalSections(0);
    setIsLoading(true);
    setError(null);
    
    if (mounted) fetchData();
    
    return () => {
      mounted = false;
    };
  }, [projectId, fetchData]);

  // 🔑 ИСПРАВЛЕНИЕ: Добавляем автообновление
  useAutoRefresh(projectId || '', fetchData);

  if (isLoading) {
    return <LoadingCard title="Загрузка статусов разделов" />;
  }

  if (error) {
    return <ErrorCard message={error} onRetry={() => fetchData()} />;
  }

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 h-full flex flex-col shadow-lg hover:shadow-xl transition-all duration-300">
      <h3 className="text-muted-foreground text-sm mb-4">Статусы разделов</h3>
      
      {totalSections === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground text-sm space-y-2">
          <div className="relative w-28 h-28">
            <svg className="w-full h-full" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="40" fill="none" stroke="#374151" strokeWidth="8" strokeDasharray="4 4" />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="text-xl font-bold text-muted-foreground">0</div>
                <div className="text-sm text-muted-foreground">разделов</div>
              </div>
            </div>
          </div>
          <p className="text-center">Нет данных по разделам</p>
        </div>
      ) : (
        <>
          <div className="flex flex-col items-center flex-1">
            <div className="relative w-28 h-28 mb-3">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="40" fill="none" stroke="#1F2937" strokeWidth="8" />
                {statusData.map((item, index) => {
                  // Правильные математические расчеты для круговой диаграммы
                  const radius = 40;
                  const circumference = 2 * Math.PI * radius; // ≈ 251.33
                  
                  // Процент текущего сегмента
                  const percentage = totalSections > 0 ? (item.value / totalSections) : 0;
                  const segmentLength = circumference * percentage;
                  
                  // Накопительный процент всех предыдущих сегментов
                  const previousPercentage = statusData.slice(0, index)
                    .reduce((sum, prev) => sum + (prev.value / totalSections), 0);
                  const rotationOffset = circumference * previousPercentage;

                  return (
                    <circle
                      key={`${item.name}-${index}`}
                      cx="50"
                      cy="50"
                      r={radius}
                      fill="none"
                      stroke={item.color}
                      strokeWidth="8"
                      strokeLinecap="round"
                      strokeDasharray={`${segmentLength} ${circumference}`}
                      strokeDashoffset={-rotationOffset}
                      className="transition-all duration-300"
                      style={{
                        filter: 'drop-shadow(0 0 2px rgba(0,0,0,0.3))'
                      }}
                    />
                  );
                })}
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-xl font-bold text-card-foreground">{totalSections}</div>
                  <div className="text-sm text-muted-foreground">разделов</div>
                </div>
              </div>
            </div>

            <div 
              className="space-y-1.5 w-full overflow-y-auto pr-1" 
              style={{ 
                maxHeight: '72px', // Уменьшаем высоту чтобы поместиться в карточку
                scrollbarWidth: 'none',
                msOverflowStyle: 'none'
              }}
            >
              <style jsx>{`
                div::-webkit-scrollbar {
                  display: none;
                }
              `}</style>
              {statusData.map((status, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: status.color }}></div>
                    <span className="text-card-foreground text-sm">{status.name}</span>
                  </div>
                  <span className="text-muted-foreground text-sm">{status.value}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
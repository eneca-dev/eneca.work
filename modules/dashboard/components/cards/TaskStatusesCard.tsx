"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useDashboardStore } from '../../stores/useDashboardStore';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import { createClient } from '@/utils/supabase/client';
import { LoadingCard, ErrorCard } from '../ui/CardStates';
import { ChartDataItem } from '../../types';

// Цвета статусов заданий как в макете
const statusColors: { [key: string]: string } = {
  'Согласовано': '#10B981',     // emerald-500 (зеленый)
  'Выполнено': '#059669',       // emerald-600 (темно-зеленый)
  'Принято': '#8B5CF6',         // violet-500 (фиолетовый)
  'Передано': '#3B82F6',        // blue-500 (синий)
  'Создано': '#F59E0B',         // amber-500 (оранжевый)
  'Не указан': '#6B7280'        // gray-500 (серый)
};

export const TaskStatusesCard: React.FC = () => {
  const projectId = useDashboardStore((state) => state.projectId);
  const [taskData, setTaskData] = useState<ChartDataItem[]>([]);
  const [totalTasks, setTotalTasks] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!projectId) return;

    setIsLoading(true);
    setError(null);

    try {
      const supabase = createClient();

      // Получаем задания проекта с их статусами
      const { data: assignments, error: assignmentsError } = await supabase
        .from('assignments')
        .select(`
          assignment_id,
          status
        `)
        .eq('project_id', projectId);

      if (assignmentsError) {
        throw new Error(assignmentsError.message);
      }

      if (!assignments || assignments.length === 0) {
        setTaskData([]);
        setTotalTasks(0);
        return;
      }

      // Группируем по статусам
      const statusCounts: { [key: string]: number } = {};
      
      assignments.forEach((assignment: Record<string, any>) => {
        const status = assignment.status || 'Не указан';
        statusCounts[status] = (statusCounts[status] || 0) + 1;
      });

      const formattedData: ChartDataItem[] = Object.entries(statusCounts)
        .map(([name, value]) => ({
          name,
          value,
          color: statusColors[name] || '#6B7280',
        }))
        .sort((a, b) => b.value - a.value); // Сортировка по убыванию количества

      const total = formattedData.reduce((sum, item) => sum + item.value, 0);
      setTotalTasks(total);
      setTaskData(formattedData);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Не удалось загрузить статусы заданий.';
      // Логируем только в development режиме
      if (process.env.NODE_ENV === 'development') {
        console.error('Error fetching task statuses:', err);
      }
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    let mounted = true;
    
    // 🔑 ИСПРАВЛЕНИЕ: Сброс данных при смене проекта
    setTaskData([]);
    setTotalTasks(0);
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
    return <LoadingCard title="Загрузка статусов заданий" />;
  }

  if (error) {
    return <ErrorCard message={error} onRetry={() => fetchData()} />;
  }

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 h-full flex flex-col shadow-lg hover:shadow-xl transition-all duration-300">
      <h3 className="text-muted-foreground text-sm mb-4">Статусы заданий</h3>
      
      {totalTasks === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground text-sm space-y-2">
          <div className="relative w-28 h-28">
            <svg className="w-full h-full" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="40" fill="none" stroke="#374151" strokeWidth="8" strokeDasharray="4 4" />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="text-xl font-bold text-muted-foreground">0</div>
                <div className="text-sm text-muted-foreground">заданий</div>
              </div>
            </div>
          </div>
          <p className="text-center">Нет данных по заданиям</p>
        </div>
      ) : (
        <>
          <div className="flex flex-col items-center flex-1">
            <div className="relative w-28 h-28 mb-3">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="40" fill="none" stroke="#1F2937" strokeWidth="8" />
                {(() => {
                  const circumference = 2 * Math.PI * 40; // 2πr = ~251.33
                  let cumulativePercentage = 0;
                  
                  return taskData.map((item, index) => {
                    const percentage = item.value / totalTasks;
                    const strokeLength = percentage * circumference;
                    const strokeDasharray = `${strokeLength} ${circumference - strokeLength}`;
                    
                    // Правильное накопительное смещение
                    const rotation = cumulativePercentage * circumference;
                    cumulativePercentage += percentage;
                    
                    return (
                      <circle
                        key={`${item.name}-${index}`}
                        cx="50"
                        cy="50"
                        r="40"
                        fill="none"
                        stroke={item.color}
                        strokeWidth="8"
                        strokeDasharray={strokeDasharray}
                        strokeDashoffset={-rotation}
                        strokeLinecap="round"
                        className="transition-all duration-300"
                      />
                    );
                  });
                })()}
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-xl font-bold text-card-foreground">{totalTasks}</div>
                  <div className="text-sm text-muted-foreground">заданий</div>
                </div>
              </div>
            </div>

            <div 
              className="space-y-1.5 w-full overflow-y-auto pr-1" 
              style={{ 
                maxHeight: '84px',
                scrollbarWidth: 'none',
                msOverflowStyle: 'none'
              }}
            >
              <style jsx>{`
                div::-webkit-scrollbar {
                  display: none;
                }
              `}</style>
              {taskData.map((task, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: task.color }}></div>
                    <span className="text-card-foreground text-xs leading-tight truncate">{task.name}</span>
                  </div>
                  <span className="text-muted-foreground text-xs flex-shrink-0">{task.value}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
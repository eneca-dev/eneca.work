"use client";

import React, { useState, useEffect } from 'react';
import { CheckCircle, Building2 } from 'lucide-react';
import { useDashboardStore } from '../../stores/useDashboardStore';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { createClient } from '@/utils/supabase/client';
import { ProjectInfo, Task } from '../../types';
import { LoadingCard, ErrorCard } from '../ui/CardStates';

interface HierarchyStats {
  stages: number;
  objects: number;
  sections: number;
}

interface SectionStats {
  tasks: {
    total: number;
    totalHours: number;
    completed: number;
    completedHours: number;
    inProgress: number;
    inProgressHours: number;
  };
  assignments: {
    total: number;
  };
}

const getInitials = (firstName?: string, lastName?: string) => {
  if (!firstName && !lastName) return 'NN';
  const f = firstName?.charAt(0) || '';
  const l = lastName?.charAt(0) || '';
  return `${f}${l}`.toUpperCase() || 'NN';
};

const getStatusColor = (status: string) => {
  switch (status?.toLowerCase()) {
    case 'active':
    case 'активный':
      return 'text-primary';
    case 'paused':
    case 'приостановлен':
      return 'text-yellow-600';
    case 'completed':
    case 'завершен':
      return 'text-blue-600';
    case 'cancelled':
    case 'отменен':
      return 'text-red-600';
    default:
      return 'text-gray-600';
  }
};

const getStatusText = (status: string) => {
  switch (status?.toLowerCase()) {
    case 'active':
      return 'Активный';
    case 'paused':
      return 'Приостановлен';
    case 'completed':
      return 'Завершен';
    case 'cancelled':
      return 'Отменен';
    default:
      return status || 'Неизвестно';
  }
};

export const ProjectInfoCard: React.FC = () => {
  const projectId = useDashboardStore((state) => state.projectId);
  const [projectInfo, setProjectInfo] = useState<ProjectInfo | null>(null);
  const [hierarchyStats, setHierarchyStats] = useState({ stages: 0, objects: 0, sections: 0 });
  const [sectionStats, setSectionStats] = useState<SectionStats>({
    tasks: { total: 0, totalHours: 0, completed: 0, completedHours: 0, inProgress: 0, inProgressHours: 0 },
    assignments: { total: 0 }
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async (abortSignal?: AbortSignal) => {
    if (!projectId) return;
    if (abortSignal?.aborted) return; // Проверяем отмену

    setIsLoading(true);
    setError(null);

    try {
      const supabase = createClient();

      // Единый оптимизированный запрос для всех данных
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .select(`
          project_id,
          project_name,
          project_description,
          project_status,
          project_created,
          project_updated,
          manager:profiles!projects_project_manager_fkey(user_id, first_name, last_name, avatar_url),
          lead_engineer:profiles!projects_project_lead_engineer_fkey(user_id, first_name, last_name, avatar_url),
          client:clients!projects_client_id_fkey(client_id, client_name)
        `)
        .eq('project_id', projectId)
        .single();

      if (projectError) {
        throw new Error(projectError.message);
      }
      if (!projectData) {
        setError('Проект не найден.');
        return;
      }

      // Параллельные запросы для статистики
      const [hierarchyResult, assignmentsResult] = await Promise.allSettled([
        // Иерархия: стадии, объекты, разделы - ИСПРАВЛЕННАЯ ЛОГИКА
        Promise.all([
          // Стадии - прямая связь с проектом
          supabase.from('stages').select('stage_id', { count: 'exact' }).eq('stage_project_id', projectId),
          
          // Объекты - ИСПРАВЛЕННЫЙ подход: сначала получаем стадии, потом объекты
          (async () => {
            // Получаем ID всех стадий проекта
            const { data: stageIds } = await supabase
              .from('stages')
              .select('stage_id')
              .eq('stage_project_id', projectId);
            
            const stageIdsList = stageIds?.map(s => s.stage_id) || [];
            
            // Считаем объекты: либо напрямую к проекту, либо к стадиям проекта
            if (stageIdsList.length > 0) {
              return supabase.from('objects').select('object_id', { count: 'exact' })
                .or(`object_project_id.eq.${projectId},object_stage_id.in.(${stageIdsList.join(',')})`);
            } else {
              // Если стадий нет, ищем только объекты с прямой привязкой
              return supabase.from('objects').select('object_id', { count: 'exact' }).eq('object_project_id', projectId);
            }
          })(),
          
          // Разделы - прямая связь с проектом (по данным БД все разделы имеют section_project_id)
          supabase.from('sections').select('section_id', { count: 'exact' }).eq('section_project_id', projectId)
        ]),
        // Прямой запрос статистики заданий (вместо RPC)
        supabase.from('assignments').select('assignment_id', { count: 'exact' }).eq('project_id', projectId)
      ]);

      // Обработка иерархии
      let hierarchyStats = { stages: 0, objects: 0, sections: 0 };
      if (hierarchyResult.status === 'fulfilled') {
        const [stages, objects, sections] = hierarchyResult.value;
        hierarchyStats = {
          stages: stages.count || 0,
          objects: objects.count || 0,
          sections: sections.count || 0
        };
      }

      // Обработка статистики задач (используем прямые запросы)
      let taskStats = {
        total_tasks: 0,
        total_hours: 0,
        completed_tasks: 0,
        completed_hours: 0,
        in_progress_tasks: 0,
        in_progress_hours: 0,
        total_assignments: 0
      };

      // Получаем количество заданий из прямого запроса
      if (assignmentsResult.status === 'fulfilled') {
        taskStats.total_assignments = assignmentsResult.value.count || 0;
      }

      // Объединяем все данные
      const enrichedProject: ProjectInfo = {
        ...projectData,
        ...taskStats,
        manager: Array.isArray(projectData.manager) ? projectData.manager[0] : projectData.manager,
        lead_engineer: Array.isArray(projectData.lead_engineer) ? projectData.lead_engineer[0] : projectData.lead_engineer,
        client: Array.isArray(projectData.client) ? projectData.client[0] : projectData.client
      };

      // Проверяем отмену перед установкой данных
      if (!abortSignal?.aborted) {
        setProjectInfo(enrichedProject);
        setHierarchyStats(hierarchyStats);
      }

    } catch (err) {
      // Игнорируем ошибки отмены
      if ((err instanceof Error && err.name === 'AbortError') || abortSignal?.aborted) return;
      
      const errorMessage = err instanceof Error ? err.message : 'Не удалось загрузить информацию о проекте.';
      // Логируем только в development режиме
      if (process.env.NODE_ENV === 'development') {
        console.error('Error fetching project info:', err);
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

  const fetchSectionStats = async (abortSignal?: AbortSignal) => {
    if (!projectId) return;
    if (abortSignal?.aborted) return;

    try {
      const supabase = createClient();

      // Сначала получаем разделы проекта
      const { data: sections } = await supabase
        .from('sections')
        .select('section_id')
        .eq('section_project_id', projectId);

      const sectionIds = sections?.map(s => s.section_id) || [];

      if (sectionIds.length === 0) {
        // Нет разделов - нет задач
        if (!abortSignal?.aborted) {
          setSectionStats({
            tasks: { total: 0, totalHours: 0, completed: 0, completedHours: 0, inProgress: 0, inProgressHours: 0 },
            assignments: { total: 0 }
          });
        }
        return;
      }

      // Параллельные запросы для статистики по разделам
      const [tasksResult, assignmentsResult] = await Promise.allSettled([
        // Задачи: получаем все задачи проекта через разделы
        supabase
          .from('tasks')
          .select(`
            task_id,
            task_status,
            task_completed,
            task_parent_section,
            loadings!loadings_loading_task_fkey(
              loading_start,
              loading_finish,
              loading_rate,
              loading_status
            )
          `)
          .in('task_parent_section', sectionIds),

        // Задания: простой подсчет по проекту
        supabase
          .from('assignments')
          .select('assignment_id', { count: 'exact' })
          .eq('project_id', projectId)
      ]);

      let taskStats = {
        total: 0,
        totalHours: 0,
        completed: 0,
        completedHours: 0,
        inProgress: 0,
        inProgressHours: 0
      };

      let assignmentStats = { total: 0 };

      // Обработка результатов задач
      if (tasksResult.status === 'fulfilled' && tasksResult.value.data) {
        const tasks = tasksResult.value.data;
        taskStats.total = tasks.length;

        tasks.forEach((task: Task) => {
          const isCompleted = task.task_completed !== null;
          const isActive = task.task_status === 'active' && !isCompleted;

          // Подсчет часов из загрузок
          let taskHours = 0;
          if (task.loadings && Array.isArray(task.loadings)) {
            taskHours = task.loadings
              .filter((loading) => loading.loading_status === 'active')
              .reduce((sum: number, loading) => {
                if (loading.loading_start && loading.loading_finish) {
                  const start = new Date(loading.loading_start);
                  const finish = new Date(loading.loading_finish);
                  const diffMs = finish.getTime() - start.getTime();
                  const days = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1);
                  const rate = loading.loading_rate || 1;
                  return sum + (days * 8 * rate); // 8 часов в день * коэффициент
                }
                return sum;
              }, 0);
          }

          taskStats.totalHours += taskHours;

          if (isCompleted) {
            taskStats.completed++;
            taskStats.completedHours += taskHours;
          } else if (isActive) {
            taskStats.inProgress++;
            taskStats.inProgressHours += taskHours;
          }
        });
      }

      // Обработка результатов заданий
      if (assignmentsResult.status === 'fulfilled') {
        assignmentStats.total = assignmentsResult.value.count || 0;
      }

      // Проверяем отмену перед установкой данных
      if (!abortSignal?.aborted) {
        setSectionStats({
          tasks: taskStats,
          assignments: assignmentStats
        });
      }

    } catch (err) {
      // Игнорируем ошибки отмены
      if ((err instanceof Error && err.name === 'AbortError') || abortSignal?.aborted) return;
      
      // Логируем только в development режиме
      if (process.env.NODE_ENV === 'development') {
        console.error('Error fetching section stats:', err);
      }
      // Не устанавливаем ошибку, чтобы не ломать основную карточку
    }
  };

  useEffect(() => {
    // 🔑 ИСПРАВЛЕНИЕ: Сброс данных при смене проекта
    setProjectInfo(null);
    setHierarchyStats({ stages: 0, objects: 0, sections: 0 });
    setSectionStats({
      tasks: { total: 0, totalHours: 0, completed: 0, completedHours: 0, inProgress: 0, inProgressHours: 0 },
      assignments: { total: 0 }
    });
    setIsLoading(true);
    setError(null);
    
    // 🔑 ДОБАВЛЕНО: AbortController для отмены запросов
    const controller = new AbortController();
    
    fetchData(controller.signal);
    fetchSectionStats(controller.signal);
    
    return () => {
      controller.abort(); // Отменяем запрос при смене проекта
    };
  }, [projectId]);

  // 🔑 ИСПРАВЛЕНИЕ: Используем useAutoRefresh вместо setInterval
  useAutoRefresh(projectId || '', async () => {
    await Promise.all([
      fetchData(),
      fetchSectionStats()
    ]);
  });

  if (isLoading) {
    return <LoadingCard title="Загрузка информации о проекте" />;
  }

  if (error) {
    return <ErrorCard message={error} onRetry={() => {
      fetchData();
      fetchSectionStats();
    }} />;
  }

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3 h-full overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300">
      {projectInfo && (
        <div className="space-y-1">
          {/* Название проекта */}
          <div className="bg-gray-100/50 dark:bg-gray-700/50 p-1.5 rounded">
            <p className="text-muted-foreground text-sm mb-1">Название проекта</p>
            <p className="text-primary font-medium text-sm">
              {projectInfo.project_name}
            </p>
          </div>

          {/* Руководитель проекта */}
          <div className="bg-gray-100/50 dark:bg-gray-700/50 p-1.5 rounded">
            <p className="text-muted-foreground text-sm mb-1">Руководитель проекта</p>
            <div className="flex items-center space-x-2">
              <Avatar className="h-5 w-5 bg-green-500">
                <AvatarImage src={projectInfo.manager?.avatar_url || undefined} />
                <AvatarFallback className="bg-green-500 text-card-foreground text-xs">
                  {getInitials(projectInfo.manager?.first_name, projectInfo.manager?.last_name)}
                </AvatarFallback>
              </Avatar>
              <span className="text-primary font-medium text-sm">
                {projectInfo.manager
                  ? `${projectInfo.manager.first_name} ${projectInfo.manager.last_name}`
                  : 'Не назначен'
                }
              </span>
            </div>
          </div>

          {/* Главный инженер */}
          <div className="bg-gray-100/50 dark:bg-gray-700/50 p-1.5 rounded">
            <p className="text-muted-foreground text-sm mb-1">Главный инженер</p>
            <div className="flex items-center space-x-2">
              <Avatar className="h-5 w-5 bg-blue-500">
                <AvatarImage src={projectInfo.lead_engineer?.avatar_url || undefined} />
                <AvatarFallback className="bg-blue-500 text-card-foreground text-xs">
                  {getInitials(projectInfo.lead_engineer?.first_name, projectInfo.lead_engineer?.last_name)}
                </AvatarFallback>
              </Avatar>
              <span className="text-primary font-medium text-sm">
                {projectInfo.lead_engineer
                  ? `${projectInfo.lead_engineer.first_name} ${projectInfo.lead_engineer.last_name}`
                  : 'Не назначен'
                }
              </span>
            </div>
          </div>

          {/* Клиент */}
          <div className="bg-gray-100/50 dark:bg-gray-700/50 p-1.5 rounded">
            <p className="text-muted-foreground text-sm mb-1">Клиент</p>
            <div className="flex items-center space-x-2">
              <div className="h-5 w-5 bg-purple-500 rounded-full flex items-center justify-center">
                <Building2 className="h-3 w-3 text-card-foreground" />
              </div>
              <span className="text-primary font-medium text-sm">
                {projectInfo.client?.client_name || 'Не указан'}
              </span>
            </div>
          </div>

          {/* Статус проекта */}
          <div className="bg-gray-100/50 dark:bg-gray-700/50 p-1.5 rounded">
            <p className="text-muted-foreground text-sm mb-1">Статус проекта</p>
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-3 w-3 text-green-400" />
              <span className={`font-medium text-sm ${getStatusColor(projectInfo.project_status)}`}>
                {getStatusText(projectInfo.project_status)}
              </span>
            </div>
          </div>

          {/* Иерархия */}
          <div className="bg-gray-100/50 dark:bg-gray-700/50 p-1.5 rounded">
            <h3 className="text-muted-foreground text-sm mb-1">Иерархия</h3>
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-card-foreground text-sm">- Стадии</span>
                <span className="text-card-foreground font-medium text-sm">{hierarchyStats.stages}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-card-foreground text-sm">- Объекты</span>
                <span className="text-card-foreground font-medium text-sm">{hierarchyStats.objects}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-card-foreground text-sm">- Разделы</span>
                <span className="text-card-foreground font-medium text-sm">{hierarchyStats.sections}</span>
              </div>
            </div>
          </div>

          {/* Статистика по разделам */}
          <div className="bg-gray-100/50 dark:bg-gray-700/50 p-1.5 rounded">
            <h3 className="text-muted-foreground text-sm mb-1">Статистика по разделам</h3>
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-card-foreground text-sm">- Задачи</span>
                <span className="text-card-foreground font-medium text-sm">
                  {sectionStats.tasks.total} - {sectionStats.tasks.totalHours}ч
                </span>
              </div>
              <div className="flex justify-between ml-4">
                <span className="text-card-foreground text-sm">- выполненные</span>
                <span className="text-card-foreground font-medium text-sm">
                  {sectionStats.tasks.completed} - {sectionStats.tasks.completedHours}ч
                </span>
              </div>
              <div className="flex justify-between ml-4">
                <span className="text-card-foreground text-sm">- в работе</span>
                <span className="text-card-foreground font-medium text-sm">
                  {sectionStats.tasks.inProgress} - {sectionStats.tasks.inProgressHours}ч
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-card-foreground text-sm">- Задания</span>
                <span className="text-card-foreground font-medium text-sm">{sectionStats.assignments.total}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
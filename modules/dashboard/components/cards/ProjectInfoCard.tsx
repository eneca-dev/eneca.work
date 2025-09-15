"use client";

import React, { useState, useEffect } from 'react';
import { CheckCircle, Building2 } from 'lucide-react';
import { useDashboardStore } from '../../stores/useDashboardStore';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { createClient } from '@/utils/supabase/client';
import { ProjectInfo } from '../../types';
import { LoadingCard, ErrorCard } from '../ui/CardStates';

interface HierarchyStats {
  stages: number;
  objects: number;
  sections: number;
}

interface ProjectDashboardStats {
  decomposition_count: number;
  hours_planned_total: number;
  hours_actual_total: number;
  assignments_total: number;
}

interface SectionStats {
  tasks: {
    count: number;
  };
  hours: {
    planned: number;
    actual: number;
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

import {
  getProjectStatusTextColor,
  getProjectStatusLabel,
} from '@/modules/projects/constants/project-status';

const getStatusColor = (status: string) => getProjectStatusTextColor(status);

const getStatusText = (status: string) => getProjectStatusLabel(status) || (status || 'Неизвестно');

export const ProjectInfoCard: React.FC = () => {
  const projectId = useDashboardStore((state) => state.projectId);
  const [projectInfo, setProjectInfo] = useState<ProjectInfo | null>(null);
  const [hierarchyStats, setHierarchyStats] = useState({ stages: 0, objects: 0, sections: 0 });
  const [sectionStats, setSectionStats] = useState<SectionStats>({
    tasks: { count: 0 },
    hours: { planned: 0, actual: 0 },
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

      // Получаем данные из view_project_dashboard 
      const [dashboardResult, assignmentsResult] = await Promise.allSettled([
        // Данные из view_project_dashboard
        supabase
          .from('view_project_dashboard')
          .select('decomposition_count, hours_planned_total, hours_actual_total')
          .eq('project_id', projectId)
          .single(),

        // Количество заданий по проекту
        supabase
          .from('assignments')
          .select('assignment_id', { count: 'exact' })
          .eq('project_id', projectId)
      ]);

      let dashboardStats: ProjectDashboardStats = {
        decomposition_count: 0,
        hours_planned_total: 0,
        hours_actual_total: 0,
        assignments_total: 0
      };

      // Обработка данных из view_project_dashboard
      if (dashboardResult.status === 'fulfilled' && dashboardResult.value.data) {
        dashboardStats = {
          decomposition_count: dashboardResult.value.data.decomposition_count || 0,
          hours_planned_total: Number(dashboardResult.value.data.hours_planned_total) || 0,
          hours_actual_total: Number(dashboardResult.value.data.hours_actual_total) || 0,
          assignments_total: 0
        };
      }

      // Обработка количества заданий
      if (assignmentsResult.status === 'fulfilled') {
        dashboardStats.assignments_total = assignmentsResult.value.count || 0;
      }

      // Проверяем отмену перед установкой данных
      if (!abortSignal?.aborted) {
        setSectionStats({
          tasks: { count: dashboardStats.decomposition_count },
          hours: {
            planned: dashboardStats.hours_planned_total,
            actual: dashboardStats.hours_actual_total
          },
          assignments: { total: dashboardStats.assignments_total }
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
      tasks: { count: 0 },
      hours: { planned: 0, actual: 0 },
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
        <div className="space-y-1 pt-7">
          {/* Название проекта */}
          <div className="bg-gray-100/50 dark:bg-gray-700/50 p-1.5 rounded">
            <p className="text-muted-foreground text-sm mb-1">Название проекта</p>
            <p
              className="text-primary font-medium text-sm overflow-hidden text-ellipsis"
              style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical'}}
            >
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
                <span className="text-card-foreground font-medium text-sm">{sectionStats.tasks.count}</span>
              </div>
              <div className="flex justify-between ml-4">
                <span className="text-card-foreground text-sm">- план</span>
                <span className="text-card-foreground font-medium text-sm">{sectionStats.hours.planned}ч</span>
              </div>
              <div className="flex justify-between ml-4">
                <span className="text-card-foreground text-sm">- факт</span>
                <span className="text-card-foreground font-medium text-sm">{sectionStats.hours.actual}ч</span>
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
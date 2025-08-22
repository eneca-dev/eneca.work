import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/utils/supabase/client';
import { ProjectStatistics } from '../types';

const fetchProjectStatistics = async (projectId: string): Promise<ProjectStatistics> => {
  try {
    const supabase = createClient();
    // Получаем количество стадий, объектов и разделов
    const [stagesResult, objectsResult, sectionsResult] = await Promise.all([
      supabase
        .from('stages')
        .select('stage_id', { count: 'exact', head: true })
        .eq('stage_project_id', projectId),
      
      supabase
        .from('objects')
        .select('object_id', { count: 'exact', head: true })
        .eq('object_project_id', projectId),
      
      supabase
        .from('sections')
        .select('section_hours', { count: 'exact' })
        .eq('section_project_id', projectId)
    ]);

    if (stagesResult.error) {
      throw new Error(`Ошибка загрузки стадий: ${stagesResult.error.message}`);
    }

    if (objectsResult.error) {
      throw new Error(`Ошибка загрузки объектов: ${objectsResult.error.message}`);
    }

    if (sectionsResult.error) {
      throw new Error(`Ошибка загрузки разделов: ${sectionsResult.error.message}`);
    }

    // Подсчитываем общие часы
    const totalHours =
      sectionsResult.data?.reduce(
        (sum: number, section: Record<string, any>) => sum + Number(section.section_hours ?? 0),
        0
      ) ?? 0;

    // TODO: Добавить подсчет задач когда будет таблица tasks
    const totalTasks = 0;

    return {
      stages_count: stagesResult.count || 0,
      objects_count: objectsResult.count || 0,
      sections_count: sectionsResult.count || 0,
      total_tasks: totalTasks,
      total_hours: totalHours,
    };
  } catch (error) {
    throw new Error(`Ошибка загрузки статистики проекта: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
  }
};

export const useProjectStatistics = (projectId: string) => {
  return useQuery({
    queryKey: ['dashboard', 'project-statistics', projectId],
    queryFn: () => fetchProjectStatistics(projectId),
    enabled: !!projectId,
    staleTime: 2 * 60 * 1000, // 2 минуты
    refetchInterval: 2 * 60 * 1000, // Обновляем каждые 2 минуты
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
};
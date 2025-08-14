import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/utils/supabase/client';
import { ProjectInfo } from '../types';

const fetchProjectInfo = async (projectId: string): Promise<ProjectInfo> => {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('projects')
    .select(`
      project_id,
      project_name,
      project_description,
      project_status,
      project_created,
      project_updated,
      manager:profiles!projects_project_manager_fkey (
        user_id,
        first_name,
        last_name,
        avatar_url
      ),
      lead_engineer:profiles!projects_project_lead_engineer_fkey (
        user_id,
        first_name,
        last_name,
        avatar_url
      ),
      client:clients!projects_client_id_fkey (
        client_id,
        client_name
      )
    `)
    .eq('project_id', projectId)
    .maybeSingle();

  if (error) {
    // Keep message concise; surface details in UI logs if needed
    throw new Error('Ошибка загрузки информации о проекте');
  }
  if (!data) {
    const notFound = new Error('Проект не найден');
    notFound.name = 'NotFoundError';
    throw notFound;
  }

  return {
    project_id: data.project_id,
    project_name: data.project_name,
    project_description: data.project_description,
    project_status: data.project_status,
    project_created: data.project_created,
    project_updated: data.project_updated,
    manager: Array.isArray(data.manager) ? (data.manager[0] ?? null) : (data.manager ?? null),
    lead_engineer: Array.isArray(data.lead_engineer) ? (data.lead_engineer[0] ?? null) : (data.lead_engineer ?? null),
    client: Array.isArray(data.client) ? (data.client[0] ?? null) : (data.client ?? null),
  };
};

export const useProjectInfo = (projectId: string) => {
  return useQuery<ProjectInfo, Error>({
    queryKey: ['dashboard', 'project-info', projectId],
    queryFn: () => fetchProjectInfo(projectId),
    enabled: !!projectId,
    staleTime: 5 * 60 * 1000, // 5 минут - данные редко меняются
    refetchInterval: 5 * 60 * 1000, // Обновляем каждые 5 минут
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    retry: (failureCount, error) => {
      if ((error as Error)?.name === 'NotFoundError' || (error as Error)?.message?.includes('Проект не найден')) {
        return false;
      }
      return failureCount < 3;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    placeholderData: (prev) => prev,
  });
};
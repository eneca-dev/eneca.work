import { useEffect, useCallback } from 'react';
import { useDashboardStore } from '../stores/useDashboardStore';
import { useProjectInfo } from './useProjectInfo';
import { useProjectStatistics } from './useProjectStatistics';

export const useDashboardData = (projectId: string) => {
  const store = useDashboardStore();
  
  // Хуки для получения данных (только реально используемые)
  const projectInfo = useProjectInfo(projectId);
  const statistics = useProjectStatistics(projectId);

  // Синхронизация данных с стором
  useEffect(() => {
    if (projectInfo.data) {
      store.setProjectInfo(projectInfo.data);
    }
  }, [projectInfo.data, store]);

  useEffect(() => {
    if (statistics.data) {
      store.setStatistics(statistics.data);
    }
  }, [statistics.data, store]);

  // Синхронизация состояний загрузки
  useEffect(() => {
    store.setLoading('projectInfo', projectInfo.isLoading);
    if (projectInfo.error) store.setError('projectInfo', projectInfo.error.message);
  }, [projectInfo.isLoading, projectInfo.error, store]);

  useEffect(() => {
    store.setLoading('statistics', statistics.isLoading);
    if (statistics.error) store.setError('statistics', statistics.error.message);
  }, [statistics.isLoading, statistics.error, store]);

  // Функции для обновления данных
  const refetchAll = useCallback(async () => {
    const results = await Promise.allSettled([
      projectInfo.refetch(),
      statistics.refetch(),
    ]);
    
    // Логируем ошибки только в development режиме
    const failures = results.filter(r => r.status === 'rejected');
    if (failures.length > 0 && process.env.NODE_ENV === 'development') {
      console.error('Some refetch operations failed:', failures);
    }
  }, [projectInfo, statistics]);

  const refetchDynamic = useCallback(async () => {
    // Пока что просто вызываем refetchAll, в будущем здесь будут динамические данные
    await refetchAll();
  }, [refetchAll]);

  return {
    data: store.data,
    loading: store.loading,
    refetchAll,
    refetchDynamic,
  };
};
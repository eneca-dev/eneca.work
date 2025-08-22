import { useEffect, useRef, useCallback } from 'react';
import { useDashboardStore } from '../stores/useDashboardStore';

export const useAutoRefresh = (
  projectId: string, 
  refetchFunction: () => Promise<void>
) => {
  const { isOpen, autoRefresh } = useDashboardStore();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isOpenRef = useRef(isOpen);
  const autoRefreshRef = useRef(autoRefresh);

  // Обновляем refs с актуальными значениями
  useEffect(() => {
    isOpenRef.current = isOpen;
    autoRefreshRef.current = autoRefresh;
  }, [isOpen, autoRefresh]);

  const startAutoRefresh = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    intervalRef.current = setInterval(async () => {
      if (isOpenRef.current && autoRefreshRef.current) {
        try {
          await refetchFunction();
        } catch (error) {
          console.error('Ошибка автообновления дашборда:', error);
        }
      }
    }, 30000); // 30 секунд
  }, [refetchFunction]);

  const stopAutoRefresh = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Запускаем автообновление когда дашборд открыт
  useEffect(() => {
    if (isOpen && autoRefresh && projectId) {
      startAutoRefresh();
    } else {
      stopAutoRefresh();
    }

    return () => {
      stopAutoRefresh();
    };
  }, [isOpen, autoRefresh, projectId]);

  // Останавливаем при скрытии вкладки
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopAutoRefresh();
      }
      // Основной effect обработает перезапуск при возвращении видимости
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [stopAutoRefresh]);

  return {
    startAutoRefresh,
    stopAutoRefresh,
    isAutoRefreshActive: !!intervalRef.current,
  };
};
"use client";

import React, { useState, useEffect } from 'react';
import {
  ProjectInfoCard,
  SectionStatusesCard,
  TaskStatusesCard,
  AttentionRequiredCard,
  LastActivityCard,
  PlaceholderCard
} from './components/cards';
import { LastCommentsCard } from './components/cards/LastCommentsCard';
import { DataCompletenessNewCard } from './components/cards/DataCompletenessNewCard';
import { useDashboardStore } from './stores/useDashboardStore';
import { Layers, BarChart3 } from 'lucide-react';

interface InlineDashboardProps {
  projectId: string;
  isClosing?: boolean;
  onClose?: () => void; // Callback для закрытия дашборда
  isModal?: boolean; // Флаг для определения режима отображения
}

export const InlineDashboard: React.FC<InlineDashboardProps> = ({
  projectId,
  isClosing = false,
  onClose,
  isModal = false
}) => {
  const { openDashboard, closeDashboard, resetData } = useDashboardStore();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // 🔑 КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Сбрасываем данные при смене проекта
    resetData(); // Сбрасываем данные СРАЗУ при смене projectId
    
    openDashboard(projectId);
    // Плавное появление дашборда
    const timer = setTimeout(() => setIsVisible(true), 50);
    
    // Закрываем дашборд при размонтировании
    return () => {
      clearTimeout(timer);
      closeDashboard();
    };
  }, [projectId, openDashboard, closeDashboard, resetData]);

  // Эффект для плавного закрытия
  useEffect(() => {
    if (isClosing) {
      setIsVisible(false);
    }
  }, [isClosing]);

  // Если это модальное окно - используем адаптивную сетку
  if (isModal) {
    return (
      <div
        className={`w-full h-full bg-gray-50 dark:bg-gray-900 rounded-xl text-gray-900 dark:text-white transition-all duration-300 ease-out transform ${
          isVisible ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-8'
        }`}
      >
        {/* Адаптивная сетка для модального окна */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4 h-full">
          
          {/* Информация о проекте - занимает всю ширину на мобильных */}
          <div className="md:col-span-1 lg:col-span-1 xl:col-span-1">
            <div className="h-full">
              <ProjectInfoCard />
            </div>
          </div>

          {/* Статусы разделов */}
          <div className="md:col-span-1 lg:col-span-1 xl:col-span-1">
            <div className="h-full">
              <SectionStatusesCard />
            </div>
          </div>

          {/* Разделы проекта */}
          <div className="md:col-span-2 lg:col-span-1 xl:col-span-1">
            <div className="h-full">
              <PlaceholderCard 
                title="Разделы проекта" 
                description="Этот блок находится в разработке."
                icon="construction"
              />
            </div>
          </div>

          {/* Внимание требуется */}
          <div className="md:col-span-1 lg:col-span-1 xl:col-span-1">
            <div className="h-full">
              <AttentionRequiredCard />
            </div>
          </div>

          {/* Статусы заданий */}
          <div className="md:col-span-1 lg:col-span-1 xl:col-span-1">
            <div className="h-full">
              <TaskStatusesCard />
            </div>
          </div>

          {/* Последняя активность */}
          <div className="md:col-span-1 lg:col-span-1 xl:col-span-1">
            <div className="h-full">
              <LastActivityCard />
            </div>
          </div>

          {/* Последние комментарии */}
          <div className="md:col-span-2 lg:col-span-1 xl:col-span-1">
            <div className="h-full">
              <LastCommentsCard />
            </div>
          </div>

          {/* Полнота данных */}
          <div className="md:col-span-2 lg:col-span-2 xl:col-span-1">
            <div className="h-full">
              <DataCompletenessNewCard />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Оригинальный дизайн для встроенного отображения
  return (
    <div
    className={`w-full h-full bg-gray-50 dark:bg-gray-900 rounded-2xl p-6 relative text-gray-900 dark:text-white transition-all duration-300 ease-out transform dashboard-scroll ${
        isVisible ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-8'
      }`}
      style={{
        minWidth: '1200px',
        overflowX: 'auto',
        overflowY: 'hidden',
        scrollbarWidth: 'thin',
        scrollbarColor: 'rgba(156, 163, 175, 0.4) transparent'
      }}
    >
      {/* CSS стили для красивого скролла в WebKit браузерах */}
      <style jsx>{`
        .dashboard-scroll::-webkit-scrollbar {
          height: 8px;
          width: 8px;
        }
        .dashboard-scroll::-webkit-scrollbar-track {
          background: rgba(156, 163, 175, 0.2);
          border-radius: 4px;
        }
        .dashboard-scroll::-webkit-scrollbar-thumb {
          background: rgba(156, 163, 175, 0.4);
          border-radius: 4px;
        }
        .dashboard-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(156, 163, 175, 0.6);
        }
      `}</style>

      {/* ВЕРХНИЙ РЯД */}
      
      {/* Информация о проекте */}
      <div
        className="absolute"
        style={{
          left: '1%',
          top: '2%',
          width: '18%',
          height: '69%',
        }}
      >
        <ProjectInfoCard />
      </div>

        {/* Статусы разделов */}
        <div
        className="absolute"
        style={{
          left: '20%',
          top: '2%',
          width: '18%',
          height: '32%',
        }}
      >
        <SectionStatusesCard />
      </div>

      {/* ЗАГЛУШКА - Разделы проекта */}
      <div
        className="absolute"
        style={{
          left: '39%',
          top: '2%',
          width: '38%',
          height: '32%',
        }}
      >
        <PlaceholderCard 
          title="Разделы проекта" 
          description="Этот блок находится в разработке."
          icon="construction"
        />
      </div>

      {/* Внимание требуется */}
      <div
        className="absolute"
        style={{
          left: '78%',
          top: '2%',
          width: '21%',
          height: '32%',
        }}
      >
        <AttentionRequiredCard />
      </div>

      {/* СРЕДНИЙ РЯД */}

      {/* Статусы заданий */}
      <div
        className="absolute"
        style={{
          left: '20%',
          top: '35%',
          width: '18%',
          height: '32%',
        }}
      >
        <TaskStatusesCard />
      </div>

      {/* Последняя активность */}
      <div
        className="absolute"
        style={{
          left: '39%',
          top: '35%',
          width: '18%',
          height: '32%',
        }}
      >
        <LastActivityCard />
      </div>

      {/* Последние комментарии */}
      <div
        className="absolute"
        style={{
          left: '58%',
          top: '35%',
          width: '18%',
          height: '32%',
        }}
      >
        <LastCommentsCard />
      </div>

      {/* Полнота данных */}
      <div
        className="absolute"
        style={{
          left: '77%',
          top: '35%',
          width: '22%',
          height: '32%',
        }}
      >
        <DataCompletenessNewCard />
      </div>

      {/* НИЖНИЙ РЯД */}

      {/* Заглушка - Графики */}
      <div
        className="absolute"
        style={{
          left: '1%',
          top: '68%',
          width: '98%',
          height: '30%',
        }}
      >
        <PlaceholderCard 
          title="Графики и аналитика" 
          description="Этот блок находится в разработке."
          icon="zap"
        />
      </div>
    </div>
  );
};

export default InlineDashboard;
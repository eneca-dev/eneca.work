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
import { Layers, BarChart3, ChevronLeft, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

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

  // Если это модальное окно - используем полноэкранный layout
  if (isModal) {
    return (
      <div
        className={`w-full h-full bg-gray-50 dark:bg-gray-900 relative text-gray-900 dark:text-white transition-all duration-300 ease-out transform dashboard-scroll ${
          isVisible ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-8'
        }`}
        style={{
          minWidth: '100%',
          minHeight: '100%',
          overflowY: 'hidden',
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(156, 163, 175, 0.4) transparent'
        }}
      >
        {/* Кнопка "назад" внутри дашборда */}
        {onClose && (
          <div className="absolute top-[28px] left-[28px] z-20">
            <Button
              variant="outline"
              onClick={onClose}
              className="h-6 w-[197px] bg-[#F9F9FA] dark:bg-[#2B3544] border-gray-200 dark:border-gray-700 hover:bg-[#F0F0F1] dark:hover:bg-[#232A36] shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center relative"
            >
              <ArrowLeft className="absolute left-2 h-3 w-3" />
              <span className="ml-4">Назад к проектам</span>
            </Button>
          </div>
        )}
       
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
            top: '36%',
            width: '18%',
            height: '35%',
          }}
        >
          <TaskStatusesCard />
        </div>

        {/* ЗАГЛУШКА - Статистика заданий */}
        <div
          className="absolute"
          style={{
            left: '39%',
            top: '36%',
            width: '25%',
            height: '35%',
          }}
        >
          <PlaceholderCard 
            title="Статистика заданий" 
            description="Этот блок находится в разработке."
            icon="zap"
          />
        </div>

        {/* НИЖНИЙ РЯД */}

        {/* Заполненность иерархии */}
        <div
          className="absolute"
          style={{
            left: '1%',
            top: '73%',
            width: '18%',
            height: '26%',
          }}
        >
          <DataCompletenessNewCard />
        </div>

        {/* Последняя активность */}
        <div
          className="absolute"
          style={{
            left: '65%',
            top: '36%',
            width: '34%',
            height: '63%',
          }}
        >
          <LastActivityCard />
        </div>

        {/* Последние комментарии */}
        <div
          className="absolute"
          style={{
            left: '20%',
            top: '73%',
            width: '44%',
            height: '26%',
          }}
        >
          <LastCommentsCard onClose={onClose} />
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
          top: '36%',
          width: '18%',
          height: '35%',
        }}
      >
        <TaskStatusesCard />
      </div>

      {/* ЗАГЛУШКА - Статистика заданий */}
      <div
        className="absolute"
        style={{
          left: '39%',
          top: '36%',
          width: '25%',
          height: '35%',
        }}
      >
        <PlaceholderCard 
          title="Статистика заданий" 
          description="Этот блок находится в разработке."
          icon="zap"
        />
      </div>

      {/* НИЖНИЙ РЯД */}

      {/* Заполненность иерархии */}
      <div
        className="absolute"
        style={{
          left: '1%',
          top: '73%',
          width: '18%',
          height: '26%',
        }}
      >
        <DataCompletenessNewCard />
      </div>

      {/* Последняя активность */}
      <div
        className="absolute"
        style={{
          left: '65%',
          top: '36%',
          width: '34%',
          height: '63%',
        }}
      >
        <LastActivityCard />
      </div>

      {/* Последние комментарии */}
      <div
        className="absolute"
        style={{
          left: '20%',
          top: '73%',
          width: '44%',
          height: '26%',
        }}
      >
        <LastCommentsCard onClose={onClose} />
      </div>
    </div>
  );
};

export default InlineDashboard;
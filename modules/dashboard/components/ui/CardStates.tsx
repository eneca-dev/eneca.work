"use client";

import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

// Интерфейсы для компонентов состояний карточек
interface LoadingCardProps {
  title?: string;
}

interface ErrorCardProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

// Компонент состояния загрузки
export const LoadingCard: React.FC<LoadingCardProps> = ({ title }) => {
  return (
    <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-6 text-gray-900 dark:text-white h-full">
      {/* Заголовок */}
      {title ? (
        <div className="flex items-center gap-2 mb-6">
          <div className="w-4 h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" aria-hidden="true" />
          <span className="text-gray-600 dark:text-gray-300 text-sm font-medium">{title}</span>
        </div>
      ) : (
        <div className="flex items-center gap-2 mb-6" aria-hidden="true">
          <div className="w-4 h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32 animate-pulse" />
        </div>
      )}
      
      {/* Текстовые скелетоны - имитация реального контента */}
      <div className="space-y-4" role="status" aria-live="polite">
        {/* Блок 1: Заголовок секции */}
        <div className="space-y-2">
          <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-3/4" />
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-full" />
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-5/6" />
        </div>
        
        {/* Блок 2: Список элементов */}
        <div className="space-y-3">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-4/5" />
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-3/5" />
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-2/3" />
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-1/2" />
        </div>
        
        {/* Блок 3: Дополнительная информация */}
        <div className="space-y-2">
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-2/5" />
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-3/5" />
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-1/3" />
        </div>
        
        {/* Блок 4: Нижняя секция */}
        <div className="pt-2 space-y-2">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-3/4" />
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-1/2" />
        </div>
      </div>
    </div>
  );
};

// Компонент состояния ошибки
export const ErrorCard: React.FC<ErrorCardProps> = ({ title, message, onRetry }) => {
  return (
    <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-6 text-gray-900 dark:text-white h-full">
      {/* Заголовок */}
      {title && (
        <div className="flex items-center gap-2 mb-6">
          <AlertTriangle className="h-4 w-4 text-gray-400 dark:text-gray-500" />
          <h3 className="text-gray-600 dark:text-gray-300 text-sm font-medium">{title}</h3>
        </div>
      )}
      
      {/* Содержимое ошибки */}
      <div className="flex flex-col items-center justify-center h-full space-y-4">
        {/* Иконка ошибки */}
        <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center">
          <AlertTriangle className="h-6 w-6 text-red-400" aria-hidden="true" />
        </div>
        
        {/* Сообщение об ошибке */}
        <div className="text-center space-y-2" role="alert" aria-live="polite">
          <p className="text-red-400 text-sm font-medium">Loading Error</p>
          <p className="text-gray-500 dark:text-gray-400 text-xs leading-relaxed max-w-xs">
            {message}
          </p>
        </div>
        
        {/* Кнопка повтора */}
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="flex items-center gap-2 px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg transition-colors duration-200 text-sm"
            aria-label="Retry loading data"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Retry
          </button>
        )}
      </div>
    </div>
  );
};

export default { LoadingCard, ErrorCard };

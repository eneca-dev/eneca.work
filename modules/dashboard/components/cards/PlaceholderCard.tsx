"use client";

import React from 'react';
import { Construction, Zap, Clock } from 'lucide-react';

interface PlaceholderCardProps {
  title: string;
  description?: string;
  icon?: 'construction' | 'zap' | 'clock';
  height?: string;
}

const getIcon = (iconType: PlaceholderCardProps['icon']) => {
  switch (iconType) {
    case 'construction':
      return <Construction className="h-8 w-8 text-amber-500" aria-hidden="true" />;
    case 'zap':
      return <Zap className="h-8 w-8 text-purple-500" aria-hidden="true" />;
    case 'clock':
      return <Clock className="h-8 w-8 text-blue-500" aria-hidden="true" />;
    default:
      return <Construction className="h-8 w-8 text-amber-500" aria-hidden="true" />;
  }
};

export const PlaceholderCard: React.FC<PlaceholderCardProps> = ({ 
  title, 
  description, 
  icon = 'construction',
  height 
}) => {
  return (
    <div 
      className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 text-card-foreground h-full hover:border-accent transition-all duration-300 shadow-lg hover:shadow-xl"
      style={height ? { height } : undefined}
    >
      <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
        {/* Анимированная иконка */}
        <div className="relative">
          <div className="absolute inset-0 bg-gray-100 dark:bg-gray-700 rounded-full motion-safe:animate-ping opacity-20" aria-hidden="true" />
          <div className="relative bg-gray-100/50 dark:bg-gray-700/50 p-4 rounded-full">
            {getIcon(icon)}
          </div>
        </div>
        
        {/* Заголовок */}
        <div className="space-y-2">
          <h3 className="text-muted-foreground text-sm font-medium">{title}</h3>
          {description && (
            <p className="text-muted-foreground/70 text-xs leading-relaxed max-w-xs">
              {description}
            </p>
          )}
        </div>
        
        {/* Индикатор разработки */}
        <div className="flex items-center gap-2 px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full">
          <div className="w-2 h-2 bg-amber-500 rounded-full motion-safe:animate-pulse" />
          <span className="text-amber-400 text-xs font-medium">In Development</span>
        </div>
      </div>
    </div>
  );
};

export default PlaceholderCard;
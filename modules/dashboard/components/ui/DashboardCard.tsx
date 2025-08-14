"use client";

import React from 'react';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Info } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface DashboardCardProps {
  title: string;
  icon: LucideIcon;
  children: React.ReactNode;
  className?: string;
  height?: string;
  tooltip?: string;
  onRetry?: () => void;
  error?: string;
}

export const DashboardCard: React.FC<DashboardCardProps> = ({
  title,
  icon: Icon,
  children,
  className,
  height = "auto",
  tooltip,
  onRetry,
  error
}) => {
  return (
    <div 
      className={cn(
        "bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm",
        "flex flex-col",
        className
      )}
      style={{ height }}
    >
      {/* Заголовок карточки */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <Icon className="h-5 w-5 text-muted-foreground" />
          <h3 className="font-medium text-card-foreground">{title}</h3>
        </div>
        
        {tooltip && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-4 w-4 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-xs text-sm">{tooltip}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>

      {/* Содержимое карточки */}
      <div className="flex-1 p-4 overflow-hidden">
        {error ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <p className="text-destructive text-sm mb-2" role="alert" aria-live="polite">{error}</p>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="text-primary hover:text-primary/80 text-sm font-medium"
              >
                Retry
              </button>
            )}
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
};

export default DashboardCard;
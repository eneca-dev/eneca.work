"use client"

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';
import { useSectionStatuses } from '@/modules/statuses-tags/statuses/hooks/useSectionStatuses';
import { useClickOutside } from '@/hooks/useClickOutside';

interface CompactStatusSelectorProps {
  value: string;
  onChange: (statusId: string | null) => void;
  disabled?: boolean;
  currentStatusName?: string;
  currentStatusColor?: string;
}

export function CompactStatusSelector({ 
  value, 
  onChange, 
  disabled = false,
  currentStatusName,
  currentStatusColor
}: CompactStatusSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  
  const { statuses, isLoading } = useSectionStatuses();
  const buttonRef = useRef<HTMLButtonElement>(null);
  
  // Хук для закрытия dropdown при клике вне его
  const dropdownRef = useClickOutside<HTMLDivElement>(() => setIsOpen(false), isOpen);

  const selectedStatus = statuses.find(status => status.id === value);
  const normalizeSectionDescription = (text?: string) => {
    if (!text) return undefined
    return text
  }

  // Вспомогательные функции для окраски бейджа под цвет статуса
  const hexToRgb = (hex: string): { r: number; g: number; b: number } | null => {
    const normalized = hex.replace('#', '');
    if (!(normalized.length === 3 || normalized.length === 6)) return null;
    const full = normalized.length === 3
      ? normalized.split('').map((c) => c + c).join('')
      : normalized;
    const r = parseInt(full.substring(0, 2), 16);
    const g = parseInt(full.substring(2, 4), 16);
    const b = parseInt(full.substring(4, 6), 16);
    return { r, g, b };
  };

  const rgba = (hex: string, alpha: number): string | undefined => {
    const rgb = hexToRgb(hex);
    if (!rgb) return undefined;
    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
  };

  // Функция для обновления позиции дропдауна
  const updateDropdownPosition = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPosition({
        // Для position: fixed координаты должны быть в системе viewport,
        // поэтому НЕ добавляем scrollX/scrollY (rect уже относителен viewport)
        top: rect.bottom,
        left: rect.left,
        width: Math.max(rect.width, 200) // Минимальная ширина для удобства
      });
    }
  };

  const handleToggle = () => {
    if (!disabled) {
      if (!isOpen) {
        updateDropdownPosition();
      }
      setIsOpen(!isOpen);
    }
  };

  const handleSelect = (statusId: string | null) => {
    onChange(statusId);
    setIsOpen(false);
  };

  // Обновляем позицию при изменении размеров окна
  useEffect(() => {
    if (isOpen) {
      const handleResize = () => updateDropdownPosition();
      window.addEventListener('resize', handleResize);
      window.addEventListener('scroll', handleResize);
      
      return () => {
        window.removeEventListener('resize', handleResize);
        window.removeEventListener('scroll', handleResize);
      };
    }
  }, [isOpen]);

  return (
    <>
      <div className="relative w-full">
        <button
          ref={buttonRef}
          type="button"
          onClick={handleToggle}
          className={`
            w-full px-2 py-1 rounded border text-xs transition-colors cursor-pointer
            ${disabled ? 'cursor-not-allowed opacity-70' : 'hover:opacity-90'}
          `}
          disabled={disabled}
          style={(() => {
            const color = selectedStatus?.color || currentStatusColor;
            if (disabled) {
              return {
                backgroundColor: 'var(--tw-bg-opacity, rgba(0,0,0,0))',
                borderColor: 'rgb(229 231 235)',
              } as React.CSSProperties;
            }
            if (color) {
              return {
                backgroundColor: rgba(color, 0.12),
                borderColor: rgba(color, 0.35),
                color: color,
              } as React.CSSProperties;
            }
            return undefined;
          })()}
        >
          <div className="flex items-center justify-between gap-1">
            {isLoading ? (
              <span className="text-gray-500 dark:text-slate-400">...</span>
            ) : selectedStatus ? (
              <div className="flex items-center gap-1 min-w-0">
                <div 
                  className="w-2 h-2 rounded-full flex-shrink-0" 
                  style={{ backgroundColor: selectedStatus.color }}
                />
                <span className="truncate">
                  {selectedStatus.name}
                </span>
              </div>
            ) : currentStatusName && currentStatusColor ? (
              <div className="flex items-center gap-1 min-w-0">
                <div 
                  className="w-2 h-2 rounded-full flex-shrink-0" 
                  style={{ backgroundColor: currentStatusColor }}
                />
                <span className="truncate">
                  {currentStatusName}
                </span>
              </div>
            ) : (
              <span className="truncate text-gray-500 dark:text-slate-400">Без статуса</span>
            )}
            <ChevronDown className="h-3 w-3 flex-shrink-0 text-gray-400 dark:text-slate-500" />
          </div>
        </button>
      </div>

      {isOpen && !disabled && typeof window !== 'undefined' && 
        createPortal(
          <div
            ref={dropdownRef}
            className="fixed z-[9999] bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-md shadow-lg max-h-80 overflow-y-auto"
            style={{
              top: dropdownPosition.top + 4,
              left: dropdownPosition.left,
              width: dropdownPosition.width,
            }}
          >
            {/* Опция "Не выбран" */}
            <div
              onMouseDown={(e) => { e.preventDefault(); handleSelect(null); }}
              className="px-3 py-2 hover:bg-gray-100 dark:hover:bg-slate-700 cursor-pointer border-b border-slate-200 dark:border-slate-700"
            >
              <div className="flex items-center">
                <div className="w-3 h-3 rounded-full mr-2 border border-slate-400 dark:border-slate-400 bg-transparent" />
                <div className="text-gray-600 dark:text-slate-400 text-sm">Без статуса</div>
              </div>
            </div>

            {/* Список статусов с разделителями */}
            <div className="divide-y divide-slate-200 dark:divide-slate-700">
              {statuses.map((status) => (
                <div
                  key={status.id}
                  onMouseDown={(e) => { e.preventDefault(); handleSelect(status.id); }}
                  className="px-3 py-2 hover:bg-gray-100 dark:hover:bg-slate-700 cursor-pointer flex items-center"
                >
                  <div className="flex items-center">
                    <div 
                      className="w-3 h-3 rounded-full mr-2" 
                      style={{ backgroundColor: status.color }}
                    />
                    <div>
                      <div className="font-medium text-slate-800 dark:text-slate-200 text-sm">
                        {status.name}
                      </div>
                      {normalizeSectionDescription(status.description) && (
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {normalizeSectionDescription(status.description)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Сообщение если нет статусов */}
            {statuses.length === 0 && (
              <div className="px-3 py-4 text-center text-gray-500 dark:text-slate-400">
                <span className="text-sm">
                  Нет доступных статусов
                </span>
              </div>
            )}
          </div>,
          document.body
        )
      }
    </>
  );
}

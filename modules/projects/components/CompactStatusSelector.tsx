"use client"

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Search } from 'lucide-react';
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
  const [searchQuery, setSearchQuery] = useState('');
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  
  const { statuses, isLoading } = useSectionStatuses();
  const buttonRef = useRef<HTMLButtonElement>(null);
  
  // Хук для закрытия dropdown при клике вне его
  const dropdownRef = useClickOutside<HTMLDivElement>(() => setIsOpen(false), isOpen);

  const selectedStatus = statuses.find(status => status.id === value);

  // Функция для обновления позиции дропдауна
  const updateDropdownPosition = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX,
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

  // Фильтрация статусов по поисковому запросу
  const filteredStatuses = React.useMemo(() => {
    if (!searchQuery.trim()) {
      return statuses;
    }

    const query = searchQuery.toLowerCase();
    return statuses.filter(status => 
      status.name.toLowerCase().includes(query) ||
      (status.description && status.description.toLowerCase().includes(query))
    );
  }, [statuses, searchQuery]);

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
            w-full px-2 py-1 rounded-full border text-xs transition-colors
            ${disabled 
              ? 'bg-gray-100 dark:bg-slate-700 cursor-not-allowed border-gray-200 dark:border-slate-600' 
              : selectedStatus || currentStatusName
                ? 'border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700 cursor-pointer'
                : 'border-gray-300 dark:border-slate-500 hover:border-gray-400 dark:hover:border-slate-400 cursor-pointer text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300'
            }
          `}
          disabled={disabled}
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
                <span className="truncate text-gray-700 dark:text-slate-300">
                  {selectedStatus.name}
                </span>
              </div>
            ) : currentStatusName && currentStatusColor ? (
              <div className="flex items-center gap-1 min-w-0">
                <div 
                  className="w-2 h-2 rounded-full flex-shrink-0" 
                  style={{ backgroundColor: currentStatusColor }}
                />
                <span className="truncate text-gray-700 dark:text-slate-300">
                  {currentStatusName}
                </span>
              </div>
            ) : (
              <span className="truncate">Без статуса</span>
            )}
            <ChevronDown className="h-3 w-3 flex-shrink-0 text-gray-400 dark:text-slate-500" />
          </div>
        </button>
      </div>

      {isOpen && !disabled && typeof window !== 'undefined' && 
        createPortal(
          <div
            ref={dropdownRef}
            className="fixed z-[9999] bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg shadow-lg max-h-64 overflow-y-auto"
            style={{
              top: dropdownPosition.top + 4,
              left: dropdownPosition.left,
              width: dropdownPosition.width,
            }}
          >
            {/* Поле поиска */}
            {statuses.length > 0 && (
              <div className="p-2 border-b dark:border-slate-600">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-gray-400 dark:text-slate-500" />
                  <input
                    type="text"
                    placeholder="Поиск..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full pl-7 pr-6 py-1.5 text-xs bg-gray-50 dark:bg-slate-600 border border-gray-200 dark:border-slate-500 rounded text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-600 focus:border-transparent"
                  />
                  {searchQuery && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setSearchQuery('')
                      }}
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:text-slate-500 dark:hover:text-slate-300"
                    >
                      <span className="text-xs">×</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Опция "Не выбран" */}
            <div
              onClick={() => handleSelect(null)}
              className="px-3 py-2 hover:bg-gray-100 dark:hover:bg-slate-600 cursor-pointer border-b dark:border-slate-600"
            >
              <div className="text-gray-500 dark:text-slate-400 text-sm">
                Без статуса
              </div>
            </div>

            {/* Список статусов */}
            {filteredStatuses.length === 0 && searchQuery ? (
              <div className="px-3 py-4 text-center">
                <div className="text-xs text-gray-500 dark:text-slate-400 mb-1">
                  Статусы не найдены
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setSearchQuery('')
                  }}
                  className="text-xs text-teal-600 dark:text-teal-400 hover:underline"
                >
                  Очистить поиск
                </button>
              </div>
            ) : (
              filteredStatuses.map((status) => (
                <div
                  key={status.id}
                  onClick={() => handleSelect(status.id)}
                  className="px-3 py-2 hover:bg-gray-100 dark:hover:bg-slate-600 cursor-pointer flex items-center"
                >
                  <div className="flex items-center">
                    <div 
                      className="w-3 h-3 rounded-full mr-2" 
                      style={{ backgroundColor: status.color }}
                    />
                    <div>
                      <div className="font-medium dark:text-white text-sm">
                        {status.name}
                      </div>
                      {status.description && (
                        <div className="text-xs text-gray-500 dark:text-slate-400">
                          {status.description}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}

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

"use client"

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Tag, Search } from 'lucide-react';
import { useSectionStatuses } from '../hooks/useSectionStatuses';
import { useClickOutside } from '@/hooks/useClickOutside';

interface StatusSelectorProps {
  value: string;
  onChange: (statusId: string) => void;
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;
}



export function StatusSelector({ 
  value, 
  onChange, 
  disabled = false, 
  required = false,
  placeholder = "Выберите статус..."
}: StatusSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  
  const { statuses, isLoading } = useSectionStatuses();
  const buttonRef = useRef<HTMLButtonElement>(null);
  
  // Хук для закрытия dropdown при клике вне его
  const dropdownRef = useClickOutside<HTMLDivElement>(() => setIsOpen(false), isOpen);

  // useSectionStatuses хук уже автоматически подписан на все события статусов
  // Убираем дублирующую подписку чтобы избежать лишних запросов к базе

  const selectedStatus = statuses.find(status => status.id === value);

  // Функция для обновления позиции дропдауна
  const updateDropdownPosition = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX,
        width: rect.width
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

  const handleSelect = (statusId: string) => {
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
      <div className="relative">
        <button
          ref={buttonRef}
          type="button"
          onClick={handleToggle}
          className={`
            w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-emerald-700 focus:border-transparent dark:bg-slate-800 dark:text-white
            ${disabled 
              ? 'bg-gray-100 dark:bg-slate-700 cursor-not-allowed' 
              : 'bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700'
            }
          `}
          disabled={disabled}
        >
          <div className="flex items-center">
            <Tag className="h-4 w-4 mr-2 text-slate-400" />
            {isLoading ? (
              <span className="text-slate-500">Загрузка...</span>
            ) : selectedStatus ? (
              <div className="flex items-center">
                <div 
                  className="w-3 h-3 rounded-full mr-2" 
                  style={{ backgroundColor: selectedStatus.color }}
                />
                <span>{selectedStatus.name}</span>
              </div>
            ) : (
              <span className="text-slate-500">{placeholder}</span>
            )}
          </div>
          <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
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
                    className="w-full pl-7 pr-6 py-1.5 text-xs bg-gray-50 dark:bg-slate-600 border border-gray-200 dark:border-slate-500 rounded text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-slate-400 focus:outline-none focus:focus:ring-1 focus:ring-emerald-600 focus:border-transparent dark:bg-slate-800 dark:text-white"
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
            {!required && (
              <div
                onClick={() => handleSelect('')}
                className="px-3 py-2 hover:bg-gray-100 dark:hover:bg-slate-600 cursor-pointer border-b dark:border-slate-600"
              >
                <div className="text-gray-500 dark:text-slate-400">
                  Не выбран
                </div>
              </div>
            )}

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
                      <div className="font-medium dark:text-white">
                        {status.name}
                      </div>
                      {status.description && (
                        <div className="text-sm text-gray-500 dark:text-slate-400">
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
                <span>
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
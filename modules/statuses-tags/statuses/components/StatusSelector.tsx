"use client"

import React, { useState } from 'react';
import { ChevronDown, Tag } from 'lucide-react';
import { SectionStatus } from '../types';
import { useSectionStatuses } from '../hooks/useSectionStatuses';

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
  const { statuses, loading } = useSectionStatuses();

  const selectedStatus = statuses.find(status => status.id === value);

  const handleSelect = (statusId: string) => {
    onChange(statusId);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`
          w-full px-3 py-2 pr-10 border rounded-lg text-left focus:ring-2 focus:ring-orange-500 focus:border-transparent
          ${disabled 
            ? 'bg-gray-100 dark:bg-slate-700 cursor-not-allowed' 
            : 'bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700'
          }
          border-gray-300 dark:border-slate-600 dark:text-white
          ${!selectedStatus && required ? 'border-red-300 dark:border-red-600' : ''}
        `}
        disabled={disabled}
        onBlur={() => {
          setTimeout(() => setIsOpen(false), 200);
        }}
      >
        <div className="flex items-center">
          <Tag className="h-4 w-4 mr-2 text-slate-400" />
          {loading ? (
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

      {isOpen && !disabled && (
        <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg shadow-lg max-h-48 overflow-y-auto">
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
          {statuses.map((status) => (
            <div
              key={status.id}
              onClick={() => handleSelect(status.id)}
              className="px-3 py-2 hover:bg-gray-100 dark:hover:bg-slate-600 cursor-pointer flex items-center"
            >
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
          ))}
        </div>
      )}
    </div>
  );
} 
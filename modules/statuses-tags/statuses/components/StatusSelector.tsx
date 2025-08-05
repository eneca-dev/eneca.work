"use client"

import React, { useState, useEffect } from 'react';
import { ChevronDown, Tag, Settings, Plus, Edit2, Trash2, X } from 'lucide-react';
import { SectionStatus } from '../types';
import { useSectionStatuses } from '../hooks/useSectionStatuses';
import { StatusForm } from './StatusForm';
import { useUiStore } from '@/stores/useUiStore';

interface StatusSelectorProps {
  value: string;
  onChange: (statusId: string) => void;
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;
}

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  statusName: string;
}

const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  statusName
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-slate-800 rounded-lg p-6 max-w-md w-full mx-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold dark:text-white">
            Подтвердите удаление
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <p className="text-gray-600 dark:text-gray-300 mb-6">
          Вы уверены, что хотите удалить статус <strong>"{statusName}"</strong>?
          Это действие нельзя отменить.
        </p>
        
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700"
          >
            Отмена
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
          >
            Удалить
          </button>
        </div>
      </div>
    </div>
  );
};

export function StatusSelector({ 
  value, 
  onChange, 
  disabled = false, 
  required = false,
  placeholder = "Выберите статус..."
}: StatusSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showManageMode, setShowManageMode] = useState(false);
  const [showStatusForm, setShowStatusForm] = useState(false);
  const [editingStatus, setEditingStatus] = useState<SectionStatus | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingStatus, setDeletingStatus] = useState<SectionStatus | null>(null);
  
  const { statuses, loading, deleteStatus } = useSectionStatuses();
  const { setNotification } = useUiStore();

  // useSectionStatuses хук уже автоматически подписан на все события статусов
  // Убираем дублирующую подписку чтобы избежать лишних запросов к базе

  const selectedStatus = statuses.find(status => status.id === value);

  const handleSelect = (statusId: string) => {
    if (!showManageMode) {
      onChange(statusId);
      setIsOpen(false);
    }
  };

  const handleCreateStatus = () => {
    setEditingStatus(null);
    setShowStatusForm(true);
  };

  const handleEditStatus = (status: SectionStatus, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingStatus(status);
    setShowStatusForm(true);
  };

  const handleDeleteStatus = (status: SectionStatus, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeletingStatus(status);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!deletingStatus) return;
    
    try {
      await deleteStatus(deletingStatus.id);
      setNotification(`Статус "${deletingStatus.name}" удален`);
      setShowDeleteModal(false);
      setDeletingStatus(null);
      
      // Если удалили выбранный статус, сбрасываем выбор
      if (value === deletingStatus.id) {
        onChange('');
      }
    } catch (error) {
      console.warn('Ошибка удаления статуса:', error);
      setNotification('Ошибка при удалении статуса');
    }
  };

  const handleStatusFormSuccess = () => {
    setShowStatusForm(false);
    setEditingStatus(null);
  };

  const toggleManageMode = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowManageMode(!showManageMode);
  };

  return (
    <>
      <div className="relative flex">
        <button
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          className={`
            flex-1 px-3 py-2 pr-10 border-l border-t border-b rounded-l-lg text-left focus:ring-2 focus:ring-orange-500 focus:border-transparent
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
        
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            toggleManageMode(e);
          }}
          className={`
            px-2 py-2 border-r border-t border-b rounded-r-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent
            ${disabled 
              ? 'bg-gray-100 dark:bg-slate-700 cursor-not-allowed' 
              : showManageMode 
                ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 border-orange-300 dark:border-orange-600' 
                : 'bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
            }
            border-gray-300 dark:border-slate-600
            ${!selectedStatus && required ? 'border-red-300 dark:border-red-600' : ''}
          `}
          disabled={disabled}
          title={showManageMode ? "Выйти из режима управления" : "Управление статусами"}
        >
          <Settings className="h-4 w-4" />
        </button>

        {isOpen && !disabled && (
          <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg shadow-lg max-h-64 overflow-y-auto">
            {/* Заголовок режима управления */}
            {showManageMode && (
              <div className="px-3 py-2 border-b dark:border-slate-600 bg-orange-50 dark:bg-orange-900/20">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-orange-700 dark:text-orange-300">
                    Режим управления статусами
                  </span>
                  <button
                    onClick={handleCreateStatus}
                    className="p-1 rounded hover:bg-orange-200 dark:hover:bg-orange-800 text-orange-600 dark:text-orange-400"
                    title="Создать новый статус"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Опция "Не выбран" */}
            {!required && !showManageMode && (
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
            {statuses.map((status) => (
              <div
                key={status.id}
                onClick={() => handleSelect(status.id)}
                className={`px-3 py-2 hover:bg-gray-100 dark:hover:bg-slate-600 cursor-pointer flex items-center justify-between group ${
                  showManageMode ? 'pr-16' : ''
                }`}
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

                {/* Кнопки управления */}
                {showManageMode && (
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => handleEditStatus(status, e)}
                      className="p-1 rounded text-blue-500 hover:bg-blue-100 dark:hover:bg-blue-900/30"
                      title="Редактировать статус"
                    >
                      <Edit2 className="h-3 w-3" />
                    </button>
                    <button
                      onClick={(e) => handleDeleteStatus(status, e)}
                      className="p-1 rounded text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30"
                      title="Удалить статус"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>
            ))}

            {/* Сообщение если нет статусов */}
            {statuses.length === 0 && (
              <div className="px-3 py-4 text-center text-gray-500 dark:text-slate-400">
                <span>
                  Нет статусов. 
                  <button
                    onClick={handleCreateStatus}
                    className="text-orange-500 hover:text-orange-600 ml-1"
                  >
                    Создать первый?
                  </button>
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Модальные окна */}
      <StatusForm
        isOpen={showStatusForm}
        onClose={() => setShowStatusForm(false)}
        status={editingStatus}
        onSuccess={handleStatusFormSuccess}
      />

      <DeleteConfirmModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setDeletingStatus(null);
        }}
        onConfirm={confirmDelete}
        statusName={deletingStatus?.name || ''}
      />
    </>
  );
} 
"use client"

import React, { useState } from 'react';
import { Plus, Edit, Trash2, Loader2 } from 'lucide-react';
import { useSectionStatuses } from '../hooks/useSectionStatuses';
import { SectionStatus } from '../types';
import { StatusForm } from './StatusForm';
import { useUiStore } from '@/stores/useUiStore';

export function StatusesList() {
  const [showForm, setShowForm] = useState(false);
  const [editingStatus, setEditingStatus] = useState<SectionStatus | null>(null);
  const [deletingStatusId, setDeletingStatusId] = useState<string | null>(null);

  const { statuses, loading, deleteStatus } = useSectionStatuses();
  const { setNotification } = useUiStore();

  const handleEdit = (status: SectionStatus) => {
    setEditingStatus(status);
    setShowForm(true);
  };

  const handleDelete = async (status: SectionStatus) => {
    if (!confirm(`Вы уверены, что хотите удалить статус "${status.name}"?`)) {
      return;
    }

    setDeletingStatusId(status.id);
    try {
      const success = await deleteStatus(status.id);
      if (success) {
        setNotification(`Статус "${status.name}" удален`);
      }
    } catch (error) {
      console.error('Ошибка удаления статуса:', error);
    } finally {
      setDeletingStatusId(null);
    }
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingStatus(null);
  };

  const handleFormSuccess = () => {
    // После успешного создания/обновления список обновится автоматически через хук
  };

  if (loading && statuses.length === 0) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
        <span className="ml-2 text-gray-500">Загрузка статусов...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold dark:text-white">Статусы секций</h2>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors"
        >
          <Plus className="h-4 w-4 mr-2" />
          Добавить статус
        </button>
      </div>

      {statuses.length === 0 ? (
        <div className="text-center py-8 text-gray-500 dark:text-slate-400">
          Нет созданных статусов. Создайте первый статус для секций проектов.
        </div>
      ) : (
        <div className="grid gap-3">
          {statuses.map((status) => (
            <div
              key={status.id}
              className="flex items-center justify-between p-4 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg hover:shadow-md transition-shadow"
            >
              <div className="flex items-center space-x-3">
                <div 
                  className="w-6 h-6 rounded-full border border-gray-300 dark:border-slate-500" 
                  style={{ backgroundColor: status.color }}
                />
                <div>
                  <h3 className="font-medium dark:text-white">{status.name}</h3>
                  {status.description && (
                    <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
                      {status.description}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleEdit(status)}
                  className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                  title="Редактировать"
                >
                  <Edit className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleDelete(status)}
                  disabled={deletingStatusId === status.id}
                  className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50"
                  title="Удалить"
                >
                  {deletingStatusId === status.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <StatusForm
        isOpen={showForm}
        onClose={handleCloseForm}
        status={editingStatus}
        onSuccess={handleFormSuccess}
      />
    </div>
  );
} 
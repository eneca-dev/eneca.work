"use client"

import React, { useState } from 'react';
import { Plus, Edit2, Trash2, Settings, X } from 'lucide-react';
import { Modal, ModalButton } from '@/components/modals';
import { useSectionStatuses } from '../hooks/useSectionStatuses';
import { SectionStatus } from '../types';
import { StatusForm } from './StatusForm';
import { useUiStore } from '@/stores/useUiStore';

interface StatusManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
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

export function StatusManagementModal({ isOpen, onClose }: StatusManagementModalProps) {
  const [showStatusForm, setShowStatusForm] = useState(false);
  const [editingStatus, setEditingStatus] = useState<SectionStatus | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingStatus, setDeletingStatus] = useState<SectionStatus | null>(null);
  
  const { statuses, loading, deleteStatus } = useSectionStatuses();
  const { setNotification } = useUiStore();

  const handleCreateStatus = () => {
    setEditingStatus(null);
    setShowStatusForm(true);
  };

  const handleEditStatus = (status: SectionStatus) => {
    setEditingStatus(status);
    setShowStatusForm(true);
  };

  const handleDeleteStatus = (status: SectionStatus) => {
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
    } catch (error) {
      console.error('Ошибка удаления статуса:', error);
      setNotification('Ошибка при удалении статуса');
    }
  };

  const handleStatusFormSuccess = () => {
    setShowStatusForm(false);
    setEditingStatus(null);
    
    // Принудительно обновляем все статусы во всех компонентах
    setTimeout(() => {
      console.log('🔄 Принудительное обновление статусов после успешной операции');
      window.dispatchEvent(new CustomEvent('forceStatusRefresh'));
    }, 100);
  };

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} size="lg">
        <Modal.Header 
          title="Управление статусами"
          subtitle="Создание, редактирование и удаление статусов секций"
        />
        
        <Modal.Body>
          <div className="space-y-4">
            {/* Кнопка создания нового статуса */}
            <div className="flex justify-between items-center">
              <h4 className="text-lg font-medium dark:text-slate-200 text-slate-800">
                Статусы секций ({statuses.length})
              </h4>
              <button
                onClick={handleCreateStatus}
                className="flex items-center gap-2 px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors"
              >
                <Plus className="h-4 w-4" />
                Создать статус
              </button>
            </div>

            {/* Список статусов */}
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {loading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500 mx-auto"></div>
                  <p className="text-sm dark:text-slate-400 text-slate-500 mt-3">Загрузка статусов...</p>
                </div>
              ) : statuses.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                    <Settings className="w-6 h-6 dark:text-slate-400 text-slate-500" />
                  </div>
                  <p className="dark:text-slate-300 text-slate-700 font-medium">Нет созданных статусов</p>
                  <p className="text-sm dark:text-slate-400 text-slate-500 mt-1">
                    Создайте первый статус для работы с секциями
                  </p>
                </div>
              ) : (
                statuses.map((status) => (
                  <div
                    key={status.id}
                    className="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
                  >
                    <div className="flex items-center flex-1">
                      <div 
                        className="w-6 h-6 rounded-full mr-3 border border-gray-300 dark:border-slate-500" 
                        style={{ backgroundColor: status.color }}
                      />
                      <div className="flex-1">
                        <div className="font-medium dark:text-white text-slate-900">
                          {status.name}
                        </div>
                        {status.description && (
                          <div className="text-sm text-gray-500 dark:text-slate-400 mt-1">
                            {status.description}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Кнопки управления */}
                    <div className="flex items-center gap-2 ml-4">
                      <button
                        onClick={() => handleEditStatus(status)}
                        className="p-2 rounded-lg text-teal-600 dark:text-teal-400 hover:bg-teal-100 dark:hover:bg-teal-900/30 transition-colors"
                        title="Редактировать статус"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteStatus(status)}
                        className="p-2 rounded-lg text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                        title="Удалить статус"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </Modal.Body>

        <Modal.Footer>
          <ModalButton variant="cancel" onClick={onClose}>
            Закрыть
          </ModalButton>
        </Modal.Footer>
      </Modal>

      {/* Форма создания/редактирования статуса */}
      <StatusForm
        isOpen={showStatusForm}
        onClose={() => setShowStatusForm(false)}
        status={editingStatus}
        onSuccess={handleStatusFormSuccess}
      />

      {/* Модальное окно подтверждения удаления */}
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
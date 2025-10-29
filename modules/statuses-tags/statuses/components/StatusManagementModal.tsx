"use client"

import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Edit2, Trash2, Settings, X, Search } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useSectionStatusesStore } from '../store';
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
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] dark:bg-gray-800 dark:border-gray-700">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            Подтвердите удаление
          </DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Это действие нельзя отменить
          </p>
        </DialogHeader>
        
        <div className="py-4">
          <p className="text-foreground mb-4">
            Вы уверены, что хотите удалить статус <strong>"{statusName}"</strong>?
          </p>
          <p className="text-sm text-muted-foreground">
            Все разделы, использующие этот статус, автоматически получат статус "Без статуса".
            Это действие нельзя отменить.
          </p>
        </div>
        
        <DialogFooter className="flex justify-between">
          <Button variant="outline" onClick={onClose}>
            Отмена
          </Button>
          <Button 
            variant="destructive"
            onClick={onConfirm}
          >
            Удалить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export function StatusManagementModal({ isOpen, onClose }: StatusManagementModalProps) {
  const [showStatusForm, setShowStatusForm] = useState(false);
  const [editingStatus, setEditingStatus] = useState<SectionStatus | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingStatus, setDeletingStatus] = useState<SectionStatus | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  const statuses = useSectionStatusesStore(state => state.statuses);
  const isLoading = useSectionStatusesStore(state => state.isLoading);
  const deleteStatus = useSectionStatusesStore(state => state.deleteStatus);
  const { setNotification } = useUiStore();

  // Фильтрация статусов по поисковому запросу
  const filteredStatuses = useMemo(() => {
    if (!searchQuery.trim()) {
      return statuses;
    }

    const query = searchQuery.toLowerCase();
    return statuses.filter(status => 
      status.name.toLowerCase().includes(query) ||
      (status.description && status.description.toLowerCase().includes(query))
    );
  }, [statuses, searchQuery]);

  // Обработчик закрытия модального окна
  const handleClose = () => {
    // Все компоненты уже обновились автоматически через события statusCreated/statusUpdated/statusDeleted
    // Убираем принудительное событие forceStatusRefresh как ненужное
    
    onClose();
  };

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
      setNotification(`Статус "${deletingStatus.name}" удален`, 'success');
      setShowDeleteModal(false);
      setDeletingStatus(null);
    } catch (error) {
      console.warn('Ошибка удаления статуса:', error);
      setNotification('Ошибка при удалении статуса', 'error');
    }
  };

  const handleStatusFormSuccess = () => {
    setShowStatusForm(false);
    setEditingStatus(null);
    
    // Обновление списка статусов происходит автоматически через события
    // Убираем принудительный вызов loadStatuses() чтобы избежать двойного обновления
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-[800px] max-h-[80vh] flex flex-col overflow-hidden dark:bg-gray-800 dark:border-gray-700">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-foreground">
              Управление статусами
            </DialogTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Создание, редактирование и удаление статусов разделов
            </p>
          </DialogHeader>
          
          <div className="py-4 flex-1 overflow-y-auto">
            {/* Заголовок с кнопкой создания */}
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-3">
                <h4 className="text-lg font-medium text-foreground">
                  Статусы разделов
                </h4>
                {statuses.length > 0 && (
                  <Badge 
                    variant="secondary" 
                    className="bg-primary/10 text-primary border-primary/20 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700/50"
                  >
                    {statuses.length}
                  </Badge>
                )}
              </div>
              
              <Button
                onClick={handleCreateStatus}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                <Plus className="h-4 w-4 mr-2" />
                Создать статус
              </Button>
            </div>

            {/* Поле поиска */}
            {statuses.length > 0 && (
              <div className="relative mb-6">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Поиск по названию или описанию..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-400"
                />
                {searchQuery && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0 hover:bg-muted dark:text-gray-400 dark:hover:bg-gray-600 dark:hover:text-gray-200"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
            )}

            {/* Список статусов */}
            <div className="space-y-3">
              {isLoading ? (
                <div className="flex justify-center items-center py-12">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                    <p className="text-muted-foreground">Загрузка статусов...</p>
                  </div>
                </div>
              ) : statuses.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                    <Settings className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-medium text-foreground mb-2">Нет созданных статусов</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Создайте первый статус для работы с разделами
                  </p>
                  <Button
                    onClick={handleCreateStatus}
                    variant="outline"
                    className="border-primary text-primary hover:bg-primary/10 dark:border-blue-500 dark:text-blue-400 dark:hover:bg-blue-900/20"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Создать статус
                  </Button>
                </div>
              ) : filteredStatuses.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                    <Search className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-medium text-foreground mb-2">Статусы не найдены</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    По запросу "{searchQuery}" ничего не найдено
                  </p>
                  <Button
                    onClick={() => setSearchQuery('')}
                    variant="outline"
                    className="border-primary text-primary hover:bg-primary/10 dark:border-blue-500 dark:text-blue-400 dark:hover:bg-blue-900/20"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Очистить поиск
                  </Button>
                </div>
              ) : (
                filteredStatuses.map((status) => (
                  <div
                    key={status.id}
                    className="flex items-center justify-between p-3 bg-card rounded-lg border border-border hover:bg-muted/50 transition-colors dark:bg-gray-700 dark:border-gray-600 dark:hover:bg-gray-600"
                  >
                    <div className="flex items-center flex-1">
                      <div 
                        className="w-6 h-6 rounded-full mr-3 border border-border shadow-sm" 
                        style={{ backgroundColor: status.color }}
                      />
                      <div className="flex-1">
                        <div className="font-medium text-foreground">
                          {status.name}
                        </div>
                        {status.description && (
                          <div className="text-sm text-muted-foreground mt-1">
                            {status.description}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Кнопки управления */}
                    <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditStatus(status)}
                        className="text-green-600 hover:text-green-500 hover:bg-green-50 dark:text-green-400 dark:hover:text-green-300 dark:hover:bg-green-900/20"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteStatus(status)}
                        className="text-red-600 hover:text-red-500 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-900/20"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <DialogFooter className="mt-0">
            <Button 
              variant="outline" 
              onClick={handleClose}
              className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-600"
            >
              Закрыть
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
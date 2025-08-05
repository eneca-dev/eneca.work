"use client"

import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Edit2, Trash2, Settings, X, Search } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
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
  
  const { statuses, loading, deleteStatus, loadStatuses } = useSectionStatuses();
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

  // Слушаем события изменения статусов для автоматического обновления
  useEffect(() => {
    // Проверяем, что мы в браузере
    if (typeof window === 'undefined') return;
    
    const handleStatusChange = (event: Event) => {
      const customEvent = event as CustomEvent;
      console.log('🔄 StatusManagementModal: Получено событие', event.type, customEvent.detail);
      console.log('🔄 StatusManagementModal: Обновление списка статусов');
      
      // Принудительно перезагружаем статусы
      loadStatuses();
    };

    console.log('🔧 StatusManagementModal: Подписка на события статусов');
    
    // Подписываемся на все события изменения статусов
    window.addEventListener('statusCreated', handleStatusChange);
    window.addEventListener('statusUpdated', handleStatusChange);
    window.addEventListener('statusDeleted', handleStatusChange);

    return () => {
      console.log('🔧 StatusManagementModal: Отписка от событий статусов');
      // Отписываемся при размонтировании компонента
      if (typeof window !== 'undefined') {
        window.removeEventListener('statusCreated', handleStatusChange);
        window.removeEventListener('statusUpdated', handleStatusChange);
        window.removeEventListener('statusDeleted', handleStatusChange);
      }
    };
  }, [loadStatuses]);

  // Обработчик закрытия модального окна
  const handleClose = () => {
    console.log('🔄 StatusManagementModal: Закрытие модального окна, автоматическое обновление уже произошло через события');
    
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
      setNotification(`Статус "${deletingStatus.name}" удален`);
      setShowDeleteModal(false);
      setDeletingStatus(null);
    } catch (error) {
      console.warn('Ошибка удаления статуса:', error);
      setNotification('Ошибка при удалении статуса');
    }
  };

  const handleStatusFormSuccess = () => {
    setShowStatusForm(false);
    setEditingStatus(null);
    
    // Обновление списка статусов происходит автоматически через события
    // Убираем принудительный вызов loadStatuses() чтобы избежать двойного обновления
    console.log('✅ StatusManagementModal: Статус успешно сохранен, обновление произойдет автоматически через события');
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-[800px] max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-foreground">
              Управление статусами
            </DialogTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Создание, редактирование и удаление статусов секций
            </p>
          </DialogHeader>
          
          <div className="py-4">
            {/* Заголовок с кнопкой создания */}
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-3">
                <h4 className="text-lg font-medium text-foreground">
                  Статусы секций
                </h4>
                {statuses.length > 0 && (
                  <Badge 
                    variant="secondary" 
                    className="bg-primary/10 text-primary border-primary/20"
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
                  className="pl-10"
                />
                {searchQuery && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0 hover:bg-muted"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
            )}

            {/* Список статусов */}
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {loading ? (
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
                    Создайте первый статус для работы с секциями
                  </p>
                  <Button
                    onClick={handleCreateStatus}
                    variant="outline"
                    className="border-primary text-primary hover:bg-primary/10"
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
                    className="border-primary text-primary hover:bg-primary/10"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Очистить поиск
                  </Button>
                </div>
              ) : (
                filteredStatuses.map((status) => (
                  <div
                    key={status.id}
                    className="flex items-center justify-between p-4 bg-card rounded-lg border border-border hover:bg-muted/50 transition-colors"
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
                    <div className="flex items-center gap-2 ml-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditStatus(status)}
                        className="text-primary hover:text-primary hover:bg-primary/10"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteStatus(status)}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleClose}>
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
"use client"

import React, { useState } from 'react';
import { Plus, Edit2, Trash2, Settings, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  
  const { statuses, loading, deleteStatus } = useSectionStatuses();
  const { setNotification } = useUiStore();

  // Обработчик закрытия модального окна с принудительным обновлением статусов
  const handleClose = () => {
    console.log('🔄 StatusManagementModal: Закрытие с принудительным обновлением статусов');
    
    // Отправляем событие для обновления всех компонентов со статусами
    window.dispatchEvent(new CustomEvent('forceStatusRefresh', {
      detail: { source: 'StatusManagementModal' }
    }));
    
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
      console.error('Ошибка удаления статуса:', error);
      setNotification('Ошибка при удалении статуса');
    }
  };

  const handleStatusFormSuccess = () => {
    setShowStatusForm(false);
    setEditingStatus(null);
    
    // События уже отправляются из хука useSectionStatuses при создании/обновлении
    // Убираем дублирование событий
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
              ) : (
                statuses.map((status) => (
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
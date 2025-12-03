"use client"

import React, { useState, useMemo } from 'react';
import { Plus, Edit2, Trash2, Tag, X, Search } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useProjectTagsStore } from '../../stores/useProjectTagsStore';
import type { ProjectTag } from '../../types';
import { ProjectTagForm } from './ProjectTagForm';
import { useUiStore } from '@/stores/useUiStore';

interface ProjectTagManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  tagName: string;
}

const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  tagName
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
            Вы уверены, что хотите удалить тег <strong>"{tagName}"</strong>?
          </p>
          <p className="text-sm text-muted-foreground">
            Этот тег будет автоматически удален из всех проектов, где он используется.
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

export function ProjectTagManagementModal({ isOpen, onClose }: ProjectTagManagementModalProps) {
  const [showTagForm, setShowTagForm] = useState(false);
  const [editingTag, setEditingTag] = useState<ProjectTag | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingTag, setDeletingTag] = useState<ProjectTag | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const tags = useProjectTagsStore(state => state.tags);
  const isLoading = useProjectTagsStore(state => state.isLoading);
  const deleteTag = useProjectTagsStore(state => state.deleteTag);
  const { setNotification } = useUiStore();

  // Фильтрация тегов по поисковому запросу
  const filteredTags = useMemo(() => {
    if (!searchQuery.trim()) {
      return tags;
    }

    const query = searchQuery.toLowerCase();
    return tags.filter(tag =>
      tag.name.toLowerCase().includes(query)
    );
  }, [tags, searchQuery]);

  const handleClose = () => {
    onClose();
  };

  const handleCreateTag = () => {
    setEditingTag(null);
    setShowTagForm(true);
  };

  const handleEditTag = (tag: ProjectTag) => {
    setEditingTag(tag);
    setShowTagForm(true);
  };

  const handleDeleteTag = (tag: ProjectTag) => {
    setDeletingTag(tag);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!deletingTag) return;

    try {
      await deleteTag(deletingTag.tag_id);
      setNotification(`Тег "${deletingTag.name}" удален`, 'success');
      setShowDeleteModal(false);
      setDeletingTag(null);
    } catch (error) {
      console.warn('Ошибка удаления тега:', error);
      setNotification('Ошибка при удалении тега', 'error');
    }
  };

  const handleTagFormSuccess = () => {
    setShowTagForm(false);
    setEditingTag(null);
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-[800px] max-h-[80vh] flex flex-col overflow-hidden dark:bg-gray-800 dark:border-gray-700">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-foreground">
              Управление тегами проектов
            </DialogTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Создание, редактирование и удаление тегов для категоризации проектов
            </p>
          </DialogHeader>

          <div className="py-4 flex-1 overflow-y-auto">
            {/* Заголовок с кнопкой создания */}
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-3">
                <h4 className="text-lg font-medium text-foreground">
                  Теги проектов
                </h4>
                {tags.length > 0 && (
                  <Badge
                    variant="secondary"
                    className="bg-primary/10 text-primary border-primary/20 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700/50"
                  >
                    {tags.length}
                  </Badge>
                )}
              </div>

              <Button
                onClick={handleCreateTag}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                <Plus className="h-4 w-4 mr-2" />
                Создать тег
              </Button>
            </div>

            {/* Поле поиска */}
            {tags.length > 0 && (
              <div className="relative mb-6">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Поиск по названию..."
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

            {/* Список тегов */}
            <div className="space-y-3">
              {isLoading ? (
                <div className="flex justify-center items-center py-12">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                    <p className="text-muted-foreground">Загрузка тегов...</p>
                  </div>
                </div>
              ) : tags.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                    <Tag className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-medium text-foreground mb-2">Нет созданных тегов</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Создайте первый тег для категоризации проектов
                  </p>
                  <Button
                    onClick={handleCreateTag}
                    variant="outline"
                    className="border-primary text-primary hover:bg-primary/10 dark:border-blue-500 dark:text-blue-400 dark:hover:bg-blue-900/20"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Создать тег
                  </Button>
                </div>
              ) : filteredTags.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                    <Search className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-medium text-foreground mb-2">Теги не найдены</h3>
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
                filteredTags.map((tag) => (
                  <div
                    key={tag.tag_id}
                    className="flex items-center justify-between p-3 bg-card rounded-lg border border-border hover:bg-muted/50 transition-colors dark:bg-gray-700 dark:border-gray-600 dark:hover:bg-gray-600"
                  >
                    <div className="flex items-center flex-1">
                      <div
                        className="w-6 h-6 rounded-full mr-3 border border-border shadow-sm"
                        style={{ backgroundColor: tag.color }}
                      />
                      <div className="flex-1">
                        <div className="font-medium text-foreground">
                          {tag.name}
                        </div>
                      </div>
                    </div>

                    {/* Кнопки управления */}
                    <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditTag(tag)}
                        className="text-green-600 hover:text-green-500 hover:bg-green-50 dark:text-green-400 dark:hover:text-green-300 dark:hover:bg-green-900/20"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteTag(tag)}
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

      {/* Модальное окно формы тега */}
      <ProjectTagForm
        isOpen={showTagForm}
        onClose={() => setShowTagForm(false)}
        tag={editingTag}
        onSuccess={handleTagFormSuccess}
      />

      {/* Модальное окно подтверждения удаления */}
      <DeleteConfirmModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={confirmDelete}
        tagName={deletingTag?.name || ''}
      />
    </>
  );
}

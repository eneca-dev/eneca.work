"use client"

import React, { useState, useMemo } from 'react';
import { Plus, Edit2, Trash2, Tag, X, Search, Loader2, AlertTriangle } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useProjectTagsStore } from '../../stores/useProjectTagsStore';
import type { ProjectTag } from '../../types';
import { ProjectTagForm } from './ProjectTagForm';
import { useUiStore } from '@/stores/useUiStore';
import { getTagStyles } from '../../utils/color';

interface ProjectTagManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  tag: ProjectTag | null;
  isDeleting?: boolean;
  isDark: boolean;
}

const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  tag,
  isDeleting = false,
  isDark
}) => {
  if (!tag) return null;

  const styles = getTagStyles(tag.color, isDark);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[420px] p-0 gap-0 overflow-hidden border-destructive/20">
        {/* Warning header with gradient */}
        <div className="relative bg-gradient-to-br from-destructive/10 via-destructive/5 to-transparent p-6 pb-4">
          {/* Decorative line */}
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-destructive/50 to-transparent" />

          <div className="flex items-start gap-4">
            <div className="relative p-2.5 rounded-xl bg-destructive/15 ring-1 ring-destructive/20">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              {/* Subtle glow */}
              <div className="absolute inset-0 rounded-xl bg-destructive/20 blur-md -z-10" />
            </div>
            <div className="flex-1">
              <DialogTitle className="text-lg font-semibold text-foreground">
                Удалить тег?
              </DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Это действие нельзя отменить
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {/* Tag preview - striped style */}
          <div className="flex items-center justify-center py-4">
            <div
              className="
                relative overflow-hidden inline-flex items-center gap-1.5
                px-4 py-2 text-sm font-medium
                rounded-md border
                transition-transform duration-300
                hover:scale-105
              "
              style={{
                backgroundColor: styles.backgroundColor,
                borderColor: styles.borderColor,
                color: styles.color,
              }}
            >
              {/* Diagonal stripes overlay */}
              <span
                className="absolute inset-0 pointer-events-none opacity-[0.08]"
                style={{
                  backgroundImage: `repeating-linear-gradient(
                    -45deg,
                    ${styles.stripeColor},
                    ${styles.stripeColor} 1px,
                    transparent 1px,
                    transparent 5px
                  )`,
                }}
              />
              <span className="relative">{tag.name}</span>
            </div>
          </div>

          <p className="text-sm text-muted-foreground text-center leading-relaxed">
            Тег будет удалён из всех проектов, где он используется.
          </p>
        </div>

        <DialogFooter className="px-6 py-4 bg-muted/20 border-t border-border/50">
          <div className="flex items-center justify-end gap-3 w-full">
            <Button
              variant="ghost"
              onClick={onClose}
              disabled={isDeleting}
              className="px-4 hover:bg-muted/80"
            >
              Отмена
            </Button>
            <Button
              variant="destructive"
              onClick={onConfirm}
              disabled={isDeleting}
              className="px-6 min-w-[100px] shadow-lg shadow-destructive/20"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Удаление...
                </>
              ) : (
                'Удалить'
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export function ProjectTagManagementModal({ isOpen, onClose }: ProjectTagManagementModalProps) {
  const [showTagForm, setShowTagForm] = useState(false);
  const [editingTag, setEditingTag] = useState<ProjectTag | null>(null);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingTag, setDeletingTag] = useState<ProjectTag | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const tags = useProjectTagsStore(state => state.tags);
  const isLoading = useProjectTagsStore(state => state.isLoading);
  const deleteTag = useProjectTagsStore(state => state.deleteTag);
  const { setNotification } = useUiStore();

  const filteredTags = useMemo(() => {
    if (!searchQuery.trim()) {
      return tags;
    }
    const query = searchQuery.toLowerCase();
    return tags.filter(tag => tag.name.toLowerCase().includes(query));
  }, [tags, searchQuery]);

  const handleClose = () => {
    setSearchQuery('');
    setShowTagForm(false);
    setEditingTag(null);
    setDeletingTag(null);
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

    setIsDeleting(true);
    try {
      await deleteTag(deletingTag.tag_id);
      setNotification(`Тег "${deletingTag.name}" удалён`, 'success');
      setShowDeleteModal(false);
      setDeletingTag(null);
    } catch (error) {
      console.warn('Ошибка удаления тега:', error);
      setNotification('Ошибка при удалении тега', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleTagFormSuccess = () => {
    setShowTagForm(false);
    setEditingTag(null);
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] flex flex-col p-0 gap-0 overflow-hidden border-primary/10">
          {/* Header with refined gradient */}
          <div className="relative">
            {/* Decorative gradient line */}
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-primary/40 to-transparent" />

            {/* Subtle background gradient */}
            <div
              className="absolute inset-0 opacity-[0.03] pointer-events-none"
              style={{
                background: 'radial-gradient(ellipse at top left, hsl(var(--primary)) 0%, transparent 50%)',
              }}
            />

            <DialogHeader className="relative p-6 pb-4 pr-14">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative p-2.5 rounded-xl bg-primary/10 ring-1 ring-primary/20 flex-shrink-0">
                    <Tag className="h-5 w-5 text-primary" />
                    {/* Subtle glow */}
                    <div className="absolute inset-0 rounded-xl bg-primary/15 blur-md -z-10" />
                  </div>
                  <div className="min-w-0">
                    <DialogTitle className="text-lg font-semibold">
                      Управление тегами
                    </DialogTitle>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {tags.length > 0 ? `${tags.length} ${tags.length === 1 ? 'тег' : tags.length < 5 ? 'тега' : 'тегов'}` : 'Нет тегов'}
                    </p>
                  </div>
                </div>
                <Button
                  onClick={handleCreateTag}
                  size="sm"
                  className="gap-1.5 shadow-lg shadow-primary/20 flex-shrink-0"
                >
                  <Plus className="h-4 w-4" />
                  Новый тег
                </Button>
              </div>
            </DialogHeader>
          </div>

          {/* Search with refined styling */}
          {tags.length > 3 && (
            <div className="px-6 py-3 border-y border-border/30 bg-muted/10">
              <div className="relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
                <Input
                  placeholder="Поиск тегов..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-10 bg-background/50 border-border/50 focus:border-primary/30 focus:ring-primary/20 transition-all"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-muted/80 transition-colors"
                  >
                    <X className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Tags list with enhanced styling */}
          <div className="flex-1 overflow-y-auto no-scrollbar-bg p-4">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="relative">
                  <Loader2 className="h-10 w-10 animate-spin text-primary" />
                  <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full" />
                </div>
                <p className="text-sm text-muted-foreground mt-4">Загрузка тегов...</p>
              </div>
            ) : tags.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                {/* Empty state with refined styling */}
                <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-muted/80 to-muted/40 flex items-center justify-center mb-5 ring-1 ring-border/50">
                  <Tag className="w-9 h-9 text-muted-foreground/70" />
                  {/* Decorative dots */}
                  <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-primary/20" />
                  <div className="absolute -bottom-1 -left-1 w-2 h-2 rounded-full bg-primary/15" />
                </div>
                <h3 className="text-base font-semibold text-foreground mb-1.5">Нет тегов</h3>
                <p className="text-sm text-muted-foreground text-center mb-5 max-w-[260px] leading-relaxed">
                  Создайте первый тег для категоризации проектов
                </p>
                <Button
                  onClick={handleCreateTag}
                  variant="outline"
                  size="sm"
                  className="gap-1.5 border-primary/30 hover:bg-primary/5 hover:border-primary/50"
                >
                  <Plus className="h-4 w-4" />
                  Создать тег
                </Button>
              </div>
            ) : filteredTags.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-muted/80 to-muted/40 flex items-center justify-center mb-5 ring-1 ring-border/50">
                  <Search className="w-9 h-9 text-muted-foreground/70" />
                </div>
                <h3 className="text-base font-semibold text-foreground mb-1.5">Ничего не найдено</h3>
                <p className="text-sm text-muted-foreground text-center mb-5">
                  По запросу «{searchQuery}» тегов не найдено
                </p>
                <Button
                  onClick={() => setSearchQuery('')}
                  variant="ghost"
                  size="sm"
                  className="text-primary hover:text-primary hover:bg-primary/10"
                >
                  Очистить поиск
                </Button>
              </div>
            ) : (
              <div className="grid gap-2">
                {filteredTags.map((tag, index) => {
                  const styles = getTagStyles(tag.color, isDark);
                  return (
                    <div
                      key={tag.tag_id}
                      className="
                        group relative flex items-center gap-3 p-3.5
                        rounded-xl border border-border/40
                        bg-card/30 hover:bg-accent/20
                        hover:border-border/60
                        transition-all duration-200
                        animate-in fade-in-0 slide-in-from-bottom-2
                      "
                      style={{ animationDelay: `${index * 40}ms` }}
                    >
                      {/* Tag chip - striped style like statuses */}
                      <div
                        className="
                          relative overflow-hidden flex items-center justify-center
                          px-3 py-1.5 rounded-md text-xs font-medium border
                          transition-all duration-200
                          group-hover:shadow-sm
                        "
                        style={{
                          backgroundColor: styles.backgroundColor,
                          borderColor: styles.borderColor,
                          color: styles.color,
                        }}
                      >
                        {/* Diagonal stripes overlay */}
                        <span
                          className="absolute inset-0 pointer-events-none opacity-[0.08]"
                          style={{
                            backgroundImage: `repeating-linear-gradient(
                              -45deg,
                              ${styles.stripeColor},
                              ${styles.stripeColor} 1px,
                              transparent 1px,
                              transparent 5px
                            )`,
                          }}
                        />
                        <span className="relative">{tag.name}</span>
                      </div>

                      {/* Spacer */}
                      <div className="flex-1" />

                      {/* Actions with refined hover states */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditTag(tag)}
                          className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteTag(tag)}
                          className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer with refined styling */}
          <DialogFooter className="px-6 py-4 border-t border-border/40 bg-muted/10">
            <Button
              variant="ghost"
              onClick={handleClose}
              className="hover:bg-muted/80"
            >
              Закрыть
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tag form modal */}
      <ProjectTagForm
        isOpen={showTagForm}
        onClose={() => setShowTagForm(false)}
        tag={editingTag}
        onSuccess={handleTagFormSuccess}
      />

      {/* Delete confirmation modal */}
      <DeleteConfirmModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={confirmDelete}
        tag={deletingTag}
        isDeleting={isDeleting}
        isDark={isDark}
      />
    </>
  );
}

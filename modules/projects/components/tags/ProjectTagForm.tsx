"use client"

import React, { useState, useEffect, useRef } from 'react';
import { Save, Loader2, Palette } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useUiStore } from '@/stores/useUiStore';
import { useUserStore } from '@/stores/useUserStore';
import type { ProjectTag, ProjectTagFormData } from '../../types';
import { useProjectTagsStore } from '../../stores/useProjectTagsStore';
import { TAG_COLORS } from '../../constants/project-tags';

interface ProjectTagFormProps {
  isOpen: boolean;
  onClose: () => void;
  tag?: ProjectTag | null;
  onSuccess?: () => void;
}

export function ProjectTagForm({ isOpen, onClose, tag, onSuccess }: ProjectTagFormProps) {
  const [formData, setFormData] = useState<ProjectTagFormData>({
    name: '',
    color: '#3B82F6',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const colorPickerRef = useRef<HTMLDivElement>(null);

  const { setNotification } = useUiStore();
  const currentUser = useUserStore(state => state.profile);
  const createTag = useProjectTagsStore(state => state.createTag);
  const updateTag = useProjectTagsStore(state => state.updateTag);

  const isEditing = !!tag;

  useEffect(() => {
    if (isOpen) {
      if (tag) {
        setFormData({
          name: tag.name,
          color: tag.color,
        });
      } else {
        setFormData({
          name: '',
          color: '#3B82F6',
        });
      }
    }
  }, [isOpen, tag]);

  // Закрытие color picker при клике вне его области
  useEffect(() => {
    if (!showColorPicker) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (colorPickerRef.current && !colorPickerRef.current.contains(event.target as Node)) {
        setShowColorPicker(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showColorPicker]);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!formData.name.trim()) {
      setNotification('Название тега обязательно', 'error');
      return;
    }

    if (!currentUser?.user_id) {
      setNotification('Ошибка авторизации', 'error');
      return;
    }

    setIsLoading(true);
    try {
      let result: ProjectTag | null = null;

      if (isEditing && tag) {
        result = await updateTag(tag.tag_id, formData, currentUser.user_id);
      } else {
        result = await createTag(formData, currentUser.user_id);
      }

      if (result) {
        setNotification(`Тег "${formData.name}" ${isEditing ? 'обновлен' : 'создан'}`, 'success');
        onSuccess?.();
        handleClose();
      } else {
        setNotification(`Не удалось ${isEditing ? 'обновить' : 'создать'} тег`, 'error');
      }
    } catch (error) {
      console.warn('Ошибка сохранения тега:', error);

      let errorMessage = `Не удалось ${isEditing ? 'обновить' : 'создать'} тег`;

      if (error instanceof Error) {
        if (error.message.includes('duplicate') || error.message.includes('already exists') || error.message.includes('уже существует')) {
          errorMessage = 'Тег с таким названием уже существует';
        } else if (error.message.includes('network') || error.message.includes('fetch')) {
          errorMessage = 'Ошибка соединения. Проверьте подключение к интернету';
        } else if (error.message.includes('permission') || error.message.includes('unauthorized')) {
          errorMessage = 'Недостаточно прав для выполнения операции';
        } else if (error.message.trim()) {
          errorMessage = error.message;
        }
      }

      setNotification(errorMessage, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({
      name: '',
      color: '#3B82F6',
    });
    setShowColorPicker(false);
    onClose();
  };

  const handleColorSelect = (color: string) => {
    setFormData(prev => ({ ...prev, color }));
    setShowColorPicker(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            {isEditing ? 'Редактировать тег' : 'Создать новый тег'}
          </DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Тег для категоризации проектов
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 py-4">
          {/* Название тега */}
          <div className="space-y-2">
            <Label htmlFor="tagName" className="text-sm font-medium">
              Название тега *
            </Label>
            <Input
              id="tagName"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Введите название тега"
              disabled={isLoading}
              autoFocus
              className="w-full"
            />
          </div>

          {/* Цвет тега */}
          <div className="space-y-2">
            <Label htmlFor="tagColor" className="text-sm font-medium">
              Цвет *
            </Label>
            <div className="relative">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowColorPicker(!showColorPicker)}
                disabled={isLoading}
                className="w-full justify-start text-left h-10"
              >
                <div
                  className="w-5 h-5 rounded mr-3 border border-border shadow-sm"
                  style={{ backgroundColor: formData.color }}
                />
                <span className="flex-1">Выберите цвет тега</span>
                <Palette className="h-4 w-4 text-muted-foreground" />
              </Button>

              {showColorPicker && (
                <div
                  ref={colorPickerRef}
                  className="absolute z-50 mt-2 p-4 bg-card border border-border rounded-lg shadow-lg w-full"
                >
                  <div className="grid grid-cols-6 gap-2">
                    {TAG_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => handleColorSelect(color)}
                        className={`w-10 h-10 rounded-md border-2 hover:scale-105 transition-transform ${
                          formData.color === color
                            ? 'border-primary shadow-md'
                            : 'border-border hover:border-primary/50'
                        }`}
                        style={{ backgroundColor: color }}
                        title="Выбрать этот цвет"
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </form>

        <DialogFooter className="flex justify-between">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isLoading}
          >
            Отмена
          </Button>
          <Button
            onClick={() => handleSubmit()}
            disabled={isLoading || !formData.name.trim()}
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isLoading ? 'Сохранение...' : (isEditing ? 'Сохранить' : 'Создать')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

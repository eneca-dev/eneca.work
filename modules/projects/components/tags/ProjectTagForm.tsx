"use client"

import React, { useState, useEffect, useRef } from 'react';
import { Loader2, Check, Tag } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useUiStore } from '@/stores/useUiStore';
import { useUserStore } from '@/stores/useUserStore';
import type { ProjectTag, ProjectTagFormData } from '../../types';
import { useProjectTagsStore } from '../../stores/useProjectTagsStore';
import { TAG_COLORS } from '../../constants/project-tags';
import { getContrastColor, getTagStyles } from '../../utils/color';

interface ProjectTagFormProps {
  isOpen: boolean;
  onClose: () => void;
  tag?: ProjectTag | null;
  onSuccess?: () => void;
}

// Утилита для затемнения цвета
function darkenColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.max((num >> 16) - amt, 0);
  const G = Math.max((num >> 8 & 0x00FF) - amt, 0);
  const B = Math.max((num & 0x0000FF) - amt, 0);
  return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
}

export function ProjectTagForm({ isOpen, onClose, tag, onSuccess }: ProjectTagFormProps) {
  const [formData, setFormData] = useState<ProjectTagFormData>({
    name: '',
    color: '#3B82F6',
  });
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const { setNotification } = useUiStore();
  const currentUser = useUserStore(state => state.profile);
  const createTag = useProjectTagsStore(state => state.createTag);
  const updateTag = useProjectTagsStore(state => state.updateTag);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

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
          color: TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)],
        });
      }
      // Focus input after modal opens
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, tag]);

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
        setNotification(`Тег "${formData.name}" ${isEditing ? 'обновлён' : 'создан'}`, 'success');
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
    onClose();
  };

  const handleColorSelect = (color: string) => {
    setFormData(prev => ({ ...prev, color }));
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[480px] p-0 gap-0 overflow-hidden">
        {/* Header with gradient accent */}
        <div className="relative">
          <div
            className="absolute inset-0 opacity-10"
            style={{
              background: `linear-gradient(135deg, ${formData.color} 0%, transparent 60%)`,
            }}
          />
          <DialogHeader className="relative p-6 pb-4">
            <div className="flex items-center gap-3">
              <div
                className="p-2 rounded-lg"
                style={{
                  backgroundColor: `${formData.color}20`,
                }}
              >
                <Tag className="h-5 w-5" style={{ color: formData.color }} />
              </div>
              <div>
                <DialogTitle className="text-lg font-semibold">
                  {isEditing ? 'Редактировать тег' : 'Новый тег'}
                </DialogTitle>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {isEditing ? 'Измените название или цвет тега' : 'Создайте тег для категоризации проектов'}
                </p>
              </div>
            </div>
          </DialogHeader>
        </div>

        <form onSubmit={handleSubmit} className="px-6 pb-6 space-y-5">
          {/* Live preview - striped style */}
          <div className="flex items-center justify-center py-4">
            {(() => {
              const styles = getTagStyles(formData.color, isDark);
              return (
                <div
                  className="
                    relative overflow-hidden inline-flex items-center gap-1.5
                    px-4 py-2 text-sm font-medium
                    rounded-md border
                    transition-all duration-300 ease-out
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
                  <span className="relative">{formData.name || 'Название тега'}</span>
                </div>
              );
            })()}
          </div>

          {/* Tag name input */}
          <div className="space-y-1.5">
            <Label htmlFor="tagName" className="text-sm font-medium">
              Название
            </Label>
            <Input
              ref={inputRef}
              id="tagName"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Введите название тега"
              disabled={isLoading}
              className="h-11"
              maxLength={50}
            />
            <div className="flex items-center justify-end">
              <span className={`text-[11px] transition-colors ${
                formData.name.length >= 50
                  ? 'text-destructive font-medium'
                  : formData.name.length >= 40
                    ? 'text-amber-500'
                    : 'text-muted-foreground'
              }`}>
                {formData.name.length}/50
              </span>
            </div>
          </div>

          {/* Color picker */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">
              Цвет
            </Label>
            <div className="grid grid-cols-5 gap-2">
              {TAG_COLORS.map((color) => {
                const isSelected = formData.color === color;
                return (
                  <button
                    key={color}
                    type="button"
                    onClick={() => handleColorSelect(color)}
                    disabled={isLoading}
                    className={`
                      group relative aspect-square rounded-lg
                      transition-all duration-200
                      focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2
                      ${isSelected ? 'scale-110 z-10' : 'hover:scale-105'}
                      disabled:opacity-50 disabled:cursor-not-allowed
                    `}
                    style={{
                      backgroundColor: color,
                      boxShadow: isSelected
                        ? `0 4px 12px ${color}60, inset 0 0 0 2px rgba(255,255,255,0.3)`
                        : `0 2px 4px ${color}30`,
                      borderBottom: `2px solid ${darkenColor(color, 20)}`,
                    }}
                    title={color}
                  >
                    {/* Check mark for selected color */}
                    {isSelected && (
                      <div
                        className="absolute inset-0 flex items-center justify-center"
                        style={{ color: getContrastColor(color) }}
                      >
                        <Check className="h-4 w-4" strokeWidth={3} />
                      </div>
                    )}
                    {/* Hover shine effect */}
                    <div
                      className="
                        absolute inset-0 rounded-lg opacity-0
                        group-hover:opacity-100 transition-opacity duration-200
                        pointer-events-none
                      "
                      style={{
                        background: 'linear-gradient(135deg, rgba(255,255,255,0.25) 0%, transparent 50%)',
                      }}
                    />
                  </button>
                );
              })}
            </div>
          </div>
        </form>

        {/* Footer */}
        <DialogFooter className="px-6 py-4 bg-muted/30 border-t border-border/50">
          <div className="flex items-center justify-end gap-3 w-full">
            <Button
              type="button"
              variant="ghost"
              onClick={handleClose}
              disabled={isLoading}
              className="px-4"
            >
              Отмена
            </Button>
            <Button
              type="submit"
              onClick={() => handleSubmit()}
              disabled={isLoading || !formData.name.trim()}
              className="px-6 min-w-[120px]"
              style={{
                backgroundColor: formData.color,
                color: getContrastColor(formData.color),
                borderBottom: `2px solid ${darkenColor(formData.color, 15)}`,
              }}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Сохранение...
                </>
              ) : (
                isEditing ? 'Сохранить' : 'Создать тег'
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

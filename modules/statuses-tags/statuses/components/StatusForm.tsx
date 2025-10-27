"use client"

import React, { useState, useEffect, useRef } from 'react';
import { Save, Loader2, Palette } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useUiStore } from '@/stores/useUiStore';
import { SectionStatus, SectionStatusFormData } from '../types';
import { useSectionStatusesStore } from '../store';

interface StatusFormProps {
  isOpen: boolean;
  onClose: () => void;
  status?: SectionStatus | null;
  onSuccess?: () => void;
}

const DEFAULT_COLORS = [
  '#EF4444', '#F97316', '#F59E0B', '#EAB308', '#84CC16', '#22C55E',
  '#10B981', '#14B8A6', '#06B6D4', '#0EA5E9', '#3B82F6', '#6366F1',
  '#8B5CF6', '#A855F7', '#D946EF', '#EC4899', '#F43F5E', '#6B7280'
];

export function StatusForm({ isOpen, onClose, status, onSuccess }: StatusFormProps) {
  const [formData, setFormData] = useState<SectionStatusFormData>({
    name: '',
    color: '#3B82F6',
    description: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const colorPickerRef = useRef<HTMLDivElement>(null);

  const { setNotification } = useUiStore();
  const createStatus = useSectionStatusesStore(state => state.createStatus);
  const updateStatus = useSectionStatusesStore(state => state.updateStatus);

  const isEditing = !!status;

  useEffect(() => {
    if (isOpen) {
      if (status) {
        setFormData({
          name: status.name,
          color: status.color,
          description: status.description || ''
        });
      } else {
        setFormData({
          name: '',
          color: '#3B82F6',
          description: ''
        });
      }
    }
  }, [isOpen, status]);

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
      setNotification('Название статуса обязательно', 'error');
      return;
    }

    setIsLoading(true);
    try {
      let result: SectionStatus | null = null;

      if (isEditing && status) {
        result = await updateStatus(status.id, formData);
      } else {
        result = await createStatus(formData);
      }

      if (result) {
        setNotification(`Статус "${formData.name}" ${isEditing ? 'обновлен' : 'создан'}`, 'success');
        onSuccess?.();
        handleClose();
      }
    } catch (error) {
      console.warn('Ошибка сохранения статуса:', error);
      
      // Определяем тип ошибки и формируем соответствующее сообщение
      let errorMessage = `Не удалось ${isEditing ? 'обновить' : 'создать'} статус`;
      
      if (error instanceof Error) {
        // Проверяем специфические ошибки
        if (error.message.includes('duplicate') || error.message.includes('already exists')) {
          errorMessage = 'Статус с таким названием уже существует';
        } else if (error.message.includes('network') || error.message.includes('fetch')) {
          errorMessage = 'Ошибка соединения. Проверьте подключение к интернету';
        } else if (error.message.includes('permission') || error.message.includes('unauthorized')) {
          errorMessage = 'Недостаточно прав для выполнения операции';
        } else if (error.message.includes('validation')) {
          errorMessage = 'Проверьте правильность заполнения полей';
        } else if (error.message.trim()) {
          // Если есть конкретное сообщение об ошибке, используем его
          errorMessage = `${errorMessage}: ${error.message}`;
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
      description: ''
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
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            {isEditing ? 'Редактировать статус' : 'Создать новый статус'}
          </DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Статус секции проекта
          </p>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6 py-4">
          {/* Название статуса */}
          <div className="space-y-2">
            <Label htmlFor="statusName" className="text-sm font-medium">
              Название статуса *
            </Label>
            <Input
              id="statusName"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Введите название статуса"
              disabled={isLoading}
              autoFocus
              className="w-full"
            />
          </div>

          {/* Цвет статуса */}
          <div className="space-y-2">
            <Label htmlFor="statusColor" className="text-sm font-medium">
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
                <span className="flex-1">Выберите цвет статуса</span>
                <Palette className="h-4 w-4 text-muted-foreground" />
              </Button>
              
              {showColorPicker && (
                <div 
                  ref={colorPickerRef}
                  className="absolute z-50 mt-2 p-4 bg-card border border-border rounded-lg shadow-lg w-full"
                >
                  <div className="grid grid-cols-6 gap-2">
                    {DEFAULT_COLORS.map((color) => (
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

          {/* Описание */}
          <div className="space-y-2">
            <Label htmlFor="statusDescription" className="text-sm font-medium">
              Описание
            </Label>
            <Textarea
              id="statusDescription"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Введите описание статуса (необязательно)"
              disabled={isLoading}
              className="min-h-[80px] resize-none"
            />
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
            {isLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {isLoading ? 'Сохранение...' : (isEditing ? 'Обновить' : 'Создать')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 
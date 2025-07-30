"use client"

import React, { useState, useEffect } from 'react';
import { Save, Loader2, Palette } from 'lucide-react';
import { Modal, ModalButton } from '@/components/modals';
import { useUiStore } from '@/stores/useUiStore';
import { SectionStatus, SectionStatusFormData } from '../types';
import { useSectionStatuses } from '../hooks/useSectionStatuses';

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
  const [loading, setLoading] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);

  const { setNotification } = useUiStore();
  const { createStatus, updateStatus } = useSectionStatuses();

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

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!formData.name.trim()) {
      setNotification('Название статуса обязательно');
      return;
    }

    setLoading(true);
    try {
      let result: SectionStatus | null = null;

      if (isEditing && status) {
        result = await updateStatus(status.id, formData);
      } else {
        result = await createStatus(formData);
      }

      if (result) {
        setNotification(`Статус "${formData.name}" ${isEditing ? 'обновлен' : 'создан'}`);
        onSuccess?.();
        handleClose();
      }
    } catch (error) {
      console.error('Ошибка сохранения статуса:', error);
    } finally {
      setLoading(false);
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
    <Modal isOpen={isOpen} onClose={handleClose} size="md">
      <Modal.Header 
        title={isEditing ? 'Редактировать статус' : 'Создать новый статус'}
        subtitle="Статус секции проекта"
      />
      
      <Modal.Body>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2 dark:text-slate-300 text-slate-700">
              Название статуса *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent dark:bg-slate-800 dark:text-white"
              placeholder="Введите название статуса"
              disabled={loading}
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 dark:text-slate-300 text-slate-700">
              Цвет *
            </label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowColorPicker(!showColorPicker)}
                className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent dark:bg-slate-800 dark:text-white flex items-center"
                disabled={loading}
              >
                <div 
                  className="w-6 h-6 rounded mr-3 border border-gray-300 dark:border-slate-500" 
                  style={{ backgroundColor: formData.color }}
                />
                <span>{formData.color}</span>
                <Palette className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
              </button>
              
              {showColorPicker && (
                <div className="absolute z-10 mt-1 p-3 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg shadow-lg">
                  <div className="grid grid-cols-6 gap-2">
                    {DEFAULT_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => handleColorSelect(color)}
                        className={`w-8 h-8 rounded border-2 hover:scale-110 transition-transform ${
                          formData.color === color 
                            ? 'border-gray-800 dark:border-white' 
                            : 'border-gray-300 dark:border-slate-500'
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                  <div className="mt-3">
                    <input
                      type="color"
                      value={formData.color}
                      onChange={(e) => handleColorSelect(e.target.value)}
                      className="w-full h-8 rounded border border-gray-300 dark:border-slate-600"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 dark:text-slate-300 text-slate-700">
              Описание
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent dark:bg-slate-800 dark:text-white"
              placeholder="Введите описание статуса (необязательно)"
              disabled={loading}
            />
          </div>
        </form>
      </Modal.Body>

      <Modal.Footer>
        <ModalButton variant="cancel" onClick={handleClose} disabled={loading}>
          Отмена
        </ModalButton>
        <ModalButton 
          variant="success" 
          onClick={() => handleSubmit()}
          disabled={loading || !formData.name.trim()}
          icon={loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        >
          {loading ? 'Сохранение...' : (isEditing ? 'Обновить' : 'Создать')}
        </ModalButton>
      </Modal.Footer>
    </Modal>
  );
} 
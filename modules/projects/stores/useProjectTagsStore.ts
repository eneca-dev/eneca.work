import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { ProjectTag, ProjectTagFormData } from '../types';
import * as api from '../api/project-tags';

interface ProjectTagsStore {
  tags: ProjectTag[];
  isLoading: boolean;
  isLoaded: boolean;
  error: string | null;

  loadTags: () => Promise<void>;
  createTag: (data: ProjectTagFormData, userId: string) => Promise<ProjectTag | null>;
  updateTag: (id: string, data: ProjectTagFormData, userId: string) => Promise<ProjectTag | null>;
  deleteTag: (id: string) => Promise<boolean>;
  reset: () => void;
}

export const useProjectTagsStore = create<ProjectTagsStore>()(
  devtools(
    persist(
      (set, get) => ({
        tags: [],
        isLoading: false,
        isLoaded: false,
        error: null,

        loadTags: async () => {
          // Если уже загружено и есть данные, не перезагружать
          const state = get();
          if (state.isLoaded && state.tags.length > 0) {
            console.log('✅ Теги проектов уже загружены из кеша:', state.tags.length);
            return;
          }

          set({ isLoading: true, error: null });

          try {
            const tags = await api.getAllProjectTags();

            console.log('✅ Загружено тегов из БД:', tags.length);
            set({
              tags,
              isLoading: false,
              isLoaded: true,
              error: null,
            });
          } catch (err) {
            console.warn('❌ Ошибка загрузки тегов:', err);
            const errorMessage = err instanceof Error ? err.message : 'Ошибка загрузки тегов';
            set({ error: errorMessage, isLoading: false });
          }
        },

        createTag: async (data: ProjectTagFormData, userId: string): Promise<ProjectTag | null> => {
          set({ isLoading: true, error: null });

          try {
            const tag = await api.createTag(data, userId);

            if (!tag) return null;

            // Добавляем новый тег в локальный store
            set(state => ({
              tags: [...state.tags, tag].sort((a, b) => a.name.localeCompare(b.name)),
              isLoading: false,
            }));

            console.log('✅ Тег создан:', tag.name);

            // Dispatch событие для обновления других компонентов
            window.dispatchEvent(new CustomEvent('projectTags:created', {
              detail: { tag }
            }));

            return tag;
          } catch (err) {
            console.warn('❌ Ошибка создания тега:', err);
            const errorMessage = err instanceof Error ? err.message : 'Ошибка создания тега';
            set({ error: errorMessage, isLoading: false });
            return null;
          }
        },

        updateTag: async (id: string, data: ProjectTagFormData, userId: string): Promise<ProjectTag | null> => {
          set({ isLoading: true, error: null });

          try {
            const tag = await api.updateTag(id, data, userId);

            if (!tag) return null;

            // Обновляем тег в локальном store
            set(state => ({
              tags: state.tags
                .map(t => t.tag_id === id ? tag : t)
                .sort((a, b) => a.name.localeCompare(b.name)),
              isLoading: false,
            }));

            console.log('✅ Тег обновлен:', tag.name);

            // Dispatch событие для обновления других компонентов
            window.dispatchEvent(new CustomEvent('projectTags:updated', {
              detail: { tag }
            }));

            return tag;
          } catch (err) {
            console.warn('❌ Ошибка обновления тега:', err);
            const errorMessage = err instanceof Error ? err.message : 'Ошибка обновления тега';
            set({ error: errorMessage, isLoading: false });
            return null;
          }
        },

        deleteTag: async (id: string): Promise<boolean> => {
          set({ isLoading: true, error: null });

          try {
            const success = await api.deleteTag(id);

            if (!success) return false;

            // Удаляем тег из локального store
            set(state => ({
              tags: state.tags.filter(t => t.tag_id !== id),
              isLoading: false,
            }));

            console.log('✅ Тег удален:', id);

            // Dispatch событие для обновления других компонентов
            window.dispatchEvent(new CustomEvent('projectTags:deleted', {
              detail: { tagId: id }
            }));

            return true;
          } catch (err) {
            console.warn('❌ Ошибка удаления тега:', err);
            const errorMessage = err instanceof Error ? err.message : 'Ошибка удаления тега';
            set({ error: errorMessage, isLoading: false });
            return false;
          }
        },

        reset: () => {
          set({
            tags: [],
            isLoading: false,
            isLoaded: false,
            error: null,
          });
        },
      }),
      {
        name: 'project-tags-store',
        partialize: (state) => ({
          tags: state.tags,
          isLoaded: state.isLoaded,
        }),
      }
    )
  )
);

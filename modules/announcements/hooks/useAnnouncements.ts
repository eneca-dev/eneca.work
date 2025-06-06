import { useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useAnnouncementsStore } from '@/modules/announcements/store';
import { Announcement, AnnouncementFormData } from '@/modules/announcements/types';
import { toast } from 'sonner';

export function useAnnouncements() {
  const {
    announcements,
    setAnnouncements,
    addAnnouncement,
    updateAnnouncement,
    deleteAnnouncement,
    setLoading,
    setError,
  } = useAnnouncementsStore();

  const supabase = createClient();

  // Загрузка объявлений с именами авторов
  const fetchAnnouncements = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('announcements')
        .select(`
          *,
          profiles!announcements_created_by_fkey (
            first_name,
            last_name
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Преобразуем данные, объединяя имя и фамилию автора
      const announcementsWithAuthors = data?.map((announcement: any) => ({
        ...announcement,
        author_name: announcement.profiles
          ? [announcement.profiles.first_name, announcement.profiles.last_name]
              .filter(Boolean)
              .join(' ') || 'Неизвестный пользователь'
          : 'Неизвестный пользователь'
      })) || [];

      setAnnouncements(announcementsWithAuthors);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Ошибка загрузки объявлений';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [supabase, setAnnouncements, setLoading, setError]);

  // Создание объявления
  const createAnnouncement = useCallback(async (announcementData: AnnouncementFormData, userId: string) => {
    try {
      setLoading(true);
      setError(null);

      const newAnnouncement = {
        ...announcementData,
        created_by: userId,
      };

      const { data, error } = await supabase
        .from('announcements')
        .insert([newAnnouncement])
        .select()
        .single();

      if (error) throw error;

      // Перезагружаем все объявления после создания
      await fetchAnnouncements();
      toast.success('Объявление создано успешно');
      return data;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Ошибка создания объявления';
      setError(message);
      toast.error(message);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [supabase, fetchAnnouncements, setLoading, setError]);

  // Обновление объявления
  const editAnnouncement = useCallback(async (id: string, announcementData: Partial<AnnouncementFormData>) => {
    try {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('announcements')
        .update(announcementData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      // Перезагружаем все объявления после обновления
      await fetchAnnouncements();
      toast.success('Объявление обновлено успешно');
      return data;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Ошибка обновления объявления';
      setError(message);
      toast.error(message);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [supabase, fetchAnnouncements, setLoading, setError]);

  // Удаление объявления
  const removeAnnouncement = useCallback(async (id: string) => {
    try {
      setLoading(true);
      setError(null);

      const { error } = await supabase
        .from('announcements')
        .delete()
        .eq('id', id);

      if (error) throw error;

      // Перезагружаем все объявления после удаления
      await fetchAnnouncements();
      toast.success('Объявление удалено успешно');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Ошибка удаления объявления';
      setError(message);
      toast.error(message);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [supabase, fetchAnnouncements, setLoading, setError]);

  return {
    announcements,
    fetchAnnouncements,
    createAnnouncement,
    editAnnouncement,
    removeAnnouncement,
  };
} 
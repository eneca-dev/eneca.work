import { useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useAnnouncementsStore } from '@/modules/announcements/store';
import { Announcement, AnnouncementFormData } from '@/modules/announcements/types';
import { toast } from 'sonner';

// Функция для отправки уведомлений
const sendNotification = async (
  payload: {
    entityType: string;
    payload: Record<string, unknown>;
    userIds?: string[];
  },
  supabase: any
) => {
  try {
    console.log('🔔 Начинаю отправку уведомления:', payload);
    
    // Получаем токен пользователя
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.access_token) {
      throw new Error('Пользователь не авторизован');
    }

    console.log('🔑 Токен получен, длина:', session.access_token.length);

    const requestData = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(payload),
    };

    console.log('📤 Отправляю запрос на:', 'https://gvrcbvifirhxxdnvrwlz.supabase.co/functions/v1/notifications');
    console.log('📝 Заголовки:', requestData.headers);
    console.log('📦 Тело запроса:', requestData.body);

    // Используем обычный fetch вместо supabase.functions.invoke
    const response = await fetch('https://gvrcbvifirhxxdnvrwlz.supabase.co/functions/v1/notifications', requestData);
    
    console.log('📨 Ответ получен:', response.status, response.statusText);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Ошибка ответа:', errorText);
      throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
    }
    
    const result = await response.json();
    console.log('✅ Уведомление отправлено успешно:', result);
    return result;
  } catch (error) {
    console.error('❌ Ошибка отправки уведомления:', error);
    throw error;
  }
};

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

      // Получаем информацию о пользователе для уведомления
      const { data: userData, error: userError } = await supabase
        .from('profiles')
        .select('first_name, last_name')
        .eq('user_id', userId)
        .single();

      if (userError) {
        console.error('Ошибка получения данных пользователя:', userError);
      }

      const userName = userData
        ? [userData.first_name, userData.last_name].filter(Boolean).join(' ') || 'Неизвестный пользователь'
        : 'Неизвестный пользователь';

      // Получаем всех пользователей для отправки уведомлений
      const { data: allUsers, error: usersError } = await supabase
        .from('profiles')
        .select('user_id')
        .neq('user_id', userId); // Исключаем автора объявления

      if (usersError) {
        console.error('Ошибка получения списка пользователей:', usersError);
      }

      const userIds = allUsers?.map(user => user.user_id) || [];

             // Отправляем уведомления всем пользователям (кроме автора)
       if (userIds.length > 0) {
         try {
           await sendNotification({
             entityType: 'announcement',
             payload: {
               title: announcementData.header,
               body: announcementData.text || '',
               user_name: userName,
               announcement_id: data.id, // Добавляем ID объявления
               action: {
                 type: 'navigate',
                 url: '/dashboard',
                 data: { announcementId: data.id }
               }
             },
             userIds: userIds,
           }, supabase);
         } catch (notificationError) {
           console.error('Ошибка отправки уведомлений:', notificationError);
           // Не прерываем процесс создания объявления из-за ошибки уведомлений
         }
       }

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
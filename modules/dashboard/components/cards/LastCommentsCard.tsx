"use client";

import React, { useState, useEffect } from 'react';
import { useDashboardStore } from '../../stores/useDashboardStore';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import { createClient } from '@/utils/supabase/client';
import { LoadingCard, ErrorCard } from '../ui/CardStates';
import { useProjectsStore } from '@/modules/projects/store';
import { CommentItem, SectionComment, UserProfile } from '../../types';

interface LastCommentsCardProps {
  onClose?: () => void; // Callback для закрытия дашборда
}

export const LastCommentsCard: React.FC<LastCommentsCardProps> = ({ onClose }) => {
  const projectId = useDashboardStore((state) => state.projectId);
  const { highlightSection } = useProjectsStore();
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Функция для очистки HTML тегов
  const stripHtml = (html: string) => {
    return html.replace(/<[^>]*>/g, '').trim();
  };

  // Функция для обрезки текста комментария
  const truncateText = (text: string, maxLength: number = 50) => {
    const cleanText = stripHtml(text);
    return cleanText.length > maxLength ? cleanText.slice(0, maxLength) + '...' : cleanText;
  };

  // Функция для обработки клика по комментарию
  const handleCommentClick = (sectionId: string) => {
    // Подсвечиваем раздел для открытия с комментариями
    highlightSection(sectionId);
    // Закрываем дашборд через callback из ProjectsPage
    if (onClose) {
      onClose();
    }
  };

  const fetchData = async () => {
    if (!projectId) return;

    setIsLoading(true);
    setError(null);

    try {
      const supabase = createClient();

      // Получаем последние комментарии проекта
      const { data: commentsData, error: commentsError } = await supabase
        .from('section_comments')
        .select(`
          comment_id,
          section_id,
          content,
          created_at,
          author_id,
          sections!inner (
            section_id,
            section_project_id
          )
        `)
        .eq('sections.section_project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (commentsError) {
        throw new Error(commentsError.message);
      }

      if (!commentsData || commentsData.length === 0) {
        setComments([]);
        return;
      }

      // Получаем уникальные ID пользователей для загрузки профилей
      const userIds = [...new Set(commentsData.map(comment => comment.author_id).filter(Boolean))];
      
      // Загружаем профили пользователей
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, email')
        .in('user_id', userIds);

      if (profilesError && process.env.NODE_ENV === 'development') {
        console.warn('Не удалось загрузить профили пользователей:', profilesError);
      }

      // Создаем карту профилей для быстрого поиска
      const profilesMap = new Map<string, UserProfile>();
      if (profilesData) {
        profilesData.forEach((profile: UserProfile) => {
          profilesMap.set(profile.user_id, profile);
        });
      }

      // Преобразуем данные в нужный формат
      const formattedComments: CommentItem[] = commentsData.map((comment: SectionComment) => {
        const profile = profilesMap.get(comment.author_id);
        const userName = profile 
          ? `${profile.first_name} ${profile.last_name}`.trim() || profile.email
          : 'Неизвестный пользователь';

        return {
          id: comment.comment_id,
          section_id: comment.section_id,
          user: userName,
          comment: comment.content || '',
          time: comment.created_at
        };
      });

      setComments(formattedComments);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Не удалось загрузить комментарии.';
      // Логируем только в development режиме
      if (process.env.NODE_ENV === 'development') {
        console.error('Error fetching comments:', err);
      }
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let isCancelled = false;
    
    // 🔑 ИСПРАВЛЕНИЕ: Сброс данных при смене проекта
    setComments([]);
    setIsLoading(true);
    setError(null);
    
    const fetchDataWithCancel = async () => {
      if (!projectId || isCancelled) return;
      await fetchData();
    };
    
    fetchDataWithCancel();
    
    return () => {
      isCancelled = true;
    };
  }, [projectId]);

  // 🔑 ИСПРАВЛЕНИЕ: Добавляем автообновление
  useAutoRefresh(projectId || '', fetchData);

  if (isLoading) {
    return <LoadingCard title="Загрузка комментариев" />;
  }

  if (error) {
    return <ErrorCard message={error} onRetry={() => fetchData()} />;
  }

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 h-full flex flex-col shadow-lg hover:shadow-xl transition-all duration-300">
      <h3 className="text-muted-foreground text-sm mb-3">Последние комментарии</h3>
      
      <div 
        className="space-y-1 flex-1 overflow-y-auto pr-1 scrollbar-hide"
        style={{
          scrollbarWidth: 'none', /* Firefox */
          msOverflowStyle: 'none'  /* IE and Edge */
        }}
      >
        
        {comments.length > 0 ? (
          comments.map((comment) => (
            <div 
              key={comment.id}
              className="cursor-pointer hover:bg-accent p-1.5 rounded-lg transition-colors duration-200"
              onClick={() => handleCommentClick(comment.section_id)}
            >
                                        <p className="leading-tight">
                            <span className="text-primary font-medium text-sm">
                              {comment.user}: 
                            </span>
                            <span className="text-card-foreground text-sm ml-1">
                              {truncateText(comment.comment)}
                            </span>
                          </p>
            </div>
          ))
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
            Нет комментариев
          </div>
        )}
      </div>
    </div>
  );
};
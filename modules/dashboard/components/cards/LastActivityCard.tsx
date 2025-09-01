"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { TrendingUp, MessageSquare, Plus, Package, Edit, FileText, UserCheck, BarChart3 } from 'lucide-react';
import { useDashboardStore } from '../../stores/useDashboardStore';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import { createClient } from '@/utils/supabase/client';
import { LoadingCard, ErrorCard } from '../ui/CardStates';

// Utility функция для безопасного извлечения значений из array-wrapped данных
const extractRelatedValue = <T,>(data: T | T[] | undefined, key?: keyof T): any => {
  const item = Array.isArray(data) ? data[0] : data;
  return key && item ? item[key] : item;
};

interface ActivityRecord {
  user_name: string | null;
  item_name: string;
  timestamp: string;
  relative_time: string;
  extra_data?: {
    responsible_name?: string | null;
    status_name?: string;
    from_section_name?: string;
    to_section_name?: string;
  };
}

interface ActivityTypeData {
  type: 'section_created' | 'comment_added' | 'object_created' | 'responsible_updated' | 'status_updated' | 'assignment_created';
  title: string;
  hasData: boolean;
  data?: ActivityRecord[]; // Массив до 5 записей
  icon: React.ReactNode;
  color: string;
}

// Функция для получения иконки и цвета активности
const getActivityIconAndColor = (type: string): { icon: React.ReactNode; color: string } => {
  switch (type) {
    case 'section_created':
      return {
        icon: <Plus className="h-3 w-3 text-green-400" />,
        color: 'text-green-400'
      };
    case 'comment_added':
      return {
        icon: <MessageSquare className="h-3 w-3 text-blue-400" />,
        color: 'text-blue-400'
      };
    case 'object_created':
      return {
        icon: <Package className="h-3 w-3 text-purple-400" />,
        color: 'text-purple-400'
      };
    case 'responsible_updated':
      return {
        icon: <UserCheck className="h-3 w-3 text-blue-400" />,
        color: 'text-blue-400'
      };
    case 'status_updated':
      return {
        icon: <BarChart3 className="h-3 w-3 text-green-400" />,
        color: 'text-green-400'
      };
    case 'assignment_created':
      return {
        icon: <FileText className="h-3 w-3 text-cyan-400" />,
        color: 'text-cyan-400'
      };
    default:
      return {
        icon: <TrendingUp className="h-3 w-3 text-muted-foreground" />,
        color: 'text-muted-foreground'
      };
  }
};

// Функция для получения относительного времени
const getRelativeTime = (timestamp: string): string => {
  const now = new Date();
  const date = new Date(timestamp);
  const diffMs = now.getTime() - date.getTime();
  
  const minutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMs / 3600000);
  const days = Math.floor(diffMs / 86400000);
  
  if (minutes < 1) return 'только что';
  if (minutes < 60) return `${minutes} мин назад`;
  if (hours < 24) return `${hours} ч назад`;
  if (days < 30) return `${days} дн назад`;
  return date.toLocaleDateString();
};

// Функция для получения текста действия (теперь принимает дополнительные данные)
const getActionText = (type: string, data?: {
  responsible_name?: string | null;
  status_name?: string;
  from_section_name?: string;
  to_section_name?: string;
}): string => {
  switch (type) {
    case 'section_created': return ''; // Убираем текст для разделов
    case 'comment_added': return 'добавил комментарий к разделу';
    case 'object_created': return ''; // Убираем текст для объектов
    case 'responsible_updated':
      // Показываем имя ответственного; если удалён — явно указываем отсутствие
      return data?.responsible_name || 'без ответственного';
    case 'status_updated':
      // Показываем название статуса
      return data?.status_name ? `"${data.status_name}"` : 'Новый статус';
    case 'assignment_created':
      // Показываем направление задания от раздела к разделу
      if (data?.from_section_name && data?.to_section_name) {
        return `от "${data.from_section_name}" → к "${data.to_section_name}"`;
      } else {
        return 'создал задание';
      }
    default: return 'выполнил действие';
  }
};

export const LastActivityCard: React.FC = () => {
  const projectId = useDashboardStore((state) => state.projectId);
  const [activityTypes, setActivityTypes] = useState<ActivityTypeData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async (abortSignal?: AbortSignal) => {
    if (!projectId) return;
    if (abortSignal?.aborted) return;

    setIsLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 30); // Активности за последние 30 дней

      // Сначала получаем стадии проекта для правильной фильтрации объектов
      const { data: stageIds, error: stageError } = await supabase
        .from('stages')
        .select('stage_id')
        .eq('stage_project_id', projectId);

      if (stageError) {
        throw new Error(`Ошибка получения стадий: ${stageError.message}`);
      }

      const stageIdsList = stageIds?.map(s => s.stage_id) || [];

      // Параллельные запросы для всех типов активности (по 1 записи каждого типа)
      const [
        sectionsResult,
        objectsResult,
        responsibleUpdatesResult,
        statusUpdatesResult,
        assignmentsResult
      ] = await Promise.allSettled([
        // 1. Создание новых разделов - ПОСЛЕДНИЕ 3 для проекта
        supabase
          .from('sections')
          .select('section_id, section_name, section_created')
          .eq('section_project_id', projectId)
          .gte('section_created', cutoffDate.toISOString())
          .order('section_created', { ascending: false })
          .limit(3),

        // 2. Создание новых объектов - ИСПРАВЛЕННЫЙ запрос с учетом стадий (ПОСЛЕДНИЕ 3)
        (async () => {
          let query = supabase
            .from('objects')
            .select('object_id, object_name, object_created')
            .gte('object_created', cutoffDate.toISOString());

          // Фильтрация объектов: прямая связь с проектом ИЛИ через стадии
          let filters = [`object_project_id.eq.${projectId}`];
          if (stageIdsList.length > 0) {
            // Используем UUID без кавычек для предотвращения SQL injection
            filters.push(`object_stage_id.in.(${stageIdsList.join(',')})`);
          }

          if (filters.length > 0) {
            query = query.or(filters.join(','));
          }

          return await query
            .order('object_created', { ascending: false })
            .limit(3); 
        })(),

        // 3. Обновления ответственных — по last_responsible_updated
        (async () => {
          const { data, error } = await supabase
            .from('sections')
            .select(`
              section_id,
              section_name,
              last_responsible_updated,
              section_responsible,
              responsible_profile:section_responsible(first_name, last_name)
            `)
            .eq('section_project_id', projectId)
            .not('last_responsible_updated', 'is', null)
            .gte('last_responsible_updated', cutoffDate.toISOString())
            .order('last_responsible_updated', { ascending: false })
            .limit(5);

          return { data, error };
        })(),

        // 4. Обновления статусов — по last_status_updated
        (async () => {
          const { data, error } = await supabase
            .from('sections')
            .select(`
              section_id,
              section_name,
              last_status_updated,
              section_status_id,
              status:section_status_id(name)
            `)
            .eq('section_project_id', projectId)
            .not('last_status_updated', 'is', null)
            .gte('last_status_updated', cutoffDate.toISOString())
            .order('last_status_updated', { ascending: false })
            .limit(5);

          return { data, error };
        })(),

        // 4. Создание новых заданий - РАСШИРЕННЫЙ запрос с разделами
        supabase
          .from('assignments')
          .select(`
            assignment_id, 
            title, 
            created_at, 
            created_by,
            from_section_id,
            to_section_id,
            from_section:from_section_id(section_name),
            to_section:to_section_id(section_name)
          `)
          .eq('project_id', projectId)
          .gte('created_at', cutoffDate.toISOString())
          .order('created_at', { ascending: false })
          .limit(5) // ✅ Последние 5
      ]);

      if (abortSignal?.aborted) return;

      // Создаем фиксированный массив из 5 типов активности
      const activityTypesData: ActivityTypeData[] = [
        // 1. Создание новых разделов
        {
          type: 'section_created',
          title: 'Создание новых разделов',
          hasData: false,
          ...getActivityIconAndColor('section_created')
        },
        // 2. Создание новых объектов
        {
          type: 'object_created',
          title: 'Создание новых объектов',
          hasData: false,
          ...getActivityIconAndColor('object_created')
        },
        // 3. Обновление ответственного
        {
          type: 'responsible_updated',
          title: 'Обновление ответственного',
          hasData: false,
          ...getActivityIconAndColor('responsible_updated')
        },
        // 4. Обновление статусов
        {
          type: 'status_updated',
          title: 'Обновление статусов',
          hasData: false,
          ...getActivityIconAndColor('status_updated')
        },
        // 5. Создание новых заданий
        {
          type: 'assignment_created',
          title: 'Создание новых заданий',
          hasData: false,
          ...getActivityIconAndColor('assignment_created')
        }
      ];

      // Заполняем данные для каждого типа
      
      // 1. Создание разделов
      if (sectionsResult.status === 'fulfilled' && sectionsResult.value.data && sectionsResult.value.data.length > 0) {
        const sections = sectionsResult.value.data;
        activityTypesData[0].hasData = true;
        activityTypesData[0].data = sections.map((section: Record<string, any>) => ({
          user_name: null, // Нет поля created_by в sections
          item_name: section.section_name,
          timestamp: section.section_created,
          relative_time: getRelativeTime(section.section_created)
        }));
      }

      // 2. Создание объектов
      if (objectsResult.status === 'fulfilled' && objectsResult.value.data && objectsResult.value.data.length > 0) {
        const objects = objectsResult.value.data;
        activityTypesData[1].hasData = true;
        activityTypesData[1].data = objects.map((object: Record<string, any>) => ({
          user_name: null, // Нет поля created_by в objects
          item_name: object.object_name,
          timestamp: object.object_created,
          relative_time: getRelativeTime(object.object_created)
        }));
      }

      // 3. Обновления ответственного (по last_responsible_updated)
      if (responsibleUpdatesResult.status === 'fulfilled' && responsibleUpdatesResult.value.data && responsibleUpdatesResult.value.data.length > 0) {
        const sections = responsibleUpdatesResult.value.data;
        activityTypesData[2].hasData = true;
        activityTypesData[2].data = sections.map((section: Record<string, any>) => {
          const responsibleProfile = extractRelatedValue(section.responsible_profile);
          const responsibleName = responsibleProfile 
            ? `${responsibleProfile.first_name} ${responsibleProfile.last_name}`
            : null;

          return {
            user_name: null,
            item_name: section.section_name,
            timestamp: section.last_responsible_updated,
            relative_time: getRelativeTime(section.last_responsible_updated),
            extra_data: {
              responsible_name: responsibleName
            }
          };
        });
      }

      // 4. Обновления статусов (по last_status_updated)
      if (statusUpdatesResult.status === 'fulfilled' && statusUpdatesResult.value.data && statusUpdatesResult.value.data.length > 0) {
        const sections = statusUpdatesResult.value.data;
        activityTypesData[3].hasData = true;
        activityTypesData[3].data = sections.map((section: Record<string, any>) => {
          const statusName = extractRelatedValue(section.status, 'name');

          return {
            user_name: null,
            item_name: section.section_name,
            timestamp: section.last_status_updated,
            relative_time: getRelativeTime(section.last_status_updated),
            extra_data: {
              status_name: statusName
            }
          };
        });
      }

      // 5. Создание заданий - ОБРАБОТКА с данными о разделах
      if (assignmentsResult.status === 'fulfilled' && assignmentsResult.value.data && assignmentsResult.value.data.length > 0) {
        const assignments = assignmentsResult.value.data;
        activityTypesData[4].hasData = true;
        activityTypesData[4].data = assignments.map((assignment: Record<string, any>) => {
          // Получаем названия разделов
          const fromSectionName = extractRelatedValue(assignment.from_section, 'section_name');
          const toSectionName = extractRelatedValue(assignment.to_section, 'section_name');

          return {
            user_name: null, // Всегда null, так как created_by = null
            item_name: assignment.title || 'Новое задание',
            timestamp: assignment.created_at,
            relative_time: getRelativeTime(assignment.created_at),
            // Дополнительные данные для отображения направления
            extra_data: {
              from_section_name: fromSectionName,
              to_section_name: toSectionName
            }
          };
        });
      }

      if (!abortSignal?.aborted) {
        setActivityTypes(activityTypesData);
      }

    } catch (err) {
      // Игнорируем ошибки отмены
      if ((err instanceof Error && err.name === 'AbortError') || abortSignal?.aborted) return;
      
      const errorMessage = err instanceof Error ? err.message : 'Не удалось загрузить активность.';
      // Логируем только в development режиме
      if (process.env.NODE_ENV === 'development') {
        console.error('Error fetching activities:', err);
      }
      if (!abortSignal?.aborted) {
        setError(errorMessage);
      }
    } finally {
      if (!abortSignal?.aborted) {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    // 🔑 ИСПРАВЛЕНИЕ: Сброс данных при смене проекта
    setActivityTypes([]);
    setIsLoading(true);
    setError(null);
    
    // 🔑 ДОБАВЛЕНО: AbortController для отмены запросов
    const controller = new AbortController();
    
    fetchData(controller.signal);
    
    return () => {
      controller.abort();
    };
  }, [projectId]);

  // Создаем стабильную ссылку для auto-refresh с proper abort handling
  const autoRefreshCallback = useCallback(async () => {
    const controller = new AbortController();
    await fetchData(controller.signal);
  }, [projectId]);
  
  useAutoRefresh(projectId || '', autoRefreshCallback);

  if (isLoading) {
    return <LoadingCard title="Загрузка активности" />;
  }

  if (error) {
    return <ErrorCard message={error} onRetry={() => fetchData()} />;
  }

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 h-full flex flex-col shadow-lg hover:shadow-xl transition-all duration-300">
      <div className="flex items-center mb-3">
        <TrendingUp className="h-3 w-3 text-muted-foreground mr-2" />
        <h3 className="text-muted-foreground text-sm">Последняя активность</h3>
      </div>
      
      {/* Группированный список типов активности с невидимым скроллом */}
      <div 
        className="space-y-4 flex-1 overflow-y-auto pr-1"
        style={{
          scrollbarWidth: 'none', /* Firefox */
          msOverflowStyle: 'none'  /* IE and Edge */
        }}
      >
        <style jsx>{`
          div::-webkit-scrollbar {
            display: none; /* Chrome, Safari, Opera */
          }
        `}</style>
        
                 {activityTypes.map((activityType, index) => {
           // Специальная обработка для разделов - показываем их вместе с объектами
           if (activityType.type === 'section_created') {
             const objectsType = activityTypes.find(t => t.type === 'object_created');
             
             return (
               <div key="sections-and-objects" className="border-b border-gray-200 dark:border-gray-700 pb-3">
                 <div className="grid grid-cols-2 gap-2">
                   {/* Левая колонка - разделы */}
                   <div>
                     <div className="flex items-center mb-2">
                       <div className="flex-shrink-0">
                         {activityType.icon}
                       </div>
                       <h4 className="text-xs font-medium text-muted-foreground ml-2 uppercase tracking-wide">
                         СОЗДАНИЕ РАЗДЕЛОВ
                       </h4>
                     </div>
                     
                     {activityType.hasData && activityType.data && activityType.data.length > 0 ? (
                       <div className="space-y-2">
                         {activityType.data.map((record, recordIndex) => (
                           <div key={recordIndex} className="border-l-2 border-green-500/30 pl-3">
                             <p className="text-sm text-card-foreground break-words leading-tight">
                               {record.item_name}
                             </p>
                             <p className="text-xs text-muted-foreground mt-0.5">
                               {record.relative_time}
                             </p>
                           </div>
                         ))}
                       </div>
                     ) : (
                       <div>
                         <p className="text-xs text-muted-foreground italic">
                           Нет активности
                         </p>
                       </div>
                     )}
                   </div>
                   
                   {/* Правая колонка - объекты */}
                   <div>
                     <div className="flex items-center mb-2">
                       <div className="flex-shrink-0">
                         {objectsType?.icon}
                       </div>
                       <h4 className="text-xs font-medium text-muted-foreground ml-2 uppercase tracking-wide">
                         СОЗДАНИЕ ОБЪЕКТОВ
                       </h4>
                     </div>
                     
                     {objectsType?.hasData && objectsType.data && objectsType.data.length > 0 ? (
                       <div className="space-y-2">
                         {objectsType.data.map((record, recordIndex) => (
                           <div key={recordIndex} className="border-l-2 border-purple-500/30 pl-3">
                             <p className="text-sm text-card-foreground break-words leading-tight">
                               {record.item_name}
                             </p>
                             <p className="text-xs text-muted-foreground mt-0.5">
                               {record.relative_time}
                             </p>
                           </div>
                         ))}
                       </div>
                     ) : (
                       <div>
                         <p className="text-xs text-muted-foreground italic">
                           Нет активности
                         </p>
                       </div>
                     )}
                   </div>
                 </div>
               </div>
             );
           }
           
           // Пропускаем объекты, так как они уже обработаны выше
           if (activityType.type === 'object_created') {
             return null;
           }

           // Специальная обработка для обновлений - показываем ответственных и статусы вместе
           if (activityType.type === 'responsible_updated') {
             const statusType = activityTypes.find(t => t.type === 'status_updated');
             
             return (
               <div key="updates-responsible-and-status" className="border-b border-gray-200 dark:border-gray-700 pb-3">
                 <div className="grid grid-cols-2 gap-2">
                   {/* Левая колонка - ответственные */}
                   <div>
                     <div className="flex items-center mb-2">
                       <div className="flex-shrink-0">
                         {activityType.icon}
                       </div>
                       <h4 className="text-xs font-medium text-muted-foreground ml-2 uppercase tracking-wide">
                         ОБНОВЛЕНИЕ ОТВЕТСТВЕННОГО
                       </h4>
                     </div>
                     
                     {activityType.hasData && activityType.data && activityType.data.length > 0 ? (
                       <div className="space-y-2">
                         {activityType.data.map((record, recordIndex) => (
                           <div key={recordIndex} className="border-l-2 border-blue-500/30 pl-3">
                             <p className="text-sm text-blue-400 break-words leading-tight font-medium">
                               {getActionText(activityType.type, record.extra_data)}
                             </p>
                             <p className="text-xs text-card-foreground/70 mt-0.5">
                               {record.item_name}
                             </p>
                             <p className="text-xs text-muted-foreground mt-0.5">
                               {record.relative_time}
                             </p>
                           </div>
                         ))}
                       </div>
                     ) : (
                       <div>
                         <p className="text-xs text-muted-foreground italic">
                           Нет активности
                         </p>
                       </div>
                     )}
                   </div>
                   
                   {/* Правая колонка - статусы */}
                   <div>
                     <div className="flex items-center mb-2">
                       <div className="flex-shrink-0">
                         {statusType?.icon}
                       </div>
                       <h4 className="text-xs font-medium text-muted-foreground ml-2 uppercase tracking-wide">
                         ОБНОВЛЕНИЕ СТАТУСОВ
                       </h4>
                     </div>
                     
                     {statusType?.hasData && statusType.data && statusType.data.length > 0 ? (
                       <div className="space-y-2">
                         {statusType.data.map((record, recordIndex) => (
                           <div key={recordIndex} className="border-l-2 border-green-500/30 pl-3">
                             <p className="text-sm text-green-400 break-words leading-tight font-medium">
                               {getActionText(statusType.type, record.extra_data)}
                             </p>
                             <p className="text-xs text-card-foreground/70 mt-0.5">
                               {record.item_name}
                             </p>
                             <p className="text-xs text-muted-foreground mt-0.5">
                               {record.relative_time}
                             </p>
                           </div>
                         ))}
                       </div>
                     ) : (
                       <div>
                         <p className="text-xs text-muted-foreground italic">
                           Нет активности
                         </p>
                       </div>
                     )}
                   </div>
                 </div>
               </div>
             );
           }
           
           // Пропускаем статусы, так как они уже обработаны выше
           if (activityType.type === 'status_updated') {
             return null;
           }
          
          // Остальные типы отображаем как обычно
          return (
            <div key={activityType.type} className="border-b border-gray-200 dark:border-gray-700 pb-3 last:border-b-0 last:pb-0">
              {/* Заголовок типа активности */}
              <div className="flex items-center mb-2">
                <div className="flex-shrink-0">
                  {activityType.icon}
                </div>
                <h4 className="text-xs font-medium text-muted-foreground ml-2 uppercase tracking-wide">
                  {activityType.title}
                </h4>
              </div>
              
              {/* Список записей или заглушка */}
              {activityType.hasData && activityType.data && activityType.data.length > 0 ? (
                <div className="space-y-2">
                  {activityType.data.map((record, recordIndex) => (
                    <div key={recordIndex} className="border-l-2 border-gray-200 dark:border-gray-600 pl-3">
                                             <p className="text-sm leading-tight">
                         {record.user_name ? (
                           <span className={`${activityType.color} font-medium`}>
                             {record.user_name}
                           </span>
                         ) : (
                           <span className="text-muted-foreground">Система</span>
                         )}
                         <span className="text-card-foreground ml-1">
                           {getActionText(activityType.type, record.extra_data)}
                         </span>
                       </p>
                      <p className="text-xs text-card-foreground/70 mt-0.5 break-words">
                        {record.item_name}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {record.relative_time}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div>
                  <p className="text-xs text-muted-foreground italic">
                    Нет активности за последние 30 дней
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
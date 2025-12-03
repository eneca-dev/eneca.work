import { createClient } from '@/utils/supabase/client';
import type { ProjectTag, ProjectTagFormData } from '../types';

interface ApiResult {
  success: boolean;
  error?: string;
}

/**
 * Получить все теги из справочника
 */
export async function getAllProjectTags(): Promise<ProjectTag[]> {
  try {
    const supabase = createClient();

    const { data, error } = await supabase
      .from('project_tags')
      .select('*')
      .order('name');

    if (error) {
      console.error('Error loading project tags:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error in getAllProjectTags:', error);
    return [];
  }
}

/**
 * Получить теги конкретного проекта
 */
export async function getProjectTags(projectId: string): Promise<ProjectTag[]> {
  try {
    const supabase = createClient();

    const { data, error } = await supabase
      .from('project_tag_links')
      .select(`
        tag_id,
        project_tags (
          tag_id,
          name,
          color,
          created_at,
          updated_at
        )
      `)
      .eq('project_id', projectId);

    if (error) {
      console.error('Error loading project tags:', error);
      return [];
    }

    // @ts-ignore - Supabase types are complex here
    return data?.map(item => item.project_tags).filter(Boolean) || [];
  } catch (error) {
    console.error('Error in getProjectTags:', error);
    return [];
  }
}

/**
 * Добавить тег к проекту
 */
export async function addTagToProject(
  projectId: string,
  tagId: string
): Promise<ApiResult> {
  try {
    const supabase = createClient();

    const { error } = await supabase
      .from('project_tag_links')
      .insert({
        project_id: projectId,
        tag_id: tagId,
      });

    if (error) {
      // Duplicate key error
      if (error.code === '23505') {
        return { success: false, error: 'Этот тег уже назначен проекту' };
      }
      console.error('Error adding tag to project:', error);
      return { success: false, error: 'Ошибка при добавлении тега' };
    }

    return { success: true };
  } catch (error) {
    console.error('Error in addTagToProject:', error);
    return { success: false, error: 'Произошла ошибка' };
  }
}

/**
 * Удалить тег из проекта
 */
export async function removeTagFromProject(
  projectId: string,
  tagId: string
): Promise<ApiResult> {
  try {
    const supabase = createClient();

    const { error } = await supabase
      .from('project_tag_links')
      .delete()
      .eq('project_id', projectId)
      .eq('tag_id', tagId);

    if (error) {
      console.error('Error removing tag from project:', error);
      return { success: false, error: 'Ошибка при удалении тега' };
    }

    return { success: true };
  } catch (error) {
    console.error('Error in removeTagFromProject:', error);
    return { success: false, error: 'Произошла ошибка' };
  }
}

/**
 * Массовое обновление тегов проекта (заменить все)
 */
export async function updateProjectTags(
  projectId: string,
  tagIds: string[]
): Promise<ApiResult> {
  try {
    const supabase = createClient();

    // Удалить все существующие теги
    const { error: deleteError } = await supabase
      .from('project_tag_links')
      .delete()
      .eq('project_id', projectId);

    if (deleteError) {
      console.error('Error deleting old tags:', deleteError);
      return { success: false, error: 'Ошибка при обновлении тегов' };
    }

    // Добавить новые теги (если есть)
    if (tagIds.length > 0) {
      const links = tagIds.map(tagId => ({
        project_id: projectId,
        tag_id: tagId,
      }));

      const { error: insertError } = await supabase
        .from('project_tag_links')
        .insert(links);

      if (insertError) {
        console.error('Error inserting new tags:', insertError);
        return { success: false, error: 'Ошибка при добавлении тегов' };
      }
    }

    return { success: true };
  } catch (error) {
    console.error('Error in updateProjectTags:', error);
    return { success: false, error: 'Произошла ошибка' };
  }
}

/**
 * Создать новый тег
 */
export async function createTag(
  data: ProjectTagFormData,
  userId: string
): Promise<ProjectTag | null> {
  try {
    const supabase = createClient();

    const { data: tag, error } = await supabase
      .from('project_tags')
      .insert({
        name: data.name.trim(),
        color: data.color,
        created_by: userId,
        updated_by: userId,
      })
      .select()
      .single();

    if (error) {
      // Unique constraint violation
      if (error.code === '23505') {
        throw new Error('Тег с таким названием уже существует');
      }
      console.error('Error creating tag:', error);
      throw new Error('Ошибка при создании тега');
    }

    return tag;
  } catch (error) {
    console.error('Error in createTag:', error);
    throw error;
  }
}

/**
 * Обновить существующий тег
 */
export async function updateTag(
  tagId: string,
  data: ProjectTagFormData,
  userId: string
): Promise<ProjectTag | null> {
  try {
    const supabase = createClient();

    const { data: tag, error } = await supabase
      .from('project_tags')
      .update({
        name: data.name.trim(),
        color: data.color,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      })
      .eq('tag_id', tagId)
      .select()
      .single();

    if (error) {
      // Unique constraint violation
      if (error.code === '23505') {
        throw new Error('Тег с таким названием уже существует');
      }
      console.error('Error updating tag:', error);
      throw new Error('Ошибка при обновлении тега');
    }

    return tag;
  } catch (error) {
    console.error('Error in updateTag:', error);
    throw error;
  }
}

/**
 * Удалить тег из справочника
 */
export async function deleteTag(tagId: string): Promise<boolean> {
  try {
    const supabase = createClient();

    // ON DELETE CASCADE автоматически удалит связи
    const { error } = await supabase
      .from('project_tags')
      .delete()
      .eq('tag_id', tagId);

    if (error) {
      console.error('Error deleting tag:', error);
      throw new Error('Ошибка при удалении тега');
    }

    return true;
  } catch (error) {
    console.error('Error in deleteTag:', error);
    throw error;
  }
}

/**
 * Сервис для работы с базой данных Eneca
 * Содержит CRUD операции для всех сущностей системы
 */

import { supabase } from '../config/supabase.js';
import type {
  Project, Stage, ObjectEntity, Section, Profile, Client,
  CreateProjectInput, CreateStageInput, CreateObjectInput, CreateSectionInput,
  UpdateProjectInput, UpdateStageInput, UpdateObjectInput, UpdateSectionInput,
  OperationResult, ProjectFilters, StageFilters, ObjectFilters, SectionFilters,
  CascadeDeleteInfo
} from '../types/eneca.js';

export class DatabaseService {
  // ===== МЕТОДЫ ВАЛИДАЦИИ =====

  async validateProjectExists(projectId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('projects')
      .select('project_id')
      .eq('project_id', projectId)
      .single();
    
    return !error && !!data;
  }

  async validateStageExists(stageId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('stages')
      .select('stage_id')
      .eq('stage_id', stageId)
      .single();
    
    return !error && !!data;
  }

  async validateObjectExists(objectId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('objects')
      .select('object_id')
      .eq('object_id', objectId)
      .single();
    
    return !error && !!data;
  }

  async validateUserExists(userId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('profiles')
      .select('user_id')
      .eq('user_id', userId)
      .single();
    
    return !error && !!data;
  }

  async validateProjectNameUnique(name: string, excludeId?: string): Promise<boolean> {
    let query = supabase
      .from('projects')
      .select('project_id')
      .eq('project_name', name);
    
    if (excludeId) {
      query = query.neq('project_id', excludeId);
    }
    
    const { data, error } = await query;
    return !error && (!data || data.length === 0);
  }

  // ===== CRUD ОПЕРАЦИИ ДЛЯ ПРОЕКТОВ =====

  async createProject(input: CreateProjectInput): Promise<OperationResult> {
    try {
      // Валидация уникальности названия
      if (!(await this.validateProjectNameUnique(input.project_name))) {
        return { success: false, message: 'Проект с таким названием уже существует' };
      }

      // Валидация менеджера проекта
      if (input.project_manager && !(await this.validateUserExists(input.project_manager))) {
        return { success: false, message: 'Указанный менеджер проекта не найден' };
      }

      // Валидация главного инженера
      if (input.project_lead_engineer && !(await this.validateUserExists(input.project_lead_engineer))) {
        return { success: false, message: 'Указанный главный инженер не найден' };
      }

      const { data, error } = await supabase
        .from('projects')
        .insert([input])
        .select()
        .single();

      if (error) {
        return { success: false, message: `Ошибка создания проекта: ${error.message}`, error: error.message };
      }

      return { success: true, message: 'Проект успешно создан', data };
    } catch (error) {
      return { success: false, message: `Неожиданная ошибка: ${error}`, error: String(error) };
    }
  }

  async updateProject(input: UpdateProjectInput): Promise<OperationResult> {
    try {
      // Проверка существования проекта
      if (!(await this.validateProjectExists(input.project_id))) {
        return { success: false, message: 'Проект не найден' };
      }

      // Валидация уникальности названия
      if (input.project_name && !(await this.validateProjectNameUnique(input.project_name, input.project_id))) {
        return { success: false, message: 'Проект с таким названием уже существует' };
      }

      // Валидация менеджера проекта
      if (input.project_manager && !(await this.validateUserExists(input.project_manager))) {
        return { success: false, message: 'Указанный менеджер проекта не найден' };
      }

      // Валидация главного инженера
      if (input.project_lead_engineer && !(await this.validateUserExists(input.project_lead_engineer))) {
        return { success: false, message: 'Указанный главный инженер не найден' };
      }

      const { project_id, ...updateData } = input;
      const { data, error } = await supabase
        .from('projects')
        .update(updateData)
        .eq('project_id', project_id)
        .select()
        .single();

      if (error) {
        return { success: false, message: `Ошибка обновления проекта: ${error.message}`, error: error.message };
      }

      return { success: true, message: 'Проект успешно обновлен', data };
    } catch (error) {
      return { success: false, message: `Неожиданная ошибка: ${error}`, error: String(error) };
    }
  }

  async deleteProject(projectId: string, cascade: boolean = false): Promise<OperationResult> {
    try {
      // Проверка существования проекта
      if (!(await this.validateProjectExists(projectId))) {
        return { success: false, message: 'Проект не найден' };
      }

      // Получение информации о связанных данных
      const cascadeInfo = await this.getCascadeDeleteInfo(projectId);
      
      if (cascadeInfo.total > 0 && !cascade) {
        return { 
          success: false, 
          message: `Нельзя удалить проект: найдены связанные данные (${cascadeInfo.total} записей). Используйте каскадное удаление.`,
          data: cascadeInfo 
        };
      }

      // Каскадное удаление
      if (cascade) {
        await supabase.from('sections').delete().eq('section_project_id', projectId);
        await supabase.from('objects').delete().eq('object_project_id', projectId);
        await supabase.from('stages').delete().eq('stage_project_id', projectId);
      }

      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('project_id', projectId);

      if (error) {
        return { success: false, message: `Ошибка удаления проекта: ${error.message}`, error: error.message };
      }

      return { 
        success: true, 
        message: cascade ? 
          `Проект и все связанные данные (${cascadeInfo.total} записей) успешно удалены` : 
          'Проект успешно удален',
        data: cascadeInfo 
      };
    } catch (error) {
      return { success: false, message: `Неожиданная ошибка: ${error}`, error: String(error) };
    }
  }

  async getProject(projectId: string): Promise<OperationResult> {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('project_id', projectId)
        .single();

      if (error) {
        return { success: false, message: `Проект не найден: ${error.message}`, error: error.message };
      }

      return { success: true, message: 'Проект найден', data };
    } catch (error) {
      return { success: false, message: `Неожиданная ошибка: ${error}`, error: String(error) };
    }
  }

  async listProjects(filters: ProjectFilters = {}): Promise<OperationResult> {
    try {
      let query = supabase
        .from('projects')
        .select('*');

      // Применение фильтров
      if (filters.manager) {
        query = query.eq('project_manager', filters.manager);
      }
      if (filters.status) {
        query = query.eq('project_status', filters.status);
      }
      if (filters.client_id) {
        query = query.eq('client_id', filters.client_id);
      }
      if (filters.limit) {
        query = query.limit(filters.limit);
      }
      if (filters.offset) {
        query = query.range(filters.offset, filters.offset + (filters.limit || 10) - 1);
      }

      const { data, error } = await query;

      if (error) {
        return { success: false, message: `Ошибка получения проектов: ${error.message}`, error: error.message };
      }

      return { success: true, message: `Найдено проектов: ${data.length}`, data };
    } catch (error) {
      return { success: false, message: `Неожиданная ошибка: ${error}`, error: String(error) };
    }
  }

  // ===== CRUD ОПЕРАЦИИ ДЛЯ ЭТАПОВ =====

  async createStage(input: CreateStageInput): Promise<OperationResult> {
    try {
      // Валидация существования проекта
      if (!(await this.validateProjectExists(input.stage_project_id))) {
        return { success: false, message: 'Указанный проект не найден' };
      }

      const { data, error } = await supabase
        .from('stages')
        .insert([input])
        .select()
        .single();

      if (error) {
        return { success: false, message: `Ошибка создания этапа: ${error.message}`, error: error.message };
      }

      return { success: true, message: 'Этап успешно создан', data };
    } catch (error) {
      return { success: false, message: `Неожиданная ошибка: ${error}`, error: String(error) };
    }
  }

  async updateStage(input: UpdateStageInput): Promise<OperationResult> {
    try {
      // Проверка существования этапа
      if (!(await this.validateStageExists(input.stage_id))) {
        return { success: false, message: 'Этап не найден' };
      }

      // Валидация существования проекта
      if (input.stage_project_id && !(await this.validateProjectExists(input.stage_project_id))) {
        return { success: false, message: 'Указанный проект не найден' };
      }

      const { stage_id, ...updateData } = input;
      const { data, error } = await supabase
        .from('stages')
        .update(updateData)
        .eq('stage_id', stage_id)
        .select()
        .single();

      if (error) {
        return { success: false, message: `Ошибка обновления этапа: ${error.message}`, error: error.message };
      }

      return { success: true, message: 'Этап успешно обновлен', data };
    } catch (error) {
      return { success: false, message: `Неожиданная ошибка: ${error}`, error: String(error) };
    }
  }

  async deleteStage(stageId: string, cascade: boolean = false): Promise<OperationResult> {
    try {
      // Проверка существования этапа
      if (!(await this.validateStageExists(stageId))) {
        return { success: false, message: 'Этап не найден' };
      }

      // Проверка связанных объектов
      const childrenCount = await this.hasStageChildren(stageId);
      
      if (childrenCount > 0 && !cascade) {
        return { 
          success: false, 
          message: `Нельзя удалить этап: найдены связанные объекты (${childrenCount}). Используйте каскадное удаление.` 
        };
      }

      // Каскадное удаление
      if (cascade) {
        // Удаляем разделы связанных объектов
        const { data: objects } = await supabase
          .from('objects')
          .select('object_id')
          .eq('object_stage_id', stageId);
        
        if (objects && objects.length > 0) {
          const objectIds = objects.map(obj => obj.object_id);
          await supabase.from('sections').delete().in('section_object_id', objectIds);
        }
        
        await supabase.from('objects').delete().eq('object_stage_id', stageId);
      }

      const { error } = await supabase
        .from('stages')
        .delete()
        .eq('stage_id', stageId);

      if (error) {
        return { success: false, message: `Ошибка удаления этапа: ${error.message}`, error: error.message };
      }

      return { 
        success: true, 
        message: cascade ? 
          `Этап и все связанные объекты (${childrenCount}) успешно удалены` : 
          'Этап успешно удален' 
      };
    } catch (error) {
      return { success: false, message: `Неожиданная ошибка: ${error}`, error: String(error) };
    }
  }

  async listStages(filters: StageFilters = {}): Promise<OperationResult> {
    try {
      let query = supabase
        .from('stages')
        .select('*');

      // Применение фильтров
      if (filters.project_id) {
        query = query.eq('stage_project_id', filters.project_id);
      }
      if (filters.limit) {
        query = query.limit(filters.limit);
      }
      if (filters.offset) {
        query = query.range(filters.offset, filters.offset + (filters.limit || 10) - 1);
      }

      const { data, error } = await query;

      if (error) {
        return { success: false, message: `Ошибка получения этапов: ${error.message}`, error: error.message };
      }

      return { success: true, message: `Найдено этапов: ${data.length}`, data };
    } catch (error) {
      return { success: false, message: `Неожиданная ошибка: ${error}`, error: String(error) };
    }
  }

  // ===== ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ =====

  async getCascadeDeleteInfo(projectId: string): Promise<CascadeDeleteInfo> {
    const [sectionsResult, objectsResult, stagesResult] = await Promise.all([
      supabase.from('sections').select('section_id').eq('section_project_id', projectId),
      supabase.from('objects').select('object_id').eq('object_project_id', projectId),
      supabase.from('stages').select('stage_id').eq('stage_project_id', projectId)
    ]);

    const sections = sectionsResult.data?.length || 0;
    const objects = objectsResult.data?.length || 0;
    const stages = stagesResult.data?.length || 0;

    return {
      sections,
      objects,
      stages,
      total: sections + objects + stages
    };
  }

  async hasStageChildren(stageId: string): Promise<number> {
    const { data } = await supabase
      .from('objects')
      .select('object_id')
      .eq('object_stage_id', stageId);
    
    return data?.length || 0;
  }

  async hasObjectChildren(objectId: string): Promise<number> {
    const { data } = await supabase
      .from('sections')
      .select('section_id')
      .eq('section_object_id', objectId);
    
    return data?.length || 0;
  }

  // ===== ПОИСК ПО ИМЕНАМ =====

  async findUserByName(name: string): Promise<Profile | null> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .or(`first_name.ilike.%${name}%,last_name.ilike.%${name}%,email.ilike.%${name}%`)
      .limit(1)
      .single();

    return error ? null : data;
  }

  // ===== МЕТОДЫ С ОБРАБОТКОЙ ДУБЛИКАТОВ =====

  async validateUniqueProjectByName(name: string): Promise<Project | 'not_found' | 'multiple_found'> {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('project_name', name);

    if (error || !data) return 'not_found';
    if (data.length === 0) return 'not_found';
    if (data.length > 1) return 'multiple_found';
    return data[0];
  }

  async validateUniqueStageByName(name: string, projectId: string): Promise<Stage | 'not_found' | 'multiple_found'> {
    const { data, error } = await supabase
      .from('stages')
      .select('*')
      .eq('stage_name', name)
      .eq('stage_project_id', projectId);

    if (error || !data) return 'not_found';
    if (data.length === 0) return 'not_found';
    if (data.length > 1) return 'multiple_found';
    return data[0];
  }

  async validateUniqueObjectByName(name: string, stageId?: string): Promise<ObjectEntity | 'not_found' | 'multiple_found'> {
    let query = supabase
      .from('objects')
      .select('*')
      .eq('object_name', name);

    if (stageId) {
      query = query.eq('object_stage_id', stageId);
    }

    const { data, error } = await query;

    if (error || !data) return 'not_found';
    if (data.length === 0) return 'not_found';
    if (data.length > 1) return 'multiple_found';
    return data[0];
  }

  async searchUsersByQuery(query: string): Promise<any[]> {
    // Убираем пробелы
    const cleanQuery = query.trim();
    
    if (!cleanQuery) {
      // Если запрос пустой, возвращаем всех активных пользователей
      const { data, error } = await supabase
        .from('view_users')
        .select('*')
        .eq('is_active', true)
        .limit(50);
      return error ? [] : data || [];
    }

    // Создаем различные варианты поиска
    const searchTerms = [];
    
    // Оригинальный запрос
    searchTerms.push(`first_name.ilike.%${cleanQuery}%`);
    searchTerms.push(`last_name.ilike.%${cleanQuery}%`);
    searchTerms.push(`full_name.ilike.%${cleanQuery}%`);
    searchTerms.push(`email.ilike.%${cleanQuery}%`);
    
    // Если в запросе есть пробелы, ищем как полное имя
    if (cleanQuery.includes(' ')) {
      // Разбиваем на слова
      const words = cleanQuery.split(/\s+/);
      if (words.length >= 2) {
        // Первое слово - имя, второе - фамилия
        const firstName = words[0];
        const lastName = words[1];
        
        // Добавляем поиск по комбинации имя+фамилия
        searchTerms.push(`and(first_name.ilike.%${firstName}%,last_name.ilike.%${lastName}%)`);
        // И в обратном порядке
        searchTerms.push(`and(first_name.ilike.%${lastName}%,last_name.ilike.%${firstName}%)`);
      }
    }
    
    const { data, error } = await supabase
      .from('view_users')
      .select('*')
      .eq('is_active', true)
      .or(searchTerms.join(','))
      .limit(10);

    return error ? [] : data || [];
  }

  async getUserActiveWorkloads(userId: string): Promise<any[]> {
    // Получаем активные проекты и разделы пользователя
    const { data, error } = await supabase
      .from('view_sections_with_loadings')
      .select('*')
      .or(`section_responsible_id.eq.${userId},loading_responsible.eq.${userId}`)
      .limit(20);

    return error ? [] : data || [];
  }

  // ===== МЕТОДЫ ПОИСКА ДЛЯ ОБНОВЛЕНИЯ =====

  async findProjectByNameExact(name: string): Promise<Project | null> {
    const cleanName = name.trim();
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('project_name', cleanName)
      .single();

    return error ? null : data;
  }

  async findStageByNameExact(name: string, projectId: string): Promise<Stage | null> {
    const cleanName = name.trim();
    const { data, error } = await supabase
      .from('stages')
      .select('*')
      .eq('stage_name', cleanName)
      .eq('stage_project_id', projectId)
      .single();

    return error ? null : data;
  }

  async findObjectByNameExact(name: string, projectId: string, stageId?: string): Promise<ObjectEntity | null> {
    const cleanName = name.trim();
    let query = supabase
      .from('objects')
      .select('*')
      .eq('object_name', cleanName)
      .eq('object_project_id', projectId);

    if (stageId) {
      query = query.eq('object_stage_id', stageId);
    }

    const { data, error } = await query.single();
    return error ? null : data;
  }

  async findSectionByNameExact(name: string, projectId: string, objectId?: string): Promise<Section | null> {
    const cleanName = name.trim();
    let query = supabase
      .from('sections')
      .select('*')
      .eq('section_name', cleanName)
      .eq('section_project_id', projectId);

    if (objectId) {
      query = query.eq('section_object_id', objectId);
    }

    const { data, error } = await query.single();
    return error ? null : data;
  }

  // ===== ВАЛИДАЦИЯ УНИКАЛЬНОСТИ ДЛЯ ОБНОВЛЕНИЯ =====

  async validateUniqueProjectByNameForUpdate(name: string, excludeId: string): Promise<'unique' | 'duplicate'> {
    const cleanName = name.trim();
    const { data, error } = await supabase
      .from('projects')
      .select('project_id')
      .eq('project_name', cleanName)
      .neq('project_id', excludeId);

    if (error) return 'unique';
    return data && data.length > 0 ? 'duplicate' : 'unique';
  }

  async validateUniqueStageByNameForUpdate(name: string, projectId: string, excludeId: string): Promise<'unique' | 'duplicate'> {
    const cleanName = name.trim();
    const { data, error } = await supabase
      .from('stages')
      .select('stage_id')
      .eq('stage_name', cleanName)
      .eq('stage_project_id', projectId)
      .neq('stage_id', excludeId);

    if (error) return 'unique';
    return data && data.length > 0 ? 'duplicate' : 'unique';
  }

  async validateUniqueObjectByNameForUpdate(name: string, stageId: string, excludeId: string): Promise<'unique' | 'duplicate'> {
    const cleanName = name.trim();
    const { data, error } = await supabase
      .from('objects')
      .select('object_id')
      .eq('object_name', cleanName)
      .eq('object_stage_id', stageId)
      .neq('object_id', excludeId);

    if (error) return 'unique';
    return data && data.length > 0 ? 'duplicate' : 'unique';
  }

  async validateUniqueSectionByNameForUpdate(name: string, objectId: string, excludeId: string): Promise<'unique' | 'duplicate'> {
    const cleanName = name.trim();
    const { data, error } = await supabase
      .from('sections')
      .select('section_id')
      .eq('section_name', cleanName)
      .eq('section_object_id', objectId)
      .neq('section_id', excludeId);

    if (error) return 'unique';
    return data && data.length > 0 ? 'duplicate' : 'unique';
  }

  // ===== UTILITY МЕТОДЫ =====

  validateProjectStatus(status: string): boolean {
    const validStatuses = ['active', 'archive', 'paused', 'canceled'];
    return validStatuses.includes(status.toLowerCase());
  }

  parseDate(dateString: string): string | null {
    try {
      const trimmed = dateString.trim();
      
      // Проверка на формат дд.мм.гггг
      const ddmmyyyyPattern = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/;
      const match = trimmed.match(ddmmyyyyPattern);
      
      if (match) {
        const day = parseInt(match[1], 10);
        const month = parseInt(match[2], 10);
        const year = parseInt(match[3], 10);
        
        // Создаем дату в формате ISO (год-месяц-день)
        const date = new Date(year, month - 1, day); // месяц в JS начинается с 0
        
        // Проверяем, что дата валидная
        if (date.getFullYear() === year && 
            date.getMonth() === month - 1 && 
            date.getDate() === day) {
          return date.toISOString().split('T')[0]; // возвращаем только дату без времени
        }
        return null;
      }
      
      // Если не формат дд.мм.гггг, пробуем стандартный парсинг
      const date = new Date(trimmed);
      if (isNaN(date.getTime())) return null;
      return date.toISOString().split('T')[0];
    } catch {
      return null;
    }
  }

  formatDateForDisplay(dateString: string): string {
    try {
      const date = new Date(dateString);
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear();
      return `${day}.${month}.${year}`;
    } catch {
      return dateString;
    }
  }

  async searchProjectsByName(name: string): Promise<Project[]> {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .ilike('project_name', `%${name}%`)
      .limit(10);

    return error ? [] : data || [];
  }

  async searchStagesByName(name: string, projectId?: string): Promise<Stage[]> {
    let query = supabase
      .from('stages')
      .select('*')
      .ilike('stage_name', `%${name}%`);

    if (projectId) {
      query = query.eq('stage_project_id', projectId);
    }

    const { data, error } = await query.limit(10);
    return error ? [] : data || [];
  }

  async searchObjectsByName(name: string, stageId?: string): Promise<ObjectEntity[]> {
    let query = supabase
      .from('objects')
      .select('*')
      .ilike('object_name', `%${name}%`);

    if (stageId) {
      query = query.eq('object_stage_id', stageId);
    }

    const { data, error } = await query.limit(10);
    return error ? [] : data || [];
  }

  async findProjectByName(name: string): Promise<Project | null> {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .ilike('project_name', `%${name}%`)
      .limit(1)
      .single();

    return error ? null : data;
  }

  async findStageByName(name: string, projectId?: string): Promise<Stage | null> {
    let query = supabase
      .from('stages')
      .select('*')
      .ilike('stage_name', `%${name}%`);

    if (projectId) {
      query = query.eq('stage_project_id', projectId);
    }

    const { data, error } = await query.limit(1).single();
    return error ? null : data;
  }

  async findObjectByName(name: string, stageId?: string): Promise<ObjectEntity | null> {
    let query = supabase
      .from('objects')
      .select('*')
      .ilike('object_name', `%${name}%`);

    if (stageId) {
      query = query.eq('object_stage_id', stageId);
    }

    const { data, error } = await query.limit(1).single();
    return error ? null : data;
  }

  async findClientByName(name: string): Promise<Client | null> {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .ilike('client_name', `%${name}%`)
      .limit(1)
      .single();

    return error ? null : data;
  }

  // ===== CRUD ОПЕРАЦИИ ДЛЯ ОБЪЕКТОВ =====

  async createObject(input: CreateObjectInput): Promise<OperationResult> {
    try {
      // Валидация существования проекта
      if (!(await this.validateProjectExists(input.object_project_id))) {
        return { success: false, message: 'Указанный проект не найден' };
      }

      // Валидация существования стадии
      if (!(await this.validateStageExists(input.object_stage_id))) {
        return { success: false, message: 'Указанная стадия не найдена' };
      }

      // Валидация ответственного пользователя
      if (input.object_responsible && !(await this.validateUserExists(input.object_responsible))) {
        return { success: false, message: 'Указанный ответственный пользователь не найден' };
      }

      const { data, error } = await supabase
        .from('objects')
        .insert([input])
        .select()
        .single();

      if (error) {
        return { success: false, message: `Ошибка создания объекта: ${error.message}`, error: error.message };
      }

      return { success: true, message: 'Объект успешно создан', data };
    } catch (error) {
      return { success: false, message: `Неожиданная ошибка: ${error}`, error: String(error) };
    }
  }

  async updateObject(input: UpdateObjectInput): Promise<OperationResult> {
    try {
      // Проверка существования объекта
      if (!(await this.validateObjectExists(input.object_id))) {
        return { success: false, message: 'Объект не найден' };
      }

      // Валидация существования проекта
      if (input.object_project_id && !(await this.validateProjectExists(input.object_project_id))) {
        return { success: false, message: 'Указанный проект не найден' };
      }

      // Валидация существования стадии
      if (input.object_stage_id && !(await this.validateStageExists(input.object_stage_id))) {
        return { success: false, message: 'Указанная стадия не найдена' };
      }

      // Валидация ответственного пользователя
      if (input.object_responsible && !(await this.validateUserExists(input.object_responsible))) {
        return { success: false, message: 'Указанный ответственный пользователь не найден' };
      }

      const { object_id, ...updateData } = input;
      const { data, error } = await supabase
        .from('objects')
        .update(updateData)
        .eq('object_id', object_id)
        .select()
        .single();

      if (error) {
        return { success: false, message: `Ошибка обновления объекта: ${error.message}`, error: error.message };
      }

      return { success: true, message: 'Объект успешно обновлен', data };
    } catch (error) {
      return { success: false, message: `Неожиданная ошибка: ${error}`, error: String(error) };
    }
  }

  async deleteObject(objectId: string, cascade: boolean = false): Promise<OperationResult> {
    try {
      // Проверка существования объекта
      if (!(await this.validateObjectExists(objectId))) {
        return { success: false, message: 'Объект не найден' };
      }

      // Проверка связанных разделов
      const childrenCount = await this.hasObjectChildren(objectId);
      
      if (childrenCount > 0 && !cascade) {
        return { 
          success: false, 
          message: `Нельзя удалить объект: найдены связанные разделы (${childrenCount}). Используйте каскадное удаление.` 
        };
      }

      // Каскадное удаление разделов
      if (cascade) {
        await supabase.from('sections').delete().eq('section_object_id', objectId);
      }

      const { error } = await supabase
        .from('objects')
        .delete()
        .eq('object_id', objectId);

      if (error) {
        return { success: false, message: `Ошибка удаления объекта: ${error.message}`, error: error.message };
      }

      return { success: true, message: 'Объект успешно удален' };
    } catch (error) {
      return { success: false, message: `Неожиданная ошибка: ${error}`, error: String(error) };
    }
  }

  async listObjects(filters: ObjectFilters = {}): Promise<OperationResult> {
    try {
      let query = supabase
        .from('objects')
        .select('*');

      // Применение фильтров
      if (filters.project_id) {
        query = query.eq('object_project_id', filters.project_id);
      }
      if (filters.stage_id) {
        query = query.eq('object_stage_id', filters.stage_id);
      }
      if (filters.responsible) {
        query = query.eq('object_responsible', filters.responsible);
      }
      if (filters.limit) {
        query = query.limit(filters.limit);
      }
      if (filters.offset) {
        query = query.range(filters.offset, filters.offset + (filters.limit || 10) - 1);
      }

      const { data, error } = await query;

      if (error) {
        return { success: false, message: `Ошибка получения объектов: ${error.message}`, error: error.message };
      }

      return { success: true, message: `Найдено объектов: ${data.length}`, data };
    } catch (error) {
      return { success: false, message: `Неожиданная ошибка: ${error}`, error: String(error) };
    }
  }

  // ===== CRUD ОПЕРАЦИИ ДЛЯ РАЗДЕЛОВ =====

  async createSection(input: CreateSectionInput): Promise<OperationResult> {
    try {
      // Валидация существования проекта
      if (!(await this.validateProjectExists(input.section_project_id))) {
        return { success: false, message: 'Указанный проект не найден' };
      }

      // Валидация существования объекта
      if (!(await this.validateObjectExists(input.section_object_id))) {
        return { success: false, message: 'Указанный объект не найден' };
      }

      // Валидация ответственного пользователя
      if (input.section_responsible && !(await this.validateUserExists(input.section_responsible))) {
        return { success: false, message: 'Указанный ответственный пользователь не найден' };
      }

      const { data, error } = await supabase
        .from('sections')
        .insert([input])
        .select()
        .single();

      if (error) {
        return { success: false, message: `Ошибка создания раздела: ${error.message}`, error: error.message };
      }

      return { success: true, message: 'Раздел успешно создан', data };
    } catch (error) {
      return { success: false, message: `Неожиданная ошибка: ${error}`, error: String(error) };
    }
  }

  async updateSection(input: UpdateSectionInput): Promise<OperationResult> {
    try {
      // Проверка существования раздела
      if (!(await this.validateSectionExists(input.section_id))) {
        return { success: false, message: 'Раздел не найден' };
      }

      // Валидация существования проекта
      if (input.section_project_id && !(await this.validateProjectExists(input.section_project_id))) {
        return { success: false, message: 'Указанный проект не найден' };
      }

      // Валидация существования объекта
      if (input.section_object_id && !(await this.validateObjectExists(input.section_object_id))) {
        return { success: false, message: 'Указанный объект не найден' };
      }

      // Валидация ответственного пользователя
      if (input.section_responsible && !(await this.validateUserExists(input.section_responsible))) {
        return { success: false, message: 'Указанный ответственный пользователь не найден' };
      }

      const { section_id, ...updateData } = input;
      const { data, error } = await supabase
        .from('sections')
        .update(updateData)
        .eq('section_id', section_id)
        .select()
        .single();

      if (error) {
        return { success: false, message: `Ошибка обновления раздела: ${error.message}`, error: error.message };
      }

      return { success: true, message: 'Раздел успешно обновлен', data };
    } catch (error) {
      return { success: false, message: `Неожиданная ошибка: ${error}`, error: String(error) };
    }
  }

  async deleteSection(sectionId: string): Promise<OperationResult> {
    try {
      // Проверка существования раздела
      if (!(await this.validateSectionExists(sectionId))) {
        return { success: false, message: 'Раздел не найден' };
      }

      const { error } = await supabase
        .from('sections')
        .delete()
        .eq('section_id', sectionId);

      if (error) {
        return { success: false, message: `Ошибка удаления раздела: ${error.message}`, error: error.message };
      }

      return { success: true, message: 'Раздел успешно удален' };
    } catch (error) {
      return { success: false, message: `Неожиданная ошибка: ${error}`, error: String(error) };
    }
  }

  async listSections(filters: SectionFilters = {}): Promise<OperationResult> {
    try {
      let query = supabase
        .from('sections')
        .select('*');

      // Применение фильтров
      if (filters.project_id) {
        query = query.eq('section_project_id', filters.project_id);
      }
      if (filters.object_id) {
        query = query.eq('section_object_id', filters.object_id);
      }
      if (filters.responsible) {
        query = query.eq('section_responsible', filters.responsible);
      }
      if (filters.section_type) {
        query = query.eq('section_type', filters.section_type);
      }
      if (filters.limit) {
        query = query.limit(filters.limit);
      }
      if (filters.offset) {
        query = query.range(filters.offset, filters.offset + (filters.limit || 10) - 1);
      }

      const { data, error } = await query;

      if (error) {
        return { success: false, message: `Ошибка получения разделов: ${error.message}`, error: error.message };
      }

      return { success: true, message: `Найдено разделов: ${data.length}`, data };
    } catch (error) {
      return { success: false, message: `Неожиданная ошибка: ${error}`, error: String(error) };
    }
  }

  // Валидация существования раздела
  async validateSectionExists(sectionId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('sections')
      .select('section_id')
      .eq('section_id', sectionId)
      .single();
    
    return !error && !!data;
  }
} 
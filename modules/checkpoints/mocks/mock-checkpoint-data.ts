// MOCK DATA - not connected to DB
// Моковые данные для прототипа функционала "чекпоинты-проблемы"
// Используются только для проекта "Демопроект1"

import type { Checkpoint, ProblemResolution } from '../actions/checkpoints'

// ============================================================================
// Mock Problem Resolutions
// ============================================================================

export const mockResolutions: Record<string, ProblemResolution[]> = {
  'mock-problem-1': [
    {
      resolution_id: 'res-1',
      resolved_by: 'user-001',
      resolved_by_name: 'Иван Петров',
      resolved_at: '2026-01-15T14:30:00Z',
      comment: 'Согласовали сдвиг сроков с заказчиком из-за задержки поставки материалов',
      deadline_shift_days: 7,
      action_type: 'comment',
    },
  ],
  'mock-problem-2': [
    {
      resolution_id: 'res-2',
      resolved_by: 'user-002',
      resolved_by_name: 'Мария Сидорова',
      resolved_at: '2026-01-20T10:15:00Z',
      comment: 'Выявлена ошибка в расчетах, корректируем документацию',
      deadline_shift_days: 3,
      action_type: 'comment',
    },
    {
      resolution_id: 'res-3',
      resolved_by: 'user-003',
      resolved_by_name: 'Алексей Смирнов',
      resolved_at: '2026-01-22T16:45:00Z',
      comment: 'Документация обновлена, согласование с главным инженером завершено',
      deadline_shift_days: 0,
      action_type: 'comment',
    },
  ],
  // Решенная проблема - теперь обычный чекпоинт, но с историей решений
  'mock-resolved-1': [
    {
      resolution_id: 'res-4',
      resolved_by: 'user-001',
      resolved_by_name: 'Иван Петров',
      resolved_at: '2026-01-18T11:20:00Z',
      comment: 'Получено положительное заключение экспертизы, все замечания устранены',
      deadline_shift_days: 5,
      action_type: 'closed',
    },
  ],
  'mock-resolved-2': [
    {
      resolution_id: 'res-5',
      resolved_by: 'user-002',
      resolved_by_name: 'Мария Сидорова',
      resolved_at: '2026-01-24T09:00:00Z',
      comment: 'Вышла на связь с подрядчиком, уточнили требования',
      deadline_shift_days: 0,
      action_type: 'comment',
    },
    {
      resolution_id: 'res-6',
      resolved_by: 'user-002',
      resolved_by_name: 'Мария Сидорова',
      resolved_at: '2026-01-25T14:30:00Z',
      comment: 'Все расхождения устранены, задание передано без замечаний',
      deadline_shift_days: 2,
      action_type: 'comment',
    },
    {
      resolution_id: 'res-7',
      resolved_by: 'user-003',
      resolved_by_name: 'Алексей Смирнов',
      resolved_at: '2026-01-26T10:00:00Z',
      comment: '',
      deadline_shift_days: 0,
      action_type: 'closed',
    },
  ],
}

// ============================================================================
// Mock Checkpoints
// ============================================================================
//
// Структура прототипа:
// 1. Активные проблемы (is_problem: true) - показаны красными маркерами 22px
//    - mock-problem-1: с 1 решением (проблема всё ещё активна)
//    - mock-problem-2: с 2 решениями (проблема всё ещё активна)
//    - mock-problem-3: без решений (новая проблема)
// 2. Решенные проблемы (is_problem: false, но есть problem_resolutions) - обычные маркеры
//    - mock-resolved-1: была проблема, решена за 1 итерацию
//    - mock-resolved-2: была проблема, решена за 2 итерации
// 3. Обычные чекпоинты (is_problem: false, нет resolutions) - обычные маркеры
//
export const mockCheckpoints: Checkpoint[] = [
  // Активный проблемный чекпоинт #1 - с историей решений
  {
    checkpoint_id: 'mock-problem-1',
    section_id: 'section-demo-1', // Будет заменен на реальный section_id
    type_id: 'type-exam',
    type_code: 'exam',
    type_name: 'Экспертиза',
    is_custom: false,
    title: 'Государственная экспертиза проектной документации',
    description: 'Задержка согласования из-за замечаний по пожарной безопасности',
    checkpoint_date: '2026-02-10',
    icon: 'FileSearch',
    color: '#3b82f6',
    completed_at: null,
    completed_by: null,
    status: 'overdue',
    status_label: 'Просрочено',
    created_by: 'user-001',
    created_at: '2026-01-10T09:00:00Z',
    updated_at: '2026-01-15T14:30:00Z',
    section_responsible: 'user-001',
    project_manager: 'user-pm-1',
    linked_sections: [],
    linked_sections_count: 0,
    // MOCK DATA - prototype fields
    is_problem: true,
    problem_resolutions: mockResolutions['mock-problem-1'],
  },

  // Активный проблемный чекпоинт #2 - с несколькими решениями
  {
    checkpoint_id: 'mock-problem-2',
    section_id: 'section-demo-1',
    type_id: 'type-task-transfer',
    type_code: 'task_transfer',
    type_name: 'Передача задания',
    is_custom: false,
    title: 'Передача задания на разработку РД',
    description: 'Обнаружены расхождения в технических требованиях',
    checkpoint_date: '2026-02-15',
    icon: 'FileText',
    color: '#8b5cf6',
    completed_at: null,
    completed_by: null,
    status: 'pending',
    status_label: 'Ожидает',
    created_by: 'user-002',
    created_at: '2026-01-12T10:00:00Z',
    updated_at: '2026-01-22T16:45:00Z',
    section_responsible: 'user-002',
    project_manager: 'user-pm-1',
    linked_sections: [],
    linked_sections_count: 0,
    // MOCK DATA - prototype fields
    is_problem: true,
    problem_resolutions: mockResolutions['mock-problem-2'],
  },

  // Активный проблемный чекпоинт #3 - без решений (новая проблема)
  {
    checkpoint_id: 'mock-problem-3',
    section_id: 'section-demo-1',
    type_id: 'type-milestone',
    type_code: 'milestone',
    type_name: 'Веха',
    is_custom: false,
    title: 'Завершение этапа "Рабочая документация"',
    description: 'Критическая задержка - не поставлено оборудование',
    checkpoint_date: '2026-03-01',
    icon: 'Flag',
    color: '#f59e0b',
    completed_at: null,
    completed_by: null,
    status: 'pending',
    status_label: 'Ожидает',
    created_by: 'user-003',
    created_at: '2026-01-25T11:00:00Z',
    updated_at: '2026-01-25T11:00:00Z',
    section_responsible: 'user-003',
    project_manager: 'user-pm-1',
    linked_sections: [],
    linked_sections_count: 0,
    // MOCK DATA - prototype fields
    is_problem: true,
    problem_resolutions: [],
  },

  // Решенная проблема #1 - была проблема, но теперь решена
  {
    checkpoint_id: 'mock-resolved-1',
    section_id: 'section-demo-1',
    type_id: 'type-exam',
    type_code: 'exam',
    type_name: 'Экспертиза',
    is_custom: false,
    title: 'Проверка достоверности сметной документации',
    description: 'Были замечания по расценкам, успешно устранены',
    checkpoint_date: '2026-02-20',
    icon: 'FileSearch',
    color: '#3b82f6',
    completed_at: null,
    completed_by: null,
    status: 'pending',
    status_label: 'Ожидает',
    created_by: 'user-001',
    created_at: '2026-01-10T09:30:00Z',
    updated_at: '2026-01-18T11:20:00Z',
    section_responsible: 'user-001',
    project_manager: 'user-pm-1',
    linked_sections: [],
    linked_sections_count: 0,
    // MOCK DATA - была проблема, теперь решена (is_problem: false, но есть история)
    is_problem: false,
    problem_resolutions: mockResolutions['mock-resolved-1'],
  },

  // Обычные чекпоинты (никогда не были проблемами)
  {
    checkpoint_id: 'mock-regular-2',
    section_id: 'section-demo-1',
    type_id: 'type-approval',
    type_code: 'approval',
    type_name: 'Согласование',
    is_custom: false,
    title: 'Согласование с эксплуатирующей организацией',
    description: 'Технические условия на присоединение к сетям',
    checkpoint_date: '2026-02-25',
    icon: 'CheckCircle',
    color: '#10b981',
    completed_at: '2026-02-24T15:20:00Z',
    completed_by: 'user-002',
    status: 'completed',
    status_label: 'Выполнено',
    created_by: 'user-002',
    created_at: '2026-01-12T11:00:00Z',
    updated_at: '2026-02-24T15:20:00Z',
    section_responsible: 'user-002',
    project_manager: 'user-pm-1',
    linked_sections: [],
    linked_sections_count: 0,
    is_problem: false,
  },

  // Решенная проблема #2 - была проблема с несколькими итерациями решений
  {
    checkpoint_id: 'mock-resolved-2',
    section_id: 'section-demo-1',
    type_id: 'type-task-transfer',
    type_code: 'task_transfer',
    type_name: 'Передача задания',
    is_custom: false,
    title: 'Передача задания на инженерные изыскания',
    description: 'Были расхождения в технических требованиях, решено за 2 итерации',
    checkpoint_date: '2026-03-05',
    icon: 'FileText',
    color: '#8b5cf6',
    completed_at: null,
    completed_by: null,
    status: 'pending',
    status_label: 'Ожидает',
    created_by: 'user-003',
    created_at: '2026-01-15T14:00:00Z',
    updated_at: '2026-01-25T14:30:00Z',
    section_responsible: 'user-003',
    project_manager: 'user-pm-1',
    linked_sections: [],
    linked_sections_count: 0,
    // MOCK DATA - была проблема, теперь решена (is_problem: false, но есть история из 2 решений)
    is_problem: false,
    problem_resolutions: mockResolutions['mock-resolved-2'],
  },

  {
    checkpoint_id: 'mock-regular-4',
    section_id: 'section-demo-1',
    type_id: 'type-milestone',
    type_code: 'milestone',
    type_name: 'Веха',
    is_custom: false,
    title: 'Завершение этапа "Проектная документация"',
    description: 'Финальная сдача комплекта ПД заказчику',
    checkpoint_date: '2026-03-10',
    icon: 'Flag',
    color: '#f59e0b',
    completed_at: null,
    completed_by: null,
    status: 'pending',
    status_label: 'Ожидает',
    created_by: 'user-001',
    created_at: '2026-01-18T10:00:00Z',
    updated_at: '2026-01-18T10:00:00Z',
    section_responsible: 'user-001',
    project_manager: 'user-pm-1',
    linked_sections: [],
    linked_sections_count: 0,
    is_problem: false,
  },

  {
    checkpoint_id: 'mock-regular-5',
    section_id: 'section-demo-1',
    type_id: 'type-delivery',
    type_code: 'delivery',
    type_name: 'Сдача',
    is_custom: false,
    title: 'Сдача раздела "Архитектурные решения"',
    description: null,
    checkpoint_date: '2026-03-15',
    icon: 'Package',
    color: '#ec4899',
    completed_at: null,
    completed_by: null,
    status: 'pending',
    status_label: 'Ожидает',
    created_by: 'user-002',
    created_at: '2026-01-20T09:00:00Z',
    updated_at: '2026-01-20T09:00:00Z',
    section_responsible: 'user-002',
    project_manager: 'user-pm-1',
    linked_sections: [],
    linked_sections_count: 0,
    is_problem: false,
  },

  {
    checkpoint_id: 'mock-regular-6',
    section_id: 'section-demo-1',
    type_id: 'type-approval',
    type_code: 'approval',
    type_name: 'Согласование',
    is_custom: false,
    title: 'Согласование с архитектурным отделом',
    description: 'Внешний вид фасадов и благоустройство территории',
    checkpoint_date: '2026-03-20',
    icon: 'CheckCircle',
    color: '#10b981',
    completed_at: null,
    completed_by: null,
    status: 'pending',
    status_label: 'Ожидает',
    created_by: 'user-003',
    created_at: '2026-01-22T13:00:00Z',
    updated_at: '2026-01-22T13:00:00Z',
    section_responsible: 'user-003',
    project_manager: 'user-pm-1',
    linked_sections: [],
    linked_sections_count: 0,
    is_problem: false,
  },
]

// ============================================================================
// Helper функция для получения моковых чекпоинтов
// ============================================================================

/**
 * Получить моковые чекпоинты для конкретного раздела
 * @param sectionId - ID раздела
 * @returns Массив моковых чекпоинтов с обновленным section_id
 */
export function getMockCheckpointsForSection(sectionId: string): Checkpoint[] {
  return mockCheckpoints.map((cp) => ({
    ...cp,
    section_id: sectionId,
  }))
}

/**
 * Проверить, является ли проект "Демопроект1" по названию
 * @param projectName - Название проекта
 * @returns true если это Демопроект1
 */
export function isDemoProject1(projectName: string | null | undefined): boolean {
  if (!projectName) return false
  return projectName.toLowerCase().includes('демопроект1') || projectName === 'Демопроект1'
}

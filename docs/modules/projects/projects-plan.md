# Модуль "Проекты" - Техническая документация

## Обзор модуля

Модуль "Проекты" предназначен для управления проектной структурой компании, включая создание и редактирование проектов, стадий, объектов и разделов. Модуль обеспечивает иерархическое представление проектной структуры и детальное управление каждым элементом.

### Основные функции
- Создание и редактирование проектов
- Управление стадиями проектов
- Создание и настройка объектов проектирования  
- Управление разделами проекта
- Просмотр иерархической структуры проектов
- Детальная информация о разделах с командой и файлами
- Система фильтрации по различным критериям

## Архитектура модуля

### Структура файлов
```
modules/
└── projects/
    ├── components/
    │   ├── ProjectForm.tsx           # Форма создания/редактирования проекта
    │   ├── StageForm.tsx            # Форма создания/редактирования стадии
    │   ├── ObjectForm.tsx           # Форма создания/редактирования объекта
    │   ├── SectionForm.tsx          # Форма создания/редактирования раздела
    │   ├── ProjectHierarchy.tsx     # Иерархическое дерево проектов
    │   ├── ProjectFilters.tsx       # Компонент фильтров
    │   ├── SectionDetails.tsx       # Детальная панель раздела
    │   ├── SectionOverview.tsx      # Вкладка "Обзор" раздела
    │   ├── SectionTeam.tsx          # Вкладка "Команда" раздела
    │   ├── SectionFiles.tsx         # Вкладка "Файлы" раздела
    │   └── CreateButtons.tsx        # Кнопки создания новых сущностей
    ├── hooks/
    │   ├── useProjects.ts           # Хук для работы с проектами
    │   ├── useStages.ts             # Хук для работы со стадиями
    │   ├── useObjects.ts            # Хук для работы с объектами
    │   ├── useSections.ts           # Хук для работы с разделами
    │   └── useProjectFilters.ts     # Хук для управления фильтрами
    ├── types.ts                     # Типы данных модуля
    ├── store.ts                     # Zustand store для модуля
    ├── utils.ts                     # Утилиты модуля
    ├── ProjectsPage.tsx             # Главная страница модуля
    └── ProjectsMenu.tsx             # Компонент для бокового меню
```

### Интеграция в приложение

#### Создание страницы в App Router
```tsx
// app/dashboard/projects/page.tsx
import ProjectsPage from '@/modules/projects/ProjectsPage';

export default function Page() {
  return <ProjectsPage />;
}
```

#### Добавление в боковое меню
```tsx
// components/dashboard/sidebar.tsx
import { ProjectsMenu } from '@/modules/projects/ProjectsMenu';

export function Sidebar() {
  return (
    <nav>
      {/* Другие пункты меню */}
      <ProjectsMenu />
    </nav>
  );
}
```

## Управление состоянием с Zustand

### Структура стора
```tsx
// modules/projects/store.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ProjectsState {
  // Фильтры
  filters: {
    managerId: string | null;
    projectId: string | null;
    stageId: string | null;
    objectId: string | null;
    departmentId: string | null;
    teamId: string | null;
    employeeId: string | null;
  };
  
  // UI состояние
  selectedSectionId: string | null;
  isDetailsPanelOpen: boolean;
  activeDetailsTab: 'overview' | 'team' | 'files';
  expandedNodes: Set<string>;
  
  // Данные
  projects: Project[];
  stages: Stage[];
  objects: Object[];
  sections: Section[];
  
  // Действия
  setFilter: (key: keyof ProjectsState['filters'], value: string | null) => void;
  clearFilters: () => void;
  selectSection: (sectionId: string | null) => void;
  toggleDetailsPanel: () => void;
  setActiveDetailsTab: (tab: ProjectsState['activeDetailsTab']) => void;
  toggleNode: (nodeId: string) => void;
  
  // CRUD операции
  createProject: (project: CreateProjectData) => Promise<void>;
  updateProject: (id: string, project: UpdateProjectData) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  // ... аналогично для stages, objects, sections
}

export const useProjectsStore = create<ProjectsState>()(
  persist(
    (set, get) => ({
      filters: {
        managerId: null,
        projectId: null,
        stageId: null,
        objectId: null,
        departmentId: null,
        teamId: null,
        employeeId: null,
      },
      selectedSectionId: null,
      isDetailsPanelOpen: false,
      activeDetailsTab: 'overview',
      expandedNodes: new Set(),
      projects: [],
      stages: [],
      objects: [],
      sections: [],
      
      setFilter: (key, value) =>
        set((state) => ({
          filters: { ...state.filters, [key]: value }
        })),
        
      clearFilters: () =>
        set((state) => ({
          filters: {
            managerId: null,
            projectId: null,
            stageId: null,
            objectId: null,
            departmentId: null,
            teamId: null,
            employeeId: null,
          }
        })),
        
      // ... остальные действия
    }),
    {
      name: 'projects-storage',
      partialize: (state) => ({
        filters: state.filters,
        expandedNodes: Array.from(state.expandedNodes),
        activeDetailsTab: state.activeDetailsTab,
      }),
    }
  )
);
```

## Использование существующих представлений БД

### Основные представления для использования

#### view_section_hierarchy
**Применение**: Основное представление для отображения иерархической структуры проектов.
```typescript
// Использование в компоненте
const fetchProjectHierarchy = async () => {
  const supabase = createClient();
  const { data } = await supabase
    .from('view_section_hierarchy')
    .select('*')
    .order('project_name, stage_name, object_name, section_name');
  return data;
};
```

#### view_sections_with_loadings  
**Применение**: Для отображения разделов с информацией о загрузке сотрудников.
```typescript
const fetchSectionsWithLoadings = async (filters: ProjectFilters) => {
  const supabase = createClient();
  let query = supabase.from('view_sections_with_loadings').select('*');
  
  if (filters.managerId) {
    query = query.eq('project_manager_id', filters.managerId);
  }
  // ... применение других фильтров
  
  const { data } = await query;
  return data;
};
```

#### view_manager_projects
**Применение**: Для фильтрации по менеджерам проектов.
```typescript
const fetchManagers = async () => {
  const supabase = createClient();
  const { data } = await supabase
    .from('view_manager_projects')
    .select('manager_id, manager_name, manager_avatar')
    .group('manager_id, manager_name, manager_avatar');
  return data;
};
```

#### view_employees
**Применение**: Для фильтрации по сотрудникам и назначения ответственных.
```typescript
const fetchEmployees = async (departmentId?: string, teamId?: string) => {
  const supabase = createClient();
  let query = supabase.from('view_employees').select('*');
  
  if (departmentId) query = query.eq('department_id', departmentId);
  if (teamId) query = query.eq('team_id', teamId);
  
  const { data } = await query;
  return data;
};
```

### Дополнительные представления (могут потребоваться)

Рассмотреть создание новых представлений:

#### view_project_structure (предложение)
Представление для полной иерархии проект -> стадия -> объект -> раздел с агрегированной статистикой.

#### view_sections_with_tasks (предложение)  
Представление разделов с количеством и статистикой связанных задач.

## Система фильтров

### Структура фильтров (аналогично системе планирования)

```tsx
// modules/projects/components/ProjectFilters.tsx
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useProjectsStore } from '../store';
import { useEmployees, useProjects, useStages, useObjects } from '../hooks';

export function ProjectFilters() {
  const { filters, setFilter, clearFilters } = useProjectsStore();
  const { data: managers } = useManagers();
  const { data: projects } = useProjects();
  const { data: stages } = useStages();
  const { data: objects } = useObjects();
  const { data: departments } = useDepartments();
  const { data: teams } = useTeams(filters.departmentId);
  const { data: employees } = useEmployees(filters.departmentId, filters.teamId);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <FilterIcon className="h-4 w-4" />
        <span className="font-medium">Фильтры</span>
        <Button variant="ghost" size="sm" onClick={clearFilters}>
          Очистить
        </Button>
      </div>
      
      {/* Первая строка фильтров */}
      <div className="grid grid-cols-4 gap-4">
        <Select 
          value={filters.managerId || ''} 
          onValueChange={(value) => setFilter('managerId', value || null)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Выберите менеджера" />
          </SelectTrigger>
          <SelectContent>
            {managers?.map((manager) => (
              <SelectItem key={manager.manager_id} value={manager.manager_id}>
                <div className="flex items-center gap-2">
                  {manager.manager_avatar && (
                    <img src={manager.manager_avatar} className="w-4 h-4 rounded-full" />
                  )}
                  {manager.manager_name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        {/* Аналогично для проекта, стадии, объекта */}
      </div>
      
      {/* Вторая строка фильтров */}
      <div className="grid grid-cols-3 gap-4">
        {/* Отдел, Команда, Сотрудник */}
      </div>
    </div>
  );
}
```

### Логика применения фильтров
```typescript
// modules/projects/hooks/useProjectFilters.ts
export function useProjectFilters() {
  const { filters } = useProjectsStore();
  
  const applyFilters = useCallback((data: SectionHierarchy[]) => {
    return data.filter((item) => {
      // Фильтрация по менеджеру
      if (filters.managerId && item.project_manager_id !== filters.managerId) {
        return false;
      }
      
      // Фильтрация по проекту
      if (filters.projectId && item.project_id !== filters.projectId) {
        return false;
      }
      
      // Фильтрация по стадии
      if (filters.stageId && item.stage_id !== filters.stageId) {
        return false;
      }
      
      // Фильтрация по объекту
      if (filters.objectId && item.object_id !== filters.objectId) {
        return false;
      }
      
      // Фильтрация по департаменту ответственного за раздел
      if (filters.departmentId && item.responsible_department_id !== filters.departmentId) {
        return false;
      }
      
      // Фильтрация по команде ответственного за раздел
      if (filters.teamId && item.responsible_team_id !== filters.teamId) {
        return false;
      }
      
      // Фильтрация по сотруднику (ответственный за раздел)
      if (filters.employeeId && item.section_responsible_id !== filters.employeeId) {
        return false;
      }
      
      return true;
    });
  }, [filters]);
  
  return { applyFilters };
}
```

## Дизайн компонентов

### Главная страница модуля
```tsx
// modules/projects/ProjectsPage.tsx
export default function ProjectsPage() {
  const { 
    selectedSectionId, 
    isDetailsPanelOpen, 
    toggleDetailsPanel 
  } = useProjectsStore();

  return (
    <div className="flex h-full">
      {/* Основная область */}
      <div className={cn(
        "flex-1 transition-all duration-300",
        isDetailsPanelOpen ? "mr-96" : "mr-0"
      )}>
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">Управление проектами</h1>
            <CreateButtons />
          </div>
          
          <ProjectFilters />
          
          <Card>
            <CardContent className="p-0">
              <ProjectHierarchy />
            </CardContent>
          </Card>
        </div>
      </div>
      
      {/* Панель деталей */}
      <AnimatePresence>
        {isDetailsPanelOpen && selectedSectionId && (
          <motion.div
            initial={{ x: 384, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 384, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed right-0 top-0 h-full w-96 bg-background border-l z-50"
          >
            <SectionDetails sectionId={selectedSectionId} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
```

### Иерархическое дерево проектов  
```tsx
// modules/projects/components/ProjectHierarchy.tsx
export function ProjectHierarchy() {
  const { expandedNodes, toggleNode, selectSection } = useProjectsStore();
  const { data: sections, isLoading } = useSectionsHierarchy();
  const { applyFilters } = useProjectFilters();
  
  const filteredSections = useMemo(() => {
    return sections ? applyFilters(sections) : [];
  }, [sections, applyFilters]);
  
  const hierarchyData = useMemo(() => {
    return buildHierarchy(filteredSections);
  }, [filteredSections]);

  return (
    <div className="space-y-2">
      {hierarchyData.map((project) => (
        <ProjectNode 
          key={project.project_id}
          project={project}
          level={0}
        />
      ))}
    </div>
  );
}

function ProjectNode({ project, level }: { project: ProjectHierarchyNode, level: number }) {
  const { expandedNodes, toggleNode, selectSection } = useProjectsStore();
  const isExpanded = expandedNodes.has(project.project_id);
  
  return (
    <div className="space-y-1">
      <div 
        className={cn(
          "flex items-center gap-2 p-2 rounded-md hover:bg-accent cursor-pointer",
          `ml-${level * 4}`
        )}
        onClick={() => toggleNode(project.project_id)}
      >
        <Button variant="ghost" size="sm" className="h-4 w-4 p-0">
          {isExpanded ? (
            <ChevronDownIcon className="h-3 w-3" />
          ) : (
            <ChevronRightIcon className="h-3 w-3" />
          )}
        </Button>
        
        <FolderIcon className="h-4 w-4 text-blue-500" />
        <span className="font-medium">{project.project_name}</span>
        
        <div className="ml-auto flex items-center gap-2">
          {project.project_manager_avatar && (
            <img 
              src={project.project_manager_avatar} 
              className="w-6 h-6 rounded-full" 
              alt="Менеджер"
            />
          )}
        </div>
      </div>
      
      {isExpanded && (
        <div className="space-y-1">
          {project.stages?.map((stage) => (
            <StageNode key={stage.stage_id} stage={stage} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
```

### Панель деталей раздела
```tsx
// modules/projects/components/SectionDetails.tsx
export function SectionDetails({ sectionId }: { sectionId: string }) {
  const { activeDetailsTab, setActiveDetailsTab, toggleDetailsPanel } = useProjectsStore();
  const { data: section } = useSection(sectionId);

  return (
    <div className="flex flex-col h-full">
      {/* Заголовок */}
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="text-lg font-semibold">Детали раздела</h2>
        <Button variant="ghost" size="sm" onClick={toggleDetailsPanel}>
          <XIcon className="h-4 w-4" />
        </Button>
      </div>
      
      {/* Вкладки */}
      <div className="flex border-b">
        <button
          className={cn(
            "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
            activeDetailsTab === 'overview'
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
          onClick={() => setActiveDetailsTab('overview')}
        >
          Обзор
        </button>
        <button
          className={cn(
            "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
            activeDetailsTab === 'team'
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
          onClick={() => setActiveDetailsTab('team')}
        >
          Команда
        </button>
        <button
          className={cn(
            "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
            activeDetailsTab === 'files'
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
          onClick={() => setActiveDetailsTab('files')}
        >
          Файлы
        </button>
      </div>
      
      {/* Содержимое вкладок */}
      <div className="flex-1 overflow-auto">
        {activeDetailsTab === 'overview' && <SectionOverview sectionId={sectionId} />}
        {activeDetailsTab === 'team' && <SectionTeam sectionId={sectionId} />}  
        {activeDetailsTab === 'files' && <SectionFiles sectionId={sectionId} />}
      </div>
    </div>
  );
}
```

## Формы создания и редактирования

### Форма проекта
```tsx
// modules/projects/components/ProjectForm.tsx
const projectSchema = z.object({
  project_name: z.string().min(1, 'Название проекта обязательно'),
  project_description: z.string().optional(),
  project_manager: z.string().uuid('Выберите менеджера проекта'),
  project_lead_engineer: z.string().uuid().optional(),
  client_id: z.string().uuid('Выберите заказчика'),
});

export function ProjectForm({ projectId }: { projectId?: string }) {
  const { createProject, updateProject } = useProjectsStore();
  const { data: project } = useProject(projectId);
  const { data: managers } = useManagers();
  const { data: engineers } = useEngineers();
  const { data: clients } = useClients();
  
  const form = useForm<z.infer<typeof projectSchema>>({
    resolver: zodResolver(projectSchema),
    defaultValues: project || {
      project_name: '',
      project_description: '',
      project_manager: '',
      project_lead_engineer: '',
      client_id: '',
    },
  });

  const onSubmit = async (values: z.infer<typeof projectSchema>) => {
    if (projectId) {
      await updateProject(projectId, values);
    } else {
      await createProject(values);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="project_name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Название проекта</FormLabel>
              <FormControl>
                <Input placeholder="Введите название проекта" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        {/* Остальные поля формы... */}
        
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline">Отмена</Button>
          <Button type="submit">
            {projectId ? 'Обновить' : 'Создать'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
```

## Типы данных

```typescript
// modules/projects/types.ts
export interface Project {
  project_id: string;
  project_name: string;
  project_description?: string;
  project_manager: string;
  project_lead_engineer?: string;
  project_status: 'active' | 'archive' | 'paused' | 'canceled';
  project_created: string;
  project_updated: string;
  client_id: string;
}

export interface Stage {
  stage_id: string;
  stage_name: string;
  stage_description?: string;
}

export interface Object {
  object_id: string;
  object_name: string;
  object_description?: string;
  object_stage_id: string;
  object_responsible?: string;
  object_start_date?: string;
  object_end_date?: string;
  object_created: string;
  object_updated: string;
}

export interface Section {
  section_id: string;
  section_name: string;
  section_description?: string;
  section_responsible?: string;
  section_project_id: string;
  section_created: string;
  section_updated: string;
  section_object_id?: string;
  section_type?: string;
  section_start_date?: string;
  section_end_date?: string;
}

export interface ProjectHierarchyNode {
  project_id: string;
  project_name: string;
  project_manager_name?: string;
  project_manager_avatar?: string;
  stages?: StageHierarchyNode[];
}

export interface StageHierarchyNode {
  stage_id: string;
  stage_name: string;
  objects?: ObjectHierarchyNode[];
}

export interface ObjectHierarchyNode {
  object_id: string;
  object_name: string;
  sections?: SectionHierarchyNode[];
}

export interface SectionHierarchyNode {
  section_id: string;
  section_name: string;
  section_responsible_name?: string;
  section_responsible_avatar?: string;
  section_start_date?: string;
  section_end_date?: string;
  total_loading_rate?: number;
  tasks_count?: number;
}

export interface ProjectFilters {
  managerId: string | null;
  projectId: string | null;
  stageId: string | null;
  objectId: string | null;
  departmentId: string | null;
  teamId: string | null;
  employeeId: string | null;
}
```

## Неопределенные моменты

### 1. Права доступа и роли
- **Вопрос**: Какие роли могут создавать/редактировать проекты, стадии, объекты, разделы?
- **Предположение**: Менеджеры проектов и администраторы могут создавать проекты, ГИПы могут создавать разделы
- **Требует уточнения**: Матрица прав доступа для каждой сущности

### 2. Обязательные поля и валидация
- **Вопрос**: Какие поля обязательны при создании каждой сущности?
- **Предположение**: Название всегда обязательно, ответственные лица - желательно
- **Требует уточнения**: Бизнес-правила валидации, особенно для дат и связей

### 3. Логика связей между сущностями  
- **Вопрос**: Может ли раздел существовать без объекта? Может ли объект существовать без стадии?
- **Предположение**: По схеме БД section_object_id является опциональным
- **Требует уточнения**: Бизнес-логика создания иерархии

### 4. Интеграция с Worksection
- **Вопрос**: Как обрабатывать конфликты при синхронизации с Worksection?
- **Предположение**: Приоритет у данных из Worksection
- **Требует уточнения**: Стратегия разрешения конфликтов и показа статуса синхронизации

### 5. Управление файлами
- **Вопрос**: Где и как хранятся файлы разделов? Какие типы файлов поддерживаются?
- **Предположение**: Использование Supabase Storage
- **Требует уточнения**: Структура хранения, права доступа к файлам, версионирование

### 6. Уведомления и события
- **Вопрос**: Нужны ли уведомления при изменении ответственных, сроков, статусов?
- **Предположение**: Уведомления нужны для ответственных лиц
- **Требует уточнения**: Типы событий, способы доставки уведомлений

### 7. Массовые операции
- **Вопрос**: Нужна ли возможность массового редактирования разделов/объектов?
- **Предположение**: Может быть полезно для смены ответственных или сроков
- **Требует уточнения**: Какие поля можно редактировать массово

### 8. Отчетность и экспорт
- **Вопрос**: Какие отчеты нужны по проектной структуре? В каких форматах экспорт?
- **Предположение**: Excel экспорт иерархии, отчеты по загрузке
- **Требует уточнения**: Форматы отчетов, расписание автоматической генерации

### 9. Мобильная адаптация
- **Вопрос**: Как будет выглядеть модуль на мобильных устройствах?
- **Предположение**: Адаптивный дизайн с коллапсом фильтров
- **Требует уточнения**: UX для мобильных устройств, приоритизация функций

### 10. Производительность
- **Вопрос**: Как обрабатывать большие проекты с сотнями разделов?
- **Предположение**: Пагинация и виртуализация списков
- **Требует уточнения**: Лимиты загрузки, стратегия оптимизации больших деревьев

## Следующие шаги

1. **Уточнить бизнес-требования** по неопределенным моментам
2. **Создать прототипы** основных компонентов
3. **Настроить API эндпоинты** для CRUD операций
4. **Реализовать систему прав доступа** (RLS политики)
5. **Подготовить тестовые данные** для разработки
6. **Создать компоненты UI** согласно дизайн-системе
7. **Интегрировать с существующими модулями** (планирование, пользователи)
8. **Протестировать производительность** на большом объеме данных

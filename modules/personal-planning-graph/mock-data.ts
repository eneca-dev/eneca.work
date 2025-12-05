import type { Project } from "./types"

// Mock data - hierarchical structure: Project → Stage → Object → Section → DecompositionStage → Task
// Today: Dec 4, 2025. Timeline shows Nov 20 - Jan 1
export const mockProjects: Project[] = [
  {
    id: "proj-1",
    name: "П-47/25 Жилой комплекс «Sunrise»",
    status: "active",
    stages: [
      {
        id: "pstage-1",
        name: "Стадия П",
        objects: [
          {
            id: "obj-1",
            name: "Корпус А",
            sections: [
              {
                id: "54dcc942-b93f-4e51-aab1-8cd6b466479f",
                name: "7. П-47/25-ТМ(ПС)",
                startDate: "2025-11-20",
                endDate: "2025-12-18",
                milestones: [
                  {
                    id: "m1",
                    type: "task_transfer_in",
                    date: "2025-11-22",
                    title: "Приём задания от КР",
                    description: "Получение исходных данных по конструкциям от раздела КР для моделирования",
                    relatedSectionName: "КР - Конструктивные решения",
                    isCompleted: true,
                  },
                  {
                    id: "m2",
                    type: "task_transfer_out",
                    date: "2025-12-10",
                    title: "Передача в ВК",
                    description: "Передача координационных точек и проёмов в раздел ВК",
                    relatedSectionName: "ВК - Водоснабжение и канализация",
                    isCompleted: false,
                  },
                  {
                    id: "m3",
                    type: "expertise_submission",
                    date: "2025-12-18",
                    title: "Выдача в экспертизу",
                    description: "Передача комплекта документации раздела ТМ на экспертизу",
                    isCompleted: false,
                  },
                ],
                stages: [
                  {
                    id: "d89c408f-a580-45b3-96c3-5cc3b2568146",
                    name: "Моделирование /Жамойть",
                    startDate: "2025-11-20",
                    finishDate: "2025-11-26",
                    order: 1,
                    status: "done",
                    plannedHours: 40,
                    loadings: [
                      { id: "l1", startDate: "2025-11-20", endDate: "2025-11-26", rate: 1, employeeName: "Иван Жамойть" },
                    ],
                    workLogs: [
                      { id: "w1", date: "2025-11-20", hours: 6, employeeName: "Иван Жамойть" },
                      { id: "w2", date: "2025-11-21", hours: 8, employeeName: "Иван Жамойть" },
                      { id: "w4", date: "2025-11-24", hours: 8, employeeName: "Иван Жамойть" },
                      { id: "w5", date: "2025-11-25", hours: 8, employeeName: "Иван Жамойть" },
                      { id: "w6", date: "2025-11-26", hours: 8, employeeName: "Иван Жамойть" },
                    ],
                    tasks: [
                      { id: "t1", description: "Создание базовой 3D модели здания", plannedHours: 16, progress: 100, responsibleName: "Иван Жамойть", order: 1 },
                      { id: "t2", description: "Проработка конструктивных узлов", plannedHours: 12, progress: 100, responsibleName: "Иван Жамойть", order: 2 },
                      { id: "t3", description: "Экспорт в расчётную модель", plannedHours: 8, progress: 100, responsibleName: "Иван Жамойть", order: 3 },
                      { id: "t4", description: "Проверка коллизий", plannedHours: 4, progress: 100, responsibleName: "Иван Жамойть", order: 4 },
                    ],
                  },
                  {
                    id: "cfdb8d3c-1edb-4484-9784-c688b650147d",
                    name: "Расчеты /Жамойть",
                    startDate: "2025-11-27",
                    finishDate: "2025-12-03",
                    order: 2,
                    status: "review",
                    plannedHours: 35,
                    loadings: [
                      { id: "l2", startDate: "2025-11-27", endDate: "2025-11-28", rate: 1, employeeName: "Иван Жамойть" },
                      { id: "l3", startDate: "2025-12-01", endDate: "2025-12-03", rate: 0.75, employeeName: "Петр Сидоров" },
                    ],
                    workLogs: [
                      { id: "w7", date: "2025-11-27", hours: 6, employeeName: "Иван Жамойть" },
                      { id: "w8", date: "2025-11-28", hours: 6, employeeName: "Иван Жамойть" },
                      { id: "w9", date: "2025-12-01", hours: 6, employeeName: "Петр Сидоров" },
                      { id: "w10", date: "2025-12-02", hours: 6, employeeName: "Петр Сидоров" },
                      { id: "w11", date: "2025-12-03", hours: 8, employeeName: "Петр Сидоров" },
                    ],
                    tasks: [
                      { id: "t5", description: "Статический расчёт каркаса", plannedHours: 12, progress: 100, responsibleName: "Иван Жамойть", order: 1 },
                      { id: "t6", description: "Расчёт фундаментов", plannedHours: 10, progress: 100, responsibleName: "Иван Жамойть", order: 2 },
                      { id: "t7", description: "Расчёт перекрытий", plannedHours: 8, progress: 80, responsibleName: "Петр Сидоров", order: 3 },
                      { id: "t8", description: "Формирование отчёта", plannedHours: 5, progress: 60, responsibleName: "Петр Сидоров", order: 4 },
                    ],
                  },
                  {
                    id: "9fe6ce2d-d40f-4004-bed7-61e0f55a7a6c",
                    name: "Моделирование /Шаблев",
                    startDate: "2025-12-02",
                    finishDate: "2025-12-06",
                    order: 3,
                    status: "in_progress",
                    plannedHours: 32,
                    loadings: [
                      { id: "l4", startDate: "2025-12-02", endDate: "2025-12-06", rate: 1, employeeName: "Алексей Шаблев" },
                    ],
                    workLogs: [
                      { id: "w12", date: "2025-12-02", hours: 7, employeeName: "Алексей Шаблев" },
                      { id: "w13", date: "2025-12-03", hours: 6, employeeName: "Алексей Шаблев" },
                    ],
                    tasks: [
                      { id: "t9", description: "Моделирование инженерных систем", plannedHours: 14, progress: 50, responsibleName: "Алексей Шаблев", order: 1 },
                      { id: "t10", description: "Трассировка коммуникаций", plannedHours: 10, progress: 30, responsibleName: "Алексей Шаблев", order: 2 },
                      { id: "t11", description: "Проверка пересечений", plannedHours: 8, progress: 0, responsibleName: "Алексей Шаблев", order: 3 },
                    ],
                  },
                ],
              },
              {
                id: "542f98ef-591b-4d3c-9a10-5363ad6eb729",
                name: "ВК - Водоснабжение и канализация",
                startDate: "2025-11-25",
                endDate: "2025-12-20",
                milestones: [
                  {
                    id: "m4",
                    type: "task_transfer_in",
                    date: "2025-12-10",
                    title: "Приём от ТМ",
                    description: "Получение координационных точек и проёмов от раздела ТМ",
                    relatedSectionName: "7. П-47/25-ТМ(ПС)",
                    isCompleted: false,
                  },
                  {
                    id: "m5",
                    type: "approval",
                    date: "2025-12-15",
                    title: "Согласование с заказчиком",
                    description: "Промежуточное согласование концепции инженерных систем",
                    isCompleted: false,
                  },
                  {
                    id: "m6",
                    type: "deadline",
                    date: "2025-12-20",
                    title: "Дедлайн раздела",
                    description: "Крайний срок сдачи раздела ВК по договору",
                    isCompleted: false,
                  },
                ],
                stages: [
                  {
                    id: "a1afb2e1-66ac-4467-b8a0-f449912c369e",
                    name: "Этап планирования",
                    startDate: "2025-11-25",
                    finishDate: "2025-11-29",
                    order: 1,
                    status: "done",
                    plannedHours: 20,
                    loadings: [
                      { id: "l8", startDate: "2025-11-25", endDate: "2025-11-28", rate: 0.5, employeeName: "Дмитрий Волков" },
                    ],
                    workLogs: [
                      { id: "w15", date: "2025-11-25", hours: 4, employeeName: "Дмитрий Волков" },
                      { id: "w16", date: "2025-11-26", hours: 5, employeeName: "Дмитрий Волков" },
                      { id: "w17", date: "2025-11-27", hours: 4, employeeName: "Дмитрий Волков" },
                      { id: "w18", date: "2025-11-28", hours: 5, employeeName: "Дмитрий Волков" },
                    ],
                    tasks: [
                      { id: "t18", description: "Анализ ТЗ и исходных данных", plannedHours: 8, progress: 100, responsibleName: "Дмитрий Волков", order: 1 },
                      { id: "t19", description: "Разработка концепции", plannedHours: 12, progress: 100, responsibleName: "Дмитрий Волков", order: 2 },
                    ],
                  },
                  {
                    id: "4f4ca6e7-2d05-4164-87f8-635aa7b1330e",
                    name: "Этап подготовки",
                    startDate: "2025-12-02",
                    finishDate: "2025-12-10",
                    order: 2,
                    status: "paused",
                    plannedHours: 45,
                    loadings: [
                      { id: "l9", startDate: "2025-12-02", endDate: "2025-12-10", rate: 0.75, employeeName: "Сергей Новиков" },
                    ],
                    workLogs: [
                      { id: "w20", date: "2025-12-02", hours: 6, employeeName: "Сергей Новиков" },
                      { id: "w21", date: "2025-12-03", hours: 5, employeeName: "Сергей Новиков" },
                    ],
                    tasks: [
                      { id: "t20", description: "Расчёт водопотребления", plannedHours: 15, progress: 40, responsibleName: "Сергей Новиков", order: 1 },
                      { id: "t21", description: "Подбор оборудования", plannedHours: 12, progress: 20, responsibleName: "Сергей Новиков", order: 2 },
                      { id: "t22", description: "Схема водоснабжения", plannedHours: 10, progress: 0, responsibleName: "Сергей Новиков", order: 3 },
                      { id: "t23", description: "Схема канализации", plannedHours: 8, progress: 0, responsibleName: "Сергей Новиков", order: 4 },
                    ],
                  },
                ],
              },
            ],
          },
          {
            id: "obj-2",
            name: "Корпус Б",
            sections: [
              {
                id: "sec-kb-1",
                name: "КР - Конструктивные решения",
                startDate: "2025-12-09",
                endDate: "2025-12-20",
                milestones: [
                  {
                    id: "m7",
                    type: "task_transfer_out",
                    date: "2025-12-12",
                    title: "Выдача в АР",
                    description: "Передача осей и отметок в раздел АР для согласования",
                    relatedSectionName: "АР - Архитектурные решения",
                    isCompleted: false,
                  },
                  {
                    id: "m8",
                    type: "expertise_submission",
                    date: "2025-12-20",
                    title: "Сдача в экспертизу",
                    description: "Передача раздела КР на госэкспертизу",
                    isCompleted: false,
                  },
                ],
                stages: [
                  {
                    id: "3e3c9ba7-daae-46bb-a46f-0a2079922b20",
                    name: "Оформление / Власовец",
                    startDate: "2025-12-09",
                    finishDate: "2025-12-13",
                    order: 1,
                    status: "plan",
                    plannedHours: 25,
                    loadings: [
                      { id: "l5", startDate: "2025-12-09", endDate: "2025-12-13", rate: 0.75, employeeName: "Мария Власовец" },
                    ],
                    workLogs: [],
                    tasks: [
                      { id: "t12", description: "Оформление чертежей планов", plannedHours: 10, progress: 0, responsibleName: "Мария Власовец", order: 1 },
                      { id: "t13", description: "Оформление разрезов", plannedHours: 8, progress: 0, responsibleName: "Мария Власовец", order: 2 },
                      { id: "t14", description: "Спецификации и ведомости", plannedHours: 7, progress: 0, responsibleName: "Мария Власовец", order: 3 },
                    ],
                  },
                  {
                    id: "e5a6c4d1-b52e-4a78-9e6c-09ebba272895",
                    name: "Оформление / Мироненко",
                    startDate: "2025-12-14",
                    finishDate: "2025-12-18",
                    order: 2,
                    status: "backlog",
                    plannedHours: 28,
                    loadings: [
                      { id: "l6", startDate: "2025-12-16", endDate: "2025-12-17", rate: 1, employeeName: "Ольга Мироненко" },
                      { id: "l7", startDate: "2025-12-18", endDate: "2025-12-18", rate: 0.5, employeeName: "Анна Козлова" },
                    ],
                    workLogs: [],
                    tasks: [
                      { id: "t15", description: "Детальные узлы", plannedHours: 12, progress: 0, responsibleName: "Ольга Мироненко", order: 1 },
                      { id: "t16", description: "Схемы армирования", plannedHours: 10, progress: 0, responsibleName: "Ольга Мироненко", order: 2 },
                      { id: "t17", description: "Финальная проверка комплекта", plannedHours: 6, progress: 0, responsibleName: "Анна Козлова", order: 3 },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "proj-2",
    name: "ПР-12/25 Бизнес-центр «Horizon»",
    status: "active",
    stages: [
      {
        id: "pstage-2",
        name: "Стадия Р",
        objects: [
          {
            id: "obj-3",
            name: "Основное здание",
            sections: [
              {
                id: "b691378c-d7d6-4031-b544-ecbc1dd477bc",
                name: "1. ТХ - Технологические решения",
                startDate: "2025-11-22",
                endDate: "2025-12-25",
                milestones: [
                  {
                    id: "m9",
                    type: "approval",
                    date: "2025-12-05",
                    title: "Согласование ТЗ",
                    description: "Согласование технического задания с заказчиком",
                    isCompleted: false,
                  },
                  {
                    id: "m10",
                    type: "task_transfer_out",
                    date: "2025-12-12",
                    title: "Выдача в ОВ",
                    description: "Передача нагрузок на вентиляцию в раздел ОВ",
                    relatedSectionName: "ОВ - Отопление и вентиляция",
                    isCompleted: false,
                  },
                  {
                    id: "m11",
                    type: "deadline",
                    date: "2025-12-25",
                    title: "Срок сдачи",
                    description: "Контрактный срок завершения раздела ТХ",
                    isCompleted: false,
                  },
                ],
                stages: [
                  {
                    id: "461f3808-d89a-4687-a052-5b3a24831a83",
                    name: "Разработка раздела",
                    startDate: "2025-11-22",
                    finishDate: "2025-12-05",
                    order: 1,
                    status: "in_progress",
                    plannedHours: 70,
                    loadings: [
                      { id: "l11", startDate: "2025-11-22", endDate: "2025-11-28", rate: 1, employeeName: "Андрей Петров" },
                      { id: "l12", startDate: "2025-12-01", endDate: "2025-12-05", rate: 0.5, employeeName: "Виктор Соколов" },
                    ],
                    workLogs: [
                      { id: "w22", date: "2025-11-24", hours: 8, employeeName: "Андрей Петров" },
                      { id: "w23", date: "2025-11-25", hours: 8, employeeName: "Андрей Петров" },
                      { id: "w24", date: "2025-11-26", hours: 8, employeeName: "Андрей Петров" },
                      { id: "w25", date: "2025-11-27", hours: 8, employeeName: "Андрей Петров" },
                      { id: "w26", date: "2025-11-28", hours: 8, employeeName: "Андрей Петров" },
                      { id: "w28", date: "2025-12-01", hours: 4, employeeName: "Виктор Соколов" },
                      { id: "w29", date: "2025-12-02", hours: 4, employeeName: "Виктор Соколов" },
                      { id: "w30", date: "2025-12-03", hours: 4, employeeName: "Виктор Соколов" },
                    ],
                    tasks: [
                      { id: "t27", description: "Технологическая схема производства", plannedHours: 20, progress: 100, responsibleName: "Андрей Петров", order: 1 },
                      { id: "t28", description: "Планировка оборудования", plannedHours: 18, progress: 90, responsibleName: "Андрей Петров", order: 2 },
                      { id: "t29", description: "Расчёт мощностей", plannedHours: 16, progress: 60, responsibleName: "Виктор Соколов", order: 3 },
                      { id: "t30", description: "Экспликация помещений", plannedHours: 16, progress: 30, responsibleName: "Виктор Соколов", order: 4 },
                    ],
                  },
                  {
                    id: "stage-tx-2",
                    name: "Согласование",
                    startDate: "2025-12-08",
                    finishDate: "2025-12-12",
                    order: 2,
                    status: "plan",
                    plannedHours: 15,
                    loadings: [
                      { id: "l13", startDate: "2025-12-08", endDate: "2025-12-12", rate: 0.4, employeeName: "Николай Федоров" },
                    ],
                    workLogs: [],
                    tasks: [
                      { id: "t31", description: "Внутреннее согласование", plannedHours: 8, progress: 0, responsibleName: "Николай Федоров", order: 1 },
                      { id: "t32", description: "Согласование с заказчиком", plannedHours: 7, progress: 0, responsibleName: "Николай Федоров", order: 2 },
                    ],
                  },
                ],
              },
              {
                id: "6ddc8b75-f8e6-47b9-ad88-9bec2c96d1c8",
                name: "АР - Архитектурные решения",
                startDate: "2025-12-10",
                endDate: "2026-01-05",
                milestones: [
                  {
                    id: "m12",
                    type: "task_transfer_in",
                    date: "2025-12-12",
                    title: "Приём от КР",
                    description: "Получение осей и отметок от раздела КР",
                    relatedSectionName: "КР - Конструктивные решения",
                    isCompleted: false,
                  },
                  {
                    id: "m13",
                    type: "approval",
                    date: "2025-12-20",
                    title: "Защита концепции",
                    description: "Презентация архитектурной концепции заказчику",
                    isCompleted: false,
                  },
                ],
                stages: [
                  {
                    id: "7a1d0412-408c-40ce-a2af-17e3b7e2552c",
                    name: "Концепция",
                    startDate: "2025-12-10",
                    finishDate: "2025-12-18",
                    order: 1,
                    status: "plan",
                    plannedHours: 45,
                    loadings: [
                      { id: "l15", startDate: "2025-12-10", endDate: "2025-12-18", rate: 0.75, employeeName: "Кирилл Орлов" },
                    ],
                    workLogs: [],
                    tasks: [
                      { id: "t36", description: "Эскизное проектирование", plannedHours: 20, progress: 0, responsibleName: "Кирилл Орлов", order: 1 },
                      { id: "t37", description: "3D визуализация", plannedHours: 15, progress: 0, responsibleName: "Кирилл Орлов", order: 2 },
                      { id: "t38", description: "Презентация концепции", plannedHours: 10, progress: 0, responsibleName: "Кирилл Орлов", order: 3 },
                    ],
                  },
                  {
                    id: "stage-ar-2",
                    name: "Детализация",
                    startDate: "2025-12-19",
                    finishDate: "2025-12-30",
                    order: 2,
                    status: "backlog",
                    plannedHours: 48,
                    loadings: [
                      { id: "l16", startDate: "2025-12-19", endDate: "2025-12-24", rate: 0.5, employeeName: "Татьяна Белова" },
                      { id: "l17", startDate: "2025-12-25", endDate: "2025-12-30", rate: 0.75, employeeName: "Кирилл Орлов" },
                    ],
                    workLogs: [],
                    tasks: [
                      { id: "t39", description: "Планы этажей", plannedHours: 16, progress: 0, responsibleName: "Татьяна Белова", order: 1 },
                      { id: "t40", description: "Фасады и разрезы", plannedHours: 16, progress: 0, responsibleName: "Кирилл Орлов", order: 2 },
                      { id: "t41", description: "Узлы и детали", plannedHours: 16, progress: 0, responsibleName: "Кирилл Орлов", order: 3 },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
]

// Legacy export for backward compatibility - flattened sections
export const mockSections = mockProjects.flatMap(project =>
  project.stages.flatMap(stage =>
    stage.objects.flatMap(obj => obj.sections)
  )
)

// Mock employees with team structure
export interface MockEmployee {
  id: string
  name: string
  position: string
  teamId: string
  avatarUrl?: string
}

export interface MockTeam {
  id: string
  name: string
  leaderId: string
  departmentName: string
}

export const mockTeams: MockTeam[] = [
  {
    id: "team-1",
    name: "Команда конструкторов",
    leaderId: "emp-1",
    departmentName: "Отдел КР",
  },
  {
    id: "team-2",
    name: "Команда инженеров",
    leaderId: "emp-5",
    departmentName: "Отдел ИОС",
  },
  {
    id: "team-3",
    name: "Команда архитекторов",
    leaderId: "emp-8",
    departmentName: "Отдел АР",
  },
]

// Generate avatar URL using UI Avatars service
function getAvatarUrl(name: string, background: string = "1e7260"): string {
  const initials = name.split(" ").map(n => n[0]).join("")
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=${background}&color=fff&size=64&font-size=0.4&bold=true`
}

export const mockEmployees: MockEmployee[] = [
  // Команда конструкторов (team-1)
  { id: "emp-1", name: "Иван Жамойть", position: "Ведущий конструктор", teamId: "team-1", avatarUrl: getAvatarUrl("Иван Жамойть", "6366f1") },
  { id: "emp-2", name: "Петр Сидоров", position: "Инженер-конструктор", teamId: "team-1", avatarUrl: getAvatarUrl("Петр Сидоров", "8b5cf6") },
  { id: "emp-3", name: "Мария Власовец", position: "Инженер-конструктор", teamId: "team-1", avatarUrl: getAvatarUrl("Мария Власовец", "a855f7") },
  { id: "emp-4", name: "Ольга Мироненко", position: "Инженер-конструктор", teamId: "team-1", avatarUrl: getAvatarUrl("Ольга Мироненко", "c084fc") },

  // Команда инженеров (team-2)
  { id: "emp-5", name: "Дмитрий Волков", position: "Ведущий инженер", teamId: "team-2", avatarUrl: getAvatarUrl("Дмитрий Волков", "0891b2") },
  { id: "emp-6", name: "Сергей Новиков", position: "Инженер ВК", teamId: "team-2", avatarUrl: getAvatarUrl("Сергей Новиков", "0ea5e9") },
  { id: "emp-7", name: "Алексей Шаблев", position: "Инженер ОВ", teamId: "team-2", avatarUrl: getAvatarUrl("Алексей Шаблев", "38bdf8") },

  // Команда архитекторов (team-3)
  { id: "emp-8", name: "Кирилл Орлов", position: "Главный архитектор", teamId: "team-3", avatarUrl: getAvatarUrl("Кирилл Орлов", "f59e0b") },
  { id: "emp-9", name: "Татьяна Белова", position: "Архитектор", teamId: "team-3", avatarUrl: getAvatarUrl("Татьяна Белова", "f97316") },
  { id: "emp-10", name: "Анна Козлова", position: "Архитектор", teamId: "team-3", avatarUrl: getAvatarUrl("Анна Козлова", "fb923c") },

  // Отдельные специалисты
  { id: "emp-11", name: "Андрей Петров", position: "Технолог", teamId: "team-2", avatarUrl: getAvatarUrl("Андрей Петров", "10b981") },
  { id: "emp-12", name: "Виктор Соколов", position: "Инженер-технолог", teamId: "team-2", avatarUrl: getAvatarUrl("Виктор Соколов", "14b8a6") },
  { id: "emp-13", name: "Николай Федоров", position: "Согласователь", teamId: "team-2", avatarUrl: getAvatarUrl("Николай Федоров", "2dd4bf") },
]

// Helper to get employee by name
export function getEmployeeByName(name: string): MockEmployee | undefined {
  return mockEmployees.find(emp => emp.name === name)
}

// Helper to get team members
export function getTeamMembers(teamId: string): MockEmployee[] {
  return mockEmployees.filter(emp => emp.teamId === teamId)
}

// Helper to get team leader
export function getTeamLeader(teamId: string): MockEmployee | undefined {
  const team = mockTeams.find(t => t.id === teamId)
  if (!team) return undefined
  return mockEmployees.find(emp => emp.id === team.leaderId)
}

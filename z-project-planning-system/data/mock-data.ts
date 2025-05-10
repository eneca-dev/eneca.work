import type { Project, Section, Task, Loading } from "@/types/project-types"
import { mockProfiles, profileToResponsible } from "@/data/mock-profiles"

// Helper to create dates relative to today
const daysFromNow = (days: number): Date => {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date
}

// Convert string date to Date object
const parseDate = (dateString: string | null): Date | null => {
  return dateString ? new Date(dateString) : null
}

// Обновим моковые данные для загрузок, назначив только сотрудников архитектурного отдела
const mockLoadings: Loading[] = [
  {
    id: "a1b2c3d4-e5f6-4a5b-9c8d-1e2f3a4b5c6d",
    task_id: "7127aa93-8019-4ca5-b21b-5f1308d01971",
    user_id: "141679", // Павел Романюк (АР-3)
    rate: 0.75,
    date_start: daysFromNow(-8),
    date_end: daysFromNow(2),
    type: "Fact",
    created_at: new Date("2025-03-25T10:00:00.000Z"),
    updated_at: new Date("2025-03-25T10:00:00.000Z"),
  },
  {
    id: "b2c3d4e5-f6a7-5b6c-0d1e-2f3a4b5c6d7e",
    task_id: "5e3e2c97-9354-42e8-b305-d8dc31832b6b",
    user_id: "141679", // Павел Романюк (АР-3)
    rate: 1.0,
    date_start: daysFromNow(-5),
    date_end: daysFromNow(5),
    type: "Fact",
    created_at: new Date("2025-03-26T09:30:00.000Z"),
    updated_at: new Date("2025-03-26T09:30:00.000Z"),
  },
  {
    id: "c3d4e5f6-g7h8-6c7d-1e2f-3g4h5i6j7k8l",
    task_id: "7127aa93-8019-4ca5-b21b-5f1308d01971",
    user_id: "138320", // Татьяна Колоско (АР-4)
    rate: 0.5,
    date_start: daysFromNow(3),
    date_end: daysFromNow(10),
    type: "Fact",
    created_at: new Date("2025-03-27T11:15:00.000Z"),
    updated_at: new Date("2025-03-27T11:15:00.000Z"),
  },
  {
    id: "d4e5f6g7-h8i9-7d8e-2f3g-4h5i6j7k8l9m",
    task_id: "5e3e2c97-9354-42e8-b305-d8dc31832b6b",
    user_id: "138320", // Татьяна Колоско (АР-4)
    rate: 1.25,
    date_start: daysFromNow(-3),
    date_end: daysFromNow(8),
    type: "Fact",
    created_at: new Date("2025-03-28T14:45:00.000Z"),
    updated_at: new Date("2025-03-28T14:45:00.000Z"),
  },
  {
    id: "e5f6g7h8-i9j0-8e9f-3g4h-5i6j7k8l9m0n",
    task_id: "a3b4c5d6-e7f8-9g0h-1i2j-3k4l5m6n7o8",
    user_id: "107241", // Тимофей Богушевский (АР-3)
    rate: 1.0,
    date_start: daysFromNow(5),
    date_end: daysFromNow(15),
    type: "Fact",
    created_at: new Date("2025-03-29T08:20:00.000Z"),
    updated_at: new Date("2025-03-29T08:20:00.000Z"),
  },
  {
    id: "f6g7h8i9-j0k1-9f0g-4h5i-6j7k8l9m0n1o",
    task_id: "b4c5d6e7-f8g9-0h1i-2j3k-4l5m6n7o8p9",
    user_id: "135602", // Ольга Садоха (АР-4)
    rate: 0.5,
    date_start: daysFromNow(7),
    date_end: daysFromNow(18),
    type: "Fact",
    created_at: new Date("2025-03-30T16:10:00.000Z"),
    updated_at: new Date("2025-03-30T16:10:00.000Z"),
  },
  {
    id: "g7h8i9j0-k1l2-0g1h-5i6j-7k8l9m0n1o2p",
    task_id: "c5d6e7f8-g9h0-1i2j-3k4l-5m6n7o8p9q0",
    user_id: "107241", // Тимофей Богушевский (АР-3)
    rate: 0.75,
    date_start: daysFromNow(12),
    date_end: daysFromNow(22),
    type: "Fact",
    created_at: new Date("2025-03-31T13:25:00.000Z"),
    updated_at: new Date("2025-03-31T13:25:00.000Z"),
  },
  {
    id: "h8i9j0k1-l2m3-1h2i-6j7k-8l9m0n1o2p3q",
    task_id: "d6e7f8g9-h0i1-2j3k-4l5m-6n7o8p9q0r1",
    user_id: "135602", // Ольга Садоха (АР-4)
    rate: 1.0,
    date_start: daysFromNow(15),
    date_end: daysFromNow(25),
    type: "Fact",
    created_at: new Date("2025-04-01T10:40:00.000Z"),
    updated_at: new Date("2025-04-01T10:40:00.000Z"),
  },
]

// Mock tasks data based on the schema
const mockTasks: Task[] = [
  {
    id: "7127aa93-8019-4ca5-b21b-5f1308d01971",
    ws_task_id: 4768209,
    ws_subtask_id: 4768293,
    name: "Подключить к проекту",
    page: "/project/129417/4768209/4768293/",
    user_to: {
      id: "125833",
      name: "Яковлев Евгений",
      email: "evgeniy.yakovlev@enecagroup.com",
    },
    date_start: null,
    date_end: null,
    tags: {
      "200867": "0%",
      "229573": "План",
    },
    comments: [
      {
        id: "14229633",
        page: "/project/129417/4768209/4768293/#com14229633",
        text: "◷ k: 0 | vs: 0 | gs: 0 | department: No department ◷",
        user_from: {
          id: "3",
          name: "API",
          email: "API",
        },
        date_added: "2025-01-24 15:43",
      },
    ],
    loadings: mockLoadings.filter((loading) => loading.task_id === "7127aa93-8019-4ca5-b21b-5f1308d01971"),
  },
  {
    id: "5e3e2c97-9354-42e8-b305-d8dc31832b6b",
    ws_task_id: 4768221,
    ws_subtask_id: 4768229,
    name: "1.2_Печать",
    page: "/project/129417/4768221/4768229/",
    user_to: {
      id: "26787",
      name: "Таратухин Денис",
      email: "Denis.Taratuhin@enecagroup.com",
    },
    date_start: null,
    date_end: null,
    tags: {
      "200867": "0%",
      "229573": "План",
    },
    comments: [
      {
        id: "14229569",
        page: "/project/129417/4768221/4768229/#com14229569",
        text: "◷ k: 0 | vs: 0 | gs: 0 | department: No department ◷",
        user_from: {
          id: "3",
          name: "API",
          email: "API",
        },
        date_added: "2025-01-24 15:43",
      },
    ],
    loadings: mockLoadings.filter((loading) => loading.task_id === "5e3e2c97-9354-42e8-b305-d8dc31832b6b"),
  },
  {
    id: "a3b4c5d6-e7f8-9g0h-1i2j-3k4l5m6n7o8",
    ws_task_id: 4768221,
    ws_subtask_id: 4768230,
    name: "1.3_Согласование",
    page: "/project/129417/4768221/4768230/",
    user_to: {
      id: "26787",
      name: "Таратухин Денис",
      email: "Denis.Taratuhin@enecagroup.com",
    },
    date_start: null,
    date_end: null,
    tags: {
      "200867": "0%",
      "229573": "План",
    },
    comments: [],
    loadings: mockLoadings.filter((loading) => loading.task_id === "a3b4c5d6-e7f8-9g0h-1i2j-3k4l5m6n7o8"),
  },
  {
    id: "b4c5d6e7-f8g9-0h1i-2j3k-4l5m6n7o8p9",
    ws_task_id: 4768221,
    ws_subtask_id: 4768231,
    name: "1.4_Проверка",
    page: "/project/129417/4768221/4768231/",
    user_to: {
      id: "26787",
      name: "Таратухин Денис",
      email: "Denis.Taratuhin@enecagroup.com",
    },
    date_start: null,
    date_end: null,
    tags: {
      "200867": "0%",
      "229573": "План",
    },
    comments: [],
    loadings: mockLoadings.filter((loading) => loading.task_id === "b4c5d6e7-f8g9-0h1i-2j3k-4l5m6n7o8p9"),
  },
  {
    id: "c5d6e7f8-g9h0-1i2j-3k4l-5m6n7o8p9q0",
    ws_task_id: 4768221,
    ws_subtask_id: 4768232,
    name: "1.5_Утверждение",
    page: "/project/129417/4768221/4768232/",
    user_to: {
      id: "26787",
      name: "Таратухин Денис",
      email: "Denis.Taratuhin@enecagroup.com",
    },
    date_start: null,
    date_end: null,
    tags: {
      "200867": "0%",
      "229573": "План",
    },
    comments: [],
    loadings: mockLoadings.filter((loading) => loading.task_id === "c5d6e7f8-g9h0-1i2j-3k4l-5m6n7o8p9q0"),
  },
  {
    id: "d6e7f8g9-h0i1-2j3k-4l5m-6n7o8p9q0r1",
    ws_task_id: 4768221,
    ws_subtask_id: 4768233,
    name: "1.6_Выпуск",
    page: "/project/129417/4768221/4768233/",
    user_to: {
      id: "26787",
      name: "Таратухин Денис",
      email: "Denis.Taratuhin@enecagroup.com",
    },
    date_start: null,
    date_end: null,
    tags: {
      "200867": "0%",
      "229573": "План",
    },
    comments: [],
    loadings: mockLoadings.filter((loading) => loading.task_id === "d6e7f8g9-h0i1-2j3k-4l5m-6n7o8p9q0r1"),
  },
]

// Обновим данные о разделах, чтобы у каждого проекта был раздел Архитектурного отдела
const mockSections: Section[] = [
  {
    id: "e1564c10-61c7-42e3-811e-bb036725927d",
    ws_project_id: 129417,
    ws_task_id: 4768221,
    name: "АР - Архитектурные решения",
    page: "/project/129417/4768221/",
    user_to: {
      id: "99231",
      name: "Капустинский Артём",
      email: "Artem.Kapustinskiy@enecagroup.com",
    },
    date_start: null,
    date_end: null,
    tags: null,
    comments: null,
    tasks: [
      mockTasks.find((task) => task.id === "5e3e2c97-9354-42e8-b305-d8dc31832b6b")!,
      mockTasks.find((task) => task.id === "a3b4c5d6-e7f8-9g0h-1i2j-3k4l5m6n7o8")!,
      mockTasks.find((task) => task.id === "b4c5d6e7-f8g9-0h1i-2j3k-4l5m6n7o8p9")!,
    ],
    responsible: profileToResponsible(mockProfiles.find((p) => p.user_id === "107241")!), // Тимофей Богушевский (тимлид АР-3)
    department: "Архитектурный отдел",
  },
]

// Обновляем данные о проектах, чтобы добавить разных менеджеров
export const mockProjects: Project[] = [
  {
    id: "13d2c73c-2bfb-482f-85e4-b2d40fca3ac6",
    ws_project_id: 129417,
    name: "1-П-03/25-С Техмодернизация ПДСП НОВУС",
    status: "active",
    user_to: {
      id: "125833",
      name: "Яковлев Евгений",
      email: "evgeniy.yakovlev@enecagroup.com",
    },
    date_start: parseDate("2025-01-26T17:00:00.000Z"),
    date_end: parseDate("2025-03-06T17:00:00.000Z"),
    tags: {
      "230137": "Новая структура",
    },
    sections: [mockSections.find((section) => section.id === "e1564c10-61c7-42e3-811e-bb036725927d")!],
  },
  {
    id: "1ba6b1ed-cc52-4690-865b-27085b65c9c8",
    ws_project_id: 129481,
    name: "1-П-08/25-С Склад Kronospan Могилев",
    status: "active",
    user_to: {
      id: "143005",
      name: "Прокурат Нина",
      email: "Nina.Prokurat@enecagroup.com",
    },
    date_start: parseDate("2025-02-08T17:00:00.000Z"),
    date_end: parseDate("2025-05-21T17:00:00.000Z"),
    tags: {
      "202678": "В работе",
      "230137": "Новая структура",
    },
    sections: [
      {
        id: "ar-section-project2",
        ws_project_id: 129481,
        ws_task_id: 4768301,
        name: "АР - Архитектурные решения",
        page: "/project/129481/4768301/",
        user_to: {
          id: "99231",
          name: "Капустинский Артём",
          email: "Artem.Kapustinskiy@enecagroup.com",
        },
        date_start: null,
        date_end: null,
        tags: null,
        comments: null,
        tasks: [
          mockTasks.find((task) => task.id === "c5d6e7f8-g9h0-1i2j-3k4l-5m6n7o8p9q0")!,
          mockTasks.find((task) => task.id === "d6e7f8g9-h0i1-2j3k-4l5m-6n7o8p9q0r1")!,
        ],
        responsible: profileToResponsible(mockProfiles.find((p) => p.user_id === "135602")!), // Ольга Садоха (тимлид АР-4)
        department: "Архитектурный отдел",
        stages: [],
      },
    ],
  },
  {
    id: "2ca7b1ed-cc52-4690-865b-27085b65c9c9",
    ws_project_id: 129482,
    name: "1-П-10/25-С Реконструкция цеха №3",
    status: "active",
    user_to: {
      id: "106923",
      name: "Кулага Александр",
      email: "alexander.kulaga@enecagroup.com",
    },
    date_start: parseDate("2025-03-15T17:00:00.000Z"),
    date_end: parseDate("2025-06-30T17:00:00.000Z"),
    tags: {
      "202678": "В работе",
      "230137": "Новая структура",
    },
    sections: [
      {
        id: "ar-section-project3",
        ws_project_id: 129482,
        ws_task_id: 4768401,
        name: "АР - Архитектурные решения",
        page: "/project/129482/4768401/",
        user_to: {
          id: "99231",
          name: "Капустинский Артём",
          email: "Artem.Kapustinskiy@enecagroup.com",
        },
        date_start: null,
        date_end: null,
        tags: null,
        comments: null,
        tasks: [
          {
            id: "task-ar-project3-1",
            ws_task_id: 4768402,
            ws_subtask_id: 4768403,
            name: "Разработка фасадов",
            page: "/project/129482/4768402/4768403/",
            loadings: [
              {
                id: "loading-ar-project3-1",
                task_id: "task-ar-project3-1",
                user_id: "141679", // Павел Романюк (АР-3)
                rate: 0.8,
                date_start: daysFromNow(-2),
                date_end: daysFromNow(10),
                type: "Fact",
              },
            ],
          },
        ],
        responsible: profileToResponsible(mockProfiles.find((p) => p.user_id === "107241")!), // Тимофей Богушевский (тимлид АР-3)
        department: "Архитектурный отдел",
        stages: [],
      },
    ],
  },
  {
    id: "3da8b1ed-cc52-4690-865b-27085b65c9d0",
    ws_project_id: 129483,
    name: "1-П-12/25-С Модернизация ТЭЦ",
    status: "active",
    user_to: {
      id: "122048",
      name: "Лепешинский Александр",
      email: "Alexander.Lepeshinski@enecagroup.com",
    },
    date_start: parseDate("2025-04-10T17:00:00.000Z"),
    date_end: parseDate("2025-07-15T17:00:00.000Z"),
    tags: {
      "202678": "В работе",
      "230137": "Новая структура",
    },
    sections: [
      {
        id: "ar-section-project4",
        ws_project_id: 129483,
        ws_task_id: 4768501,
        name: "АР - Архитектурные решения",
        page: "/project/129483/4768501/",
        user_to: {
          id: "99231",
          name: "Капустинский Артём",
          email: "Artem.Kapustinskiy@enecagroup.com",
        },
        date_start: null,
        date_end: null,
        tags: null,
        comments: null,
        tasks: [
          {
            id: "task-ar-project4-1",
            ws_task_id: 4768502,
            ws_subtask_id: 4768503,
            name: "Планировочные решения",
            page: "/project/129483/4768502/4768503/",
            loadings: [
              {
                id: "loading-ar-project4-1",
                task_id: "task-ar-project4-1",
                user_id: "138320", // Татьяна Колоско (АР-4)
                rate: 1.0,
                date_start: daysFromNow(1),
                date_end: daysFromNow(12),
                type: "Fact",
              },
            ],
          },
        ],
        responsible: profileToResponsible(mockProfiles.find((p) => p.user_id === "135602")!), // Ольга Садоха (тимлид АР-4)
        department: "Архитектурный отдел",
        stages: [],
      },
    ],
  },
  {
    id: "4ea9b1ed-cc52-4690-865b-27085b65c9e1",
    ws_project_id: 129484,
    name: "1-П-15/25-С Офисный центр Минск",
    status: "active",
    user_to: {
      id: "143005",
      name: "Прокурат Нина",
      email: "Nina.Prokurat@enecagroup.com",
    },
    date_start: parseDate("2025-05-05T17:00:00.000Z"),
    date_end: parseDate("2025-08-20T17:00:00.000Z"),
    tags: {
      "202678": "В работе",
      "230137": "Новая структура",
    },
    sections: [
      {
        id: "ar-section-project5",
        ws_project_id: 129484,
        ws_task_id: 4768601,
        name: "АР - Архитектурные решения",
        page: "/project/129484/4768601/",
        user_to: {
          id: "99231",
          name: "Капустинский Артём",
          email: "Artem.Kapustinskiy@enecagroup.com",
        },
        date_start: null,
        date_end: null,
        tags: null,
        comments: null,
        tasks: [
          {
            id: "task-ar-project5-1",
            ws_task_id: 4768602,
            ws_subtask_id: 4768603,
            name: "Интерьерные решения",
            page: "/project/129484/4768602/4768603/",
            loadings: [
              {
                id: "loading-ar-project5-1",
                task_id: "task-ar-project5-1",
                user_id: "135602", // Ольга Садоха (АР-4)
                rate: 0.75,
                date_start: daysFromNow(5),
                date_end: daysFromNow(20),
                type: "Fact",
              },
            ],
          },
        ],
        responsible: profileToResponsible(mockProfiles.find((p) => p.user_id === "107241")!), // Тимофей Богушевский (тимлид АР-3)
        department: "Архитектурный отдел",
        stages: [],
      },
    ],
  },
]


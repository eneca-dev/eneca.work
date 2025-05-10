import type { Profile, Team, Position, Category, DepartmentInfo, Role } from "@/types/project-types"

// Обновим моковые данные для отделов
export const mockDepartments: DepartmentInfo[] = [
  {
    department_id: "gup",
    ws_department_id: 1,
    department_name: "Группа управления проектами",
  },
  {
    department_id: "ar",
    ws_department_id: 2,
    department_name: "Архитектурный отдел",
  },
  {
    department_id: "vk",
    ws_department_id: 3,
    department_name: "Отдел водоснабжения и канализации",
  },
  {
    department_id: "es",
    ws_department_id: 4,
    department_name: "Отдел электроснабжения (Гражд. объекты)",
  },
]

// Обновим моковые данные для должностей
export const mockPositions: Position[] = [
  {
    position_id: "gip",
    ws_position_id: 1001,
    position_name: "ГИП",
  },
  {
    position_id: "rp",
    ws_position_id: 1002,
    position_name: "Руководитель проекта",
  },
  {
    position_id: "gap",
    ws_position_id: 2001,
    position_name: "Главный архитектор проектов (ТЛ)",
  },
  {
    position_id: "ar1",
    ws_position_id: 2002,
    position_name: "Архитектор I кат.",
  },
  {
    position_id: "ar_tl",
    ws_position_id: 2003,
    position_name: "АР-4 (ТЛ) / ГАП",
  },
  {
    position_id: "ar",
    ws_position_id: 2004,
    position_name: "Архитекторка",
  },
  {
    position_id: "vk_tl",
    ws_position_id: 3001,
    position_name: "ВК-1 (ТЛ), инженер ГС2",
  },
  {
    position_id: "vk_k2",
    ws_position_id: 3002,
    position_name: "ВК-1, инженер К2",
  },
  {
    position_id: "vk2_tl",
    ws_position_id: 3003,
    position_name: "ВК-2 (ТЛ), ГС",
  },
  {
    position_id: "vk2_gs2",
    ws_position_id: 3004,
    position_name: "ВК-2, инженер ГС2",
  },
  {
    position_id: "es_tl",
    ws_position_id: 4001,
    position_name: "ЭС-1 (ТЛ), главный специалист ГС1",
  },
  {
    position_id: "es_vs1",
    ws_position_id: 4002,
    position_name: "ЭС-1, инженер ВС1",
  },
  {
    position_id: "es2_tl",
    ws_position_id: 4003,
    position_name: "ЭС-2 (ТЛ), инженер ВС2",
  },
  {
    position_id: "es2_vs2",
    ws_position_id: 4004,
    position_name: "ЭС-2, инженер ВС2",
  },
]

// Обновим моковые данные для команд
export const mockTeams: Team[] = [
  {
    team_id: "gup-1",
    ws_team_id: 101,
    team_name: "ГУП-1",
    department_id: "gup",
  },
  {
    team_id: "gup-9",
    ws_team_id: 102,
    team_name: "ГУП-9",
    department_id: "gup",
  },
  {
    team_id: "ar-3",
    ws_team_id: 201,
    team_name: "Команда АР-3",
    department_id: "ar",
  },
  {
    team_id: "ar-4",
    ws_team_id: 202,
    team_name: "Команда АР-4",
    department_id: "ar",
  },
  {
    team_id: "vk-1",
    ws_team_id: 301,
    team_name: "Команда ВК-1",
    department_id: "vk",
  },
  {
    team_id: "vk-2",
    ws_team_id: 302,
    team_name: "Команда ВК-2",
    department_id: "vk",
  },
  {
    team_id: "es-1",
    ws_team_id: 401,
    team_name: "Команда ЭС-1",
    department_id: "es",
  },
  {
    team_id: "es-2",
    ws_team_id: 402,
    team_name: "Команда ЭС-2",
    department_id: "es",
  },
]

// Mock data for categories based on the schema
export const mockCategories: Category[] = [
  {
    category_id: "83c4620d-ba2d-43a4-8646-3bef941a3e30",
    ws_category_id: 63187,
    category_name: "ГС1",
  },
  {
    category_id: "dda3c545-4d1a-4600-a469-ec86e8db4214",
    ws_category_id: 20875,
    category_name: "К1",
  },
  {
    category_id: "c5ba4c81-ef89-4687-a10d-fcbcc149bfb3",
    ws_category_id: 20876,
    category_name: "ВС1",
  },
  {
    category_id: "1a2b3c4d-5e6f-7g8h-9i0j-1k2l3m4n5o6p",
    ws_category_id: 20877,
    category_name: "ТЛ",
  },
  {
    category_id: "7a8b9c0d-1e2f-3g4h-5i6j-7k8l9m0n1o2p",
    ws_category_id: 20878,
    category_name: "НО",
  },
]

// Mock data for roles based on the schema
export const mockRoles: Role[] = [
  {
    id: "3ac4f27e-c94c-4b0d-b750-9fb6366b85bc",
    name: "user",
    description: "Regular user with limited permissions",
    created_at: "2025-03-19T03:52:44.903Z",
  },
  {
    id: "f23cb69e-40a7-4afe-baeb-223367e32b5a",
    name: "admin",
    description: "Administrator with full access to all functions",
    created_at: "2025-03-19T03:52:44.903Z",
  },
  {
    id: "1a2b3c4d-5e6f-7g8h-9i0j-1k2l3m4n5o6p",
    name: "manager",
    description: "Manager with access to team management functions",
    created_at: "2025-03-19T03:52:44.903Z",
  },
  {
    id: "7a8b9c0d-1e2f-3g4h-5i6j-7k8l9m0n1o2p",
    name: "team_lead",
    description: "Team lead with access to team management functions",
    created_at: "2025-03-19T03:52:44.903Z",
  },
  {
    id: "3a4b5c6d-7e8f-9g0h-1i2j-3k4l5m6n7o8p",
    name: "department_head",
    description: "Department head with access to department management functions",
    created_at: "2025-03-19T03:52:44.903Z",
  },
]

// Обновим моковые данные для профилей
export const mockProfiles: Profile[] = [
  // ГУП-1
  {
    user_id: "106923",
    first_name: "Александр",
    last_name: "Кулага",
    department_id: "gup",
    team_id: "gup-1",
    position_id: "gip",
    category_id: "83c4620d-ba2d-43a4-8646-3bef941a3e30", // ГС1
    role_id: "3ac4f27e-c94c-4b0d-b750-9fb6366b85bc", // user
    email: "alexander.kulaga@enecagroup.com",
    created_at: "2025-02-25T12:18:07.531Z",
    avatar_url: `/placeholder.svg?height=40&width=40&text=АК`,
  },
  {
    user_id: "125833",
    first_name: "Евгений",
    last_name: "Яковлев",
    department_id: "gup",
    team_id: "gup-1",
    position_id: "rp",
    category_id: "dda3c545-4d1a-4600-a469-ec86e8db4214", // К1
    role_id: "3ac4f27e-c94c-4b0d-b750-9fb6366b85bc", // user
    email: "evgeniy.yakovlev@enecagroup.com",
    created_at: "2025-02-25T12:18:07.531Z",
    avatar_url: `/placeholder.svg?height=40&width=40&text=ЕЯ`,
  },

  // ГУП-9
  {
    user_id: "122048",
    first_name: "Александр",
    last_name: "Лепешинский",
    department_id: "gup",
    team_id: "gup-9",
    position_id: "gip",
    category_id: "83c4620d-ba2d-43a4-8646-3bef941a3e30", // ГС1
    role_id: "3ac4f27e-c94c-4b0d-b750-9fb6366b85bc", // user
    email: "Alexander.Lepeshinski@enecagroup.com",
    created_at: "2025-02-25T12:18:07.531Z",
    avatar_url: `/placeholder.svg?height=40&width=40&text=АЛ`,
  },
  {
    user_id: "143005",
    first_name: "Нина",
    last_name: "Прокурат",
    department_id: "gup",
    team_id: "gup-9",
    position_id: "rp",
    category_id: "dda3c545-4d1a-4600-a469-ec86e8db4214", // К1
    role_id: "3ac4f27e-c94c-4b0d-b750-9fb6366b85bc", // user
    email: "Nina.Prokurat@enecagroup.com",
    created_at: "2025-02-25T12:18:07.531Z",
    avatar_url: `/placeholder.svg?height=40&width=40&text=НП`,
  },

  // Команда АР-3
  {
    user_id: "107241",
    first_name: "Тимофей",
    last_name: "Богушевский",
    department_id: "ar",
    team_id: "ar-3",
    position_id: "gap",
    category_id: "83c4620d-ba2d-43a4-8646-3bef941a3e30", // ГС1
    role_id: "7a8b9c0d-1e2f-3g4h-5i6j-7k8l9m0n1o2p", // team_lead
    email: "Timofey.Bogushevskiy@enecagroup.com",
    created_at: "2025-02-25T12:18:07.531Z",
    avatar_url: `/placeholder.svg?height=40&width=40&text=ТБ`,
  },
  {
    user_id: "141679",
    first_name: "Павел",
    last_name: "Романюк",
    department_id: "ar",
    team_id: "ar-3",
    position_id: "ar1",
    category_id: "dda3c545-4d1a-4600-a469-ec86e8db4214", // К1
    role_id: "3ac4f27e-c94c-4b0d-b750-9fb6366b85bc", // user
    email: "pavel.romanyuk@enecagroup.com",
    created_at: "2025-02-25T12:18:07.531Z",
    avatar_url: `/placeholder.svg?height=40&width=40&text=ПР`,
  },

  // Команда АР-4
  {
    user_id: "135602",
    first_name: "Ольга",
    last_name: "Садоха",
    department_id: "ar",
    team_id: "ar-4",
    position_id: "ar_tl",
    category_id: "83c4620d-ba2d-43a4-8646-3bef941a3e30", // ГС1
    role_id: "7a8b9c0d-1e2f-3g4h-5i6j-7k8l9m0n1o2p", // team_lead
    email: "Olga.Sadokha@enecagroup.com",
    created_at: "2025-02-25T12:18:07.531Z",
    avatar_url: `/placeholder.svg?height=40&width=40&text=ОС`,
  },
  {
    user_id: "138320",
    first_name: "Татьяна",
    last_name: "Колоско",
    department_id: "ar",
    team_id: "ar-4",
    position_id: "ar",
    category_id: "dda3c545-4d1a-4600-a469-ec86e8db4214", // К1
    role_id: "3ac4f27e-c94c-4b0d-b750-9fb6366b85bc", // user
    email: "Tatiana.Kolosko@enecagroup.com",
    created_at: "2025-02-25T12:18:07.531Z",
    avatar_url: `/placeholder.svg?height=40&width=40&text=ТК`,
  },

  // Команда ВК-1
  {
    user_id: "139202",
    first_name: "Марина",
    last_name: "Анисимова",
    department_id: "vk",
    team_id: "vk-1",
    position_id: "vk_tl",
    category_id: "83c4620d-ba2d-43a4-8646-3bef941a3e30", // ГС1
    role_id: "7a8b9c0d-1e2f-3g4h-5i6j-7k8l9m0n1o2p", // team_lead
    email: "marina.anisimova@enecagroup.com",
    created_at: "2025-02-25T12:18:07.531Z",
    avatar_url: `/placeholder.svg?height=40&width=40&text=МА`,
  },
  {
    user_id: "140366",
    first_name: "Ирина",
    last_name: "Филатова",
    department_id: "vk",
    team_id: "vk-1",
    position_id: "vk_k2",
    category_id: "dda3c545-4d1a-4600-a469-ec86e8db4214", // К1
    role_id: "3ac4f27e-c94c-4b0d-b750-9fb6366b85bc", // user
    email: "irina.filatova@enecagroup.com",
    created_at: "2025-02-25T12:18:07.531Z",
    avatar_url: `/placeholder.svg?height=40&width=40&text=ИФ`,
  },

  // Команда ВК-2
  {
    user_id: "141324",
    first_name: "Александр",
    last_name: "Тимошук",
    department_id: "vk",
    team_id: "vk-2",
    position_id: "vk2_tl",
    category_id: "83c4620d-ba2d-43a4-8646-3bef941a3e30", // ГС1
    role_id: "7a8b9c0d-1e2f-3g4h-5i6j-7k8l9m0n1o2p", // team_lead
    email: "alexander.timoshuk@enecagroup.com",
    created_at: "2025-02-25T12:18:07.531Z",
    avatar_url: `/placeholder.svg?height=40&width=40&text=АТ`,
  },
  {
    user_id: "143249",
    first_name: "Наталья",
    last_name: "Одуло",
    department_id: "vk",
    team_id: "vk-2",
    position_id: "vk2_gs2",
    category_id: "dda3c545-4d1a-4600-a469-ec86e8db4214", // К1
    role_id: "3ac4f27e-c94c-4b0d-b750-9fb6366b85bc", // user
    email: "Natalia.Odulo@enecagroup.com",
    created_at: "2025-02-25T12:18:07.531Z",
    avatar_url: `/placeholder.svg?height=40&width=40&text=НО`,
  },

  // Команда ЭС-1
  {
    user_id: "122114",
    first_name: "Дмитрий",
    last_name: "Баркун",
    department_id: "es",
    team_id: "es-1",
    position_id: "es_tl",
    category_id: "83c4620d-ba2d-43a4-8646-3bef941a3e30", // ГС1
    role_id: "7a8b9c0d-1e2f-3g4h-5i6j-7k8l9m0n1o2p", // team_lead
    email: "dmitriy.barkun@enecagroup.com",
    created_at: "2025-02-25T12:18:07.531Z",
    avatar_url: `/placeholder.svg?height=40&width=40&text=ДБ`,
  },
  {
    user_id: "122527",
    first_name: "Иван",
    last_name: "Клейменов",
    department_id: "es",
    team_id: "es-1",
    position_id: "es_vs1",
    category_id: "c5ba4c81-ef89-4687-a10d-fcbcc149bfb3", // ВС1
    role_id: "3ac4f27e-c94c-4b0d-b750-9fb6366b85bc", // user
    email: "Ivan.Kleymenov@enecagroup.com",
    created_at: "2025-02-25T12:18:07.531Z",
    avatar_url: `/placeholder.svg?height=40&width=40&text=ИК`,
  },

  // Команда ЭС-2
  {
    user_id: "108337",
    first_name: "Александра",
    last_name: "Марчук",
    department_id: "es",
    team_id: "es-2",
    position_id: "es2_tl",
    category_id: "c5ba4c81-ef89-4687-a10d-fcbcc149bfb3", // ВС1
    role_id: "7a8b9c0d-1e2f-3g4h-5i6j-7k8l9m0n1o2p", // team_lead
    email: "alexandra.marchuk@enecagroup.com",
    created_at: "2025-02-25T12:18:07.531Z",
    avatar_url: `/placeholder.svg?height=40&width=40&text=АМ`,
  },
  {
    user_id: "143201",
    first_name: "Андрей",
    last_name: "Митрахович",
    department_id: "es",
    team_id: "es-2",
    position_id: "es2_vs2",
    category_id: "c5ba4c81-ef89-4687-a10d-fcbcc149bfb3", // ВС1
    role_id: "3ac4f27e-c94c-4b0d-b750-9fb6366b85bc", // user
    email: "Andrei.Mitrakhovich@enecagroup.com",
    created_at: "2025-02-25T12:18:07.531Z",
    avatar_url: `/placeholder.svg?height=40&width=40&text=АМ`,
  },
]

// Helper functions to work with profiles
export function getFullName(profile: Profile): string {
  return `${profile.first_name} ${profile.last_name}`
}

export function getPositionName(profile: Profile): string {
  const position = mockPositions.find((p) => p.position_id === profile.position_id)
  return position ? position.position_name : ""
}

export function getDepartmentName(profile: Profile): string {
  const department = mockDepartments.find((d) => d.department_id === profile.department_id)
  return department ? department.department_name : ""
}

export function getTeamName(profile: Profile): string {
  const team = mockTeams.find((t) => t.team_id === profile.team_id)
  return team ? team.team_name : ""
}

export function getCategoryName(profile: Profile): string {
  const category = mockCategories.find((c) => c.category_id === profile.category_id)
  return category ? category.category_name : ""
}

export function getCategoryCode(profile: Profile): string {
  const category = mockCategories.find((c) => c.category_id === profile.category_id)
  return category ? category.category_name : ""
}

export function profileToResponsible(profile: Profile) {
  return {
    id: profile.user_id,
    name: getFullName(profile),
    position: getPositionName(profile),
    avatarUrl: profile.avatar_url,
  }
}

export function getProfileById(userId: string): Profile | undefined {
  return mockProfiles.find((profile) => profile.user_id === userId)
}


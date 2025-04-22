import { supabase } from "./supabase-client"
import type { User, Department, Team, Position, Category, WorkFormatType } from "./types"

// Функция для преобразования формата работы из БД в формат приложения
function mapWorkFormat(format: WorkFormatType | null): "office" | "remote" | "hybrid" {
  switch (format) {
    case "В офисе":
      return "office"
    case "Удаленно":
      return "remote"
    case "Гибридный":
      return "hybrid"
    default:
      return "office"
  }
}

// Функция для преобразования формата работы из приложения в формат БД
export function mapWorkFormatToDb(format: "office" | "remote" | "hybrid"): WorkFormatType {
  switch (format) {
    case "office":
      return "В офисе"
    case "remote":
      return "Удаленно"
    case "hybrid":
      return "Гибридный"
  }
}

// Получение всех пользователей с объединением данных из связанных таблиц
export async function getUsers(): Promise<User[]> {
  const { data: profiles, error } = await supabase.from("profiles").select(`
      user_id,
      first_name,
      last_name,
      email,
      created_at,
      work_format,
      address,
      employment_rate,
      salary,
      is_hourly,
      departments(department_id, department_name),
      teams(team_id, team_name),
      positions(position_id, position_name),
      categories(category_id, category_name)
    `)

  if (error) {
    console.error("Error fetching users:", error)
    return []
  }

  return profiles.map((profile) => {
    const department = profile.departments as unknown as { department_name: string } | null
    const team = profile.teams as unknown as { team_name: string } | null
    const position = profile.positions as unknown as { position_name: string } | null
    const category = profile.categories as unknown as { category_name: string } | null

    return {
      id: profile.user_id,
      name: `${profile.first_name || ""} ${profile.last_name || ""}`.trim(),
      email: profile.email || "",
      avatar: `/placeholder.svg?height=40&width=40&text=${profile.first_name?.[0] || ""}${profile.last_name?.[0] || ""}`,
      position: position?.position_name || "",
      department: department?.department_name || "",
      team: team?.team_name || "",
      category: category?.category_name || "",
      isActive: true, // Предполагаем, что все пользователи активны
      dateJoined: profile.created_at,
      workLocation: mapWorkFormat(profile.work_format),
      address: profile.address || "",
      employmentRate: profile.employment_rate !== null ? profile.employment_rate : 1,
      salary: profile.salary !== null ? profile.salary : profile.is_hourly ? 15 : 1500, // Разумные значения по умолчанию
      isHourly: profile.is_hourly !== null ? profile.is_hourly : true,
    }
  })
}

// Получение всех отделов
export async function getDepartments(): Promise<Department[]> {
  const { data, error } = await supabase.from("departments").select("department_id, department_name")

  if (error) {
    console.error("Error fetching departments:", error)
    return []
  }

  return data.map((dept) => ({
    id: dept.department_id,
    name: dept.department_name || "",
  }))
}

// Получение всех команд
export async function getTeams(): Promise<Team[]> {
  const { data, error } = await supabase.from("teams").select("team_id, team_name, department_id")

  if (error) {
    console.error("Error fetching teams:", error)
    return []
  }

  return data.map((team) => ({
    id: team.team_id,
    name: team.team_name || "",
    departmentId: team.department_id || "",
  }))
}

// Получение всех должностей
export async function getPositions(): Promise<Position[]> {
  const { data, error } = await supabase.from("positions").select("position_id, position_name")

  if (error) {
    console.error("Error fetching positions:", error)
    return []
  }

  return data.map((pos) => ({
    id: pos.position_id,
    name: pos.position_name || "",
  }))
}

// Получение всех категорий
export async function getCategories(): Promise<Category[]> {
  const { data, error } = await supabase.from("categories").select("category_id, category_name")

  if (error) {
    console.error("Error fetching categories:", error)
    return []
  }

  return data.map((cat) => ({
    id: cat.category_id,
    name: cat.category_name || "",
  }))
}

// Обновление пользователя
export async function updateUser(
  userId: string,
  userData: Partial<Omit<User, "id" | "avatar" | "dateJoined" | "isActive">> & { firstName?: string; lastName?: string },
) {
  const updates: any = {}

  if (userData.firstName !== undefined) {
    updates.first_name = userData.firstName
  }
  if (userData.lastName !== undefined) {
    updates.last_name = userData.lastName
  }

  if (userData.email) {
    updates.email = userData.email
  }

  // Найдем ID для связанных сущностей, если они изменились
  if (userData.department) {
    const { data: department } = await supabase
      .from("departments")
      .select("department_id")
      .eq("department_name", userData.department)
      .single()

    if (department) {
      updates.department_id = department.department_id
    }
  }

  if (userData.team) {
    const { data: team } = await supabase.from("teams").select("team_id").eq("team_name", userData.team).single()

    if (team) {
      updates.team_id = team.team_id
    }
  }

  if (userData.position) {
    const { data: position } = await supabase
      .from("positions")
      .select("position_id")
      .eq("position_name", userData.position)
      .single()

    if (position) {
      updates.position_id = position.position_id
    }
  }

  if (userData.category) {
    const { data: category } = await supabase
      .from("categories")
      .select("category_id")
      .eq("category_name", userData.category)
      .single()

    if (category) {
      updates.category_id = category.category_id
    }
  }

  if (userData.workLocation) {
    updates.work_format = mapWorkFormatToDb(userData.workLocation)
  }

  if (userData.address) {
    updates.address = userData.address
  }

  // Добавим обработку новых полей
  if (userData.employmentRate !== undefined) {
    updates.employment_rate = userData.employmentRate
  }

  if (userData.salary !== undefined) {
    updates.salary = userData.salary
  }

  if (userData.isHourly !== undefined) {
    updates.is_hourly = userData.isHourly
  }

  const { data, error } = await supabase.from("profiles").update(updates).eq("user_id", userId).select()

  if (error) {
    console.error("Error updating user:", error)
    throw error
  }

  return data
}

// Удаление пользователя
export async function deleteUser(userId: string) {
  const { error } = await supabase.from("profiles").delete().eq("user_id", userId)

  if (error) {
    console.error("Error deleting user:", error)
    throw error
  }

  return true
}

// Аналитические функции
export async function getUsersByDepartment() {
  const users = await getUsers()
  const result: Record<string, number> = {}

  users.forEach((user) => {
    if (user.department) {
      if (!result[user.department]) {
        result[user.department] = 0
      }
      result[user.department]++
    }
  })

  return result
}

export async function getUsersByTeam() {
  const users = await getUsers()
  const result: Record<string, number> = {}

  users.forEach((user) => {
    if (user.team) {
      if (!result[user.team]) {
        result[user.team] = 0
      }
      result[user.team]++
    }
  })

  return result
}

export async function getUsersByCategory() {
  const users = await getUsers()
  const result: Record<string, number> = {}

  users.forEach((user) => {
    if (user.category) {
      if (!result[user.category]) {
        result[user.category] = 0
      }
      result[user.category]++
    }
  })

  return result
}

export async function getActiveUsersCount() {
  const users = await getUsers()
  return users.filter((user) => user.isActive).length
}

export async function getInactiveUsersCount() {
  const users = await getUsers()
  return users.filter((user) => !user.isActive).length
}

export async function getUsersJoinedByMonth() {
  const users = await getUsers()
  const result: Record<string, number> = {}
  const now = new Date()

  // Последние 12 месяцев
  for (let i = 0; i < 12; i++) {
    const date = new Date(now)
    date.setMonth(now.getMonth() - i)
    const monthYear = `${date.getMonth() + 1}/${date.getFullYear()}`
    result[monthYear] = 0
  }

  users.forEach((user) => {
    const joinDate = new Date(user.dateJoined)
    const monthYear = `${joinDate.getMonth() + 1}/${joinDate.getFullYear()}`
    if (result[monthYear] !== undefined) {
      result[monthYear]++
    }
  })

  return result
}

export async function getTopDepartments() {
  const departmentCounts = await getUsersByDepartment()
  return Object.entries(departmentCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }))
}

export async function getTopTeams() {
  const teamCounts = await getUsersByTeam()
  return Object.entries(teamCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }))
}

export async function getUsersByLocation() {
  const users = await getUsers()
  const result = {
    office: 0,
    remote: 0,
    hybrid: 0,
  }

  users.forEach((user) => {
    if (user.workLocation) {
      result[user.workLocation]++
    }
  })

  return result
}

// Добавим функцию проверки доступа к разделу оплаты
export async function checkPaymentAccess(): Promise<boolean> {
  try {
    // В реальном приложении здесь будет проверка прав доступа пользователя
    // Например, проверка роли пользователя в базе данных

    // Для демонстрации просто возвращаем true
    // В реальном приложении нужно реализовать проверку прав
    return true
  } catch (error) {
    console.error("Ошибка при проверке доступа к разделу оплаты:", error)
    return false
  }
}

import type { User, Department, Team, Position, Category, WorkFormatType } from "@/types/db"
import { createClient } from "@/utils/supabase/client"
// УДАЛЕНО: Legacy import getUserRoleAndPermissions - используем новую систему permissions

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
  console.log("=== getUsers function ===");
  const supabase = createClient();
  
  // Используем новое представление view_users для получения всех данных одним запросом
  const { data: users, error } = await supabase
    .from("view_users")
    .select("*")
    .order("last_name", { ascending: true })

  if (error) {
    console.error("Error fetching users from view:", error)
    return []
  }

  console.log("Получено пользователей из представления:", users?.length || 0);

  // Преобразуем данные из представления в формат User
  const formattedUsers = users?.map((user) => ({
    id: user.user_id,
    name: user.full_name || `${user.first_name || ""} ${user.last_name || ""}`.trim(),
    email: user.email || "",
    avatar_url: user.avatar_url || `/placeholder.svg?height=40&width=40&text=${user.first_name?.[0] || ""}${user.last_name?.[0] || ""}`,
    position: user.position_name || "",
    department: user.department_name || "",
    team: user.team_name || "",
    category: user.category_name || "",
    role: user.role_name || "",

    dateJoined: user.created_at,
    workLocation: mapWorkFormat(user.work_format),
    address: user.address || "",
    city: user.city_name || undefined,
    country: user.country_name || undefined,
    employmentRate: user.employment_rate !== null ? user.employment_rate : 1,
    salary: user.salary !== null ? user.salary : user.is_hourly ? 15 : 1500,
    isHourly: user.is_hourly !== null ? user.is_hourly : true,
  })) || []

  console.log("Обработано пользователей:", formattedUsers.length);
  return formattedUsers
}

// Получение всех отделов
export async function getDepartments(): Promise<Department[]> {
  const supabase = createClient();
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
  const supabase = createClient();
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
  const supabase = createClient();
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
  const supabase = createClient()
  const { data, error } = await supabase.from("categories").select("category_id, category_name")

  if (error) {
    console.error("Error fetching categories:", error)
    throw error
  }

  return data?.map((cat) => ({
    id: cat.category_id,
    name: cat.category_name || "",
  })) || []
}

/**
 * Получить все роли
 * @returns Promise<Role[]>
 */
export async function getRoles(): Promise<{ id: string; name: string; description?: string }[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("roles")
    .select("id, name, description")
    .order("name")

  if (error) {
    console.error("Error fetching roles:", error)
    throw error
  }

  return data || []
}

/**
 * Получить роли доступные для назначения пользователю
 * @param canAddAdmin - может ли пользователь назначать роль admin
 * @returns Promise<Role[]>
 */
export async function getAvailableRoles(canAddAdmin: boolean = false): Promise<{ id: string; name: string; description?: string }[]> {
  const roles = await getRoles()
  
  if (canAddAdmin) {
    return roles
  }
  
  // Исключаем роль admin если нет соответствующего разрешения
  return roles.filter(role => role.name !== 'admin')
}

// Обновление пользователя
export async function updateUser(
  userId: string,
  userData: Partial<Omit<User, "id" | "avatar_url" | "dateJoined">> & { firstName?: string; lastName?: string; roleId?: string },
) {
  console.log("=== updateUser function ===");
  console.log("updateUser вызван с данными:", { userId, userData });
  
  const supabase = createClient();
  const updates: any = {}

  if (userData.firstName !== undefined) {
    updates.first_name = userData.firstName
    console.log("Добавлено: first_name =", userData.firstName);
  }
  if (userData.lastName !== undefined) {
    updates.last_name = userData.lastName
    console.log("Добавлено: last_name =", userData.lastName);
  }

  if (userData.email) {
    updates.email = userData.email
    console.log("Добавлено: email =", userData.email);
  }

  // Найдем ID для связанных сущностей, если они изменились
  if (userData.department && userData.department.trim() !== "") {
    console.log("Ищем отдел:", userData.department);
    try {
      const { data: department, error: deptError } = await supabase
        .from("departments")
        .select("department_id")
        .eq("department_name", userData.department)
        .single()

      if (deptError) {
        console.error("Ошибка поиска отдела:", deptError);
      } else if (department) {
        updates.department_id = department.department_id
        console.log("Найден отдел, ID =", department.department_id);
      } else {
        console.warn("Отдел не найден:", userData.department);
      }
    } catch (error) {
      console.error("Ошибка при обработке отдела:", error);
    }
  }

  if (userData.team && userData.team.trim() !== "") {
    console.log("Ищем команду:", userData.team);
    try {
      const { data: team, error: teamError } = await supabase
        .from("teams")
        .select("team_id")
        .eq("team_name", userData.team)
        .single()

      if (teamError) {
        console.error("Ошибка поиска команды:", teamError);
      } else if (team) {
        updates.team_id = team.team_id
        console.log("Найдена команда, ID =", team.team_id);
      } else {
        console.warn("Команда не найдена:", userData.team);
      }
    } catch (error) {
      console.error("Ошибка при обработке команды:", error);
    }
  }

  if (userData.position && userData.position.trim() !== "") {
    console.log("Ищем должность:", userData.position);
    try {
      const { data: position, error: posError } = await supabase
        .from("positions")
        .select("position_id")
        .eq("position_name", userData.position)
        .single()

      if (posError) {
        console.error("Ошибка поиска должности:", posError);
      } else if (position) {
        updates.position_id = position.position_id
        console.log("Найдена должность, ID =", position.position_id);
      } else {
        console.warn("Должность не найдена:", userData.position);
      }
    } catch (error) {
      console.error("Ошибка при обработке должности:", error);
    }
  }

  if (userData.category && userData.category.trim() !== "") {
    console.log("Ищем категорию:", userData.category);
    try {
      const { data: category, error: catError } = await supabase
        .from("categories")
        .select("category_id")
        .eq("category_name", userData.category)
        .single()

      if (catError) {
        console.error("Ошибка поиска категории:", catError);
      } else if (category) {
        updates.category_id = category.category_id
        console.log("Найдена категория, ID =", category.category_id);
      } else {
        console.warn("Категория не найдена:", userData.category);
      }
    } catch (error) {
      console.error("Ошибка при обработке категории:", error);
    }
  }

  if (userData.workLocation) {
    updates.work_format = mapWorkFormatToDb(userData.workLocation)
    console.log("Добавлено: work_format =", updates.work_format);
  }

  if (userData.address !== undefined) {
    updates.address = userData.address
    console.log("Добавлено: address =", userData.address);
  }

  // Обработка страны/города -> profiles.city_id
  if (userData.country !== undefined || userData.city !== undefined) {
    const countryName = typeof userData.country === 'string' ? userData.country.trim() : ''
    const cityName = typeof userData.city === 'string' ? userData.city.trim() : ''

    if (!countryName && !cityName) {
      // Сброс города
      updates.city_id = null
      console.log("Добавлено: city_id = null (очистка)");
    } else if (countryName && cityName) {
      try {
        // Гарантируем наличие country/city и получаем city_id через наш API апсерт
        const resp = await fetch('/api/geo/upsert', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ countryName, cityName })
        })
        if (resp.ok) {
          const { cityId } = await resp.json()
          updates.city_id = cityId
          console.log("Добавлено: city_id =", cityId)
        } else {
          console.warn('Не удалось апсертить страну/город через API:', await resp.text())
        }
      } catch (error) {
        console.error('Ошибка вызова /api/geo/upsert:', error)
      }
    } else {
      console.warn("Для установки города требуются и страна, и город. Передано:", { countryName, cityName })
    }
  }

  if (userData.employmentRate !== undefined) {
    updates.employment_rate = userData.employmentRate
    console.log("Добавлено: employment_rate =", userData.employmentRate);
  }

  if (userData.salary !== undefined) {
    updates.salary = userData.salary
    console.log("Добавлено: salary =", userData.salary);
  }

  if (userData.isHourly !== undefined) {
    updates.is_hourly = userData.isHourly
    console.log("Добавлено: is_hourly =", userData.isHourly);
  }



  // Обновляем роль пользователя прямо в profiles, если она была передана
  if (userData.roleId !== undefined) {
    updates.role_id = userData.roleId || null
    console.log("Добавлено: role_id =", userData.roleId);
  }

  console.log("Итоговые обновления для БД:", updates);

  // Проверяем, что есть что обновлять
  if (Object.keys(updates).length === 0) {
    console.log("Нет данных для обновления");
    return true;
  }

  // Обновляем профиль пользователя
  console.log("Выполняем обновление в БД для пользователя:", userId);
  const { error } = await supabase.from("profiles").update(updates).eq("user_id", userId)

  if (error) {
    console.error("Error updating user:", error)
    throw new Error(`Ошибка обновления профиля: ${error.message || JSON.stringify(error)}`)
  }

  console.log("Пользователь успешно обновлен в БД");
  return true
}

// Удаление пользователя
export async function deleteUser(userId: string) {
  const supabase = createClient();
  const { error } = await supabase.from("profiles").delete().eq("user_id", userId)

  if (error) {
    console.error("Error deleting user:", error)
    throw error
  }

  return true
}

// Получение пользователей по отделам для аналитики
export async function getUsersByDepartment() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("departments")
    .select(
      `
      department_name,
      profiles!profiles_department_membership_fkey!inner (
        user_id
      )
    `,
    )
    .order("department_name")

  if (error) {
    console.error("Error fetching users by department:", error)
    return []
  }

  return data.map((dept) => ({
    name: dept.department_name,
    value: Array.isArray(dept.profiles) ? dept.profiles.length : 0,
  }))
}

// Получение пользователей по командам для аналитики
export async function getUsersByTeam() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("teams")
    .select(
      `
      team_name,
      profiles!inner (
        user_id
      )
    `,
    )
    .order("team_name")

  if (error) {
    console.error("Error fetching users by team:", error)
    return []
  }

  return data.map((team) => ({
    name: team.team_name,
    value: Array.isArray(team.profiles) ? team.profiles.length : 0,
  }))
}

// Получение пользователей по категориям для аналитики
export async function getUsersByCategory() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("categories")
    .select(
      `
      category_name,
      profiles!inner (
        user_id
      )
    `,
    )
    .order("category_name")

  if (error) {
    console.error("Error fetching users by category:", error)
    return []
  }

  return data.map((cat) => ({
    name: cat.category_name,
    value: Array.isArray(cat.profiles) ? cat.profiles.length : 0,
  }))
}

// Получение количества активных пользователей
export async function getActiveUsersCount() {
  const supabase = createClient();
  const { count, error } = await supabase.from("profiles").select("*", { count: "exact" })

  return error ? 0 : count || 0
}

// Получение количества неактивных пользователей (пока всегда 0)
export async function getInactiveUsersCount() {
  return 0
}

// Получение статистики по присоединению пользователей по месяцам
export async function getUsersJoinedByMonth() {
  const supabase = createClient();
  const { data, error } = await supabase.from("profiles").select("created_at").order("created_at")

  if (error) {
    console.error("Error fetching users join dates:", error)
    return []
  }

  const months: Record<string, number> = {}
  const monthNames = ["Янв", "Фев", "Мар", "Апр", "Май", "Июн", "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"]

  data.forEach((user) => {
    if (!user.created_at) return

    const date = new Date(user.created_at)
    const monthYear = `${monthNames[date.getMonth()]} ${date.getFullYear()}`

    if (!months[monthYear]) {
      months[monthYear] = 0
    }
    months[monthYear]++
  })

  return Object.entries(months).map(([name, value]) => ({ name, value }))
}

// Получение топ-отделов по количеству пользователей
export async function getTopDepartments() {
  return getUsersByDepartment()
}

// Получение топ-команд по количеству пользователей
export async function getTopTeams() {
  return getUsersByTeam()
}

// Получение распределения пользователей по местоположению работы
export async function getUsersByLocation() {
  const supabase = createClient();
  const { data, error } = await supabase.from("profiles").select("work_format")

  if (error) {
    console.error("Error fetching users by location:", error)
    return []
  }

  const locations: Record<string, number> = {
    "В офисе": 0,
    Удаленно: 0,
    Гибридный: 0,
  }

  data.forEach((user) => {
    if (user.work_format) {
      locations[user.work_format]++
    } else {
      locations["В офисе"]++
    }
  })

  return [
    { name: "Офис", value: locations["В офисе"] },
    { name: "Удаленно", value: locations["Удаленно"] },
    { name: "Гибрид", value: locations["Гибридный"] },
  ]
}

/**
 * Проверка доступа к платежному функционалу
 * @returns {Promise<boolean>}
 */
export async function checkPaymentAccess(): Promise<boolean> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase.from("payment_settings").select("is_enabled").single()

    if (error || !data) {
      console.error("Ошибка при проверке доступа к платежам:", error)
      return false
    }

    return data.is_enabled || false
  } catch (error) {
    console.error("Непредвиденная ошибка при проверке доступа к платежам:", error)
    return false
  }
}



// УДАЛЕНО: Legacy функции getUserPermissionsOptimized и syncCurrentUserState
// Теперь разрешения управляются через модуль permissions автоматически

import type { User, Department, Team, Position, Category, WorkFormatType } from "@/types/db"
import { createClient } from "@/utils/supabase/client"

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
  const supabase = createClient();
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
      avatar_url,
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
      avatar_url: profile.avatar_url || `/placeholder.svg?height=40&width=40&text=${profile.first_name?.[0] || ""}${profile.last_name?.[0] || ""}`,
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
  const supabase = createClient();
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
  userData: Partial<Omit<User, "id" | "avatar_url" | "dateJoined" | "isActive">> & { firstName?: string; lastName?: string },
) {
  const supabase = createClient();
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

  if (userData.address !== undefined) {
    updates.address = userData.address
  }

  if (userData.employmentRate !== undefined) {
    updates.employment_rate = userData.employmentRate
  }

  if (userData.salary !== undefined) {
    updates.salary = userData.salary
  }

  if (userData.isHourly !== undefined) {
    updates.is_hourly = userData.isHourly
  }

  const { error } = await supabase.from("profiles").update(updates).eq("user_id", userId)

  if (error) {
    console.error("Error updating user:", error)
    throw error
  }

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
      profiles!inner (
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
  return 0 // В будущем можно реализовать логику с флагом is_active
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

/**
 * Получить роль и разрешения пользователя по userId
 * @param userId string
 * @param supabaseClient - опциональный экземпляр клиента Supabase
 * @returns { role: string | null, permissions: string[] }
 */
export async function getUserRoleAndPermissions(userId: string, supabaseClient?: any) {
  console.log("getUserRoleAndPermissions вызвана с userId (обновленная версия):", userId);
  
  try {
    // Используем переданный клиент Supabase или создаем новый
    const supabase = supabaseClient || createClient();
    console.log("Используем экземпляр Supabase клиента:", supabaseClient ? "переданный" : "созданный внутри функции");
    
    // Шаг 1: Получаем запись из user_roles для пользователя
    const { data: userRoles, error: userRolesError } = await supabase
      .from("user_roles")
      .select("role_id")
      .eq("user_id", userId);
    
    console.log("Запрос user_roles завершен:", { userRoles, userRolesError });
    
    if (userRolesError) {
      console.error("Ошибка при получении ролей пользователя:", userRolesError);
      return { role: null, permissions: [] };
    }
    
    if (!userRoles || userRoles.length === 0) {
      console.warn("Роли для пользователя не найдены:", userId);
      return { role: null, permissions: [] };
    }
    
    const roleId = userRoles[0].role_id;
    console.log("Найден role_id:", roleId);
    
    // Проверим структуру таблицы roles
    console.log("Выполняем запрос к таблице roles с id =", roleId);
    
    // Шаг 2: Получаем имя роли из таблицы roles
    const { data: roleData, error: roleError } = await supabase
      .from("roles")
      .select("name, description")
      .eq("id", roleId)
      .single();
    
    console.log("Запрос roles завершен:", { roleData, roleError });
    
    if (roleError) {
      console.error("Ошибка при получении информации о роли:", roleError);
      return { role: null, permissions: [] };
    }
    
    // Шаг 3: Получаем разрешения для роли
    const { data: rolePermissions, error: permissionsError } = await supabase
      .from("role_permissions")
      .select("permission_id")
      .eq("role_id", roleId);
    
    console.log("Запрос role_permissions завершен:", { rolePermissions, permissionsError });
    
    if (permissionsError) {
      console.error("Ошибка при получении разрешений для роли:", permissionsError);
      return { role: roleData.name, permissions: [] };
    }
    
    if (!rolePermissions || rolePermissions.length === 0) {
      console.warn("Разрешения для роли не найдены:", roleId);
      return { role: roleData.name, permissions: [] };
    }
    
    // Получаем имена разрешений из таблицы permissions
    const permissionIds = rolePermissions.map((p: { permission_id: string }) => p.permission_id);
    const { data: permissions, error: permNameError } = await supabase
      .from("permissions")
      .select("name")
      .in("id", permissionIds);
    
    console.log("Запрос permissions завершен:", { permissions, permNameError });
    
    if (permNameError) {
      console.error("Ошибка при получении имен разрешений:", permNameError);
      return { role: roleData.name, permissions: [] };
    }
    
    const permissionNames = permissions ? permissions.map((p: { name: string }) => p.name) : [];
    
    console.log("Возвращаемые данные:", { role: roleData.name, permissions: permissionNames });
    return { role: roleData.name, permissions: permissionNames };
  } catch (error) {
    console.error("Непредвиденная ошибка в getUserRoleAndPermissions:", error);
    return { role: null, permissions: [] };
  }
}

// Функция для принудительной синхронизации текущего пользователя из Supabase в Zustand
export async function syncCurrentUserState() {
  try {
    const supabase = createClient();
    
    // Получаем текущего пользователя из Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.getUser();
    
    if (authError || !authData.user) {
      console.error("Ошибка при получении пользователя из Auth:", authError);
      return false;
    }
    
    const userId = authData.user.id;
    
    // Получаем профиль пользователя из БД
    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", userId)
      .single();
    
    if (profileError) {
      console.error("Ошибка при получении профиля:", profileError);
      return false;
    }
    
    // Получаем роль и разрешения
    const { role, permissions } = await getUserRoleAndPermissions(userId);
    
    // Импортируем useUserStore динамически, чтобы избежать циклических зависимостей
    const { useUserStore } = await import("@/stores/useUserStore");
    
    // Обновляем состояние в Zustand
    useUserStore.getState().setUser({
      id: userId,
      email: authData.user.email || "",
      name: profileData 
        ? [profileData.first_name || "", profileData.last_name || ""].filter(Boolean).join(" ") 
        : authData.user.user_metadata?.name || "Пользователь",
      profile: profileData 
        ? {
            firstName: profileData.first_name,
            lastName: profileData.last_name,
            departmentId: profileData.department_id,
            teamId: profileData.team_id,
            positionId: profileData.position_id,
            categoryId: profileData.category_id,
            workFormat: profileData.work_format,
            salary: profileData.salary,
            isHourly: profileData.is_hourly,
            employmentRate: profileData.employment_rate,
            address: profileData.address,
            roleId: profileData.role_id,
            avatar_url: profileData.avatar_url
          } 
        : null
    });
    
    // Устанавливаем роль и разрешения
    if (role) {
      useUserStore.getState().setRoleAndPermissions(role, permissions);
    }
    
    console.log("Состояние пользователя успешно синхронизировано из Supabase");
    return true;
    
  } catch (error) {
    console.error("Ошибка при синхронизации состояния пользователя:", error);
    return false;
  }
}

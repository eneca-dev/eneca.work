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
  console.log("=== getUsers function ===");
  const supabase = createClient();
  
  // Получаем профили пользователей
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
      departments!profiles_department_membership_fkey(department_id, department_name),
      teams(team_id, team_name),
      positions(position_id, position_name),
      categories(category_id, category_name)
    `)

  if (error) {
    console.error("Error fetching users:", error)
    return []
  }

  console.log("Получено профилей из БД:", profiles?.length || 0);

  // Получаем все роли отдельным запросом
  const { data: rolesData, error: rolesError } = await supabase
    .from("roles")
    .select("id, name")
  
  if (rolesError) {
    console.error("Error fetching roles:", rolesError)
  }

  console.log("Получено ролей из БД:", rolesData?.length || 0);

  // Создаем карту ролей для быстрого поиска
  const rolesMap = new Map<string, string>()
  if (rolesData) {
    rolesData.forEach((role) => {
      rolesMap.set(role.id, role.name)
    })
  }

  const users = profiles.map((profile) => {
    const department = profile.departments as unknown as { department_name: string } | null
    const team = profile.teams as unknown as { team_name: string } | null
    const position = profile.positions as unknown as { position_name: string } | null
    const category = profile.categories as unknown as { category_name: string } | null
    
    // Получаем имя роли по role_id
    const roleName = profile.role_id ? rolesMap.get(profile.role_id) : ""

    return {
      id: profile.user_id,
      name: `${profile.first_name || ""} ${profile.last_name || ""}`.trim(),
      email: profile.email || "",
      avatar_url: profile.avatar_url || `/placeholder.svg?height=40&width=40&text=${profile.first_name?.[0] || ""}${profile.last_name?.[0] || ""}`,
      position: position?.position_name || "",
      department: department?.department_name || "",
      team: team?.team_name || "",
      category: category?.category_name || "",
      role: roleName || "",
      isActive: true, // Предполагаем, что все пользователи активны
      dateJoined: profile.created_at,
      workLocation: mapWorkFormat(profile.work_format),
      address: profile.address || "",
      employmentRate: profile.employment_rate !== null ? profile.employment_rate : 1,
      salary: profile.salary !== null ? profile.salary : profile.is_hourly ? 15 : 1500, // Разумные значения по умолчанию
      isHourly: profile.is_hourly !== null ? profile.is_hourly : true,
    }
  })

  console.log("Обработано пользователей:", users.length);
  return users
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

  // Добавляем обработку поля isActive
  // ВРЕМЕННО ОТКЛЮЧЕНО: колонка is_active отсутствует в таблице profiles
  // TODO: Добавить колонку is_active в таблицу profiles через миграцию
  // if (userData.isActive !== undefined) {
  //   updates.is_active = userData.isActive
  //   console.log("Добавлено: is_active =", userData.isActive);
  // }

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
 * Получить roleId и разрешения пользователя по userId (ИСПРАВЛЕННАЯ ВЕРСИЯ)
 * @param userId string
 * @param supabaseClient - опциональный экземпляр клиента Supabase
 * @returns { roleId: string | null, permissions: string[] }
 */
export async function getUserRoleAndPermissions(userId: string, supabaseClient?: any) {
  console.log("getUserRoleAndPermissions вызвана с userId:", userId);
  
  try {
    const supabase = supabaseClient || createClient();
    
    // Получаем roleId из profiles
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role_id")
      .eq("user_id", userId)
      .single();
    
    if (profileError || !profile?.role_id) {
      console.error("Ошибка при получении профиля:", profileError);
      return { roleId: null, permissions: [] };
    }
    
    const roleId = profile.role_id;
    
    // Получаем разрешения для роли
    const { data: rolePermissions, error: permissionsError } = await supabase
      .from("role_permissions")
      .select(`
        permissions(name)
      `)
      .eq("role_id", roleId);
    
    if (permissionsError) {
      console.error("Ошибка при получении разрешений:", permissionsError);
      return { roleId, permissions: [] };
    }
    
    const permissions = rolePermissions
      ?.map((rp: any) => rp.permissions?.name)
      .filter(Boolean) || [];
    
    console.log("Возвращаемые данные:", { roleId, permissions });
    return { roleId, permissions };
    
  } catch (error) {
    console.error("Непредвиденная ошибка в getUserRoleAndPermissions:", error);
    return { roleId: null, permissions: [] };
  }
}

/**
 * ОПТИМИЗИРОВАННАЯ функция получения разрешений
 * Использует Zustand если доступен, иначе обращается к БД
 * @param userId string - нужен только если нет данных в Zustand
 * @param forceFromDB boolean - принудительно получить из БД
 * @returns { roleId: string | null, permissions: string[] }
 */
export async function getUserPermissionsOptimized(userId?: string, forceFromDB: boolean = false) {
  try {
    // Если не требуется принудительное обращение к БД, пытаемся использовать Zustand
    if (!forceFromDB) {
      // Динамически импортируем useUserStore чтобы избежать циклических зависимостей
      const { useUserStore } = await import("@/stores/useUserStore");
      const userState = useUserStore.getState();
      
      // Если в Zustand есть актуальные данные о разрешениях
      if (userState.isAuthenticated && userState.permissions && userState.profile?.roleId) {
        console.log("Используем данные из Zustand:", {
          roleId: userState.profile.roleId,
          permissions: userState.permissions
        });
        
        return {
          roleId: userState.profile.roleId,
          permissions: userState.permissions
        };
      }
    }
    
    // Если нет данных в Zustand или требуется обращение к БД
    if (userId) {
      console.log("Получаем данные из БД для userId:", userId);
      return await getUserRoleAndPermissions(userId);
    }
    
    console.warn("Нет userId для обращения к БД и нет данных в Zustand");
    return { roleId: null, permissions: [] };
    
  } catch (error) {
    console.error("Ошибка в getUserPermissionsOptimized:", error);
    return { roleId: null, permissions: [] };
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
    const { roleId, permissions } = await getUserRoleAndPermissions(userId);
    
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
    if (roleId) {
      useUserStore.getState().setRoleAndPermissions(roleId, permissions);
    }
    
    console.log("Состояние пользователя успешно синхронизировано из Supabase");
    return true;
    
  } catch (error) {
    console.error("Ошибка при синхронизации состояния пользователя:", error);
    return false;
  }
}

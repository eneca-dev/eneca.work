import type { User, Department, Team, Position, Category, WorkFormatType } from "@/types/db"
import { createClient } from "@/utils/supabase/client"
import { createAdminClient } from "@/utils/supabase/admin"
import * as Sentry from "@sentry/nextjs"

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
  return Sentry.startSpan(
    {
      op: "db.query",
      name: "Получение всех пользователей организации",
    },
    async (span: any) => {
      try {
        console.log("=== getUsers function ===");
        const supabase = createClient();
        
        span.setAttribute("table", "view_users")
        span.setAttribute("operation", "select_all_users")
        
        // Используем новое представление view_users для получения всех данных одним запросом
        const { data: users, error } = await supabase
          .from("view_users")
          .select("*")
          .order("last_name", { ascending: true })

        if (error) {
          span.setAttribute("db.success", false)
          span.setAttribute("db.error", error.message)
          
          Sentry.captureException(error, {
            tags: {
              module: 'org_data_service',
              action: 'get_users',
              table: 'view_users'
            },
            extra: {
              error_code: error.code,
              error_details: error.details,
              error_hint: error.hint,
              timestamp: new Date().toISOString()
            }
          })
          return []
        }

        span.setAttribute("db.success", true)
        span.setAttribute("users.count", users?.length || 0)
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
          isActive: user.is_active || true,
          dateJoined: user.created_at,
          workLocation: mapWorkFormat(user.work_format),
          country: user.country_name || "",
          city: user.city_name || "",
          employmentRate: user.employment_rate !== null ? user.employment_rate : 1,
          salary: user.salary !== null ? user.salary : user.is_hourly ? 15 : 1500,
          isHourly: user.is_hourly !== null ? user.is_hourly : true,
        })) || []

        span.setAttribute("users.processed", formattedUsers.length)
        console.log("Обработано пользователей:", formattedUsers.length);
        return formattedUsers

      } catch (error) {
        span.setAttribute("error", true)
        span.setAttribute("error.message", (error as Error).message)
        
        Sentry.captureException(error, {
          tags: {
            module: 'org_data_service',
            action: 'get_users',
            error_type: 'processing_error'
          },
          extra: {
            error_message: (error as Error).message,
            timestamp: new Date().toISOString()
          }
        })
        return []
      }
    }
  )
}

// Получение всех отделов
export async function getDepartments(): Promise<Department[]> {
  return Sentry.startSpan(
    {
      op: "db.query",
      name: "Получение всех отделов",
    },
    async (span: any) => {
      try {
        const supabase = createClient();
        span.setAttribute("table", "departments")
        
        const { data, error } = await supabase.from("departments").select("department_id, department_name")

        if (error) {
          span.setAttribute("db.success", false)
          Sentry.captureException(error, {
            tags: {
              module: 'org_data_service',
              action: 'get_departments',
              table: 'departments'
            },
            extra: {
              error_code: error.code,
              error_details: error.details,
              timestamp: new Date().toISOString()
            }
          })
          return []
        }

        span.setAttribute("db.success", true)
        span.setAttribute("departments.count", data?.length || 0)
        
        return data.map((dept) => ({
          id: dept.department_id,
          name: dept.department_name || "",
        }))
      } catch (error) {
        span.setAttribute("error", true)
        Sentry.captureException(error, {
          tags: {
            module: 'org_data_service',
            action: 'get_departments',
            error_type: 'processing_error'
          },
          extra: {
            error_message: (error as Error).message,
            timestamp: new Date().toISOString()
          }
        })
        return []
      }
    }
  )
}

// Получение всех команд
export async function getTeams(): Promise<Team[]> {
  return Sentry.startSpan(
    {
      op: "db.query",
      name: "Получение всех команд",
    },
    async (span: any) => {
      try {
        const supabase = createClient();
        span.setAttribute("table", "teams")
        
        const { data, error } = await supabase.from("teams").select("team_id, team_name, department_id")

        if (error) {
          span.setAttribute("db.success", false)
          Sentry.captureException(error, {
            tags: {
              module: 'org_data_service',
              action: 'get_teams',
              table: 'teams'
            },
            extra: {
              error_code: error.code,
              error_details: error.details,
              timestamp: new Date().toISOString()
            }
          })
          return []
        }

        span.setAttribute("db.success", true)
        span.setAttribute("teams.count", data?.length || 0)
        
        return data.map((team) => ({
          id: team.team_id,
          name: team.team_name || "",
          departmentId: team.department_id || "",
        }))
      } catch (error) {
        span.setAttribute("error", true)
        Sentry.captureException(error, {
          tags: {
            module: 'org_data_service',
            action: 'get_teams',
            error_type: 'processing_error'
          },
          extra: {
            error_message: (error as Error).message,
            timestamp: new Date().toISOString()
          }
        })
        return []
      }
    }
  )
}

// Получение всех должностей
export async function getPositions(): Promise<Position[]> {
  return Sentry.startSpan(
    {
      op: "db.query",
      name: "Получение всех должностей",
    },
    async (span: any) => {
      try {
        const supabase = createClient();
        span.setAttribute("table", "positions")
        
        const { data, error } = await supabase.from("positions").select("position_id, position_name")

        if (error) {
          span.setAttribute("db.success", false)
          Sentry.captureException(error, {
            tags: {
              module: 'org_data_service',
              action: 'get_positions',
              table: 'positions'
            },
            extra: {
              error_code: error.code,
              error_details: error.details,
              timestamp: new Date().toISOString()
            }
          })
          return []
        }

        span.setAttribute("db.success", true)
        span.setAttribute("positions.count", data?.length || 0)
        
        return data.map((pos) => ({
          id: pos.position_id,
          name: pos.position_name || "",
        }))
      } catch (error) {
        span.setAttribute("error", true)
        Sentry.captureException(error, {
          tags: {
            module: 'org_data_service',
            action: 'get_positions',
            error_type: 'processing_error'
          },
          extra: {
            error_message: (error as Error).message,
            timestamp: new Date().toISOString()
          }
        })
        return []
      }
    }
  )
}

// Получение всех категорий
export async function getCategories(): Promise<Category[]> {
  return Sentry.startSpan(
    {
      op: "db.query",
      name: "Получение всех категорий",
    },
    async (span: any) => {
      try {
        const supabase = createClient()
        span.setAttribute("table", "categories")
        
        const { data, error } = await supabase.from("categories").select("category_id, category_name")

        if (error) {
          span.setAttribute("db.success", false)
          Sentry.captureException(error, {
            tags: {
              module: 'org_data_service',
              action: 'get_categories',
              table: 'categories'
            },
            extra: {
              error_code: error.code,
              error_details: error.details,
              timestamp: new Date().toISOString()
            }
          })
          throw error
        }

        span.setAttribute("db.success", true)
        span.setAttribute("categories.count", data?.length || 0)
        
        return data?.map((cat) => ({
          id: cat.category_id,
          name: cat.category_name || "",
        })) || []
      } catch (error) {
        span.setAttribute("error", true)
        Sentry.captureException(error, {
          tags: {
            module: 'org_data_service',
            action: 'get_categories',
            error_type: 'processing_error'
          },
          extra: {
            error_message: (error as Error).message,
            timestamp: new Date().toISOString()
          }
        })
        throw error
      }
    }
  )
}

/**
 * Получить все роли
 * @returns Promise<Role[]>
 */
export async function getRoles(): Promise<{ id: string; name: string; description?: string }[]> {
  return Sentry.startSpan(
    {
      op: "db.query",
      name: "Получение всех ролей",
    },
    async (span: any) => {
      try {
        const supabase = createClient()
        span.setAttribute("table", "roles")
        
        const { data, error } = await supabase
          .from("roles")
          .select("id, name, description")
          .order("name")

        if (error) {
          span.setAttribute("db.success", false)
          Sentry.captureException(error, {
            tags: {
              module: 'org_data_service',
              action: 'get_roles',
              table: 'roles'
            },
            extra: {
              error_code: error.code,
              error_details: error.details,
              timestamp: new Date().toISOString()
            }
          })
          throw error
        }

        span.setAttribute("db.success", true)
        span.setAttribute("roles.count", data?.length || 0)
        
        return data || []
      } catch (error) {
        span.setAttribute("error", true)
        Sentry.captureException(error, {
          tags: {
            module: 'org_data_service',
            action: 'get_roles',
            error_type: 'processing_error'
          },
          extra: {
            error_message: (error as Error).message,
            timestamp: new Date().toISOString()
          }
        })
        throw error
      }
    }
  )
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
  return Sentry.startSpan(
    {
      op: "db.update",
      name: "Обновление данных пользователя",
    },
    async (span: any) => {
      try {
        console.log("=== updateUser function ===");
        console.log("updateUser вызван с данными:", { userId, userData });
        
        span.setAttribute("user.id", userId)
        span.setAttribute("table", "profiles")
        span.setAttribute("operation", "update_user")
        
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
        Sentry.captureException(deptError, {
          tags: {
            module: 'org_data_service',
            action: 'update_user_find_department',
            user_id: userId
          },
          extra: {
            department_name: userData.department,
            error_code: deptError.code,
            error_details: deptError.details,
            timestamp: new Date().toISOString()
          }
        })
      } else if (department) {
        updates.department_id = department.department_id
        console.log("Найден отдел, ID =", department.department_id);
      } else {
        console.warn("Отдел не найден:", userData.department);
      }
    } catch (error) {
      Sentry.captureException(error, {
        tags: {
          module: 'org_data_service',
          action: 'update_user_process_department',
          user_id: userId
        },
        extra: {
          department_name: userData.department,
          error_message: (error as Error).message,
          timestamp: new Date().toISOString()
        }
      })
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
        Sentry.captureException(teamError, {
          tags: {
            module: 'org_data_service',
            action: 'update_user_find_team',
            user_id: userId
          },
          extra: {
            team_name: userData.team,
            error_code: teamError.code,
            error_details: teamError.details,
            timestamp: new Date().toISOString()
          }
        })
      } else if (team) {
        updates.team_id = team.team_id
        console.log("Найдена команда, ID =", team.team_id);
      } else {
        console.warn("Команда не найдена:", userData.team);
      }
    } catch (error) {
      Sentry.captureException(error, {
        tags: {
          module: 'org_data_service',
          action: 'update_user_process_team',
          user_id: userId
        },
        extra: {
          team_name: userData.team,
          error_message: (error as Error).message,
          timestamp: new Date().toISOString()
        }
      })
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
        Sentry.captureException(posError, {
          tags: {
            module: 'org_data_service',
            action: 'update_user_find_position',
            user_id: userId
          },
          extra: {
            position_name: userData.position,
            error_code: posError.code,
            error_details: posError.details,
            timestamp: new Date().toISOString()
          }
        })
      } else if (position) {
        updates.position_id = position.position_id
        console.log("Найдена должность, ID =", position.position_id);
      } else {
        console.warn("Должность не найдена:", userData.position);
      }
    } catch (error) {
      Sentry.captureException(error, {
        tags: {
          module: 'org_data_service',
          action: 'update_user_process_position',
          user_id: userId
        },
        extra: {
          position_name: userData.position,
          error_message: (error as Error).message,
          timestamp: new Date().toISOString()
        }
      })
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
        Sentry.captureException(catError, {
          tags: {
            module: 'org_data_service',
            action: 'update_user_find_category',
            user_id: userId
          },
          extra: {
            category_name: userData.category,
            error_code: catError.code,
            error_details: catError.details,
            timestamp: new Date().toISOString()
          }
        })
      } else if (category) {
        updates.category_id = category.category_id
        console.log("Найдена категория, ID =", category.category_id);
      } else {
        console.warn("Категория не найдена:", userData.category);
      }
    } catch (error) {
      Sentry.captureException(error, {
        tags: {
          module: 'org_data_service',
          action: 'update_user_process_category',
          user_id: userId
        },
        extra: {
          category_name: userData.category,
          error_message: (error as Error).message,
          timestamp: new Date().toISOString()
        }
      })
    }
  }

  if (userData.workLocation) {
    updates.work_format = mapWorkFormatToDb(userData.workLocation)
    console.log("Добавлено: work_format =", updates.work_format);
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
        span.setAttribute("updates.count", Object.keys(updates).length)
        
        const { error } = await supabase.from("profiles").update(updates).eq("user_id", userId)

        if (error) {
          span.setAttribute("db.success", false)
          span.setAttribute("db.error", error.message)
          
          const updateError = new Error(`Ошибка обновления профиля: ${error.message || JSON.stringify(error)}`)
          Sentry.captureException(updateError, {
            tags: {
              module: 'org_data_service',
              action: 'update_user_db',
              user_id: userId,
              critical: true
            },
            extra: {
              updates: JSON.stringify(updates),
              error_code: error.code,
              error_details: error.details,
              error_hint: error.hint,
              timestamp: new Date().toISOString()
            }
          })
          throw updateError
        }

        span.setAttribute("db.success", true)
        console.log("Пользователь успешно обновлен в БД");
        return true
        
      } catch (error) {
        span.setAttribute("error", true)
        span.setAttribute("error.message", (error as Error).message)
        
        Sentry.captureException(error, {
          tags: {
            module: 'org_data_service',
            action: 'update_user',
            user_id: userId,
            error_type: 'critical_update_error'
          },
          extra: {
            user_data: JSON.stringify(userData),
            error_message: (error as Error).message,
            timestamp: new Date().toISOString()
          }
        })
        throw error
      }
    }
  )
}

// Создание нового пользователя
export async function createUser(userData: {
  email: string
  password: string
  firstName: string
  lastName: string
  department?: string
  team?: string
  position?: string
  category?: string
  roleId?: string
  workLocation?: "office" | "remote" | "hybrid"
  country?: string
  city?: string
}) {
  return Sentry.startSpan(
    {
      op: "db.create",
      name: "Создание нового пользователя",
    },
    async (span: any) => {
      try {
        console.log("=== createUser function ===")
        console.log("createUser вызван с данными:", userData)
        
        span.setAttribute("user.email", userData.email)
        span.setAttribute("operation", "create_user")
        
        const supabase = createClient()
        const adminClient = createAdminClient()
        
        // 1. Создаем пользователя в auth.users через Admin API
        const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
          email: userData.email,
          password: userData.password,
          email_confirm: true // Автоматически подтверждаем email
        })

        if (authError || !authData.user) {
          console.error("Ошибка создания пользователя в auth:", authError)
          span.setAttribute("auth.success", false)
          span.setAttribute("auth.error", authError?.message || "Unknown auth error")
          
          Sentry.captureException(authError, {
            tags: {
              module: 'org_data_service',
              action: 'create_user',
              step: 'auth_creation'
            },
            extra: {
              email: userData.email,
              error_code: authError?.code,
              error_message: authError?.message,
              timestamp: new Date().toISOString()
            }
          })
          throw new Error(`Не удалось создать пользователя: ${authError?.message || 'Неизвестная ошибка'}`)
        }

        span.setAttribute("auth.success", true)
        span.setAttribute("user.id", authData.user.id)
        console.log("Пользователь создан в auth.users:", authData.user.id)

        // 2. Подготавливаем данные для профиля
        const profileData: any = {
          user_id: authData.user.id,
          first_name: userData.firstName,
          last_name: userData.lastName,
          email: userData.email,
          work_format: mapWorkFormatToDb(userData.workLocation || "office"),
          employment_rate: 1,
          salary: 0,
          is_hourly: true,
        }

        // Обработка страны/города
        if (userData.country && userData.city) {
          try {
            // Гарантируем наличие country/city и получаем city_id через наш API апсерт
            const resp = await fetch('/api/geo/upsert', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ countryName: userData.country, cityName: userData.city })
            })
            if (resp.ok) {
              const { cityId } = await resp.json()
              profileData.city_id = cityId
              console.log("Добавлено: city_id =", cityId)
            } else {
              console.warn('Не удалось апсертить страну/город через API:', await resp.text())
            }
          } catch (error) {
            console.error('Ошибка вызова /api/geo/upsert:', error)
          }
        }

        // 3. Найдем ID для связанных сущностей
        if (userData.department) {
          const department = await supabase
            .from("departments")
            .select("department_id")
            .eq("department_name", userData.department)
            .single()
          
          if (department.data) {
            profileData.department_id = department.data.department_id
          } else {
            console.warn("Отдел не найден:", userData.department)
          }
        }

        if (userData.team) {
          // userData.team содержит ID команды, а не название
          profileData.team_id = userData.team
        }

        if (userData.position) {
          const position = await supabase
            .from("positions")
            .select("position_id")
            .eq("position_name", userData.position)
            .single()
          
          if (position.data) {
            profileData.position_id = position.data.position_id
          } else {
            console.warn("Должность не найдена:", userData.position)
          }
        }

        if (userData.category) {
          const category = await supabase
            .from("categories")
            .select("category_id")
            .eq("category_name", userData.category)
            .single()
          
          if (category.data) {
            profileData.category_id = category.data.category_id
          } else {
            console.warn("Категория не найдена:", userData.category)
          }
        }

        if (userData.roleId) {
          profileData.role_id = userData.roleId
        } else {
          // Назначаем роль "user" по умолчанию
          const defaultRole = await supabase
            .from("roles")
            .select("id")
            .eq("name", "user")
            .single()
          
          if (defaultRole.data) {
            profileData.role_id = defaultRole.data.id
          }
        }

        // Если какие-то обязательные поля не заполнены, используем значения по умолчанию
        if (!profileData.department_id) {
          // Ищем отдел "Без отдела" или создаем его
          let defaultDept = await supabase
            .from("departments")
            .select("department_id")
            .eq("department_name", "Без отдела")
            .single()
          
          if (!defaultDept.data) {
            const { data: newDept } = await supabase
              .from("departments")
              .insert({ department_id: crypto.randomUUID(), department_name: "Без отдела" })
              .select("department_id")
              .single()
            
            profileData.department_id = newDept?.department_id
          } else {
            profileData.department_id = defaultDept.data.department_id
          }
        }

        if (!profileData.team_id) {
          // Ищем команду "Без команды" или создаем её
          let defaultTeam = await supabase
            .from("teams")
            .select("team_id")
            .eq("team_name", "Без команды")
            .single()
          
          if (!defaultTeam.data) {
            const { data: newTeam } = await supabase
              .from("teams")
              .insert({ 
                team_id: crypto.randomUUID(), 
                team_name: "Без команды", 
                department_id: profileData.department_id 
              })
              .select("team_id")
              .single()
            
            profileData.team_id = newTeam?.team_id
          } else {
            profileData.team_id = defaultTeam.data.team_id
          }
        }

        if (!profileData.position_id) {
          // Ищем должность "Без должности" или создаем её
          let defaultPosition = await supabase
            .from("positions")
            .select("position_id")
            .eq("position_name", "Без должности")
            .single()
          
          if (!defaultPosition.data) {
            const { data: newPosition } = await supabase
              .from("positions")
              .insert({ position_id: crypto.randomUUID(), position_name: "Без должности" })
              .select("position_id")
              .single()
            
            profileData.position_id = newPosition?.position_id
          } else {
            profileData.position_id = defaultPosition.data.position_id
          }
        }

        if (!profileData.category_id) {
          // Ищем категорию "Не применяется" или создаем её
          let defaultCategory = await supabase
            .from("categories")
            .select("category_id")
            .eq("category_name", "Не применяется")
            .single()
          
          if (!defaultCategory.data) {
            const { data: newCategory } = await supabase
              .from("categories")
              .insert({ category_id: crypto.randomUUID(), category_name: "Не применяется" })
              .select("category_id")
              .single()
            
            profileData.category_id = newCategory?.category_id
          } else {
            profileData.category_id = defaultCategory.data.category_id
          }
        }

        console.log("Данные профиля для создания:", profileData)

        // 4. Создаем профиль пользователя
        const { error: profileError } = await supabase
          .from("profiles")
          .insert(profileData)

        if (profileError) {
          console.error("Ошибка создания профиля:", profileError)
          span.setAttribute("profile.success", false)
          span.setAttribute("profile.error", profileError.message)
          
          // Пытаемся удалить созданного пользователя из auth, если профиль не создался
          try {
            await adminClient.auth.admin.deleteUser(authData.user.id)
            console.log("Пользователь удален из auth после ошибки создания профиля")
          } catch (deleteError) {
            console.error("Не удалось удалить пользователя из auth после ошибки:", deleteError)
          }
          
          Sentry.captureException(profileError, {
            tags: {
              module: 'org_data_service',
              action: 'create_user',
              step: 'profile_creation'
            },
            extra: {
              user_id: authData.user.id,
              email: userData.email,
              error_code: profileError.code,
              error_message: profileError.message,
              timestamp: new Date().toISOString()
            }
          })
          throw new Error(`Не удалось создать профиль пользователя: ${profileError.message}`)
        }

        span.setAttribute("profile.success", true)
        span.setAttribute("db.success", true)
        console.log("Пользователь и профиль успешно созданы")

        return {
          userId: authData.user.id,
          email: authData.user.email,
        }

      } catch (error) {
        span.setAttribute("error", true)
        span.setAttribute("error.message", (error as Error).message)
        
        Sentry.captureException(error, {
          tags: {
            module: 'org_data_service',
            action: 'create_user',
            error_type: 'general_error'
          },
          extra: {
            email: userData.email,
            error_message: (error as Error).message,
            timestamp: new Date().toISOString()
          }
        })
        throw error
      }
    }
  )
}

// Удаление пользователя (через серверный API, с полной очисткой Auth + профиль)
export async function deleteUser(userId: string) {
  return Sentry.startSpan(
    {
      op: "api.call",
      name: "Удаление пользователя через API",
    },
    async (span) => {
      try {
        span.setAttribute("user.id", userId)
        span.setAttribute("api.endpoint", "/api/admin/delete-user")

        const response = await fetch(`/api/admin/delete-user?userId=${encodeURIComponent(userId)}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
        })

        const result = await response.json().catch(() => ({}))

        if (!response.ok) {
          span.setAttribute("api.success", false)
          span.setAttribute("api.status", response.status)
          const message = result?.error || `Ошибка удаления пользователя (status ${response.status})`
          const err = new Error(message)
          Sentry.captureException(err, {
            tags: {
              module: 'org_data_service',
              action: 'delete_user_via_api',
              user_id: userId,
              status_code: response.status,
              critical: true,
            },
            extra: {
              response_body: JSON.stringify(result),
              timestamp: new Date().toISOString(),
            },
          })
          throw err
        }

        span.setAttribute("api.success", true)
        return true
      } catch (error) {
        span.setAttribute("error", true)
        span.setAttribute("error.message", (error as Error).message)
        Sentry.captureException(error, {
          tags: {
            module: 'org_data_service',
            action: 'delete_user_via_api',
            user_id: userId,
            error_type: 'network_or_api_error',
          },
          extra: {
            error_message: (error as Error).message,
            timestamp: new Date().toISOString(),
          },
        })
        throw error
      }
    }
  )
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
    Sentry.captureException(error, {
      tags: {
        module: 'org_data_service',
        action: 'get_users_by_department',
        table: 'departments'
      },
      extra: {
        error_code: error.code,
        error_details: error.details,
        timestamp: new Date().toISOString()
      }
    })
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
    Sentry.captureException(error, {
      tags: {
        module: 'org_data_service',
        action: 'get_users_by_team',
        table: 'teams'
      },
      extra: {
        error_code: error.code,
        error_details: error.details,
        timestamp: new Date().toISOString()
      }
    })
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
    Sentry.captureException(error, {
      tags: {
        module: 'org_data_service',
        action: 'get_users_by_category',
        table: 'categories'
      },
      extra: {
        error_code: error.code,
        error_details: error.details,
        timestamp: new Date().toISOString()
      }
    })
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
    Sentry.captureException(error, {
      tags: {
        module: 'org_data_service',
        action: 'get_users_joined_by_month',
        table: 'profiles'
      },
      extra: {
        error_code: error.code,
        error_details: error.details,
        timestamp: new Date().toISOString()
      }
    })
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
    Sentry.captureException(error, {
      tags: {
        module: 'org_data_service',
        action: 'get_users_by_location',
        table: 'profiles'
      },
      extra: {
        error_code: error.code,
        error_details: error.details,
        timestamp: new Date().toISOString()
      }
    })
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
      Sentry.captureException(error, {
        tags: {
          module: 'org_data_service',
          action: 'check_payment_access',
          table: 'payment_settings'
        },
        extra: {
          error_code: error?.code,
          error_details: error?.details,
          timestamp: new Date().toISOString()
        }
      })
      return false
    }

    return data.is_enabled || false
  } catch (error) {
    Sentry.captureException(error, {
      tags: {
        module: 'org_data_service',
        action: 'check_payment_access',
        error_type: 'unexpected_error'
      },
      extra: {
        error_message: (error as Error).message,
        timestamp: new Date().toISOString()
      }
    })
    return false
  }
}



// Разрешения: логика управления правами вынесена в modules/permissions и
// выполняется автоматически через UserPermissionsSyncProvider. Этот сервис
// не оперирует правами напрямую.

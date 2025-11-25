import type { User, UserWithRoles, Department, Team, Position, Category, Subdivision, WorkFormatType } from "@/types/db"
import { createClient } from "@/utils/supabase/client"
import { createAdminClient } from "@/utils/supabase/admin"
import * as Sentry from "@sentry/nextjs"
import { getUserPermissions } from "@/modules/permissions/supabase/supabasePermissions"

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
export async function getUsers(): Promise<UserWithRoles[]> {
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
        
        // ДИАГНОСТИКА: Проверяем структуру данных для Вадима Тихомирова
        if (users && users.length > 0) {
          const vadim = users.find(u => u.email === 'ghgjob123@gmail.com');
          if (vadim) {
            console.log("=== ДАННЫЕ ВАДИМА ТИХОМИРОВА ===");
            console.log("Полный объект:", vadim);
            console.log("roles_display_string:", vadim.roles_display_string);
            console.log("role_name (старое поле):", vadim.role_name);
            console.log("Все поля:", Object.keys(vadim));
          }
        }

        // Возвращаем данные напрямую из представления
        return users || []
      } catch (error) {
        span.setAttribute("db.success", false)
        span.setAttribute("db.error", error instanceof Error ? error.message : 'Unknown error')
        
        Sentry.captureException(error, {
          tags: {
            module: 'org_data_service',
            action: 'get_users',
            table: 'view_users'
          },
          extra: {
            timestamp: new Date().toISOString()
          }
        })
        
        console.error("Ошибка в getUsers:", error)
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
        
        const { data, error } = await supabase.from("departments").select("department_id, department_name, subdivision_id")

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
          subdivisionId: dept.subdivision_id || undefined,
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

// Получение всех подразделений
export async function getSubdivisions(): Promise<Subdivision[]> {
  return Sentry.startSpan(
    {
      op: "db.query",
      name: "Получение всех подразделений",
    },
    async (span: any) => {
      try {
        const supabase = createClient()
        span.setAttribute("table", "subdivisions")

        const { data, error } = await supabase.from("subdivisions").select("subdivision_id, subdivision_name")

        if (error) {
          span.setAttribute("db.success", false)
          Sentry.captureException(error, {
            tags: {
              module: 'org_data_service',
              action: 'get_subdivisions',
              table: 'subdivisions'
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
        span.setAttribute("subdivisions.count", data?.length || 0)

        return data.map((subdivision) => ({
          id: subdivision.subdivision_id,
          name: subdivision.subdivision_name || "",
        }))
      } catch (error) {
        span.setAttribute("error", true)
        Sentry.captureException(error, {
          tags: {
            module: 'org_data_service',
            action: 'get_subdivisions',
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

        // Проверка разрешений для редактирования ставки и загруженности
        const isSalaryFieldsUpdate =
          userData.salary !== undefined ||
          userData.employmentRate !== undefined ||
          userData.isHourly !== undefined

        if (isSalaryFieldsUpdate) {
          console.log("🔐 Обнаружена попытка изменения полей зарплаты, проверяем разрешения...")

          // Получаем текущего пользователя
          const { data: { user: currentUser }, error: authError } = await supabase.auth.getUser()

          if (authError || !currentUser) {
            const error = new Error("Не удалось получить данные текущего пользователя")
            Sentry.captureException(error)
            throw error
          }

          // Получаем разрешения текущего пользователя
          const { permissions } = await getUserPermissions(currentUser.id)
          const hasEditSalaryAll = permissions.includes('users.edit_salary.all')
          const hasEditSalaryDepartment = permissions.includes('users.edit_salary.department')
          const hasEditSalarySubdivision = permissions.includes('users.edit_salary.subdivision')
          const isSubdivisionHead = permissions.includes('hierarchy.is_subdivision_head')

          // Subdivision_head не может редактировать свою ставку и загруженность
          if (currentUser.id === userId && isSubdivisionHead) {
            const error = new Error("Руководитель подразделения не может редактировать свою ставку и загруженность")
            Sentry.captureException(error, {
              tags: {
                module: 'org_data_service',
                action: 'update_user_check_subdivision_head_self_edit',
                user_id: userId
              },
              extra: {
                current_user_id: currentUser.id,
                target_user_id: userId,
                is_subdivision_head: isSubdivisionHead,
                timestamp: new Date().toISOString()
              }
            })
            throw error
          }

          // Проверяем, есть ли у пользователя право редактировать зарплату
          if (!hasEditSalaryAll && !hasEditSalaryDepartment && !hasEditSalarySubdivision) {
            const error = new Error("Недостаточно прав для редактирования ставки и загруженности")
            Sentry.captureException(error, {
              tags: {
                module: 'org_data_service',
                action: 'update_user_check_salary_permissions',
                user_id: userId
              },
              extra: {
                current_user_id: currentUser.id,
                target_user_id: userId,
                permissions: permissions,
                timestamp: new Date().toISOString()
              }
            })
            throw error
          }

          // Если есть только разрешение для отдела, проверяем, что пользователи в одном отделе
          if (!hasEditSalaryAll && hasEditSalaryDepartment) {
            console.log("🔐 Проверяем, что пользователи в одном отделе...")

            // Получаем отдел текущего пользователя
            const { data: currentUserProfile, error: currentProfileError } = await supabase
              .from('profiles')
              .select('department_id')
              .eq('user_id', currentUser.id)
              .single()

            if (currentProfileError) {
              const error = new Error("Не удалось получить профиль текущего пользователя")
              Sentry.captureException(error)
              throw error
            }

            // Получаем отдел целевого пользователя
            const { data: targetUserProfile, error: targetProfileError } = await supabase
              .from('profiles')
              .select('department_id')
              .eq('user_id', userId)
              .single()

            if (targetProfileError) {
              const error = new Error("Не удалось получить профиль целевого пользователя")
              Sentry.captureException(error)
              throw error
            }

            // Проверяем, что отделы совпадают
            if (currentUserProfile.department_id !== targetUserProfile.department_id) {
              const error = new Error("Невозможно редактировать ставку пользователя из другого отдела")
              Sentry.captureException(error, {
                tags: {
                  module: 'org_data_service',
                  action: 'update_user_check_department',
                  user_id: userId
                },
                extra: {
                  current_user_id: currentUser.id,
                  current_department_id: currentUserProfile.department_id,
                  target_user_id: userId,
                  target_department_id: targetUserProfile.department_id,
                  timestamp: new Date().toISOString()
                }
              })
              throw error
            }

            console.log("✅ Пользователи в одном отделе")

            // Проверяем роль целевого пользователя (руководитель отдела может редактировать только team_lead и user)
            console.log("🔐 Проверяем роль целевого пользователя...")

            // Получаем основную роль целевого пользователя из view_users
            const { data: targetUserData, error: targetUserError } = await supabase
              .from('view_users')
              .select('primary_role')
              .eq('user_id', userId)
              .single()

            if (targetUserError) {
              const error = new Error("Не удалось получить роль целевого пользователя")
              Sentry.captureException(error)
              throw error
            }

            // Руководитель отдела может редактировать только team_lead и user
            const targetRole = targetUserData.primary_role?.toLowerCase()
            const allowedRoles = ['team_lead', 'user']

            if (!allowedRoles.includes(targetRole || '')) {
              const error = new Error(`Недостаточно прав для редактирования ставки пользователя с ролью "${targetRole}"`)
              Sentry.captureException(error, {
                tags: {
                  module: 'org_data_service',
                  action: 'update_user_check_role',
                  user_id: userId
                },
                extra: {
                  current_user_id: currentUser.id,
                  target_user_id: userId,
                  target_role: targetRole,
                  allowed_roles: allowedRoles,
                  timestamp: new Date().toISOString()
                }
              })
              throw error
            }

            console.log(`✅ Роль целевого пользователя (${targetRole}) разрешена для редактирования`)
          }

          // Если есть только разрешение для подразделения, проверяем, что пользователи в одном подразделении
          if (!hasEditSalaryAll && !hasEditSalaryDepartment && hasEditSalarySubdivision) {
            console.log("🔐 Проверяем, что пользователи в одном подразделении...")

            // Получаем подразделение текущего пользователя
            const { data: currentUserProfile, error: currentProfileError } = await supabase
              .from('profiles')
              .select('subdivision_id')
              .eq('user_id', currentUser.id)
              .single()

            if (currentProfileError) {
              const error = new Error("Не удалось получить профиль текущего пользователя")
              Sentry.captureException(error)
              throw error
            }

            // Получаем подразделение целевого пользователя
            const { data: targetUserProfile, error: targetProfileError } = await supabase
              .from('profiles')
              .select('subdivision_id')
              .eq('user_id', userId)
              .single()

            if (targetProfileError) {
              const error = new Error("Не удалось получить профиль целевого пользователя")
              Sentry.captureException(error)
              throw error
            }

            // Проверяем, что подразделения совпадают
            if (currentUserProfile.subdivision_id !== targetUserProfile.subdivision_id) {
              const error = new Error("Невозможно редактировать ставку пользователя из другого подразделения")
              Sentry.captureException(error, {
                tags: {
                  module: 'org_data_service',
                  action: 'update_user_check_subdivision',
                  user_id: userId
                },
                extra: {
                  current_user_id: currentUser.id,
                  current_subdivision_id: currentUserProfile.subdivision_id,
                  target_user_id: userId,
                  target_subdivision_id: targetUserProfile.subdivision_id,
                  timestamp: new Date().toISOString()
                }
              })
              throw error
            }

            console.log("✅ Пользователи в одном подразделении, разрешение предоставлено")
          }

          console.log("✅ Разрешение на редактирование полей зарплаты предоставлено")
        }

        const updates: any = {}

  if (userData.firstName !== undefined) {
    updates.first_name = userData.firstName
    console.log("Добавлено: first_name =", userData.firstName);
  }
  if (userData.lastName !== undefined) {
    updates.last_name = userData.lastName
    console.log("Добавлено: last_name =", userData.lastName);
  }

  // Блокировка изменения email: игнорируем любые попытки обновить email
  if (userData.email) {
    console.warn('Изменение email заблокировано на уровне сервиса. Поле email будет проигнорировано.')
    // Не обновляем auth.users и не зеркалим в profiles
  }

  // Обработка подразделения
  if (userData.subdivision !== undefined) {
    if (userData.subdivision && userData.subdivision.trim() !== "") {
      console.log("Ищем подразделение:", userData.subdivision);
      try {
        const { data: subdivision, error: subdivisionError } = await supabase
          .from("subdivisions")
          .select("subdivision_id")
          .eq("subdivision_name", userData.subdivision)
          .single()

        if (subdivisionError) {
          Sentry.captureException(subdivisionError, {
            tags: {
              module: 'org_data_service',
              action: 'update_user_find_subdivision',
              user_id: userId
            },
            extra: {
              subdivision_name: userData.subdivision,
              error_code: subdivisionError.code,
              error_details: subdivisionError.details,
              timestamp: new Date().toISOString()
            }
          })
        } else if (subdivision) {
          // Получаем текущее подразделение пользователя
          const { data: currentProfile } = await supabase
            .from("profiles")
            .select("subdivision_id")
            .eq("user_id", userId)
            .single()

          // Если подразделение изменилось, сбрасываем отдел и команду
          if (currentProfile && currentProfile.subdivision_id !== subdivision.subdivision_id) {
            console.log("Подразделение изменилось, сбрасываем отдел и команду");
            updates.subdivision_id = subdivision.subdivision_id
            updates.department_id = null
            updates.team_id = null
            console.log("Найдено подразделение, ID =", subdivision.subdivision_id);
            console.log("Сброшены department_id и team_id");
          } else {
            updates.subdivision_id = subdivision.subdivision_id
            console.log("Найдено подразделение, ID =", subdivision.subdivision_id);
          }
        } else {
          console.warn("Подразделение не найдено:", userData.subdivision);
        }
      } catch (error) {
        Sentry.captureException(error, {
          tags: {
            module: 'org_data_service',
            action: 'update_user_process_subdivision',
            user_id: userId
          },
          extra: {
            subdivision_name: userData.subdivision,
            error_message: (error as Error).message,
            timestamp: new Date().toISOString()
          }
        })
      }
    } else {
      // Устанавливаем subdivision_id в NULL
      updates.subdivision_id = null
      console.log("Устанавливаем subdivision_id = NULL (без подразделения)");
    }
  }

  // Найдем ID для связанных сущностей, если они изменились
  if (userData.department !== undefined) {
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
    } else {
      // Устанавливаем department_id в NULL
      updates.department_id = null
      console.log("Устанавливаем department_id = NULL (без отдела)");
    }
  }

  if (userData.team !== undefined) {
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
    } else {
      // Устанавливаем team_id в NULL
      updates.team_id = null
      console.log("Устанавливаем team_id = NULL (без команды)");
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



  // Роль больше не хранится в profiles.role_id — управление только через user_roles

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
  subdivision?: string
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
          // Trim and validate country and city values
          const trimmedCountry = userData.country.trim()
          const trimmedCity = userData.city.trim()
          
          // Validate that both values are non-empty after trimming
          if (trimmedCountry && trimmedCity) {
            try {
              // Normalize casing - capitalize first letter of each word
              const normalizedCountry = trimmedCountry.replace(/\b\w/g, l => l.toUpperCase())
              const normalizedCity = trimmedCity.replace(/\b\w/g, l => l.toUpperCase())
              
              // Гарантируем наличие country/city и получаем city_id через наш API апсерт
              const resp = await fetch('/api/geo/upsert', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                  countryName: normalizedCountry, 
                  cityName: normalizedCity 
                })
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
          } else {
            console.warn('Пропускаем вызов /api/geo/upsert: страна или город пустые после обрезки пробелов', {
              originalCountry: userData.country,
              originalCity: userData.city,
              trimmedCountry,
              trimmedCity
            })
          }
        }

        // 3. Найдем ID для связанных сущностей
        // Сначала обрабатываем subdivision если указано
        if (userData.subdivision) {
          const subdivision = await supabase
            .from("subdivisions")
            .select("subdivision_id")
            .eq("subdivision_name", userData.subdivision)
            .single()

          if (subdivision.data) {
            profileData.subdivision_id = subdivision.data.subdivision_id
            console.log("Найдено подразделение, ID =", subdivision.data.subdivision_id)
          } else {
            console.warn("Подразделение не найдено:", userData.subdivision)
          }
        }

        if (userData.department) {
          // Ищем отдел, учитывая подразделение если оно указано
          let departmentQuery = supabase
            .from("departments")
            .select("department_id")
            .eq("department_name", userData.department)

          // Если указано подразделение, фильтруем отделы по нему
          if (profileData.subdivision_id) {
            departmentQuery = departmentQuery.eq("subdivision_id", profileData.subdivision_id)
          }

          const department = await departmentQuery.single()

          if (department.data) {
            profileData.department_id = department.data.department_id
          } else {
            console.warn(`Отдел "${userData.department}" не найден для подразделения "${userData.subdivision}"`)
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

        // Роль не записываем в profiles.role_id — назначение выполняется через user_roles отдельно

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
      profiles!profiles_team_membership_fkey!inner (
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

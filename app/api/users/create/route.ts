import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/utils/supabase/admin"
import { createClient } from "@/utils/supabase/server"
import * as Sentry from "@sentry/nextjs"

export async function POST(request: NextRequest) {
  return Sentry.startSpan(
    {
      op: "api.users.create",
      name: "Создание нового пользователя через API",
    },
    async (span) => {
      try {
        const userData = await request.json()
        console.log("=== API createUser ===")
        console.log("Получены данные:", userData)

        span.setAttribute("user.email", userData.email)

        // Проверяем аутентификацию текущего пользователя
        const supabase = await createClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        
        if (authError || !user) {
          console.error("Пользователь не аутентифицирован:", authError)
          return NextResponse.json(
            { error: "Не авторизован" },
            { status: 401 }
          )
        }

        span.setAttribute("current_user.id", user.id)

        // Создаем админский клиент для операций с Auth API
        const adminClient = createAdminClient()
        
        // Проверяем, существует ли уже пользователь с таким email
        const { data: existingUsers, error: listError } = await adminClient.auth.admin.listUsers({
          page: 1,
          perPage: 1000 // Достаточно для большинства случаев
        })

        if (listError) {
          console.error("Ошибка при проверке существующих пользователей:", listError)
          return NextResponse.json(
            { error: "Не удалось проверить существующих пользователей" },
            { status: 500 }
          )
        }

        const existingUser = existingUsers.users?.find(u => u.email === userData.email)
        if (existingUser) {
          console.error("Пользователь с таким email уже существует:", userData.email)
          return NextResponse.json(
            { error: `Пользователь с email ${userData.email} уже существует` },
            { status: 400 }
          )
        }
        
        // 1. Создаем пользователя в auth.users
        const { data: authData, error: createAuthError } = await adminClient.auth.admin.createUser({
          email: userData.email,
          password: userData.password,
          email_confirm: true
        })

        if (createAuthError || !authData.user) {
          console.error("Ошибка создания пользователя в auth:", createAuthError)
          span.setAttribute("auth.success", false)
          return NextResponse.json(
            { error: `Не удалось создать пользователя: ${createAuthError?.message || 'Неизвестная ошибка'}` },
            { status: 400 }
          )
        }

        span.setAttribute("auth.success", true)
        span.setAttribute("new_user.id", authData.user.id)
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
            // Подготавливаем заголовки для внутреннего API вызова
            const headers: Record<string, string> = { 'Content-Type': 'application/json' }
            
            // Захватываем cookie из входящего запроса для передачи аутентификации
            const incomingCookie = request.headers.get('cookie')
            if (incomingCookie) {
              headers['Cookie'] = incomingCookie
            } else {
              console.warn('Отсутствует cookie в запросе - внутренний API вызов может быть неаутентифицирован')
            }

            // Гарантируем наличие country/city и получаем city_id через наш API апсерт
            // Construct an absolute URL for the server-side fetch
            const upsertUrl = new URL('/api/geo/upsert', request.nextUrl.origin).toString()
            const resp = await fetch(upsertUrl, {
              method: 'POST',
              headers: headers,
              body: JSON.stringify({ countryName: userData.country, cityName: userData.city })
            })
            if (resp.ok) {              const { cityId } = await resp.json()
              profileData.city_id = cityId
              console.log("Добавлено: city_id =", cityId)
            } else {
              console.warn('Не удалось апсертить страну/город через API:', await resp.text())
            }
          } catch (error) {
            console.error('Ошибка вызова /api/geo/upsert:', error)
          }
        }

        // 3. Найдем ID для связанных сущностей, используя обычный клиент
        if (userData.department) {
          const department = await supabase
            .from("departments")
            .select("department_id")
            .eq("department_name", userData.department)
            .single()
          
          if (department.data) {
            profileData.department_id = department.data.department_id
          }
        }

        if (userData.team) {
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
          }
        }

        // Роли больше не записываем в profiles.role_id — назначаем через user_roles ниже

        // Заполняем обязательные поля значениями по умолчанию если они пустые
        await fillDefaultFields(supabase, profileData)

        console.log("Данные профиля для создания:", profileData)

        // 4. Создаем или обновляем профиль пользователя (UPSERT)
        // Supabase автоматически создает базовую запись в profiles при создании пользователя в auth.users
        // Мы используем upsert для обновления этой записи с полными данными
        const { error: profileError } = await supabase
          .from("profiles")
          .upsert(profileData, { 
            onConflict: 'user_id',  // Конфликт по полю user_id
            ignoreDuplicates: false  // Обновляем существующую запись
          })

        if (profileError) {
          console.error("Ошибка обновления профиля:", profileError)
          
          // Удаляем пользователя из auth, если профиль не удалось обновить
          try {
            await adminClient.auth.admin.deleteUser(authData.user.id)
            console.log("Пользователь удален из auth после ошибки обновления профиля")
          } catch (deleteError) {
            console.error("Не удалось удалить пользователя из auth:", deleteError)
          }
          
          return NextResponse.json(
            { error: `Не удалось обновить профиль пользователя: ${profileError.message}` },
            { status: 400 }
          )
        }

        // 5. Назначаем роль пользователю через user_roles
        try {
          // Определяем целевую роль: из запроса или 'user' по умолчанию
          let roleIdToAssign: string | null = null
          if (userData.roleId) {
            roleIdToAssign = userData.roleId
          } else {
            const { data: defaultRole, error: defaultRoleError } = await supabase
              .from('roles')
              .select('id')
              .eq('name', 'user')
              .single()
            if (defaultRoleError) {
              console.warn('Не удалось получить роль по умолчанию user:', defaultRoleError)
            }
            roleIdToAssign = defaultRole?.id ?? null
          }

          if (roleIdToAssign) {
            const { error: assignError } = await supabase
              .from('user_roles')
              .insert({ user_id: authData.user.id, role_id: roleIdToAssign })
            if (assignError) {
              console.error('Ошибка назначения роли пользователю:', assignError)
              // Не прерываем создание — роль можно назначить позже вручную
            }
          }
        } catch (assignEx) {
          console.error('Неожиданная ошибка при назначении роли:', assignEx)
        }

        span.setAttribute("profile.success", true)
        console.log("Пользователь создан и профиль успешно обновлен")

        return NextResponse.json({
          success: true,
          userId: authData.user.id,
          email: authData.user.email
        })

      } catch (error) {
        console.error("Критическая ошибка при создании пользователя:", error)
        span.setAttribute("error", true)
        
        Sentry.captureException(error)
        
        return NextResponse.json(
          { error: `Произошла ошибка: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}` },
          { status: 500 }
        )
      }
    }
  )
}

// Вспомогательные функции
function mapWorkFormatToDb(format: "office" | "remote" | "hybrid"): string {
  switch (format) {
    case "office": return "В офисе"
    case "remote": return "Удаленно"
    case "hybrid": return "Гибридный"
  }
}

async function fillDefaultFields(supabase: any, profileData: any) {
  // Заполняем department_id по умолчанию
  if (!profileData.department_id) {
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

  // Заполняем team_id по умолчанию
  if (!profileData.team_id) {
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

  // Заполняем position_id по умолчанию
  if (!profileData.position_id) {
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

  // Заполняем category_id по умолчанию
  if (!profileData.category_id) {
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
}

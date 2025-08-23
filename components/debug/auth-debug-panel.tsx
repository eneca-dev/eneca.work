"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/utils/supabase/client"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import { useToast } from "@/components/ui/use-toast"
import { useUserStore, UserProfile } from "@/stores/useUserStore"
import { ProfileDebug } from "./profile-debug"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"

export function AuthDebugPanel() {
  const [sessionData, setSessionData] = useState<any>(null)
  const [userData, setUserData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const supabase = createClient()
  const router = useRouter()
  const { toast } = useToast()
  
  const userState = useUserStore()
  const { setUser, clearUser } = useUserStore()

  useEffect(() => {
    const fetchAuthData = async () => {
      setLoading(true)
      setError(null)
      try {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
        
        if (sessionError) {
          throw sessionError
        }
        
        setSessionData(sessionData)
        
        if (sessionData.session) {
          const { data: userData, error: userError } = await supabase.auth.getUser()
          
          if (userError) {
            throw userError
          }
          
          setUserData(userData)
          
          try {
            const { data: profileData } = await supabase
              .from("profiles")
              .select("*")
              .eq("user_id", userData.user.id)
              .single()
              
            console.log("Получены данные профиля из Supabase:", profileData);
            
            if (profileData) {
              setUserData((prev: any) => ({
                ...prev,
                profile: profileData
              }))
            }
            
            // Проверка текущего состояния
            console.log("Текущее состояние пользователя:", userState);
            
            // Проверяем, совпадает ли текущий ID пользователя с ID из Supabase
            const currentId = userState.id;
            const needsUpdate = refreshKey > 0 || !currentId || currentId !== userData.user.id || !userState.isAuthenticated;
            
            console.log("Требуется обновление Zustand:", needsUpdate, {
              refreshKey,
              currentId,
              supabaseId: userData.user.id,
              isAuthenticated: userState.isAuthenticated
            });
            
            if (needsUpdate) {
              console.log("Обновляем данные в хранилище, т.к. они не соответствуют или устарели");
              
              // Преобразуем профиль в тип UserProfile
              const profileForStore = profileData ? {
                firstName: profileData.first_name ?? null,
                lastName: profileData.last_name ?? null,
                departmentId: profileData.department_id ?? null,
                teamId: profileData.team_id ?? null,
                positionId: profileData.position_id ?? null,
                categoryId: profileData.category_id ?? null,
                workFormat: profileData.work_format ?? null,
                salary: profileData.salary !== undefined && profileData.salary !== null ? Number(profileData.salary) : null,
                isHourly: profileData.is_hourly !== undefined && profileData.is_hourly !== null ? Boolean(profileData.is_hourly) : null,
                employmentRate: profileData.employment_rate !== undefined && profileData.employment_rate !== null ? Number(profileData.employment_rate) : null,
                city: profileData.city ?? null,
                country: profileData.country ?? null,
                roleId: profileData.role_id ?? null
              } : null;
              
              console.log("Преобразованный профиль для хранилища:", profileForStore);
              
              const userDataToStore = {
                id: userData.user.id,
                email: userData.user.email || "no-email@example.com",
                name: userData.user.user_metadata?.name || 
                      (profileData?.first_name ? `${profileData.first_name} ${profileData.last_name || ''}` : "Пользователь"),
                profile: profileForStore
              };
              
              console.log('Итоговые данные для хранилища:', userDataToStore);
              
              // Сохраняем roleId и разрешения, если они есть
              const roleId = userState.profile?.roleId;
              // УДАЛЕНО: const permissions = userState.permissions;
              
              // Обновляем профиль пользователя
              setUser(userDataToStore);
              
              // УДАЛЕНО: Legacy восстановление permissions через setRoleAndPermissions
            } else {
              console.log("Пропускаем обновление хранилища, данные актуальны");
            }
          } catch (profileError) {
            console.log("Ошибка при получении профиля:", profileError)
            
            if (!userState.isAuthenticated) {
              const userDataNoProfile = {
                id: userData.user.id,
                email: userData.user.email || "no-email@example.com",
                name: userData.user.user_metadata?.name || "Пользователь",
                profile: null
              };
              
              console.log('Отправка данных без профиля в хранилище:', userDataNoProfile);
              setUser(userDataNoProfile);
            }
          }
        } else if (userState.isAuthenticated) {
          clearUser()
        }
      } catch (err: any) {
        console.error("Ошибка при получении данных аутентификации:", err)
        setError(err.message || "Произошла ошибка при получении данных аутентификации")
      } finally {
        setLoading(false)
      }
    }

    fetchAuthData()
  }, [supabase, refreshKey, setUser, clearUser, userState.isAuthenticated])

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1)
  }

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut()
      clearUser()
      toast({
        title: "Выход выполнен",
        description: "Вы успешно вышли из системы",
      })
      router.refresh()
      router.push("/auth/login")
    } catch (err: any) {
      toast({
        title: "Ошибка",
        description: err.message || "Произошла ошибка при выходе из системы",
        variant: "destructive",
      })
    }
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return "Н/Д"
    const date = new Date(dateString)
    return new Intl.DateTimeFormat('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date)
  }

  return (
    <div className="space-y-8">
      <ProfileDebug />
      
      <Card className="w-full bg-white dark:bg-gray-800 shadow-md">
        <CardHeader className="bg-primary/5 pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl font-bold">Отладка аутентификации</CardTitle>
              <CardDescription>
                Просмотр состояния аутентификации и данных пользователя
              </CardDescription>
            </div>
            <Badge variant={userState.isAuthenticated ? "default" : "destructive"} className="text-xs">
              {userState.isAuthenticated ? "Аутентифицирован" : "Не аутентифицирован"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center items-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent"></div>
            </div>
          ) : error ? (
            <div className="p-4 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-md m-6">
              <p className="font-semibold">Ошибка:</p>
              <p>{error}</p>
            </div>
          ) : (
            <Tabs defaultValue="zustand" className="w-full">
              <TabsList className="w-full justify-start rounded-none border-b px-6 pt-2">
                <TabsTrigger value="zustand">Zustand</TabsTrigger>
                <TabsTrigger value="supabase">Supabase</TabsTrigger>
                <TabsTrigger value="session">Сессия</TabsTrigger>
              </TabsList>
              
              {/* Вкладка Zustand */}
              <TabsContent value="zustand" className="p-6 pt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium text-muted-foreground">Информация о пользователе</h3>
                    <div className="rounded border p-3 text-sm space-y-2">
                      <div className="flex justify-between">
                        <span className="font-medium text-muted-foreground">ID:</span>
                        <span className="truncate max-w-[180px]">{userState.id || "Н/Д"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-medium text-muted-foreground">Имя:</span>
                        <span>{userState.name || "Н/Д"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-medium text-muted-foreground">Email:</span>
                        <span>{userState.email || "Н/Д"}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium text-muted-foreground">Роль</h3>
                    <div className="rounded border p-3 text-sm space-y-2">
                      <div className="flex justify-between">
                        <span className="font-medium text-muted-foreground">RoleId:</span>
                        <Badge variant="outline">{userState.profile?.roleId || "Не назначена"}</Badge>
                      </div>
                      <div className="text-muted-foreground italic text-xs">
                        Разрешения теперь управляются через permissions модуль
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-2 md:col-span-2 lg:col-span-1">
                    <h3 className="text-sm font-medium text-muted-foreground">Профиль</h3>
                    <div className="rounded border p-3 text-sm h-[calc(100%-28px)]">
                      {userState.profile ? (
                        <ScrollArea className="h-full max-h-[200px]">
                          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                            {Object.entries(userState.profile)
                              .filter(([_, value]) => value !== null && value !== undefined)
                              .map(([key, value]) => (
                                <div key={key} className="overflow-hidden">
                                  <span className="font-medium text-muted-foreground">{key}: </span>
                                  <span className="truncate">{typeof value === 'object' ? JSON.stringify(value) : String(value)}</span>
                                </div>
                              ))}
                          </div>
                        </ScrollArea>
                      ) : (
                        <span className="text-muted-foreground italic">Профиль не загружен</span>
                      )}
                    </div>
                  </div>
                  
                  <div className="col-span-1 md:col-span-2 lg:col-span-3 space-y-2">
                    <h3 className="text-sm font-medium text-muted-foreground">Полное состояние Zustand</h3>
                    <ScrollArea className="h-[200px] rounded border">
                      <pre className="p-3 text-xs font-mono">{JSON.stringify(userState, null, 2)}</pre>
                    </ScrollArea>
                  </div>
                </div>
              </TabsContent>
              
              {/* Вкладка Supabase */}
              <TabsContent value="supabase" className="p-6 pt-4">
                {userData?.user ? (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <h3 className="text-sm font-medium text-muted-foreground">Основная информация</h3>
                        <div className="rounded border p-3 text-sm space-y-2">
                          <div className="flex justify-between">
                            <span className="font-medium text-muted-foreground">ID:</span>
                            <span className="truncate max-w-[180px]">{userData.user.id}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="font-medium text-muted-foreground">Email:</span>
                            <span>{userData.user.email}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="font-medium text-muted-foreground">Email подтвержден:</span>
                            <Badge variant={userData.user.email_confirmed_at ? "default" : "destructive"}>
                              {userData.user.email_confirmed_at ? "Да" : "Нет"}
                            </Badge>
                          </div>
                          <div className="flex justify-between">
                            <span className="font-medium text-muted-foreground">Создан:</span>
                            <span>{formatDate(userData.user.created_at)}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <h3 className="text-sm font-medium text-muted-foreground">Профиль в Supabase</h3>
                        <div className="rounded border p-3 text-sm">
                          {userData.profile ? (
                            <ScrollArea className="h-[150px]">
                              <div className="grid grid-cols-1 gap-2">
                                {Object.entries(userData.profile)
                                  .filter(([key, value]) => value !== null && value !== undefined && key !== 'id' && key !== 'user_id')
                                  .map(([key, value]) => (
                                    <div key={key} className="flex justify-between">
                                      <span className="font-medium text-muted-foreground">{key}:</span>
                                      <span className="truncate max-w-[180px]">{String(value)}</span>
                                    </div>
                                  ))}
                              </div>
                            </ScrollArea>
                          ) : (
                            <span className="text-muted-foreground italic">Профиль не загружен</span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {userData.user.user_metadata && Object.keys(userData.user.user_metadata).length > 0 && (
                      <div className="space-y-2">
                        <h3 className="text-sm font-medium text-muted-foreground">User Metadata</h3>
                        <div className="rounded border p-3">
                          <pre className="text-xs font-mono">{JSON.stringify(userData.user.user_metadata, null, 2)}</pre>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-4 text-center text-muted-foreground">
                    Пользователь не аутентифицирован в Supabase
                  </div>
                )}
              </TabsContent>
              
              {/* Вкладка Сессия */}
              <TabsContent value="session" className="p-6 pt-4">
                {sessionData?.session ? (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <h3 className="text-sm font-medium text-muted-foreground">Информация о сессии</h3>
                        <div className="rounded border p-3 text-sm space-y-2">
                          <div className="flex justify-between">
                            <span className="font-medium text-muted-foreground">Провайдер:</span>
                            <span className="capitalize">{sessionData.session.provider || "email"}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="font-medium text-muted-foreground">Последний вход:</span>
                            <span>{formatDate(sessionData.session.last_sign_in_at)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="font-medium text-muted-foreground">Истекает:</span>
                            <span>{formatDate(sessionData.session.expires_at)}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <h3 className="text-sm font-medium text-muted-foreground">Токен</h3>
                        <div className="rounded border p-3">
                          <ScrollArea className="h-[100px]">
                            <p className="text-xs font-mono break-all">{sessionData.session.access_token}</p>
                          </ScrollArea>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 text-center text-muted-foreground">
                    Активная сессия не найдена
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
        <CardFooter className="flex justify-between bg-gray-50 dark:bg-gray-900/30 p-4">
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleRefresh}
              disabled={loading}
              size="sm"
            >
              Обновить
            </Button>
            <Button 
              variant="outline" 
              onClick={() => clearUser()}
              disabled={loading || !userState.isAuthenticated}
              size="sm"
            >
              Сбросить Zustand
            </Button>
          </div>
          {sessionData?.session && (
            <Button 
              variant="destructive" 
              onClick={handleLogout}
              disabled={loading}
              size="sm"
            >
              Выйти
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  )
} 
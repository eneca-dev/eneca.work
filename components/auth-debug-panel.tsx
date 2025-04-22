"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/utils/supabase/client"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "./ui/button"
import { useRouter } from "next/navigation"
import { useToast } from "./ui/use-toast"
import { useDispatch, useSelector } from "react-redux"
import { RootState } from "@/store"
import { clearUser, setUser } from "@/store/userSlice"

export function AuthDebugPanel() {
  const [sessionData, setSessionData] = useState<any>(null)
  const [userData, setUserData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const supabase = createClient()
  const router = useRouter()
  const { toast } = useToast()
  
  // Получаем данные пользователя из Redux
  const reduxUserState = useSelector((state: RootState) => state.user)
  const dispatch = useDispatch()

  useEffect(() => {
    const fetchAuthData = async () => {
      setLoading(true)
      setError(null)
      try {
        // Получаем текущую сессию
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
        
        if (sessionError) {
          throw sessionError
        }
        
        setSessionData(sessionData)
        
        // Получаем данные пользователя, если есть сессия
        if (sessionData.session) {
          const { data: userData, error: userError } = await supabase.auth.getUser()
          
          if (userError) {
            throw userError
          }
          
          setUserData(userData)
          
          // Получаем дополнительные данные из таблицы profiles, если она существует
          try {
            const { data: profileData } = await supabase
              .from("profiles")
              .select("*")
              .eq("id", userData.user.id)
              .single()
              
            // Добавляем данные из profiles к информации о пользователе
            if (profileData) {
              setUserData((prev: any) => ({
                ...prev,
                profile: profileData
              }))
            }
            
            // Синхронизируем данные с Redux если нужно
            if (!reduxUserState.isAuthenticated) {
              dispatch(setUser({
                id: userData.user.id,
                email: userData.user.email || "no-email@example.com",
                name: userData.user.user_metadata?.name || profileData?.name || "Пользователь"
              }))
            }
          } catch (profileError) {
            // Просто логируем ошибку, но не прерываем выполнение
            console.log("Ошибка при получении профиля:", profileError)
            
            // Если не удалось получить профиль, синхронизируем с данными из Auth
            if (!reduxUserState.isAuthenticated) {
              dispatch(setUser({
                id: userData.user.id,
                email: userData.user.email || "no-email@example.com",
                name: userData.user.user_metadata?.name || "Пользователь"
              }))
            }
          }
        } else if (reduxUserState.isAuthenticated) {
          // Если в Supabase нет сессии, но в Redux пользователь авторизован - очищаем Redux
          dispatch(clearUser())
        }
      } catch (err: any) {
        console.error("Ошибка при получении данных аутентификации:", err)
        setError(err.message || "Произошла ошибка при получении данных аутентификации")
      } finally {
        setLoading(false)
      }
    }

    fetchAuthData()
  }, [supabase, refreshKey, dispatch, reduxUserState.isAuthenticated])

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1)
  }

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut()
      dispatch(clearUser())
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
    if (!dateString) return "N/A"
    const date = new Date(dateString)
    return new Intl.DateTimeFormat('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(date)
  }

  return (
    <Card className="w-full bg-white dark:bg-gray-800 shadow-md">
      <CardHeader className="bg-primary/5">
        <CardTitle className="text-xl font-bold">Состояние аутентификации</CardTitle>
        <CardDescription>
          Информация о текущем состоянии аутентификации пользователя
        </CardDescription>
      </CardHeader>
      <CardContent className="p-6 space-y-4">
        {loading ? (
          <div className="flex justify-center items-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent"></div>
          </div>
        ) : error ? (
          <div className="p-4 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-md">
            <p className="font-semibold">Ошибка:</p>
            <p>{error}</p>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              {/* Redux состояние */}
              <div>
                <h3 className="text-lg font-semibold mb-2 text-primary">Redux состояние</h3>
                <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-md space-y-3 text-sm">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="font-medium text-gray-500 dark:text-gray-400">Аутентифицирован в Redux:</p>
                      <p className={reduxUserState.isAuthenticated ? "text-green-600 dark:text-green-400 font-medium" : "text-red-600 dark:text-red-400 font-medium"}>
                        {reduxUserState.isAuthenticated ? "Да" : "Нет"}
                      </p>
                    </div>
                    <div>
                      <p className="font-medium text-gray-500 dark:text-gray-400">ID пользователя:</p>
                      <p className="truncate">{reduxUserState.id || "Нет данных"}</p>
                    </div>
                    <div>
                      <p className="font-medium text-gray-500 dark:text-gray-400">Имя пользователя:</p>
                      <p>{reduxUserState.name || "Нет данных"}</p>
                    </div>
                    <div>
                      <p className="font-medium text-gray-500 dark:text-gray-400">Email пользователя:</p>
                      <p>{reduxUserState.email || "Нет данных"}</p>
                    </div>
                  </div>
                  <div className="pt-2 border-t dark:border-gray-700">
                    <p className="font-medium text-gray-500 dark:text-gray-400 mb-2">Полное состояние Redux:</p>
                    <pre className="bg-gray-100 dark:bg-gray-800 p-2 rounded-md whitespace-pre-wrap overflow-x-auto text-xs">
                      {JSON.stringify(reduxUserState, null, 2)}
                    </pre>
                  </div>
                </div>
              </div>

              {/* Суппабейс сессия */}
              <div>
                <h3 className="text-lg font-semibold mb-2 text-primary">Статус аутентификации (Supabase)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-md text-sm">
                  <div>
                    <p className="font-medium text-gray-500 dark:text-gray-400">Пользователь аутентифицирован:</p>
                    <p className={sessionData?.session ? "text-green-600 dark:text-green-400 font-medium" : "text-red-600 dark:text-red-400 font-medium"}>
                      {sessionData?.session ? "Да" : "Нет"}
                    </p>
                  </div>
                  {sessionData?.session && (
                    <>
                      <div>
                        <p className="font-medium text-gray-500 dark:text-gray-400">Истекает:</p>
                        <p>{formatDate(sessionData.session.expires_at)}</p>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {userData?.user && (
                <div>
                  <h3 className="text-lg font-semibold mb-2 text-primary">Данные пользователя (Supabase)</h3>
                  <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-md space-y-3 text-sm">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="font-medium text-gray-500 dark:text-gray-400">ID:</p>
                        <p className="truncate">{userData.user.id}</p>
                      </div>
                      <div>
                        <p className="font-medium text-gray-500 dark:text-gray-400">Email:</p>
                        <p>{userData.user.email}</p>
                      </div>
                      <div>
                        <p className="font-medium text-gray-500 dark:text-gray-400">Email подтвержден:</p>
                        <p className={userData.user.email_confirmed_at ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
                          {userData.user.email_confirmed_at ? "Да" : "Нет"}
                        </p>
                      </div>
                      <div>
                        <p className="font-medium text-gray-500 dark:text-gray-400">Создан:</p>
                        <p>{formatDate(userData.user.created_at)}</p>
                      </div>
                    </div>
                    
                    {userData.user.user_metadata && Object.keys(userData.user.user_metadata).length > 0 && (
                      <div className="pt-2 border-t dark:border-gray-700">
                        <p className="font-medium text-gray-500 dark:text-gray-400 mb-2">User Metadata:</p>
                        <pre className="bg-gray-100 dark:bg-gray-800 p-2 rounded-md whitespace-pre-wrap overflow-x-auto text-xs">
                          {JSON.stringify(userData.user.user_metadata, null, 2)}
                        </pre>
                      </div>
                    )}
                    
                    {userData.profile && (
                      <div className="pt-2 border-t dark:border-gray-700">
                        <p className="font-medium text-gray-500 dark:text-gray-400 mb-2">Данные профиля:</p>
                        <pre className="bg-gray-100 dark:bg-gray-800 p-2 rounded-md whitespace-pre-wrap overflow-x-auto text-xs">
                          {JSON.stringify(userData.profile, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {sessionData?.session && (
                <div>
                  <h3 className="text-lg font-semibold mb-2 text-primary">Данные сессии (Supabase)</h3>
                  <div className="bg-gray-50 dark:bg-gray-900/50 rounded-md p-4 text-sm">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="font-medium text-gray-500 dark:text-gray-400">Провайдер:</p>
                        <p className="capitalize">{sessionData.session.provider || "email"}</p>
                      </div>
                      <div>
                        <p className="font-medium text-gray-500 dark:text-gray-400">Время последней активности:</p>
                        <p>{formatDate(sessionData.session.last_sign_in_at)}</p>
                      </div>
                    </div>
                    
                    <div className="pt-2 mt-2 border-t dark:border-gray-700">
                      <p className="font-medium text-gray-500 dark:text-gray-400 mb-2">Токен:</p>
                      <div className="bg-gray-100 dark:bg-gray-800 p-2 rounded-md overflow-x-auto">
                        <p className="text-xs break-all">{sessionData.session.access_token.substring(0, 30)}...</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
      <CardFooter className="flex justify-between bg-gray-50 dark:bg-gray-900/30 p-4">
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={loading}
          >
            Обновить данные
          </Button>
          <Button 
            variant="outline" 
            onClick={() => dispatch(clearUser())}
            disabled={loading || !reduxUserState.isAuthenticated}
          >
            Сбросить Redux
          </Button>
        </div>
        {sessionData?.session && (
          <Button 
            variant="destructive" 
            onClick={handleLogout}
            disabled={loading}
          >
            Выйти из системы
          </Button>
        )}
      </CardFooter>
    </Card>
  )
} 
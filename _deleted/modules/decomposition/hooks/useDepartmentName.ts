import { useEffect, useState } from "react"
import { supabase } from "../utils"

interface UseDepartmentNameReturn {
  departmentName: string
  isLoading: boolean
  error: string | null
}

export const useDepartmentName = (departmentId: string | null | undefined): UseDepartmentNameReturn => {
  const [departmentName, setDepartmentName] = useState<string>("")
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Флаг отмены для предотвращения race conditions
    let isCancelled = false

    const fetchDepartmentName = async () => {
      if (!departmentId) {
        setDepartmentName("")
        setIsLoading(false)
        setError(null)
        return
      }

      setIsLoading(true)
      setError(null)

      try {
        const { data, error } = await supabase
          .from("departments")
          .select("department_name")
          .eq("department_id", departmentId)
          .single()

        // Проверяем флаг отмены перед обновлением состояния
        if (isCancelled) return

        if (error) {
          console.error("Error fetching department:", error)
          setError(error.message)
          setDepartmentName("")
        } else {
          setDepartmentName(data?.department_name || "")
        }
      } catch (err) {
        if (isCancelled) return
        
        const errorMessage = err instanceof Error ? err.message : "Unknown error"
        console.error("Error:", err)
        setError(errorMessage)
        setDepartmentName("")
      } finally {
        if (!isCancelled) {
          setIsLoading(false)
        }
      }
    }

    fetchDepartmentName()

    // Функция очистки для установки флага отмены
    return () => {
      isCancelled = true
    }
  }, [departmentId])

  return { departmentName, isLoading, error }
} 
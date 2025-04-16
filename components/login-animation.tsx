"use client"

import { useEffect } from "react"
import { Loader2 } from "lucide-react"

interface LoginAnimationProps {
  isLoading: boolean
  onComplete: () => void
}

export function LoginAnimation({ isLoading, onComplete }: LoginAnimationProps) {
  useEffect(() => {
    if (isLoading) {
      // After loading animation completes, call onComplete
      const completeTimeout = setTimeout(() => {
        onComplete()
      }, 2000)

      return () => clearTimeout(completeTimeout)
    }
  }, [isLoading, onComplete])

  if (!isLoading) return null

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
      <div className="bg-white dark:bg-gray-800 rounded-xl p-8 flex flex-col items-center justify-center max-w-sm w-full">
        <div className="flex flex-col items-center space-y-4">
          <div className="relative">
            <div className="h-20 w-20 rounded-full border-4 border-primary/20 flex items-center justify-center">
              <Loader2 className="h-10 w-10 text-primary animate-spin" />
            </div>
          </div>
          <p className="text-lg font-medium dark:text-gray-200">Выполняется вход...</p>
        </div>
      </div>
    </div>
  )
}

"use client"

import { CheckCircle } from "lucide-react"

interface LoadingSuccessToastProps {
  executor: string
  stageName: string
  isEditing?: boolean
}

export function LoadingSuccessToast({ executor, stageName, isEditing = false }: LoadingSuccessToastProps) {
  return (
    <div className="flex items-start gap-3 p-1">
      <CheckCircle className="h-5 w-5 text-[#1e7260] mt-0.5 flex-shrink-0" />
      <div>
        <h4 className="font-medium text-gray-900">Loading {isEditing ? "Updated" : "Added"} Successfully</h4>
        <p className="text-sm text-gray-600">
          {executor} has been {isEditing ? "updated in" : "assigned to"} {stageName}
        </p>
      </div>
    </div>
  )
}


import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-9 w-full min-w-0 rounded-md border-2 border-gray-300 bg-white px-3 py-1 text-base text-gray-900 shadow-sm transition-colors outline-none placeholder:text-gray-500 focus:border-green-700 focus:ring-2 focus:ring-green-700 focus:ring-offset-0 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className
      )}
      {...props}
    />
  )
}

export { Input }

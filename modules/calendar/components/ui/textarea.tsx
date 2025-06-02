import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex min-h-16 w-full rounded-md border-2 border-gray-300 bg-white px-3 py-2 text-base text-gray-900 shadow-sm transition-colors outline-none placeholder:text-gray-500 focus:border-green-700 focus:ring-2 focus:ring-green-700 focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }

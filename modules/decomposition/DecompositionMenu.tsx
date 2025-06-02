import Link from "next/link"
import { FileSpreadsheet } from "lucide-react"

export const DecompositionMenu = () => {
  return (
    <div className="py-2">
      <Link
        href="/dashboard/decomposition"
        className="flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-accent hover:text-accent-foreground"
      >
        <FileSpreadsheet className="h-4 w-4" />
        <span>Декомпозиция</span>
      </Link>
    </div>
  )
}

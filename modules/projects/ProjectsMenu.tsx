import { FolderOpen } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function ProjectsMenu({ collapsed }: { collapsed: boolean }) {
  const pathname = usePathname();
  const isActive = pathname === "/dashboard/projects";
  
  return (
    <li>
      <Link
        href="/dashboard/projects"
        className={cn(
          "flex items-center rounded-md px-3 py-2 nav-item transition-colors",
          isActive
            ? "bg-primary/10 text-primary"
            : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700",
          collapsed && "justify-center px-0",
        )}
      >
        <FolderOpen className={cn("h-5 w-5", collapsed ? "mr-0" : "mr-3")} />
        {!collapsed && <span>Проекты</span>}
      </Link>
    </li>
  );
} 
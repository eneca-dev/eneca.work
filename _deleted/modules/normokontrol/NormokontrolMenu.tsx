import { FileCheck, Settings, History } from "lucide-react"

export const NormokontrolMenu = () => {
  const menuItems = [
    {
      icon: FileCheck,
      label: "Проверка файлов",
      href: "/normokontrol",
      active: true,
    },
    {
      icon: History,
      label: "История проверок",
      href: "/normokontrol/history",
      active: false,
    },
    {
      icon: Settings,
      label: "Настройки",
      href: "/normokontrol/settings",
      active: false,
    },
  ]

  return (
    <nav className="space-y-1">
      {menuItems.map((item) => {
        const Icon = item.icon
        return (
          <a
            key={item.href}
            href={item.href}
            className={`flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
              item.active ? "bg-blue-100 text-blue-700" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
            }`}
          >
            <Icon className="w-5 h-5 mr-3" />
            {item.label}
          </a>
        )
      })}
    </nav>
  )
}

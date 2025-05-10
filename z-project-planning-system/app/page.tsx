import ProjectPlanner from "./components/ProjectPlanner"

// Убираем класс bg-white и добавляем класс p-0 для удаления отступов
export default function Home() {
  return (
    <main className="min-h-screen p-0">
      <ProjectPlanner />
    </main>
  )
}


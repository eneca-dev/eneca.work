import { useRoadmap } from "../../context/roadmap-context"

export function MonthHeader() {
  const { monthGroups, CELL_WIDTH } = useRoadmap()

  return (
    <div className="flex bg-white">
      <div className="w-64 min-w-64 p-3 font-medium bg-white"></div>
      <div className="flex-1 flex">
        {monthGroups.map((group, index) => (
          <div
            key={index}
            className="font-medium bg-white text-center border-r"
            style={{ width: `${group.days * CELL_WIDTH}px` }}
          >
            <div className="py-2 border-b">
              <span className="text-gray-700 font-semibold">{group.month}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}


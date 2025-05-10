### Frontend Layout Documentation: Project Planning System Timeline and Table Components

This documentation focuses on the UI layout and visual components of the Project Planning System, without the complex business logic, hooks, and state management.

## 1. Overview

The Project Planning System UI consists of several key visual components:

1. Timeline visualization with month and day headers
2. Table structure for displaying project sections and stages
3. Resource allocation visualization
4. Department employee timeline
5. Filtering and navigation components


## 2. Timeline Layout

### 2.1 Timeline Structure

The timeline consists of a horizontal scrollable area with the following components:

1. Month header - displays month names
2. Day header - displays day numbers
3. Navigation controls - allows users to navigate through the timeline






### 2.2 Month Header

The month header displays month names grouped by month, with each month's width proportional to the number of days it contains.

```javascriptreact
<div className="flex bg-white dark:bg-slate-900">
  <div className="w-64 min-w-64 p-3 font-medium bg-white dark:bg-slate-900"></div>
  <div className="flex-1 flex">
    {monthGroups.map((group, index) => (
      <div
        key={index}
        className="font-medium bg-white dark:bg-slate-900 text-center border-r border-slate-200 dark:border-slate-800"
        style={{ width: `${group.days * CELL_WIDTH}px` }}
      >
        <div className="py-2 border-b border-slate-200 dark:border-slate-800">
          <span className="text-gray-700 dark:text-gray-300 font-semibold">{group.month}</span>
        </div>
      </div>
    ))}
  </div>
</div>
```

### 2.3 Day Header

The day header displays day numbers below the month header. Days are highlighted if they are weekends or the current day.

```javascriptreact
<div className="flex bg-white dark:bg-slate-900">
  <div className="w-64 min-w-64 p-3 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"></div>
  <div className="flex-1 flex">
    {workingDays.map((day, index) => {
      const isWeekend = day.getDay() === 0 || day.getDay() === 6;
      const isToday = new Date().toDateString() === day.toDateString();

      return (
        <div
          key={index}
          className={`
            text-center text-xs border-r border-slate-200 dark:border-slate-800 
            flex items-center justify-center
            ${isWeekend ? "bg-gray-50 dark:bg-slate-800/50" : ""}
            ${isToday ? "bg-primary/5 dark:bg-primary/10" : ""}
          `}
          style={{ width: `${CELL_WIDTH}px`, minWidth: `${CELL_WIDTH}px` }}
        >
          <span
            className={`
              rounded-full w-6 h-6 flex items-center justify-center
              ${isToday ? "bg-primary text-white" : ""}
            `}
          >
            {day.getDate()}
          </span>
        </div>
      );
    })}
  </div>
</div>
```

### 2.4 Timeline Navigation

The timeline navigation controls allow users to move through the timeline by days, months, or to jump to the current date.

```javascriptreact
<div className="flex items-center gap-2">
  <div className="flex bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
    <button className="h-8 w-8 p-0 rounded-none border-r border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-primary">
      <span className="sr-only">Previous month</span>
      <ChevronsLeft className="h-4 w-4" />
    </button>
    <button className="h-8 w-8 p-0 rounded-none border-r border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-primary">
      <span className="sr-only">Previous 10 days</span>
      <ChevronLeft className="h-4 w-4" />
    </button>
    <button className="h-8 px-3 rounded-none border-r border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-primary">
      <Calendar className="h-4 w-4 mr-1" />
      <span className="text-xs">Today</span>
    </button>
    <button className="h-8 w-8 p-0 rounded-none border-r border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-primary">
      <span className="sr-only">Next 10 days</span>
      <ChevronRight className="h-4 w-4" />
    </button>
    <button className="h-8 w-8 p-0 rounded-none text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-primary">
      <span className="sr-only">Next month</span>
      <ChevronsRight className="h-4 w-4" />
    </button>
  </div>
  <div className="text-sm text-slate-600 dark:text-slate-400">Jan 1, 2023 - Jan 31, 2023</div>
</div>
```

## 3. Table Layout

### 3.1 Table Structure

The table structure consists of several components that display project data in a hierarchical manner:

1. Section rows - display section headers with expandable content
2. Stage rows - display stages within sections
3. Loading items - display resource allocations on the timeline






### 3.2 Section Row

The section row displays a section header with an expand/collapse button, section name, responsible person, and a difference chart.

```javascriptreact
<div className="group">
  {/* Section header row */}
  <div className="flex items-center hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer">
    <div
      className="p-3 font-medium border-r border-slate-200 dark:border-slate-800 flex items-center group-hover:bg-slate-50 dark:group-hover:bg-slate-800/50 transition-colors"
      style={{ width: `${sidebarWidth}px`, minWidth: `${sidebarWidth}px` }}
    >
      <div className="flex flex-col">
        <div className="flex items-center">
          <ChevronDown className="h-5 w-5 mr-2 text-gray-500 dark:text-gray-400" />
          <span className="font-semibold text-slate-800 dark:text-slate-200">Section Name</span>
        </div>
        <div className="ml-7 mt-0.5">
          <div
            className="text-xs px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-md border border-slate-200 dark:border-slate-700 inline-block max-w-[180px]"
            title="Project Name"
          >
            <span className="text-slate-600 dark:text-slate-300 truncate block">Project Name</span>
          </div>
        </div>
      </div>
    </div>

    {/* Responsible column */}
    <div
      className="border-r border-slate-200 dark:border-slate-800 flex items-center justify-center"
      style={{ width: `150px`, minWidth: `150px` }}
    >
      <div className="flex flex-col items-center p-2">
        <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 mb-1 overflow-hidden">
          <img src="/placeholder.svg?height=32&width=32&query=avatar" alt="Responsible" className="w-full h-full object-cover" />
        </div>
        <div className="text-xs font-medium text-slate-800 dark:text-slate-200">John Doe</div>
        <div className="text-[10px] text-slate-500 dark:text-slate-400">Department</div>
      </div>
    </div>

    {/* Difference chart */}
    <div className="flex-1 relative h-16 bg-white dark:bg-slate-900">
      <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(var(--primary) 1px, transparent 1px)", backgroundSize: "8px 8px" }}></div>
      {/* Chart would be rendered here */}
    </div>
  </div>

  {/* Expanded content would be here */}
</div>
```

### 3.3 Stage Row

The stage row displays a stage with its details and loadings.

```javascriptreact
<div
  className="flex border-t border-slate-200 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
  style={{ height: `80px` }}
>
  <div
    className="border-r border-slate-200 dark:border-slate-800 flex items-center"
    style={{ width: `264px`, minWidth: `264px` }}
  >
    <div className="flex items-center w-full px-2 py-2">
      <div className="flex-grow">
        <div className="flex items-center">
          <span className="text-[14px] text-slate-700 dark:text-slate-300 font-medium truncate max-w-[220px] block ml-2">
            Stage Name
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400 ml-2 flex-shrink-0">
            3 loadings
          </span>
        </div>
      </div>
      <div className="flex-shrink-0 ml-auto">
        <button className="h-6 w-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700">
          <Plus size={14} />
        </button>
      </div>
    </div>
  </div>

  <div
    className="border-r border-slate-200 dark:border-slate-800 flex items-center justify-start"
    style={{ width: `150px`, minWidth: `150px` }}
  ></div>

  <div className="flex-1 flex relative">
    {/* Loading items would be rendered here */}
    <div className="absolute h-6 flex items-center justify-start text-xs font-medium px-2 truncate transition-all hover:shadow-md hover:z-10 cursor-pointer"
      style={{
        left: `50px`,
        width: `150px`,
        top: `5px`,
        height: `24px`,
        backgroundColor: "#bfdbfe",
        borderTop: `1px solid #93c5fd`,
        borderRight: `1px solid #93c5fd`,
        borderBottom: `1px solid #93c5fd`,
        borderLeft: `1px solid #93c5fd`,
        color: "#1e40af",
      }}
    >
      <span className="truncate">John Doe</span>
      <div className="flex items-center gap-1 ml-auto flex-shrink-0">
        <span className="bg-white/20 px-1 text-[10px] font-medium">1.0</span>
        <span className="bg-white/20 px-1 text-[10px] font-medium">K1</span>
      </div>
    </div>
  </div>
</div>
```

## 4. Resource Allocation Visualization

### 4.1 Loading Item

The loading item displays a resource allocation on the timeline.

```javascriptreact
<div
  className="absolute h-6 flex items-center justify-start text-xs font-medium px-2 truncate transition-all hover:shadow-md hover:z-10 cursor-pointer"
  style={{
    left: `50px`,
    width: `150px`,
    top: `5px`,
    height: `24px`,
    backgroundColor: "#bfdbfe",
    borderTop: `1px solid #93c5fd`,
    borderRight: `1px solid #93c5fd`,
    borderBottom: `1px solid #93c5fd`,
    borderLeft: `1px solid #93c5fd`,
    color: "#1e40af",
    zIndex: 5,
  }}
>
  <div className="flex items-center w-full overflow-hidden gap-1">
    <span className="truncate">John Doe</span>
    <div className="flex items-center gap-1 ml-auto flex-shrink-0">
      <span className="bg-white/20 px-1 text-[10px] font-medium">1.0</span>
      <span className="bg-white/20 px-1 text-[10px] font-medium">K1</span>
    </div>
  </div>
</div>
```

### 4.2 Section Charts

The section charts display resource allocation for a section.

```javascriptreact
<div className="absolute inset-0">
  <svg width="800px" height="100%" preserveAspectRatio="none">
    {/* Grid lines */}
    {Array.from({ length: 30 }).map((_, index) => (
      <line
        key={`grid-${index}`}
        x1={index * 25}
        y1="0"
        x2={index * 25}
        y2="100%"
        stroke="rgba(226, 232, 240, 0.7)"
        strokeWidth="1"
      />
    ))}

    {/* Horizontal center line */}
    <line
      x1="0"
      y1="32"
      x2={30 * 25}
      y2="32"
      stroke="rgba(226, 232, 240, 0.7)"
      strokeWidth="1"
    />

    {/* Chart rectangles */}
    {Array.from({ length: 30 }).map((_, i) => (
      <rect
        key={`total-${i}`}
        x={i * 25}
        y={32 - Math.random() * 20}
        width={25}
        height={Math.random() * 20}
        fill="rgba(167, 199, 231, 0.7)"
        stroke="#A7C7E7"
        strokeWidth="1"
      />
    ))}
  </svg>
</div>
```

### 4.3 Section Difference Chart

The section difference chart displays the difference between plan and fact values for a section.

```javascriptreact
<div className="absolute inset-0">
  {/* Center line */}
  <div className="absolute left-0 right-0 border-t border-gray-200 dark:border-gray-700" style={{ top: "50%" }}></div>

  <svg width="800px" height="100%" preserveAspectRatio="none">
    {/* Grid lines */}
    {Array.from({ length: 30 }).map((_, index) => (
      <line
        key={`grid-${index}`}
        x1={index * 25}
        y1="0"
        x2={index * 25}
        y2="100%"
        stroke="rgba(226, 232, 240, 0.7)"
        strokeWidth="1"
      />
    ))}

    {/* Pattern for negative areas */}
    <defs>
      <pattern id="negative-pattern" patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)">
        <line x1="0" y1="0" x2="0" y2="8" stroke="#ef4444" strokeWidth="2" />
      </pattern>
    </defs>

    {/* Positive rectangles */}
    {Array.from({ length: 15 }).map((_, i) => (
      <rect
        key={`pos-${i}`}
        x={i * 25}
        y={32 - Math.random() * 20}
        width={25}
        height={Math.random() * 20}
        fill="#89A9C9"
        opacity={0.7}
      />
    ))}

    {/* Negative rectangles */}
    {Array.from({ length: 15 }).map((_, i) => (
      <g key={`neg-${i}`}>
        <rect
          x={(i + 15) * 25}
          y={32}
          width={25}
          height={Math.random() * 20}
          fill="url(#negative-pattern)"
          stroke="#ef4444"
          strokeWidth={1}
          opacity={0.7}
        />
        <rect 
          x={(i + 15) * 25} 
          y={32} 
          width={25} 
          height={Math.random() * 20} 
          fill="#89A9C9" 
          opacity={0.3} 
        />
      </g>
    ))}
  </svg>
</div>
```

## 5. Department Employee Timeline

### 5.1 Department Employee Timeline Layout

The department employee timeline displays employee workloads for a department.

```javascriptreact
<div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t-2 border-primary/30 dark:border-primary/20 shadow-lg z-10">
  {/* Header */}
  <div className="flex items-center justify-between px-4 py-2 bg-slate-100 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700">
    <div className="flex items-center cursor-pointer">
      <div className="w-1 h-5 bg-primary rounded-full mr-2"></div>
      <h3 className="font-medium text-slate-800 dark:text-slate-200">
        Department Workload: Department Name
      </h3>
      <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">
        (12 employees)
      </span>
    </div>

    <div className="flex items-center gap-2">
      {/* Team filter */}
      <div className="flex items-center gap-2">
        <div className="flex items-center bg-white dark:bg-slate-900 rounded-md border border-slate-200 dark:border-slate-700 h-8">
          <div className="px-2 flex items-center gap-1">
            <Filter size={14} className="text-slate-500 dark:text-slate-400" />
            <span className="text-xs text-slate-600 dark:text-slate-300">Team:</span>
          </div>
          <select className="border-0 h-full min-w-[120px] focus:ring-0 focus:ring-offset-0 text-xs bg-transparent">
            <option value="all">All teams</option>
            <option value="team1">Team 1</option>
            <option value="team2">Team 2</option>
          </select>
        </div>
      </div>

      {/* Collapse/expand button */}
      <button
        className="p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 text-primary"
      >
        <ChevronDown size={16} />
      </button>
    </div>
  </div>

  {/* Timeline content */}
  <div className="max-h-[300px] overflow-auto bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
    <div className="flex">
      {/* Left panel with employee names */}
      <div
        className="sticky left-0 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 z-10 shadow-md"
        style={{
          width: `414px`,
          minWidth: `414px`,
        }}
      >
        {/* Teams and employees list */}
        <div>
          {/* Team header */}
          <div
            className="flex items-center px-4 py-1 bg-slate-100 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700/50 transition-colors"
            style={{ height: "32px" }}
          >
            <div className="mr-2 text-primary">
              <ChevronDown size={14} className="text-primary" />
            </div>
            <div className="flex-1">
              <span className="font-medium text-slate-700 dark:text-slate-300 text-sm">Team Name</span>
              <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">(5)</span>
            </div>
          </div>

          {/* Employee rows */}
          <div>
            {Array.from({ length: 5 }).map((_, index) => (
              <div
                key={index}
                className="flex items-center px-4 py-1 border-b border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/30"
                style={{ height: "40px" }}
              >
                <div className="flex-1">
                  <div className="font-medium text-slate-800 dark:text-slate-200 text-sm">Employee Name</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">Position</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel with dates and workload */}
      <div className="flex-1 overflow-x-auto">
        {/* Team rows */}
        <div>
          {/* Team header row */}
          <div className="flex border-b border-slate-200 dark:border-slate-800" style={{ height: "32px" }}>
            {Array.from({ length: 30 }).map((_, index) => (
              <div
                key={index}
                className="border-r border-slate-200 dark:border-slate-800"
                style={{ width: `25px`, minWidth: `25px`, height: "100%" }}
              ></div>
            ))}
          </div>

          {/* Employee rows */}
          {Array.from({ length: 5 }).map((_, employeeIndex) => (
            <div
              key={employeeIndex}
              className="flex border-b border-slate-200 dark:border-slate-800"
              style={{ height: "40px" }}
            >
              {Array.from({ length: 30 }).map((_, dayIndex) => {
                const workload = Math.random();
                let bgColor = "bg-yellow-50 dark:bg-yellow-900/20";
                let textColor = "text-yellow-700 dark:text-yellow-300";

                if (workload > 0 && workload < 0.8) {
                  bgColor = "bg-blue-50 dark:bg-blue-900/20";
                  textColor = "text-blue-700 dark:text-blue-300";
                } else if (workload >= 0.8 && workload <= 1.1) {
                  bgColor = "bg-green-50 dark:bg-green-900/20";
                  textColor = "text-green-700 dark:text-green-300";
                } else if (workload > 1.1) {
                  bgColor = "bg-red-50 dark:bg-red-900/20";
                  textColor = "text-red-700 dark:text-red-300";
                }

                return (
                  <div
                    key={dayIndex}
                    className={`
                      flex items-center justify-center border-r border-slate-200 dark:border-slate-800
                      ${dayIndex % 7 === 0 || dayIndex % 7 === 6 ? "bg-slate-50 dark:bg-slate-800/30" : ""}
                      ${workload > 0 ? bgColor : ""}
                    `}
                    style={{ width: `25px`, minWidth: `25px`, height: "100%" }}
                  >
                    {workload > 0 && (
                      <span className={`text-xs font-medium ${textColor}`}>{workload.toFixed(1)}</span>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
</div>
```

### 5.2 Team Group

The team group displays a group of employees belonging to a team.

```javascriptreact
<div>
  {/* Team header */}
  <div
    className="flex items-center px-4 py-1 bg-slate-100 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700/50 transition-colors"
    style={{ height: "32px" }}
  >
    <div className="mr-2 text-primary">
      <ChevronDown size={14} className="text-primary" />
    </div>
    <div className="flex-1">
      <span className="font-medium text-slate-700 dark:text-slate-300 text-sm">Team Name</span>
      <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">(5)</span>
    </div>
  </div>

  {/* Employee list */}
  <div>
    {Array.from({ length: 5 }).map((_, index) => (
      <div
        key={index}
        className="flex items-center px-4 py-1 border-b border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/30"
        style={{ height: "40px" }}
      >
        <div className="flex-1">
          <div className="font-medium text-slate-800 dark:text-slate-200 text-sm">Employee Name</div>
          <div className="text-xs text-slate-500 dark:text-slate-400">Position</div>
        </div>
      </div>
    ))}
  </div>
</div>
```

## 6. Filtering and Navigation

### 6.1 Project Filter Popover

The project filter popover allows users to filter projects by various criteria.

```javascriptreact
<div className="relative mt-1">
  <button
    className="h-7 w-7 p-0 flex items-center justify-center rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700"
  >
    <FolderKanban size={14} className="text-slate-500 dark:text-slate-400" />
    <div className="absolute top-0 -right-2 h-4 min-w-4 px-1 flex items-center justify-center bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 rounded-full">
      <span className="text-[10px] font-medium leading-none">3</span>
    </div>
  </button>

  <div className="absolute top-full left-0 mt-1 w-80 p-0 shadow-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-800 rounded-md z-50">
    <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
      <h3 className="font-medium text-slate-800 dark:text-slate-200 mb-2">Select Projects</h3>
      <div className="relative">
        <input
          placeholder="Search projects or managers..."
          className="h-8 text-sm pl-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 dark:text-slate-300 rounded-md w-full"
        />
        <Search size={14} className="absolute left-2.5 top-2 text-slate-400 dark:text-slate-500" />
      </div>
    </div>

    <div className="max-h-[350px] overflow-auto p-2">
      {/* Manager group */}
      <div className="mb-2">
        <div className="flex items-center p-2 bg-slate-50 dark:bg-slate-800/70 rounded-md cursor-pointer">
          <div className="mr-2">
            <ChevronDown size={16} className="text-slate-500" />
          </div>

          <div className="flex items-center flex-1">
            <input
              type="checkbox"
              className="mr-2"
            />
            <label className="font-medium text-slate-800 dark:text-slate-200 cursor-pointer flex-1">
              Manager Name
            </label>
            <span className="ml-auto bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300 px-1.5 py-0.5 rounded text-xs">
              3
            </span>
          </div>
        </div>

        {/* Project list */}
        <div className="ml-6 mt-1 space-y-1">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="flex items-center py-1 px-2">
              <input
                type="checkbox"
                className="mr-2"
              />
              <label className="text-sm cursor-pointer font-medium text-slate-800 dark:text-slate-200">
                Project Name {index + 1}
              </label>
            </div>
          ))}
        </div>
      </div>
    </div>

    <div className="p-3 border-t border-slate-100 dark:border-slate-700 flex flex-wrap gap-2 bg-slate-50 dark:bg-slate-800/50">
      <button
        className="h-8 px-2 flex items-center gap-1 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
        title="Select all projects"
      >
        <CheckSquare size={14} />
        <span>All</span>
      </button>
      <div className="flex gap-2 ml-auto">
        <button
          className="px-3 py-1 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md text-xs"
        >
          Cancel
        </button>
        <button
          className="px-3 py-1 bg-slate-800 hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 text-white rounded-md text-xs"
        >
          <Check size={14} className="mr-1 inline-block" />
          Apply
        </button>
      </div>
    </div>
  </div>
</div>
```

### 6.2 Detail Filter Popover

The detail filter popover allows users to filter by departments, teams, and employees.

```javascriptreact
<div className="relative mt-1">
  <button
    className="h-7 w-7 p-0 flex items-center justify-center rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700"
  >
    <Filter
      size={14}
      className="text-slate-500 dark:text-slate-400"
    />
    <div className="absolute top-0 -right-2 h-4 min-w-4 px-1 flex items-center justify-center bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 rounded-full">
      <span className="text-[10px] font-medium leading-none">5</span>
    </div>
  </button>

  <div className="absolute top-full left-0 mt-1 w-80 p-0 shadow-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-800 rounded-md z-50">
    <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-medium text-slate-800 dark:text-slate-200">Detailed Filters</h3>
        <button className="h-7 px-2 text-xs text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded">
          <X size={12} className="mr-1 inline-block" />
          Clear all
        </button>
      </div>
      <div className="relative">
        <input
          placeholder="Search..."
          className="h-8 text-sm pl-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 dark:text-slate-300 rounded-md w-full"
        />
        <Filter size={14} className="absolute left-2.5 top-2 text-slate-400 dark:text-slate-500" />
      </div>
    </div>

    <div className="border-b border-slate-100 dark:border-slate-700">
      <div className="grid grid-cols-3 bg-slate-100 dark:bg-slate-800/80">
        <button className="text-xs py-2 px-1 bg-white dark:bg-slate-900 relative font-medium">
          <Building2 size={14} className="mr-1 inline-block" />
          <span className="dark:text-slate-300">Departments</span>
          <span className="ml-1 h-4 min-w-4 text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-full inline-flex items-center justify-center px-1">
            2
          </span>
        </button>
        <button className="text-xs py-2 px-1 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/70">
          <Users size={14} className="mr-1 inline-block" />
          <span className="dark:text-slate-300">Teams</span>
          <span className="ml-1 h-4 min-w-4 text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-full inline-flex items-center justify-center px-1">
            1
          </span>
        </button>
        <button className="text-xs py-2 px-1 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/70">
          <User size={14} className="mr-1 inline-block" />
          <span className="dark:text-slate-300">Employees</span>
          <span className="ml-1 h-4 min-w-4 text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-full inline-flex items-center justify-center px-1">
            2
          </span>
        </button>
      </div>
    </div>

    <div className="max-h-[300px] overflow-auto p-4">
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="flex items-center space-x-2 py-1">
            <input
              type="checkbox"
              id={`dept-${index}`}
              className="rounded"
            />
            <label
              htmlFor={`dept-${index}`}
              className="text-sm cursor-pointer font-medium text-slate-800 dark:text-slate-200"
            >
              Department Name {index + 1}
            </label>
          </div>
        ))}
      </div>
    </div>

    <div className="p-3 border-t border-slate-100 dark:border-slate-700 flex justify-end bg-slate-50 dark:bg-slate-800/50">
      <button
        className="px-3 py-1 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md text-xs mr-2"
      >
        Cancel
      </button>
      <button
        className="px-3 py-1 bg-slate-800 hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 text-white rounded-md text-xs"
      >
        <Check size={14} className="mr-1 inline-block" />
        Apply
      </button>
    </div>
  </div>
</div>
```

### 6.3 Mode Switcher

The mode switcher allows users to switch between manager and department views.

```javascriptreact
<div className="flex items-center bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden h-7">
  <button
    className="p-1 flex items-center justify-center bg-slate-100 dark:bg-slate-700 text-primary"
  >
    <Users size={14} />
  </button>
  <button
    className="p-1 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/70"
  >
    <Building2 size={14} />
  </button>
</div>
```

### 6.4 Mode Selector

The mode selector allows users to select a specific manager or department based on the current mode.

```javascriptreact
<button
  className="h-7 px-1 py-0 text-xs border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 min-w-0 max-w-[90px] rounded-md flex items-center"
>
  <span className="truncate max-w-[60px] inline-block">All departments</span>
  <ChevronDown className="ml-0.5 h-3 w-3 shrink-0 opacity-50 flex-shrink-0" />
</button>

<div className="absolute top-full left-0 mt-1 w-[200px] p-0 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md z-50">
  <div className="dark:bg-slate-800">
    <div className="border-b border-slate-200 dark:border-slate-700">
      <input
        placeholder="Search department..."
        className="h-8 dark:bg-slate-800 dark:text-slate-200 w-full px-3 text-sm border-0 focus:outline-none"
      />
    </div>
    <div className="max-h-[200px] overflow-auto">
      <div>
        {Array.from({ length: 5 }).map((_, index) => (
          <div
            key={index}
            className="text-xs dark:text-slate-200 dark:hover:bg-slate-700 px-3 py-2 cursor-pointer flex items-center justify-between"
          >
            Department Name {index + 1}
            <Check className="ml-auto h-3 w-3 opacity-0" />
          </div>
        ))}
      </div>
    </div>
  </div>
</div>
```

## 7. Complete Layout Example

Here's a complete layout example that combines all the components:

```javascriptreact
<div className="relative w-full h-full bg-white dark:bg-slate-900">
  {/* Header with navigation and mode switcher */}
  <div className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2 flex items-center justify-between">
    <div className="flex items-center gap-3">
      <h1 className="text-lg font-semibold text-slate-800 dark:text-slate-200">Project Planning System</h1>

      <div className="flex items-center gap-2 ml-4">
        {/* Mode switcher */}
        <div className="flex items-center bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden h-7">
          <button className="p-1 flex items-center justify-center bg-slate-100 dark:bg-slate-700 text-primary">
            <Users size={14} />
          </button>
          <button className="p-1 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/70">
            <Building2 size={14} />
          </button>
        </div>
        
        {/* Mode selector */}
        <button className="h-7 px-1 py-0 text-xs border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 min-w-0 max-w-[90px] rounded-md flex items-center">
          <span className="truncate max-w-[60px] inline-block">All managers</span>
          <ChevronDown className="ml-0.5 h-3 w-3 shrink-0 opacity-50 flex-shrink-0" />
        </button>
      </div>
    </div>

    {/* Timeline navigation */}
    <div className="flex items-center gap-2">
      <div className="flex bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
        <button className="h-8 w-8 p-0 rounded-none border-r border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-primary">
          <ChevronsLeft className="h-4 w-4" />
        </button>
        <button className="h-8 w-8 p-0 rounded-none border-r border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-primary">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button className="h-8 px-3 rounded-none border-r border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-primary">
          <Calendar className="h-4 w-4 mr-1 inline-block" />
          <span className="text-xs">Today</span>
        </button>
        <button className="h-8 w-8 p-0 rounded-none border-r border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-primary">
          <ChevronRight className="h-4 w-4" />
        </button>
        <button className="h-8 w-8 p-0 rounded-none text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-primary">
          <ChevronsRight className="h-4 w-4" />
        </button>
      </div>
      <div className="text-sm text-slate-600 dark:text-slate-400">Jan 1, 2023 - Jan 31, 2023</div>
    </div>
  </div>

  <div className="min-w-[800px] bg-white dark:bg-slate-900 overflow-hidden relative">
    {/* Month and day headers */}
    <div className="flex bg-white dark:bg-slate-900">
      <div className="w-64 min-w-64 p-3 font-medium bg-white dark:bg-slate-900"></div>
      <div className="w-150 min-w-150 p-3 font-medium bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800"></div>
      <div className="flex-1 flex">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className="font-medium bg-white dark:bg-slate-900 text-center border-r border-slate-200 dark:border-slate-800"
            style={{ width: `${10 * 25}px` }}
          >
            <div className="py-2 border-b border-slate-200 dark:border-slate-800">
              <span className="text-gray-700 dark:text-gray-300 font-semibold">January 2023</span>
            </div>
          </div>
        ))}
      </div>
    </div>

    <div className="flex bg-white dark:bg-slate-900">
      <div className="w-64 min-w-64 p-3 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"></div>
      <div className="w-150 min-w-150 p-3 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"></div>
      <div className="flex-1 flex">
        {Array.from({ length: 30 }).map((_, index) => {
          const isWeekend = index % 7 === 0 || index % 7 === 6;
          const isToday = index === 10;

          return (
            <div
              key={index}
              className={`
                text-center text-xs border-r border-slate-200 dark:border-slate-800 
                flex items-center justify-center
                ${isWeekend ? "bg-gray-50 dark:bg-slate-800/50" : ""}
                ${isToday ? "bg-primary/5 dark:bg-primary/10" : ""}
              `}
              style={{ width: `25px`, minWidth: `25px` }}
            >
              <span
                className={`
                  rounded-full w-6 h-6 flex items-center justify-center
                  ${isToday ? "bg-primary text-white" : ""}
                `}
              >
                {(index % 31) + 1}
              </span>
            </div>
          );
        })}
      </div>
    </div>

    {/* Section rows */}
    {Array.from({ length: 3 }).map((_, sectionIndex) => (
      <div key={sectionIndex} className="group">
        {/* Section header row */}
        <div className="flex items-center hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer">
          <div
            className="p-3 font-medium border-r border-slate-200 dark:border-slate-800 flex items-center group-hover:bg-slate-50 dark:group-hover:bg-slate-800/50 transition-colors"
            style={{ width: `264px`, minWidth: `264px` }}
          >
            <div className="flex flex-col">
              <div className="flex items-center">
                <ChevronDown className="h-5 w-5 mr-2 text-gray-500 dark:text-gray-400" />
                <span className="font-semibold text-slate-800 dark:text-slate-200">Section {sectionIndex + 1}</span>
              </div>
              <div className="ml-7 mt-0.5">
                <div
                  className="text-xs px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-md border border-slate-200 dark:border-slate-700 inline-block max-w-[180px]"
                >
                  <span className="text-slate-600 dark:text-slate-300 truncate block">Project Name</span>
                </div>
              </div>
            </div>
          </div>

          {/* Responsible column */}
          <div
            className="border-r border-slate-200 dark:border-slate-800 flex items-center justify-center"
            style={{ width: `150px`, minWidth: `150px` }}
          >
            <div className="flex flex-col items-center p-2">
              <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 mb-1 overflow-hidden">
                <img src="/placeholder.svg?height=32&width=32&query=avatar" alt="Responsible" className="w-full h-full object-cover" />
              </div>
              <div className="text-xs font-medium text-slate-800 dark:text-slate-200">John Doe</div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400">Department</div>
            </div>
          </div>

          {/* Difference chart */}
          <div className="flex-1 relative h-16 bg-white dark:bg-slate-900">
            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(var(--primary) 1px, transparent 1px)", backgroundSize: "8px 8px" }}></div>
            
            {/* Center line */}
            <div className="absolute left-0 right-0 border-t border-gray-200 dark:border-gray-700" style={{ top: "50%" }}></div>

            {/* Chart rectangles would be here */}
          </div>
        </div>

        {/* Stage rows */}
        {Array.from({ length: 2 }).map((_, stageIndex) => (
          <div
            key={stageIndex}
            className="flex border-t border-slate-200 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
            style={{ height: `80px` }}
          >
            <div
              className="border-r border-slate-200 dark:border-slate-800 flex items-center"
              style={{ width: `264px`, minWidth: `264px` }}
            >
              <div className="flex items-center w-full px-2 py-2">
                <div className="flex-grow">
                  <div className="flex items-center">
                    <span className="text-[14px] text-slate-700 dark:text-slate-300 font-medium truncate max-w-[220px] block ml-2">
                      Stage {stageIndex + 1}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400 ml-2 flex-shrink-0">
                      3 loadings
                    </span>
                  </div>
                </div>
                <div className="flex-shrink-0 ml-auto">
                  <button className="h-6 w-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700">
                    <Plus size={14} />
                  </button>
                </div>
              </div>
            </div>

            <div
              className="border-r border-slate-200 dark:border-slate-800 flex items-center justify-start"
              style={{ width: `150px`, minWidth: `150px` }}
            ></div>

            <div className="flex-1 flex relative">
              {/* Loading items */}
              {Array.from({ length: 3 }).map((_, loadingIndex) => (
                <div
                  key={loadingIndex}
                  className="absolute h-6 flex items-center justify-start text-xs font-medium px-2 truncate transition-all hover:shadow-md hover:z-10 cursor-pointer"
                  style={{
                    left: `${(loadingIndex * 5 + 1) * 25}px`,
                    width: `${5 * 25}px`,
                    top: `${5 + loadingIndex * 26}px`,
                    height: `24px`,
                    backgroundColor: "#bfdbfe",
                    borderTop: `1px solid #93c5fd`,
                    borderRight: `1px solid #93c5fd`,
                    borderBottom: `1px solid #93c5fd`,
                    borderLeft: `1px solid #93c5fd`,
                    color: "#1e40af",
                    zIndex: 5,
                  }}
                >
                  <div className="flex items-center w-full overflow-hidden gap-1">
                    <span className="truncate">John Doe</span>
                    <div className="flex items-center gap-1 ml-auto flex-shrink-0">
                      <span className="bg-white/20 px-1 text-[10px] font-medium">1.0</span>
                      <span className="bg-white/20 px-1 text-[10px] font-medium">K1</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    ))}

    {/* Department employee timeline */}
    <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t-2 border-primary/30 dark:border-primary/20 shadow-lg z-10">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-100 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center cursor-pointer">
          <div className="w-1 h-5 bg-primary rounded-full mr-2"></div>
          <h3 className="font-medium text-slate-800 dark:text-slate-200">
            Department Workload: Department Name
          </h3>
          <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">
            (12 employees)
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Team filter */}
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-white dark:bg-slate-900 rounded-md border border-slate-200 dark:border-slate-700 h-8">
              <div className="px-2 flex items-center gap-1">
                <Filter size={14} className="text-slate-500 dark:text-slate-400" />
                <span className="text-xs text-slate-600 dark:text-slate-300">Team:</span>
              </div>
              <select className="border-0 h-full min-w-[120px] focus:ring-0 focus:ring-offset-0 text-xs bg-transparent">
                <option value="all">All teams</option>
                <option value="team1">Team 1</option>
                <option value="team2">Team 2</option>
              </select>
            </div>
          </div>

          {/* Collapse/expand button */}
          <button
            className="p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 text-primary"
          >
            <ChevronDown size={16} />
          </button>
        </div>
      </div>

      {/* Timeline content */}
      <div className="max-h-[300px] overflow-auto bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
        {/* Employee timeline content would be here */}
      </div>
    </div>
  </div>
</div>
```

## 8. Conclusion

This documentation provides a comprehensive guide to the UI layout and visual components of the Project Planning System. By following the patterns and examples provided, you can create a visually appealing timeline and table visualization for project planning and resource management.

The key components covered in this documentation include:

1. Timeline visualization with month and day headers
2. Table structure for displaying project sections and stages
3. Resource allocation visualization with loading items
4. Department employee timeline for workload tracking
5. Filtering and navigation components for user interaction


These components can be combined to create a complete project planning system UI that allows users to efficiently manage resources, track project progress, and visualize workloads across departments and teams.
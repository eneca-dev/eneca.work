### Technical Specification: Project Planning and Resource Management System

## 1. Introduction

### 1.1 Purpose

The Project Planning and Resource Management System is a comprehensive web application designed to facilitate efficient project planning, resource allocation, and workload management within an engineering organization. The system provides real-time visibility into project timelines, resource utilization, and departmental workloads, enabling project managers and department heads to make informed decisions about resource allocation and project scheduling.

### 1.2 Target Audience

The application is designed for:

- **Project Managers:** To plan, track, and manage project timelines and resource allocations
- **Department Heads:** To monitor department workloads and resource availability
- **Team Leaders:** To manage team assignments and workloads
- **Resource Planners:** To optimize resource allocation across multiple projects
- **Individual Contributors:** To view their assignments and workloads


### 1.3 System Overview

The Project Planning and Resource Management System provides a visual timeline-based interface for planning and tracking projects. It allows users to:

- View and manage multiple projects simultaneously
- Track project sections and tasks
- Assign resources to tasks with specific time allocations
- Monitor actual vs. planned resource utilization
- Filter and analyze data by various criteria (projects, departments, teams, employees)
- Switch between different view modes for different management perspectives


## 2. Overall Architecture

### 2.1 System Architecture

The application follows a modern client-side rendering architecture built with Next.js and React, utilizing the App Router pattern. The system is structured as follows:

```plaintext
┌─────────────────────────────────────────────────────────┐
│                      User Interface                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │
│  │ Project     │  │ Timeline    │  │ Resource        │  │
│  │ Management  │  │ Visualization│  │ Management     │  │
│  └─────────────┘  └─────────────┘  └─────────────────┘  │
└───────────────────────────┬─────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────┐
│                    Application Logic                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │
│  │ Project     │  │ Resource    │  │ Filtering &     │  │
│  │ Controllers │  │ Controllers │  │ Data Processing │  │
│  └─────────────┘  └─────────────┘  └─────────────────┘  │
└───────────────────────────┬─────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────┐
│                       Data Layer                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │
│  │ Project     │  │ Resource    │  │ User & Team     │  │
│  │ Repository  │  │ Repository  │  │ Repository      │  │
│  └─────────────┘  └─────────────┘  └─────────────────┘  │
└───────────────────────────┬─────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────┐
│                    External Services                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │
│  │ Database    │  │ Auth        │  │ Integration     │  │
│  │ Service     │  │ Service     │  │ Services        │  │
│  └─────────────┘  └─────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### 2.2 Key Components

#### 2.2.1 Frontend Components

- **Project Management Module:** Handles project creation, editing, and management
- **Timeline Visualization Module:** Renders Gantt-style charts and timelines
- **Resource Management Module:** Manages resource allocation and workload visualization
- **Filtering System:** Provides comprehensive filtering capabilities across multiple dimensions
- **View Mode System:** Supports different views (manager, department) for different user roles


#### 2.2.2 Data Management

- **Context Providers:** Manage application state and data flow
- **Data Processing Services:** Handle data transformation and aggregation
- **Repository Services:** Interface with backend APIs and data sources


#### 2.2.3 External Integrations

- **Authentication System:** Manages user authentication and authorization
- **Database Services:** Handles data persistence and retrieval
- **External APIs:** Integrates with other organizational systems as needed


### 2.3 Technology Stack

- **Frontend Framework:** Next.js with React (App Router)
- **UI Components:** Custom components with Tailwind CSS for styling
- **State Management:** React Context API with custom hooks
- **Data Visualization:** Custom SVG-based visualization components
- **Authentication:** JWT-based authentication system
- **Styling:** Tailwind CSS with dark mode support


## 3. Functional Requirements

### 3.1 Project Management

#### 3.1.1 Project Listing and Selection

**Description:**
Users can view a list of available projects and select one or multiple projects to work with.

**UI/UX Considerations:**

- Projects are displayed in a filterable dropdown menu
- Multiple projects can be selected simultaneously
- Selected projects are indicated with visual cues (badges, highlighting)


**Input/Output Specifications:**

- Input: User selection actions
- Output: Filtered list of projects, visual indication of selected projects


**Error Handling:**

- If no projects are available, display appropriate message
- Ensure at least one project is always selected


#### 3.1.2 Project Filtering

**Description:**
Users can filter projects by various criteria including project manager, status, and other attributes.

**UI/UX Considerations:**

- Filter controls are accessible via a popover interface
- Applied filters are visually indicated
- Filters can be easily cleared or modified


**Input/Output Specifications:**

- Input: Filter criteria selection
- Output: Filtered project list based on criteria


**Error Handling:**

- Handle invalid filter combinations gracefully
- Provide feedback when no projects match filter criteria


### 3.2 Timeline Visualization

#### 3.2.1 Gantt Chart View

**Description:**
The system provides a Gantt-style chart view showing project sections, tasks, and resource allocations over time.

**UI/UX Considerations:**

- Timeline is scrollable horizontally
- Time periods are clearly labeled (days, months)
- Today's date is highlighted
- Weekends are visually distinguished
- Sections can be expanded/collapsed


**Input/Output Specifications:**

- Input: Date range selection, expand/collapse actions
- Output: Visual timeline with sections, tasks, and resource allocations


**Error Handling:**

- Handle empty date ranges
- Provide fallback visualization for missing data


#### 3.2.2 Timeline Navigation

**Description:**
Users can navigate through the timeline, changing the visible date range.

**UI/UX Considerations:**

- Navigation controls are intuitive (prev/next, today)
- Current date range is clearly displayed
- Navigation is smooth and responsive


**Input/Output Specifications:**

- Input: Navigation actions (prev, next, today)
- Output: Updated timeline view with new date range


**Error Handling:**

- Prevent navigation beyond available data boundaries
- Handle date calculation edge cases


### 3.3 Resource Management

#### 3.3.1 Resource Assignment

**Description:**
Users can assign resources (employees) to tasks with specific time allocations (rates).

**UI/UX Considerations:**

- Resource assignment interface is modal-based
- Available resources are searchable
- Assignment details (dates, rates) are easily configurable


**Input/Output Specifications:**

- Input: Resource selection, date range, allocation rate
- Output: Updated task with resource assignment


**Error Handling:**

- Validate date ranges (end date must be after start date)
- Validate allocation rates (must be between 0.1 and 2.0)
- Prevent duplicate assignments


#### 3.3.2 Resource Utilization Visualization

**Description:**
The system visualizes resource utilization across projects, showing planned vs. actual allocation.

**UI/UX Considerations:**

- Different visualization types (bars, areas) for different metrics
- Color coding for different resource categories
- Interactive elements with tooltips showing detailed information


**Input/Output Specifications:**

- Input: Timeline selection, resource filters
- Output: Visual representation of resource utilization


**Error Handling:**

- Handle missing or incomplete data
- Provide fallback visualizations


#### 3.3.3 Department Workload View

**Description:**
Department heads can view workload distribution across their department, teams, and individual employees.

**UI/UX Considerations:**

- Hierarchical view (department > teams > employees)
- Color-coded workload indicators
- Expandable/collapsible sections


**Input/Output Specifications:**

- Input: Department selection, team filters
- Output: Workload visualization for department resources


**Error Handling:**

- Handle departments with no assigned resources
- Provide appropriate messaging for empty states


### 3.4 Filtering and Analysis

#### 3.4.1 Multi-dimensional Filtering

**Description:**
Users can filter data by multiple dimensions including projects, departments, teams, and employees.

**UI/UX Considerations:**

- Filters are accessible via popover interfaces
- Applied filters are clearly indicated
- Filters can be easily cleared or modified


**Input/Output Specifications:**

- Input: Filter selections across multiple dimensions
- Output: Filtered view based on selected criteria


**Error Handling:**

- Handle invalid filter combinations
- Provide feedback when no data matches filter criteria


#### 3.4.2 View Mode Switching

**Description:**
Users can switch between different view modes (manager view, department view) to see different perspectives of the data.

**UI/UX Considerations:**

- View mode controls are prominently displayed
- Current view mode is clearly indicated
- Transition between views is smooth


**Input/Output Specifications:**

- Input: View mode selection
- Output: Updated interface based on selected view mode


**Error Handling:**

- Handle unauthorized view mode access based on user role
- Preserve applicable filters when switching views


### 3.5 Section and Task Management

#### 3.5.1 Section Responsibility Assignment

**Description:**
Users can assign responsible persons and departments to project sections.

**UI/UX Considerations:**

- Responsibility assignment controls are accessible directly in the interface
- Current assignments are clearly displayed
- Assignment changes are confirmed with feedback


**Input/Output Specifications:**

- Input: Responsible person selection, department selection
- Output: Updated section with new responsibility assignments


**Error Handling:**

- Validate that selected responsible persons exist
- Handle cases where department information is missing


#### 3.5.2 Task Creation and Management

**Description:**
Users can create, edit, and delete tasks within project sections.

**UI/UX Considerations:**

- Task management controls are intuitive
- Task details are easily editable
- Confirmation is required for destructive actions


**Input/Output Specifications:**

- Input: Task details (name, dates, etc.)
- Output: Created or updated task


**Error Handling:**

- Validate required task fields
- Prevent creation of duplicate tasks
- Confirm deletion of tasks with assigned resources


## 4. Data Model

### 4.1 Core Entities

#### 4.1.1 Project

**Description:**
Represents a project within the organization.

**Attributes:**

- `id`: Unique identifier (string)
- `ws_project_id`: External system project ID (number)
- `name`: Project name (string)
- `status`: Project status (string)
- `user_to`: Project manager reference (object)
- `date_start`: Project start date (Date)
- `date_end`: Project end date (Date)
- `tags`: Project tags (object)
- `sections`: Array of project sections (Section[])


**Relationships:**

- One-to-many with Section
- Many-to-one with User (project manager)


#### 4.1.2 Section

**Description:**
Represents a major section or component of a project.

**Attributes:**

- `id`: Unique identifier (string)
- `ws_project_id`: External system project ID (number)
- `ws_task_id`: External system task ID (number)
- `name`: Section name (string)
- `page`: External system reference page (string)
- `user_to`: Section owner reference (object)
- `date_start`: Section start date (Date)
- `date_end`: Section end date (Date)
- `tags`: Section tags (object)
- `comments`: Section comments (array)
- `tasks`: Array of tasks (Task[])
- `responsible`: Responsible person (SectionResponsible)
- `department`: Department name (string)
- `projectName`: Project name for display (string)
- `stages`: Array of stages (Stage[])


**Relationships:**

- Many-to-one with Project
- One-to-many with Task
- Many-to-one with SectionResponsible
- Many-to-one with Department


#### 4.1.3 Task

**Description:**
Represents a specific task within a project section.

**Attributes:**

- `id`: Unique identifier (string)
- `ws_task_id`: External system task ID (number)
- `ws_subtask_id`: External system subtask ID (number)
- `name`: Task name (string)
- `page`: External system reference page (string)
- `user_to`: Task owner reference (object)
- `date_start`: Task start date (Date)
- `date_end`: Task end date (Date)
- `tags`: Task tags (object)
- `comments`: Task comments (array)
- `loadings`: Array of resource loadings (Loading[])


**Relationships:**

- Many-to-one with Section
- One-to-many with Loading


#### 4.1.4 Loading

**Description:**
Represents a resource allocation to a specific task.

**Attributes:**

- `id`: Unique identifier (string)
- `task_id`: Associated task ID (string)
- `user_id`: Associated user ID (string)
- `rate`: Allocation rate (number, 0.1-2.0)
- `date_start`: Allocation start date (Date)
- `date_end`: Allocation end date (Date)
- `type`: Loading type (enum: "Plan" | "Fact")
- `created_at`: Creation timestamp (Date)
- `updated_at`: Last update timestamp (Date)
- `executorId`: Legacy field for user ID (string)


**Relationships:**

- Many-to-one with Task
- Many-to-one with User


### 4.2 User and Organization Entities

#### 4.2.1 Profile

**Description:**
Represents a user profile within the system.

**Attributes:**

- `user_id`: Unique identifier (string)
- `first_name`: User's first name (string)
- `last_name`: User's last name (string)
- `department_id`: Associated department ID (string)
- `team_id`: Associated team ID (string)
- `position_id`: Associated position ID (string)
- `category_id`: Associated category ID (string)
- `role_id`: Associated role ID (string)
- `email`: User's email address (string)
- `created_at`: Creation timestamp (string)
- `avatar_url`: URL to user's avatar image (string)


**Relationships:**

- Many-to-one with Department
- Many-to-one with Team
- Many-to-one with Position
- Many-to-one with Category
- Many-to-one with Role


#### 4.2.2 Team

**Description:**
Represents a team within the organization.

**Attributes:**

- `team_id`: Unique identifier (string)
- `ws_team_id`: External system team ID (number)
- `team_name`: Team name (string)
- `department_id`: Associated department ID (string)


**Relationships:**

- Many-to-one with Department
- One-to-many with Profile


#### 4.2.3 Department

**Description:**
Represents a department within the organization.

**Attributes:**

- `department_id`: Unique identifier (string)
- `ws_department_id`: External system department ID (number)
- `department_name`: Department name (string)


**Relationships:**

- One-to-many with Team
- One-to-many with Profile


#### 4.2.4 Position

**Description:**
Represents a job position within the organization.

**Attributes:**

- `position_id`: Unique identifier (string)
- `ws_position_id`: External system position ID (number)
- `position_name`: Position name (string)


**Relationships:**

- One-to-many with Profile


#### 4.2.5 Category

**Description:**
Represents a resource category (e.g., skill level or specialization).

**Attributes:**

- `category_id`: Unique identifier (string)
- `ws_category_id`: External system category ID (number)
- `category_name`: Category name (string)


**Relationships:**

- One-to-many with Profile


#### 4.2.6 Role

**Description:**
Represents a user role within the system.

**Attributes:**

- `id`: Unique identifier (string)
- `name`: Role name (string)
- `description`: Role description (string)
- `created_at`: Creation timestamp (string)


**Relationships:**

- One-to-many with Profile


### 4.3 Entity Relationships Diagram

```mermaid
Entity Relationship Diagram.download-icon {
            cursor: pointer;
            transform-origin: center;
        }
        .download-icon .arrow-part {
            transition: transform 0.35s cubic-bezier(0.35, 0.2, 0.14, 0.95);
             transform-origin: center;
        }
        button:has(.download-icon):hover .download-icon .arrow-part, button:has(.download-icon):focus-visible .download-icon .arrow-part {
          transform: translateY(-1.5px);
        }
        #mermaid-diagram-r53i{font-family:var(--font-geist-sans);font-size:12px;fill:#000000;}#mermaid-diagram-r53i .error-icon{fill:#552222;}#mermaid-diagram-r53i .error-text{fill:#552222;stroke:#552222;}#mermaid-diagram-r53i .edge-thickness-normal{stroke-width:1px;}#mermaid-diagram-r53i .edge-thickness-thick{stroke-width:3.5px;}#mermaid-diagram-r53i .edge-pattern-solid{stroke-dasharray:0;}#mermaid-diagram-r53i .edge-thickness-invisible{stroke-width:0;fill:none;}#mermaid-diagram-r53i .edge-pattern-dashed{stroke-dasharray:3;}#mermaid-diagram-r53i .edge-pattern-dotted{stroke-dasharray:2;}#mermaid-diagram-r53i .marker{fill:#666;stroke:#666;}#mermaid-diagram-r53i .marker.cross{stroke:#666;}#mermaid-diagram-r53i svg{font-family:var(--font-geist-sans);font-size:12px;}#mermaid-diagram-r53i p{margin:0;}#mermaid-diagram-r53i .entityBox{fill:#eee;stroke:#999;}#mermaid-diagram-r53i .attributeBoxOdd{fill:#ffffff;stroke:#999;}#mermaid-diagram-r53i .attributeBoxEven{fill:#f2f2f2;stroke:#999;}#mermaid-diagram-r53i .relationshipLabelBox{fill:hsl(-160, 0%, 93.3333333333%);opacity:0.7;background-color:hsl(-160, 0%, 93.3333333333%);}#mermaid-diagram-r53i .relationshipLabelBox rect{opacity:0.5;}#mermaid-diagram-r53i .relationshipLine{stroke:#666;}#mermaid-diagram-r53i .entityTitleText{text-anchor:middle;font-size:18px;fill:#000000;}#mermaid-diagram-r53i #MD_PARENT_START{fill:#f5f5f5!important;stroke:#666!important;stroke-width:1;}#mermaid-diagram-r53i #MD_PARENT_END{fill:#f5f5f5!important;stroke:#666!important;stroke-width:1;}#mermaid-diagram-r53i .flowchart-link{stroke:hsl(var(--gray-400));stroke-width:1px;}#mermaid-diagram-r53i .marker,#mermaid-diagram-r53i marker,#mermaid-diagram-r53i marker *{fill:hsl(var(--gray-400))!important;stroke:hsl(var(--gray-400))!important;}#mermaid-diagram-r53i .label,#mermaid-diagram-r53i text,#mermaid-diagram-r53i text>tspan{fill:hsl(var(--black))!important;color:hsl(var(--black))!important;}#mermaid-diagram-r53i .background,#mermaid-diagram-r53i rect.relationshipLabelBox{fill:hsl(var(--white))!important;}#mermaid-diagram-r53i .entityBox,#mermaid-diagram-r53i .attributeBoxEven{fill:hsl(var(--gray-150))!important;}#mermaid-diagram-r53i .attributeBoxOdd{fill:hsl(var(--white))!important;}#mermaid-diagram-r53i .label-container,#mermaid-diagram-r53i rect.actor{fill:hsl(var(--white))!important;stroke:hsl(var(--gray-400))!important;}#mermaid-diagram-r53i line{stroke:hsl(var(--gray-400))!important;}#mermaid-diagram-r53i :root{--mermaid-font-family:var(--font-geist-sans);}ProjectSectionTaskLoadingProfileDepartmentTeamPositionCategoryRolecontainscontainshasbelongs_tobelongs_tohashashasbelongs_toresponsibleassigned_toassigned_tomanaged_by
```

### 4.4 Data Flow

The system's data flows through the following primary paths:

1. **Project Planning Flow:**

1. Project creation → Section definition → Task creation → Resource assignment



2. **Resource Management Flow:**

1. Resource definition → Team assignment → Department assignment → Task allocation



3. **Reporting and Analysis Flow:**

1. Data collection → Aggregation → Filtering → Visualization





## 5. Non-Functional Requirements

### 5.1 Performance

- The application must render timeline views with up to 100 tasks within 2 seconds
- UI interactions (expanding/collapsing, filtering) must respond within 300ms
- Data loading operations must show appropriate loading indicators for operations taking longer than 500ms


### 5.2 Usability

- The interface must be responsive and work on desktop screens with minimum resolution of 1280x720
- The application must support both light and dark themes
- All interactive elements must have appropriate hover and focus states
- The application must provide clear visual feedback for all user actions


### 5.3 Compatibility

- The application must function correctly in the latest versions of Chrome, Firefox, Safari, and Edge browsers
- The application must support internationalization for Russian and English languages


### 5.4 Security

- All data access must be controlled through appropriate authorization checks
- Sensitive data must not be exposed in client-side code
- User actions must be logged for audit purposes


## 6. Appendices

### 6.1 Glossary

- **Project:** A collection of related work items with defined start and end dates
- **Section:** A major component or area of work within a project
- **Task:** A specific work item within a section
- **Loading:** A resource allocation to a specific task
- **Rate:** The allocation percentage of a resource (e.g., 0.5 = half-time, 1.0 = full-time)
- **Department:** An organizational unit containing multiple teams
- **Team:** A group of employees working together
- **Category:** A classification of employee skill level or specialization


### 6.2 References

- Project Management Institute (PMI) standards
- Organization-specific resource management guidelines
- External system integration specifications
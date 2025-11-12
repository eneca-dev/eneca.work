# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
npm run dev        # Start development server (localhost:3000)
npm run build      # Build for production
npm run start      # Start production server
npm run lint       # Run ESLint
```

**Note:** No test scripts are currently configured in package.json.

## Technology Stack

- **Framework:** Next.js 15.2.4 (App Router architecture)
- **Frontend:** React 19, TypeScript 5, Tailwind CSS 3.4
- **UI Components:** Radix UI primitives + Shadcn/ui component library
- **Backend:** Supabase (PostgreSQL database, authentication, realtime subscriptions, edge functions)
- **State Management:** Zustand (NOT Redux - despite what some old docs may say)
- **Forms:** React Hook Form + Zod validation
- **Rich Text:** TipTap editor
- **Monitoring:** Sentry for error tracking and performance monitoring
- **AI Integration:** N8N workflow automation for GPT-4o-mini chat

## Architecture Overview

### Module-Based Architecture

The application follows a strict **module-first architecture**. Each major feature is a self-contained module in `/modules/`:

```
modules/
├── planning/              # Resource planning & timeline (Gantt chart)
├── permissions/          # Dynamic permission system
├── notifications/        # Real-time notification system
├── chat/                 # AI chatbot integration
├── calendar/            # Event calendar
├── projects/            # Project management
├── dashboard/           # Dashboard cards and metrics
├── [25+ other modules]
```

**Module Structure Pattern:**
Each module typically contains:
- `components/` - React components
- `hooks/` - Custom React hooks
- `api/` - API client functions
- `types/` - TypeScript interfaces
- `stores/` - Zustand stores (if needed)
- `index.ts` - Public API exports

### Database-First Approach

The application heavily relies on PostgreSQL views for data aggregation and business logic:

- **Key Views:** `view_section_hierarchy`, `view_sections_with_loadings`, `view_users`, `view_employee_workload`
- **Access Pattern:**
  - Client-side: `createClient()` from `@/utils/supabase/client`
  - Server-side: Use SSR utilities from `@/utils/supabase/*`
  - Centralized queries in `lib/supabase-client.ts`
- **Schema Documentation:** See `supabase-db.sql` and `supabase-views.md`

### Permission System

Dynamic, database-driven permission system:

```
profiles.role_id → roles.id → role_permissions → permissions.name
```

**Usage:**
```typescript
// Component guard
<PermissionGuard permission="users.admin_panel">
  <AdminPanel />
</PermissionGuard>

// Programmatic check
const canEdit = useHasPermission('users.edit.all')
```

- Permissions loaded at runtime from database
- No hardcoded permission checks
- Uses `usePermissionsLoader()` hook
- Integrated with Sentry for access tracing

## State Management

**Zustand Stores** (NOT Redux):

```typescript
// Core stores in /stores/
useUserStore           // Authentication and user profile
useNotificationsStore  // Real-time notifications
useCalendarStore       // Calendar state
useUiStore            // UI state (sidebar, theme, filters)
useSettingsStore      // Application settings

// Module-specific stores in modules/*/stores/
usePlanningStore      // Planning module state
// ... 20+ other module stores
```

**Server State:**
- TanStack Query (`@tanstack/react-query`) for server state caching
- Supabase Realtime for live updates
- Custom hooks wrap query logic

**Form State:**
- React Hook Form for all forms
- Zod schemas for validation
- Type-safe with TypeScript

## Key Patterns

### 1. Real-Time Updates

```typescript
// Subscribe to database changes
supabase
  .channel('notifications')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'notifications'
  }, handler)
  .subscribe()
```

### 2. API Routes (App Router)

```
app/api/
├── auth/              # Authentication endpoints
├── chat/              # Chat gateway (proxies to N8N at port 5000)
├── users/             # User operations
├── admin/             # Admin operations
└── [other endpoints]
```

- Rate limiting implemented on sensitive routes
- JWT authentication for API calls
- Middleware in `middleware.ts` handles session management

### 3. Component Architecture

- **Base Components:** All UI components in `/components/ui/` (Shadcn pattern)
- **Shared Components:** `/components/` for cross-module components
- **Module Components:** Module-specific in `modules/*/components/`
- **Pattern:** Extensive use of `forwardRef` and composition

### 4. Chat System

- Chat button integrated in dashboard layout
- Proxies requests to N8N webhook (localhost:5000 → N8N)
- Stores conversations in `chat_conversations` and `chat_messages` tables
- Uses GPT-4o-mini via N8N integration
- Supports task-specific and general conversations

### 5. Error Handling

- Sentry integration throughout application
- Custom error boundaries per module
- `PermissionsErrorBoundary` for permission errors
- Structured error responses from API routes

## Important Conventions

### Naming Conventions
- **Database:** `snake_case` (e.g., `user_id`, `created_at`)
- **TypeScript:** `camelCase` (e.g., `userId`, `createdAt`)
- **Components:** `PascalCase` (e.g., `UserProfile`)
- **Files:** `kebab-case` for components, `camelCase` for utilities

### Language
- **All UI text in Russian** (монолingual application)
- No i18n library used
- Date formatting with `date-fns`

### Theme System
- Next-themes for dark/light mode
- Custom primary color: `#1e7260` (teal/green)
- CSS variables in `globals.css`
- `ThemeProvider` + `ThemeSync` pattern

## Critical Information

1. **State Management:** Application uses **Zustand**, NOT Redux (some old docs incorrectly mention Redux)

2. **Module Boundaries:** Modules should remain self-contained with clear public APIs through `index.ts`

3. **Permission Checks:** Always use database-driven permission checks, never hardcode permissions

4. **Database Access:** Prefer using existing views over direct table queries to avoid N+1 problems

5. **Type Safety:** Extensive TypeScript usage - maintain type safety across database types (`types/db.ts`)

6. **Realtime:** Many features require Supabase Realtime subscriptions - remember to unsubscribe in cleanup

7. **Sentry:** Integrate Sentry tracing for new features (see `.cursorrules/rules.md` for examples)

8. **App Router:** Uses Next.js 15 App Router (NOT Pages Router) - server components by default

## Module Documentation

For detailed module-specific documentation, refer to individual module READMEs:
- `modules/permissions/README.md` - Permission system details
- `modules/chat/README.md` - Chat system architecture
- `modules/notifications/README.md` - Notification system
- `modules/planning/README.md` - Planning module (resource allocation, Gantt chart)

## Additional Resources

- `docs/roles-and-permissions.md` - Detailed permission system documentation
- `docs/modules.md` - Module architecture overview
- `supabase-db.sql` - Complete database schema
- `supabase-views.md` - Database views documentation
- `chat-system-prompts.md` - Chat AI prompts and behavior

/**
 * Permissions Debug Panel
 *
 * Информационная панель для отладки разрешений.
 * Показывает текущее состояние аутентификации, роли, permissions и scope.
 */

'use client'

import { useState, useMemo } from 'react'
import { ChevronDown, ChevronUp, Bug, Shield, User, Lock, Unlock, AlertTriangle, CheckCircle, Database } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUserStore } from '@/stores/useUserStore'
import { usePermissionsStore } from '@/modules/permissions/store/usePermissionsStore'
import { useFilterContext } from '@/modules/permissions'

export function PermissionsDebugPanel() {
  const [isExpanded, setIsExpanded] = useState(false)

  // User store
  const isAuthenticated = useUserStore((s) => s.isAuthenticated)
  const userId = useUserStore((s) => s.id)
  const email = useUserStore((s) => s.email)

  // Permissions store
  const permissions = usePermissionsStore((s) => s.permissions)
  const filterScope = usePermissionsStore((s) => s.filterScope)
  const orgContext = usePermissionsStore((s) => s.orgContext)
  const isLoading = usePermissionsStore((s) => s.isLoading)
  const error = usePermissionsStore((s) => s.error)

  // Filter context from server (TanStack Query)
  const { data: serverContext, isLoading: serverLoading, error: serverError } = useFilterContext()

  // Database connection info
  const dbInfo = useMemo(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    const isBackup = url.includes('chzoheyqiutglrmdtacr')
    const isProduction = url.includes('gvrcbvifirhxxdnvrwlz')
    const projectRef = url.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] || 'unknown'
    return {
      url,
      projectRef,
      isBackup,
      isProduction,
      environment: isBackup ? 'BACKUP' : isProduction ? 'PRODUCTION' : 'UNKNOWN'
    }
  }, [])

  // Filter scope permissions
  const filterScopePermissions = permissions.filter((p) => p.startsWith('filters.scope.'))
  const hierarchyPermissions = permissions.filter((p) => p.startsWith('hierarchy.'))

  // Status indicators
  const isAdmin = filterScope?.level === 'all'
  const hasFiltersUnlocked = filterScope?.isLocked === false

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-md">
      {/* Toggle button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-lg shadow-lg transition-colors',
          'bg-amber-500/90 hover:bg-amber-500 text-amber-950',
          'border border-amber-600/50'
        )}
      >
        <Bug className="h-4 w-4" />
        <span className="text-sm font-medium">Debug</span>
        {/* Database indicator */}
        <span className={cn(
          'px-1.5 py-0.5 rounded text-xs font-bold',
          dbInfo.isBackup && 'bg-emerald-600 text-white',
          dbInfo.isProduction && 'bg-red-600 text-white',
          !dbInfo.isBackup && !dbInfo.isProduction && 'bg-amber-600 text-white'
        )}>
          {dbInfo.isBackup ? 'BACKUP' : dbInfo.isProduction ? 'PROD' : '???'}
        </span>
        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
      </button>

      {/* Expanded panel */}
      {isExpanded && (
        <div className="mt-2 p-4 rounded-lg shadow-xl bg-zinc-900 border border-zinc-700 text-zinc-100 text-xs font-mono max-h-[70vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-zinc-700">
            <h3 className="text-sm font-semibold text-amber-400">Permissions Debug</h3>
            {isLoading || serverLoading ? (
              <span className="text-zinc-400">Loading...</span>
            ) : error || serverError ? (
              <span className="text-red-400 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Error
              </span>
            ) : (
              <span className="text-emerald-400 flex items-center gap-1">
                <CheckCircle className="h-3 w-3" />
                OK
              </span>
            )}
          </div>

          {/* Database Connection */}
          <Section title="Database" icon={Database}>
            <Row
              label="Environment"
              value={dbInfo.environment}
              highlight={dbInfo.isBackup}
              status={dbInfo.isBackup ? true : dbInfo.isProduction ? false : undefined}
            />
            <Row label="Project Ref" value={dbInfo.projectRef} mono />
            <div className="mt-1">
              {dbInfo.isBackup ? (
                <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded text-xs">
                  Safe for development
                </span>
              ) : dbInfo.isProduction ? (
                <span className="px-2 py-1 bg-red-500/20 text-red-400 rounded text-xs">
                  PRODUCTION - Be careful!
                </span>
              ) : (
                <span className="px-2 py-1 bg-amber-500/20 text-amber-400 rounded text-xs">
                  Unknown environment
                </span>
              )}
            </div>
          </Section>

          {/* Auth State */}
          <Section title="Auth State" icon={User}>
            <Row label="Authenticated" value={isAuthenticated ? 'Yes' : 'No'} status={isAuthenticated} />
            <Row label="User ID" value={userId || 'null'} mono />
            <Row label="Email" value={email || 'null'} />
          </Section>

          {/* Filter Scope (from store) */}
          <Section title="Filter Scope (Store)" icon={Shield}>
            <Row
              label="Level"
              value={filterScope?.level || 'null'}
              highlight={filterScope?.level === 'all'}
            />
            <Row
              label="Is Locked"
              value={filterScope?.isLocked ? 'Yes' : 'No'}
              status={!filterScope?.isLocked}
              icon={filterScope?.isLocked ? Lock : Unlock}
            />
            {filterScope?.subdivisionIds?.length ? (
              <Row label="Subdivision IDs" value={filterScope.subdivisionIds.join(', ')} mono />
            ) : null}
            {filterScope?.departmentIds?.length ? (
              <Row label="Department IDs" value={filterScope.departmentIds.join(', ')} mono />
            ) : null}
            {filterScope?.teamIds?.length ? (
              <Row label="Team IDs" value={filterScope.teamIds.join(', ')} mono />
            ) : null}
            {filterScope?.projectIds?.length ? (
              <Row label="Project IDs" value={filterScope.projectIds.join(', ')} mono />
            ) : null}
          </Section>

          {/* Server Context (from TanStack Query) */}
          <Section title="Server Context (Query)" icon={Shield}>
            <Row
              label="Scope Level"
              value={serverContext?.scope?.level || 'null'}
              highlight={serverContext?.scope?.level === 'all'}
            />
            <Row label="Primary Role" value={serverContext?.primaryRole || 'null'} />
            <Row label="Roles" value={serverContext?.roles?.join(', ') || 'null'} />
            <Row label="Own Team" value={serverContext?.ownTeamName || 'null'} />
            <Row label="Own Department" value={serverContext?.ownDepartmentName || 'null'} />
            <Row label="Own Subdivision" value={serverContext?.ownSubdivisionName || 'null'} />
            {serverContext?.leadTeamName && (
              <Row label="Lead Team" value={serverContext.leadTeamName} highlight />
            )}
            {serverContext?.headDepartmentName && (
              <Row label="Head Department" value={serverContext.headDepartmentName} highlight />
            )}
            {serverContext?.headSubdivisionName && (
              <Row label="Head Subdivision" value={serverContext.headSubdivisionName} highlight />
            )}
            {serverContext?.managedProjectNames?.length ? (
              <Row label="Managed Projects" value={serverContext.managedProjectNames.join(', ')} />
            ) : null}
          </Section>

          {/* Filter Scope Permissions */}
          <Section title="Filter Scope Permissions" icon={Lock}>
            {filterScopePermissions.length > 0 ? (
              filterScopePermissions.map((p) => (
                <Row key={p} label={p} value="granted" status />
              ))
            ) : (
              <Row label="No filter.scope.* permissions" value="" />
            )}
          </Section>

          {/* Hierarchy Permissions */}
          <Section title="Hierarchy Permissions" icon={Shield}>
            {hierarchyPermissions.length > 0 ? (
              hierarchyPermissions.map((p) => (
                <Row key={p} label={p} value="granted" status />
              ))
            ) : (
              <Row label="No hierarchy.* permissions" value="" />
            )}
          </Section>

          {/* All Permissions Count */}
          <Section title="All Permissions" icon={Shield}>
            <Row label="Total Count" value={String(permissions.length)} />
            <details className="mt-1">
              <summary className="cursor-pointer text-zinc-400 hover:text-zinc-200">
                Show all permissions
              </summary>
              <div className="mt-2 max-h-32 overflow-y-auto bg-zinc-800 rounded p-2">
                {permissions.map((p) => (
                  <div key={p} className="text-zinc-300 py-0.5">
                    {p}
                  </div>
                ))}
              </div>
            </details>
          </Section>

          {/* Org Context */}
          <Section title="Org Context (Store)" icon={User}>
            <Row label="Own Team ID" value={orgContext?.ownTeamId || 'null'} mono />
            <Row label="Own Department ID" value={orgContext?.ownDepartmentId || 'null'} mono />
            <Row label="Own Subdivision ID" value={orgContext?.ownSubdivisionId || 'null'} mono />
            <Row label="Lead Team ID" value={orgContext?.leadTeamId || 'null'} mono />
            <Row label="Head Department ID" value={orgContext?.headDepartmentId || 'null'} mono />
            <Row label="Head Subdivision ID" value={orgContext?.headSubdivisionId || 'null'} mono />
            <Row
              label="Managed Project IDs"
              value={orgContext?.managedProjectIds?.length ? String(orgContext.managedProjectIds.length) : '0'}
            />
          </Section>

          {/* Errors */}
          {(error || serverError) && (
            <Section title="Errors" icon={AlertTriangle}>
              {error && <Row label="Store Error" value={error} />}
              {serverError && <Row label="Query Error" value={String(serverError)} />}
            </Section>
          )}

          {/* Summary */}
          <div className="mt-3 pt-2 border-t border-zinc-700">
            <div className="flex items-center gap-2">
              {isAdmin ? (
                <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded text-xs">
                  ADMIN - Full Access
                </span>
              ) : (
                <span className="px-2 py-1 bg-amber-500/20 text-amber-400 rounded text-xs">
                  Level: {filterScope?.level || 'unknown'}
                </span>
              )}
              {hasFiltersUnlocked && (
                <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs">
                  Filters Unlocked
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Helper Components
// ============================================================================

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string
  icon: React.ComponentType<{ className?: string }>
  children: React.ReactNode
}) {
  return (
    <div className="mb-3">
      <div className="flex items-center gap-1.5 mb-1 text-zinc-400">
        <Icon className="h-3 w-3" />
        <span className="text-xs font-semibold uppercase tracking-wide">{title}</span>
      </div>
      <div className="pl-4 space-y-0.5">{children}</div>
    </div>
  )
}

function Row({
  label,
  value,
  mono,
  status,
  highlight,
  icon: Icon,
}: {
  label: string
  value: string
  mono?: boolean
  status?: boolean
  highlight?: boolean
  icon?: React.ComponentType<{ className?: string }>
}) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className="text-zinc-400 flex items-center gap-1">
        {Icon && <Icon className="h-3 w-3" />}
        {label}:
      </span>
      <span
        className={cn(
          'text-zinc-200',
          mono && 'font-mono text-[10px]',
          status === true && 'text-emerald-400',
          status === false && 'text-red-400',
          highlight && 'text-amber-400 font-semibold'
        )}
      >
        {value}
      </span>
    </div>
  )
}

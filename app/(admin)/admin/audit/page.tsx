import { createClient } from '@/lib/supabase/server'
import { AdminHeader } from '@/components/admin/AdminHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { formatFullDate } from '@/lib/utils/date'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Audit Log' }

/**
 * Explicit row shape for audit_logs query results.
 *
 * WHY: Supabase's TypeScript inference collapses to `never[]` when the
 * selected columns include a `Json | null` field (here: `metadata`).
 * The `Json` type is a deep recursive union that exceeds TypeScript's
 * type-inference depth in the Supabase pick/intersect helpers, causing
 * the entire inferred element type to become `never`.
 *
 * Fix: declare a simple, concrete row type and cast the raw result to it.
 * `Record<string, unknown>` replaces `Json | null` — equivalent at runtime,
 * simpler for the type system.
 */
type AuditLogRow = {
  id:          string
  action:      string
  entity_type: string
  entity_id:   string
  actor_id:    string
  created_at:  string
  metadata:    Record<string, unknown> | null
}

type ActionStyle = { bg: string; color: string }

const ACTION_STYLE: Record<string, ActionStyle> = {
  report_created:       { bg: 'rgba(99,120,255,0.1)',   color: '#6378FF'  },
  report_approved:      { bg: 'rgba(34,197,94,0.1)',    color: '#22C55E'  },
  report_paid:          { bg: 'rgba(34,197,94,0.1)',    color: '#4ADE80'  },
  report_recalculated:  { bg: 'rgba(245,158,11,0.1)',   color: '#F59E0B'  },
  csv_uploaded:         { bg: 'rgba(255,255,255,0.06)', color: 'rgba(240,236,228,0.5)' },
  refund_added:         { bg: 'rgba(239,68,68,0.1)',    color: '#EF4444'  },
}

const FALLBACK_STYLE: ActionStyle = { bg: 'rgba(255,255,255,0.06)', color: 'rgba(240,236,228,0.5)' }

function actionLabel(action: string): string {
  return action.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

export default async function AdminAuditPage() {
  const supabase = await createClient()

  const { data: rawLogs } = await supabase
    .from('audit_logs')
    .select('id, action, entity_type, entity_id, actor_id, created_at, metadata')
    .order('created_at', { ascending: false })
    .limit(200)

  // Cast away the `never[]` inference caused by the `Json | null` metadata column.
  // The runtime shape exactly matches AuditLogRow — this is a type-level fix only.
  const logs = (rawLogs as unknown as AuditLogRow[] | null)

  return (
    <div>
      <AdminHeader
        title="Audit Log"
        subtitle="Append-only record of all significant actions"
      />

      <div style={{
        background: '#0D0F1A', border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: '16px', overflow: 'hidden',
      }}>
        {!logs || logs.length === 0 ? (
          <EmptyState
            icon="◎"
            title="No audit events yet"
            description="All report state changes, CSV uploads, and admin actions are recorded here."
          />
        ) : (
          <div>
            {logs.map((log: AuditLogRow, i: number) => {
              const style: ActionStyle = ACTION_STYLE[log.action] ?? FALLBACK_STYLE

              return (
                <div key={log.id} style={{
                  display: 'grid',
                  gridTemplateColumns: '180px auto 1fr',
                  gap: '16px',
                  alignItems: 'start',
                  padding: '14px 20px',
                  borderBottom: i < logs.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none',
                }}>
                  {/* Timestamp */}
                  <span style={{ fontSize: '11px', color: 'rgba(240,236,228,0.3)', paddingTop: '2px', whiteSpace: 'nowrap' }}>
                    {formatFullDate(log.created_at)}
                  </span>

                  {/* Action badge */}
                  <span style={{
                    fontSize: '10px', fontWeight: '700', letterSpacing: '0.08em',
                    padding: '3px 8px', borderRadius: '6px', whiteSpace: 'nowrap',
                    background: style.bg, color: style.color,
                  }}>
                    {actionLabel(log.action)}
                  </span>

                  {/* Detail */}
                  <div>
                    <p style={{ margin: 0, fontSize: '12px', color: 'rgba(240,236,228,0.6)' }}>
                      <span style={{ color: 'rgba(240,236,228,0.35)' }}>{log.entity_type}</span>
                      {log.entity_id && (
                        <span style={{ fontFamily: 'monospace', fontSize: '11px', marginLeft: '8px', color: 'rgba(240,236,228,0.25)' }}>
                          {log.entity_id.slice(0, 8)}…
                        </span>
                      )}
                    </p>
                    {log.metadata && Object.keys(log.metadata).length > 0 && (
                      <p style={{ margin: '3px 0 0', fontSize: '11px', color: 'rgba(240,236,228,0.3)', fontFamily: 'monospace' }}>
                        {JSON.stringify(log.metadata).slice(0, 120)}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {logs && logs.length >= 200 && (
        <p style={{ marginTop: '12px', fontSize: '12px', color: 'rgba(240,236,228,0.3)', textAlign: 'center' }}>
          Showing most recent 200 events. Pagination coming in Sprint 3.
        </p>
      )}
    </div>
  )
}

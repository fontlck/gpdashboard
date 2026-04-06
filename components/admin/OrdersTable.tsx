'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'

export type OrderRow = {
  id: string
  row_number: number
  charge_id: string
  transaction_date: string
  amount: number
  net: number
  opn_refunded: boolean
  artist_name_raw: string | null
}

type EditState = {
  rowId: string
  value: string
  saving: boolean
  error: string | null
}

type Toast = { rowId: string; message: string; ok: boolean }

const isUnknown = (v: string | null) => !v || v.trim() === '' || v.trim() === '(Unknown)'

function fmtTHB(n: number) {
  return `฿${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })
}

export function OrdersTable({ rows }: { rows: OrderRow[] }) {
  const router = useRouter()
  const [showAll,  setShowAll]  = useState(false)
  const [edit,     setEdit]     = useState<EditState | null>(null)
  const [toast,    setToast]    = useState<Toast | null>(null)
  const [localRows, setLocalRows] = useState<OrderRow[]>(rows)

  const unknownCount = useMemo(() => localRows.filter(r => isUnknown(r.artist_name_raw)).length, [localRows])
  const displayed    = useMemo(
    () => showAll ? localRows : localRows.filter(r => isUnknown(r.artist_name_raw)),
    [showAll, localRows]
  )

  function startEdit(row: OrderRow) {
    setEdit({ rowId: row.id, value: row.artist_name_raw ?? '', saving: false, error: null })
  }
  function cancelEdit() { setEdit(null) }

  async function saveEdit() {
    if (!edit) return
    setEdit(e => e ? { ...e, saving: true, error: null } : null)

    try {
      const res  = await fetch(`/api/admin/report-rows/${edit.rowId}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ artist_name: edit.value }),
      })
      const json = await res.json()

      if (!res.ok) {
        setEdit(e => e ? { ...e, saving: false, error: json.error ?? 'Save failed' } : null)
        return
      }

      // Update local row state so UI reflects change immediately
      const newArtist = json.artist_name_raw ?? null
      setLocalRows(prev =>
        prev.map(r => r.id === edit.rowId ? { ...r, artist_name_raw: newArtist } : r)
      )

      setToast({ rowId: edit.rowId, message: 'Artist updated and summaries rebuilt.', ok: true })
      setTimeout(() => setToast(null), 4000)

      setEdit(null)

      // Refresh server component data (artist_summaries panel etc.)
      router.refresh()
    } catch {
      setEdit(e => e ? { ...e, saving: false, error: 'Network error — try again.' } : null)
    }
  }

  if (localRows.length === 0) return null

  const cell: React.CSSProperties = {
    padding: '10px 8px',
    borderBottom: '1px solid rgba(255,255,255,0.04)',
    fontSize: '12px',
    color: 'rgba(240,236,228,0.7)',
    verticalAlign: 'middle',
  }
  const hdrCell: React.CSSProperties = {
    padding: '8px 8px',
    fontSize: '11px',
    fontWeight: '600',
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
    color: 'rgba(240,236,228,0.35)',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
  }

  return (
    <div>
      {/* Header bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <h2 style={{
            fontSize: '14px', fontWeight: '600',
            color: 'rgba(240,236,228,0.6)', letterSpacing: '0.08em', textTransform: 'uppercase',
            margin: 0,
          }}>
            Order Rows
          </h2>
          {unknownCount > 0 && (
            <p style={{ fontSize: '12px', color: '#F59E0B', margin: '4px 0 0' }}>
              {unknownCount} row{unknownCount !== 1 ? 's' : ''} with unknown artist
            </p>
          )}
        </div>
        <button
          onClick={() => setShowAll(v => !v)}
          style={{
            padding: '6px 14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.12)',
            background: 'transparent', color: 'rgba(240,236,228,0.7)', fontSize: '12px',
            cursor: 'pointer',
          }}
        >
          {showAll ? `Show unknown only (${unknownCount})` : `Show all rows (${localRows.length})`}
        </button>
      </div>

      {/* Global toast */}
      {toast && (
        <div style={{
          marginBottom: '12px', padding: '10px 14px', borderRadius: '8px',
          background: toast.ok ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
          border: `1px solid ${toast.ok ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`,
          fontSize: '12px', color: toast.ok ? '#4ADE80' : '#F87171',
        }}>
          {toast.message}
        </div>
      )}

      {displayed.length === 0 ? (
        <p style={{ fontSize: '13px', color: 'rgba(240,236,228,0.35)' }}>
          No unknown-artist rows — all orders have been assigned.
        </p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr>
                <th style={hdrCell}>#</th>
                <th style={hdrCell}>Date</th>
                <th style={hdrCell}>Charge ID</th>
                <th style={hdrCell}>Amount</th>
                <th style={hdrCell}>NET</th>
                <th style={{ ...hdrCell, minWidth: '180px' }}>Artist</th>
                <th style={hdrCell}></th>
              </tr>
            </thead>
            <tbody>
              {displayed.map(row => {
                const unknown = isUnknown(row.artist_name_raw)
                const isEditing = edit?.rowId === row.id

                return (
                  <tr
                    key={row.id}
                    style={{
                      background: unknown ? 'rgba(245,158,11,0.03)' : 'transparent',
                    }}
                  >
                    <td style={{ ...cell, color: 'rgba(240,236,228,0.35)' }}>{row.row_number}</td>
                    <td style={cell}>{fmtDate(row.transaction_date)}</td>
                    <td style={{ ...cell, fontFamily: 'monospace', fontSize: '11px', color: 'rgba(240,236,228,0.5)' }}>
                      {row.charge_id.slice(-8)}
                    </td>
                    <td style={{ ...cell, color: row.opn_refunded ? '#F59E0B' : 'rgba(240,236,228,0.7)' }}>
                      {row.opn_refunded ? `↩ ${fmtTHB(Number(row.amount))}` : fmtTHB(Number(row.amount))}
                    </td>
                    <td style={cell}>{fmtTHB(Number(row.net))}</td>

                    {/* Artist cell — editable */}
                    <td style={{ ...cell, minWidth: '180px' }}>
                      {isEditing ? (
                        <div>
                          <input
                            autoFocus
                            value={edit.value}
                            onChange={e => setEdit(s => s ? { ...s, value: e.target.value } : null)}
                            onKeyDown={e => {
                              if (e.key === 'Enter')  saveEdit()
                              if (e.key === 'Escape') cancelEdit()
                            }}
                            placeholder="Artist name"
                            style={{
                              width: '100%', padding: '4px 8px', borderRadius: '6px',
                              border: '1px solid rgba(196,163,94,0.4)',
                              background: 'rgba(196,163,94,0.06)', color: '#F0ECE4',
                              fontSize: '12px', outline: 'none',
                            }}
                          />
                          {edit.error && (
                            <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#F87171' }}>
                              {edit.error}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span style={{ color: unknown ? '#F59E0B' : '#F0ECE4' }}>
                          {row.artist_name_raw?.trim() || '(Unknown)'}
                        </span>
                      )}
                    </td>

                    {/* Action cell */}
                    <td style={{ ...cell, textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {isEditing ? (
                        <span style={{ display: 'inline-flex', gap: '6px' }}>
                          <button
                            onClick={saveEdit}
                            disabled={edit.saving}
                            style={{
                              padding: '4px 10px', borderRadius: '6px',
                              border: '1px solid rgba(196,163,94,0.4)',
                              background: 'rgba(196,163,94,0.1)',
                              color: '#C4A35E', fontSize: '11px', cursor: 'pointer',
                              opacity: edit.saving ? 0.5 : 1,
                            }}
                          >
                            {edit.saving ? 'Saving…' : 'Save'}
                          </button>
                          <button
                            onClick={cancelEdit}
                            disabled={edit.saving}
                            style={{
                              padding: '4px 10px', borderRadius: '6px',
                              border: '1px solid rgba(255,255,255,0.1)',
                              background: 'transparent',
                              color: 'rgba(240,236,228,0.5)', fontSize: '11px', cursor: 'pointer',
                            }}
                          >
                            Cancel
                          </button>
                        </span>
                      ) : (
                        <button
                          onClick={() => startEdit(row)}
                          style={{
                            padding: '4px 10px', borderRadius: '6px',
                            border: `1px solid ${unknown ? 'rgba(245,158,11,0.35)' : 'rgba(255,255,255,0.08)'}`,
                            background: unknown ? 'rgba(245,158,11,0.06)' : 'transparent',
                            color: unknown ? '#F59E0B' : 'rgba(240,236,228,0.4)',
                            fontSize: '11px', cursor: 'pointer',
                          }}
                        >
                          Edit
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

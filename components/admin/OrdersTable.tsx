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
  artist_image_url: string | null
}

type EditState = {
  rowId: string
  name: string
  imageUrl: string
  saving: boolean
  error: string | null
}

type Toast = { message: string; ok: boolean }

const isUnknown = (v: string | null) => !v || v.trim() === '' || v.trim() === '(Unknown)'
const isValidUrl = (v: string) => v.startsWith('http://') || v.startsWith('https://')

function fmtTHB(n: number) {
  return `฿${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })
}

function ArtistThumb({ url }: { url: string | null }) {
  const [imgErr, setImgErr] = useState(false)
  if (url && !imgErr) {
    return (
      <img
        src={url}
        alt=""
        onError={() => setImgErr(true)}
        style={{
          width: 32, height: 32, borderRadius: '50%',
          objectFit: 'cover', border: '1px solid rgba(255,255,255,0.1)',
          flexShrink: 0,
        }}
      />
    )
  }
  return (
    <div style={{
      width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
      background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '13px', color: 'rgba(240,236,228,0.2)',
    }}>
      ?
    </div>
  )
}

export function OrdersTable({ rows, locked = false }: { rows: OrderRow[]; locked?: boolean }) {
  const router = useRouter()
  const [showAll,    setShowAll]    = useState(false)
  const [edit,       setEdit]       = useState<EditState | null>(null)
  const [toast,      setToast]      = useState<Toast | null>(null)
  const [localRows,  setLocalRows]  = useState<OrderRow[]>(rows)

  const unknownCount = useMemo(() => localRows.filter(r => isUnknown(r.artist_name_raw)).length, [localRows])
  const displayed    = useMemo(
    () => showAll ? localRows : localRows.filter(r => isUnknown(r.artist_name_raw)),
    [showAll, localRows]
  )

  function startEdit(row: OrderRow) {
    setEdit({
      rowId:    row.id,
      name:     row.artist_name_raw ?? '',
      imageUrl: row.artist_image_url ?? '',
      saving:   false,
      error:    null,
    })
  }
  function cancelEdit() { setEdit(null) }

  async function saveEdit() {
    if (!edit) return
    setEdit(e => e ? { ...e, saving: true, error: null } : null)

    try {
      const res  = await fetch(`/api/admin/report-rows/${edit.rowId}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          artist_name:      edit.name,
          artist_image_url: edit.imageUrl,
        }),
      })
      const json = await res.json()

      if (!res.ok) {
        setEdit(e => e ? { ...e, saving: false, error: json.error ?? 'Save failed' } : null)
        return
      }

      // Update local row state immediately
      setLocalRows(prev =>
        prev.map(r => r.id === edit.rowId
          ? { ...r, artist_name_raw: json.artist_name_raw ?? null, artist_image_url: json.artist_image_url ?? null }
          : r
        )
      )

      setToast({ message: 'Artist updated — summaries rebuilt.', ok: true })
      setTimeout(() => setToast(null), 4000)
      setEdit(null)
      router.refresh()    // re-fetch server data (Artist Breakdown panel)
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
    fontSize: '11px', fontWeight: '600',
    letterSpacing: '0.08em', textTransform: 'uppercase' as const,
    color: 'rgba(240,236,228,0.35)',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
  }
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '5px 8px', borderRadius: '6px',
    border: '1px solid rgba(196,163,94,0.35)',
    background: 'rgba(196,163,94,0.06)', color: '#F0ECE4',
    fontSize: '12px', outline: 'none', boxSizing: 'border-box',
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <h2 style={{
            fontSize: '14px', fontWeight: '600', color: 'rgba(240,236,228,0.6)',
            letterSpacing: '0.08em', textTransform: 'uppercase', margin: 0,
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
            padding: '6px 14px', borderRadius: '8px',
            border: '1px solid rgba(255,255,255,0.12)',
            background: 'transparent', color: 'rgba(240,236,228,0.7)',
            fontSize: '12px', cursor: 'pointer',
          }}
        >
          {showAll
            ? `Show unknown only (${unknownCount})`
            : `Show all rows (${localRows.length})`}
        </button>
      </div>

      {/* Toast */}
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
          All orders have an assigned artist.
        </p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr>
                <th style={{ ...hdrCell, width: 40 }}></th>   {/* thumbnail */}
                <th style={hdrCell}>#</th>
                <th style={hdrCell}>Date</th>
                <th style={hdrCell}>Charge ID</th>
                <th style={hdrCell}>Amount</th>
                <th style={hdrCell}>NET</th>
                <th style={{ ...hdrCell, minWidth: 200 }}>Artist</th>
                <th style={{ ...hdrCell, minWidth: 220 }}>Image URL</th>
                <th style={hdrCell}></th>
              </tr>
            </thead>
            <tbody>
              {displayed.map(row => {
                const unknown   = isUnknown(row.artist_name_raw)
                const isEditing = edit?.rowId === row.id

                return (
                  <tr
                    key={row.id}
                    style={{ background: unknown ? 'rgba(245,158,11,0.03)' : 'transparent' }}
                  >
                    {/* Thumbnail */}
                    <td style={{ ...cell, padding: '8px' }}>
                      <ArtistThumb url={isEditing && isValidUrl(edit.imageUrl) ? edit.imageUrl : row.artist_image_url} />
                    </td>

                    <td style={{ ...cell, color: 'rgba(240,236,228,0.35)' }}>{row.row_number}</td>
                    <td style={cell}>{fmtDate(row.transaction_date)}</td>
                    <td style={{ ...cell, fontFamily: 'monospace', fontSize: '11px', color: 'rgba(240,236,228,0.5)' }}>
                      {row.charge_id.slice(-8)}
                    </td>
                    <td style={{ ...cell, color: row.opn_refunded ? '#F59E0B' : undefined }}>
                      {row.opn_refunded ? `↩ ${fmtTHB(Number(row.amount))}` : fmtTHB(Number(row.amount))}
                    </td>
                    <td style={cell}>{fmtTHB(Number(row.net))}</td>

                    {/* Artist name — editable */}
                    <td style={{ ...cell, minWidth: 200 }}>
                      {isEditing ? (
                        <input
                          autoFocus
                          value={edit.name}
                          onChange={e => setEdit(s => s ? { ...s, name: e.target.value } : null)}
                          onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit() }}
                          placeholder="Artist name"
                          style={inputStyle}
                        />
                      ) : (
                        <span style={{ color: unknown ? '#F59E0B' : '#F0ECE4' }}>
                          {row.artist_name_raw?.trim() || '(Unknown)'}
                        </span>
                      )}
                    </td>

                    {/* Image URL — editable */}
                    <td style={{ ...cell, minWidth: 220 }}>
                      {isEditing ? (
                        <div>
                          <input
                            value={edit.imageUrl}
                            onChange={e => setEdit(s => s ? { ...s, imageUrl: e.target.value } : null)}
                            onKeyDown={e => { if (e.key === 'Escape') cancelEdit() }}
                            placeholder="https://…"
                            style={inputStyle}
                          />
                          {/* Live preview if URL looks valid */}
                          {isValidUrl(edit.imageUrl) && (
                            <img
                              src={edit.imageUrl}
                              alt="preview"
                              style={{
                                marginTop: 6, width: 60, height: 60, borderRadius: 8,
                                objectFit: 'cover', border: '1px solid rgba(255,255,255,0.1)',
                                display: 'block',
                              }}
                            />
                          )}
                        </div>
                      ) : (
                        <span style={{ color: row.artist_image_url ? 'rgba(240,236,228,0.5)' : 'rgba(240,236,228,0.2)', fontSize: '11px', fontFamily: 'monospace' }}>
                          {row.artist_image_url
                            ? row.artist_image_url.length > 28
                              ? row.artist_image_url.slice(0, 28) + '…'
                              : row.artist_image_url
                            : '—'}
                        </span>
                      )}
                    </td>

                    {/* Action */}
                    <td style={{ ...cell, textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {locked ? (
                        <span style={{ fontSize: 11, color: 'rgba(240,236,228,0.2)' }}>
                          🔒
                        </span>
                      ) : isEditing ? (
                        <span style={{ display: 'inline-flex', gap: 6 }}>
                          <button
                            onClick={saveEdit}
                            disabled={edit.saving}
                            style={{
                              padding: '4px 10px', borderRadius: 6,
                              border: '1px solid rgba(196,163,94,0.4)',
                              background: 'rgba(196,163,94,0.1)',
                              color: '#C4A35E', fontSize: 11, cursor: 'pointer',
                              opacity: edit.saving ? 0.5 : 1,
                            }}
                          >
                            {edit.saving ? 'Saving…' : 'Save'}
                          </button>
                          <button
                            onClick={cancelEdit}
                            disabled={edit.saving}
                            style={{
                              padding: '4px 10px', borderRadius: 6,
                              border: '1px solid rgba(255,255,255,0.1)',
                              background: 'transparent',
                              color: 'rgba(240,236,228,0.5)', fontSize: 11, cursor: 'pointer',
                            }}
                          >
                            Cancel
                          </button>
                          {edit.error && (
                            <span style={{ fontSize: 11, color: '#F87171', alignSelf: 'center' }}>
                              {edit.error}
                            </span>
                          )}
                        </span>
                      ) : (
                        <button
                          onClick={() => startEdit(row)}
                          style={{
                            padding: '4px 10px', borderRadius: 6,
                            border: `1px solid ${unknown ? 'rgba(245,158,11,0.35)' : 'rgba(255,255,255,0.08)'}`,
                            background: unknown ? 'rgba(245,158,11,0.06)' : 'transparent',
                            color: unknown ? '#F59E0B' : 'rgba(240,236,228,0.4)',
                            fontSize: 11, cursor: 'pointer',
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

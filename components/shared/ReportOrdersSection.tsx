'use client'

import { useState, useEffect, useCallback } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

type Order = {
  id:               string
  row_number:       number
  charge_id:        string
  transaction_date: string
  amount:           number
  net:              number
  opn_fee:          number
  payment_source:   string | null
  branch_name:      string | null
  artist_name:      string | null
  link:             string | null
}

type Pagination = { page: number; limit: number; total: number; total_pages: number }

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtTHB(n: number) {
  return `฿${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtDateTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

const SOURCE_LABELS: Record<string, string> = {
  promptpay:    'PromptPay',
  credit_card:  'Card',
  truemoney:    'TrueMoney',
  mobile_banking: 'Mobile',
  internet_banking: 'Internet',
  alipay:       'Alipay',
  paynow:       'PayNow',
}

function sourceLabel(s: string | null) {
  if (!s) return '—'
  return SOURCE_LABELS[s.toLowerCase()] ?? s
}

// ── Toast ─────────────────────────────────────────────────────────────────────

function Toast({ msg, onHide }: { msg: string; onHide: () => void }) {
  useEffect(() => { const t = setTimeout(onHide, 2000); return () => clearTimeout(t) }, [onHide])
  return (
    <div style={{
      position: 'fixed', bottom: '28px', left: '50%', transform: 'translateX(-50%)',
      background: 'rgba(0,212,255,0.15)', border: '1px solid rgba(0,212,255,0.3)',
      color: '#E0F8FF', padding: '10px 20px', borderRadius: '10px',
      fontSize: '13px', fontWeight: '500', zIndex: 9999,
      backdropFilter: 'blur(8px)',
      boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
    }}>
      {msg}
    </div>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ReportOrdersSection({ reportId }: { reportId: string }) {
  const [open,       setOpen]       = useState(false)
  const [orders,     setOrders]     = useState<Order[]>([])
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [page,       setPage]       = useState(1)
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState<string | null>(null)
  const [toast,      setToast]      = useState<string | null>(null)

  const load = useCallback(async (p: number) => {
    setLoading(true)
    setError(null)
    try {
      const res  = await fetch(`/api/reports/${reportId}/orders?page=${p}&limit=50`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to load orders')
      setOrders(json.orders)
      setPagination(json.pagination)
      setPage(p)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [reportId])

  const toggle = () => {
    if (!open && orders.length === 0) load(1)
    setOpen(v => !v)
  }

  const copyLink = async (link: string) => {
    try {
      await navigator.clipboard.writeText(link)
      setToast('Copied!')
    } catch {
      setToast('Copy failed')
    }
  }

  return (
    <>
      {toast && <Toast msg={toast} onHide={() => setToast(null)} />}

      {/* ── Toggle header ── */}
      <div style={{
        background: '#0D0F1A', border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: '16px', overflow: 'hidden',
      }}>
        <button
          onClick={toggle}
          style={{
            width: '100%', display: 'flex', justifyContent: 'space-between',
            alignItems: 'center', padding: '22px 28px',
            background: 'transparent', border: 'none', cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h2 style={{
              margin: 0, fontSize: '11px', fontWeight: '600',
              letterSpacing: '0.1em', textTransform: 'uppercase',
              color: 'rgba(240,236,228,0.3)',
            }}>
              All Orders
            </h2>
            {pagination && (
              <span style={{
                fontSize: '11px', padding: '2px 9px', borderRadius: '20px',
                background: 'rgba(0,212,255,0.08)', color: 'rgba(0,212,255,0.7)',
                border: '1px solid rgba(0,212,255,0.15)',
              }}>
                {pagination.total.toLocaleString()}
              </span>
            )}
          </div>
          <div style={{
            fontSize: '16px', color: 'rgba(240,236,228,0.25)',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease',
          }}>
            ▾
          </div>
        </button>

        {/* ── Table ── */}
        {open && (
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            {loading && (
              <div style={{ padding: '32px', textAlign: 'center', fontSize: '13px', color: 'rgba(240,236,228,0.3)' }}>
                Loading orders…
              </div>
            )}
            {error && (
              <div style={{ padding: '24px 28px', fontSize: '13px', color: '#EF4444' }}>
                {error}
              </div>
            )}
            {!loading && !error && orders.length === 0 && (
              <div style={{ padding: '32px', textAlign: 'center', fontSize: '13px', color: 'rgba(240,236,228,0.3)' }}>
                No orders found.
              </div>
            )}
            {!loading && orders.length > 0 && (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '900px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                      {['#', 'Order ID', 'Date & Time', 'Branch', 'Artist', 'Gross', 'Net', 'Payment', 'Link'].map((h, i) => (
                        <th key={h} style={{
                          padding: i === 0 ? '10px 12px 10px 28px' : '10px 12px',
                          textAlign: ['Gross', 'Net'].includes(h) ? 'right' : 'left',
                          fontSize: '10px', fontWeight: '600', letterSpacing: '0.08em',
                          textTransform: 'uppercase', color: 'rgba(240,236,228,0.28)',
                          whiteSpace: 'nowrap',
                        }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((o, idx) => (
                      <tr key={o.id} style={{
                        borderBottom: '1px solid rgba(255,255,255,0.04)',
                        background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
                      }}>
                        {/* # */}
                        <td style={{ padding: '11px 12px 11px 28px', fontSize: '12px', color: 'rgba(240,236,228,0.22)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                          {o.row_number}
                        </td>
                        {/* Order ID */}
                        <td style={{ padding: '11px 12px', fontSize: '12px', color: 'rgba(200,240,255,0.6)', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                          {o.charge_id}
                        </td>
                        {/* Date */}
                        <td style={{ padding: '11px 12px', fontSize: '12px', color: 'rgba(240,236,228,0.5)', whiteSpace: 'nowrap' }}>
                          {fmtDateTime(o.transaction_date)}
                        </td>
                        {/* Branch */}
                        <td style={{ padding: '11px 12px', fontSize: '12px', color: 'rgba(240,236,228,0.5)', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {o.branch_name || '—'}
                        </td>
                        {/* Artist */}
                        <td style={{ padding: '11px 12px', fontSize: '12px', color: 'rgba(240,236,228,0.5)', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {o.artist_name && o.artist_name !== '(Unknown)' ? o.artist_name : '—'}
                        </td>
                        {/* Gross */}
                        <td style={{ padding: '11px 12px', textAlign: 'right', fontSize: '13px', color: '#F1F5F9', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                          {fmtTHB(o.amount)}
                        </td>
                        {/* Net */}
                        <td style={{ padding: '11px 12px', textAlign: 'right', fontSize: '13px', color: 'rgba(240,236,228,0.5)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                          {fmtTHB(o.net)}
                        </td>
                        {/* Payment */}
                        <td style={{ padding: '11px 12px', fontSize: '12px', color: 'rgba(240,236,228,0.45)', whiteSpace: 'nowrap' }}>
                          {sourceLabel(o.payment_source)}
                        </td>
                        {/* Link */}
                        <td style={{ padding: '11px 12px 11px 12px', whiteSpace: 'nowrap' }}>
                          {o.link ? (
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                              <button
                                onClick={() => copyLink(o.link!)}
                                title="Copy URL"
                                style={{
                                  padding: '4px 10px', borderRadius: '6px', border: 'none',
                                  cursor: 'pointer', fontSize: '11px', fontWeight: '500',
                                  background: 'rgba(0,212,255,0.1)', color: '#00D4FF',
                                  transition: 'background 0.15s',
                                }}
                              >
                                Copy
                              </button>
                              <a
                                href={o.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Open link"
                                style={{
                                  padding: '4px 10px', borderRadius: '6px',
                                  fontSize: '11px', fontWeight: '500', textDecoration: 'none',
                                  background: 'rgba(255,255,255,0.05)', color: 'rgba(240,236,228,0.5)',
                                  transition: 'background 0.15s',
                                }}
                              >
                                Open ↗
                              </a>
                            </div>
                          ) : (
                            <span style={{ fontSize: '11px', color: 'rgba(240,236,228,0.2)' }}>No link</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Pagination */}
                {pagination && pagination.total_pages > 1 && (
                  <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '14px 28px', borderTop: '1px solid rgba(255,255,255,0.05)',
                  }}>
                    <span style={{ fontSize: '12px', color: 'rgba(240,236,228,0.3)' }}>
                      Page {pagination.page} of {pagination.total_pages} · {pagination.total.toLocaleString()} orders
                    </span>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        onClick={() => load(page - 1)}
                        disabled={page <= 1}
                        style={{
                          padding: '6px 14px', borderRadius: '8px',
                          border: '1px solid rgba(255,255,255,0.08)',
                          background: 'transparent', cursor: page <= 1 ? 'default' : 'pointer',
                          fontSize: '12px', color: page <= 1 ? 'rgba(240,236,228,0.2)' : 'rgba(240,236,228,0.6)',
                        }}
                      >
                        ← Prev
                      </button>
                      <button
                        onClick={() => load(page + 1)}
                        disabled={page >= pagination.total_pages}
                        style={{
                          padding: '6px 14px', borderRadius: '8px',
                          border: '1px solid rgba(255,255,255,0.08)',
                          background: 'transparent', cursor: page >= pagination.total_pages ? 'default' : 'pointer',
                          fontSize: '12px', color: page >= pagination.total_pages ? 'rgba(240,236,228,0.2)' : 'rgba(240,236,228,0.6)',
                        }}
                      >
                        Next →
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}

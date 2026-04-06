'use client'

import { useRef, useState, useCallback, DragEvent, ChangeEvent, CSSProperties } from 'react'

// ── Design tokens ────────────────────────────────────────────────────────────
const GOLD        = '#C4A35E'
const GOLD_DIM    = '#9A7A3A'
const GOLD_BG     = 'rgba(196,163,94,0.08)'
const GOLD_BORDER = 'rgba(196,163,94,0.25)'
const TEXT        = '#F0ECE4'
const TEXT_MUTED  = 'rgba(240,236,228,0.45)'
const SURFACE     = '#0D0F1A'
const SURFACE_2   = '#080A10'
const BORDER      = 'rgba(255,255,255,0.06)'

const card: CSSProperties = {
  background: SURFACE, border: `1px solid ${BORDER}`,
  borderRadius: '16px', padding: '28px',
}
const label11: CSSProperties = {
  fontSize: '11px', fontWeight: 600, color: TEXT_MUTED,
  textTransform: 'uppercase', letterSpacing: '0.08em',
}
const goldBtn: CSSProperties = {
  padding: '11px 28px', borderRadius: '10px',
  background: `linear-gradient(135deg,${GOLD} 0%,${GOLD_DIM} 100%)`,
  color: SURFACE_2, fontSize: '13px', fontWeight: 700,
  cursor: 'pointer', border: 'none', letterSpacing: '0.04em',
}
const ghostBtn: CSSProperties = {
  padding: '11px 18px', borderRadius: '10px',
  background: 'none', border: `1px solid rgba(255,255,255,0.12)`,
  color: TEXT_MUTED, fontSize: '13px', cursor: 'pointer',
}

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

// ── Types ────────────────────────────────────────────────────────────────────

type Phase = 'idle' | 'mapping' | 'importing' | 'done' | 'error'

// What we resolved for each unique branch name found in the CSV
type Resolution =
  | { kind: 'pending' }
  | { kind: 'mapped';   branchId: string; branchLabel: string }
  | { kind: 'skip' }
  | { kind: 'creating' }   // mini-form open

type DbBranch = {
  id: string
  name: string
  code: string
  revenue_share_pct: number
  partner_id: string
  partners: { id: string; name: string } | null
}

type DbPartner = { id: string; name: string }

type PreviewData = {
  filename: string
  totalRows: number
  thbRows: number
  detectedMonth: number
  detectedYear: number
  uniqueBranchNames: string[]      // branch names from CSV (empty string = no branch col)
  headers: string[]
  missingCols: string[]
}

type ImportResult = {
  importedRows: number
  skippedCurrency: number
  skippedStatus: number
  skippedBranch: number
  branchesProcessed: number
  reportingMonth: number
  reportingYear: number
}

// ── CSV helpers (client-side preview only) ───────────────────────────────────

function parseCsvLine(line: string): string[] {
  const result: string[] = []
  let cur = '', inQ = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++ }
      else inQ = !inQ
    } else if (ch === ',' && !inQ) { result.push(cur.trim()); cur = '' }
    else cur += ch
  }
  result.push(cur.trim())
  return result
}

function norm(s: string) { return s.toLowerCase().replace(/[\s_\-\[\]\.]/g, '') }

function findCol(headers: string[], ...candidates: string[]): string {
  const idx: Record<string, string> = {}
  headers.forEach(h => { idx[norm(h)] = h })
  for (const c of candidates) { const f = idx[norm(c)]; if (f) return f }
  return ''
}

// ── CreateBranchForm (inline mini-form) ──────────────────────────────────────

type CreateBranchFormProps = {
  csvBranchName: string
  partners: DbPartner[]
  onCreated: (branch: DbBranch) => void
  onCancel: () => void
}

function CreateBranchForm({ csvBranchName, partners, onCreated, onCancel }: CreateBranchFormProps) {
  const [branchName,   setBranchName]   = useState(csvBranchName)
  const [revenueShare, setRevenueShare] = useState('50')
  const [partnerMode,  setPartnerMode]  = useState<'existing' | 'new'>('existing')
  const [partnerId,    setPartnerId]    = useState(partners[0]?.id ?? '')
  const [newPartner,   setNewPartner]   = useState('')
  const [saving,       setSaving]       = useState(false)
  const [err,          setErr]          = useState('')

  const handleCreate = async () => {
    setErr('')
    if (!branchName.trim()) return setErr('Branch name is required')
    const pct = parseFloat(revenueShare)
    if (isNaN(pct) || pct < 0 || pct > 100) return setErr('Revenue share must be 0–100')
    if (partnerMode === 'existing' && !partnerId) return setErr('Select a partner')
    if (partnerMode === 'new' && !newPartner.trim()) return setErr('Enter a partner name')

    setSaving(true)
    try {
      const res = await fetch('/api/admin/branches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branch_name:       branchName.trim(),
          revenue_share_pct: pct,
          ...(partnerMode === 'existing'
            ? { partner_id:   partnerId }
            : { partner_name: newPartner.trim() }),
        }),
      })
      const data = await res.json()
      if (!res.ok) { setErr(data.error ?? 'Failed to create branch'); setSaving(false); return }
      onCreated(data.branch as DbBranch)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Network error')
      setSaving(false)
    }
  }

  const inputStyle: CSSProperties = {
    width: '100%', padding: '9px 12px', borderRadius: '8px', fontSize: '13px',
    background: SURFACE_2, border: `1px solid rgba(255,255,255,0.1)`,
    color: TEXT, outline: 'none', boxSizing: 'border-box',
  }

  return (
    <div style={{
      marginTop: '12px', padding: '16px', borderRadius: '12px',
      background: SURFACE_2, border: `1px solid ${BORDER}`,
      display: 'flex', flexDirection: 'column', gap: '10px',
    }}>
      <p style={{ margin: 0, ...label11 }}>Create New Branch</p>

      <div>
        <p style={{ margin: '0 0 4px', fontSize: '11px', color: TEXT_MUTED }}>Branch name</p>
        <input style={inputStyle} value={branchName} onChange={e => setBranchName(e.target.value)} />
      </div>

      <div>
        <p style={{ margin: '0 0 4px', fontSize: '11px', color: TEXT_MUTED }}>Revenue share %</p>
        <input
          style={{ ...inputStyle, width: '120px' }}
          type="number" min={0} max={100} value={revenueShare}
          onChange={e => setRevenueShare(e.target.value)}
        />
      </div>

      <div>
        <p style={{ margin: '0 0 6px', fontSize: '11px', color: TEXT_MUTED }}>Partner</p>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
          {(['existing', 'new'] as const).map(m => (
            <button
              key={m}
              onClick={() => setPartnerMode(m)}
              style={{
                padding: '5px 14px', borderRadius: '6px', fontSize: '12px',
                cursor: 'pointer', border: 'none',
                background: partnerMode === m ? GOLD_BG : 'transparent',
                color: partnerMode === m ? GOLD : TEXT_MUTED,
                outline: partnerMode === m ? `1px solid ${GOLD_BORDER}` : '1px solid transparent',
              }}
            >
              {m === 'existing' ? 'Existing partner' : 'New partner'}
            </button>
          ))}
        </div>

        {partnerMode === 'existing' ? (
          partners.length === 0 ? (
            <p style={{ fontSize: '12px', color: TEXT_MUTED, margin: 0 }}>
              No partners exist yet — switch to "New partner"
            </p>
          ) : (
            <select
              style={{ ...inputStyle }}
              value={partnerId}
              onChange={e => setPartnerId(e.target.value)}
            >
              {partners.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          )
        ) : (
          <input
            style={inputStyle}
            placeholder="Partner / company name"
            value={newPartner}
            onChange={e => setNewPartner(e.target.value)}
          />
        )}
      </div>

      {err && (
        <p style={{ margin: 0, fontSize: '12px', color: '#FF8080' }}>{err}</p>
      )}

      <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
        <button
          onClick={handleCreate}
          disabled={saving}
          style={{ ...goldBtn, padding: '9px 20px', fontSize: '12px', opacity: saving ? 0.6 : 1 }}
        >
          {saving ? 'Creating…' : 'Create Branch'}
        </button>
        <button onClick={onCancel} style={{ ...ghostBtn, padding: '9px 14px', fontSize: '12px' }}>
          Cancel
        </button>
      </div>
    </div>
  )
}

// ── Main Component ───────────────────────────────────────────────────────────

export function CsvUploadClient() {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [phase,     setPhase]     = useState<Phase>('idle')
  const [isDrag,    setIsDrag]    = useState(false)
  const [preview,   setPreview]   = useState<PreviewData | null>(null)
  const [csvText,   setCsvText]   = useState('')

  // Branch mapping state
  const [resolutions, setResolutions] = useState<Record<string, Resolution>>({})
  const [dbBranches,  setDbBranches]  = useState<DbBranch[]>([])
  const [dbPartners,  setDbPartners]  = useState<DbPartner[]>([])
  const [loadingMeta, setLoadingMeta] = useState(false)

  // Import options
  const [isOverwrite,    setIsOverwrite]    = useState(false)
  const [amountInSatang, setAmountInSatang] = useState(false)

  const [result,   setResult]   = useState<ImportResult | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  // ── File processing ────────────────────────────────────────────────────────

  const processFile = useCallback(async (file: File) => {
    if (!file.name.endsWith('.csv')) {
      setErrorMsg('Please select a .csv file'); setPhase('error'); return
    }

    const text = await file.text()
    setCsvText(text)

    const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
    if (lines.length < 2) { setErrorMsg('CSV appears empty'); setPhase('error'); return }

    const headers = parseCsvLine(lines[0])

    const currencyCol = findCol(headers, 'currency')
    const statusCol   = findCol(headers, 'status')
    const createdCol  = findCol(headers, 'created', 'created_at', 'transaction_date', 'date', 'charge_date')
    const branchCol   = findCol(headers, 'metadata[branchName]', 'metadatabranchname', 'branchname', 'branch_name', 'branch', 'Branch Name')
    const chargeCol   = findCol(headers, 'id', 'charge_id', 'chargeid', 'transaction_id')
    const amountCol   = findCol(headers, 'amount', 'gross_amount')
    const netCol      = findCol(headers, 'net', 'net_amount')

    const missingCols: string[] = []
    if (!chargeCol) missingCols.push('id / charge_id')
    if (!amountCol) missingCols.push('amount')
    if (!netCol)    missingCols.push('net')
    if (!currencyCol) missingCols.push('currency')

    const VALID = new Set(['successful', 'paid', 'captured', ''])
    let thbRows = 0
    const branchSet = new Set<string>()
    const monthCount: Record<string, number> = {}

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim(); if (!line) continue
      const vals = parseCsvLine(line)
      const row: Record<string, string> = {}
      headers.forEach((h, idx) => { row[h] = vals[idx] ?? '' })

      const currency = currencyCol ? (row[currencyCol] ?? '').toUpperCase() : 'THB'
      if (currency && currency !== 'THB') continue
      const status = statusCol ? (row[statusCol] ?? '').toLowerCase() : ''
      if (statusCol && !VALID.has(status)) continue

      thbRows++
      if (branchCol && row[branchCol]) branchSet.add(row[branchCol])
      if (createdCol && row[createdCol]) {
        const d = new Date(row[createdCol])
        if (!isNaN(d.getTime())) {
          const key = `${d.getFullYear()}-${d.getMonth() + 1}`
          monthCount[key] = (monthCount[key] ?? 0) + 1
        }
      }
    }

    let detectedMonth = new Date().getMonth() + 1
    let detectedYear  = new Date().getFullYear()
    if (Object.keys(monthCount).length > 0) {
      const [y, m] = Object.entries(monthCount).sort((a, b) => b[1] - a[1])[0][0].split('-')
      detectedYear = parseInt(y); detectedMonth = parseInt(m)
    }

    const uniqueBranchNames = [...branchSet]

    setPreview({
      filename: file.name,
      totalRows: lines.length - 1,
      thbRows,
      detectedMonth,
      detectedYear,
      uniqueBranchNames,
      headers,
      missingCols,
    })

    // Fetch existing branches + partners from DB
    setLoadingMeta(true)
    try {
      const res = await fetch('/api/admin/branches')
      if (res.ok) {
        const data = await res.json()
        const branches: DbBranch[] = data.branches ?? []
        const partners: DbPartner[] = data.partners ?? []
        setDbBranches(branches)
        setDbPartners(partners)

        // Auto-match by exact name (case-insensitive)
        const initialResolutions: Record<string, Resolution> = {}
        for (const csvName of uniqueBranchNames) {
          const match = branches.find(b => b.name.toLowerCase() === csvName.toLowerCase())
          if (match) {
            const partnerName = match.partners?.name ?? 'Unknown Partner'
            initialResolutions[csvName] = {
              kind: 'mapped',
              branchId: match.id,
              branchLabel: `${match.name} (${partnerName})`,
            }
          } else {
            initialResolutions[csvName] = { kind: 'pending' }
          }
        }
        setResolutions(initialResolutions)
      }
    } finally {
      setLoadingMeta(false)
    }

    setPhase('mapping')
  }, [])

  const onFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (file) processFile(file); e.target.value = ''
  }
  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault(); setIsDrag(false)
    const file = e.dataTransfer.files[0]; if (file) processFile(file)
  }

  // ── Resolution helpers ─────────────────────────────────────────────────────

  const setResolution = (csvName: string, res: Resolution) =>
    setResolutions(prev => ({ ...prev, [csvName]: res }))

  const allResolved = preview?.uniqueBranchNames.every(
    n => resolutions[n]?.kind === 'mapped' || resolutions[n]?.kind === 'skip'
  ) ?? false

  const pendingCount = preview?.uniqueBranchNames.filter(
    n => resolutions[n]?.kind === 'pending' || resolutions[n]?.kind === 'creating'
  ).length ?? 0

  // ── Import ─────────────────────────────────────────────────────────────────

  const handleImport = async () => {
    if (!preview || !csvText || !allResolved) return
    setPhase('importing')

    // Build branchMapping dict: csvName → branchId | 'skip'
    const branchMapping: Record<string, string> = {}
    for (const [csvName, res] of Object.entries(resolutions)) {
      if (res.kind === 'mapped') branchMapping[csvName] = res.branchId
      else if (res.kind === 'skip') branchMapping[csvName] = 'skip'
    }
    // Rows with no branch column get a synthetic empty-string key
    if (preview.uniqueBranchNames.length === 0) {
      // No branch column — nothing to skip, mapping is empty, server handles it
    }

    try {
      const res = await fetch('/api/admin/import-csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          csvText,
          filename: preview.filename,
          isOverwrite,
          amountDivisor: amountInSatang ? 100 : 1,
          branchMapping,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setErrorMsg(data.error ?? 'Import failed')
        if (data.headersFound) setErrorMsg(p => p + `\n\nHeaders: ${data.headersFound.join(', ')}`)
        if (data.unmappedBranches) setErrorMsg(p => p + `\n\nUnmapped: ${data.unmappedBranches.join(', ')}`)
        setPhase('error'); return
      }
      setResult(data)
      setPhase('done')
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Network error')
      setPhase('error')
    }
  }

  const reset = () => {
    setPhase('idle'); setPreview(null); setCsvText('')
    setResolutions({}); setResult(null); setErrorMsg('')
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* ── Step indicator ── */}
      {phase !== 'idle' && phase !== 'error' && (
        <div style={{ display: 'flex', gap: '0', marginBottom: '4px' }}>
          {[
            { id: 'mapping',   label: '1  Map Branches' },
            { id: 'importing', label: '2  Import' },
            { id: 'done',      label: '3  Done' },
          ].map((s, i) => {
            const steps = ['mapping', 'importing', 'done']
            const activeIdx = steps.indexOf(phase)
            const stepIdx   = steps.indexOf(s.id)
            const isPast    = stepIdx < activeIdx
            const isActive  = stepIdx === activeIdx
            return (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center' }}>
                <span style={{
                  fontSize: '12px', fontWeight: isActive ? 700 : 500,
                  color: isActive ? GOLD : isPast ? 'rgba(196,163,94,0.5)' : TEXT_MUTED,
                  padding: '4px 0',
                }}>{s.label}</span>
                {i < 2 && (
                  <span style={{ margin: '0 12px', color: 'rgba(255,255,255,0.12)', fontSize: '12px' }}>→</span>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── PHASE: idle ── */}
      {phase === 'idle' && (
        <div
          onDrop={onDrop}
          onDragOver={e => { e.preventDefault(); setIsDrag(true) }}
          onDragLeave={() => setIsDrag(false)}
          style={{
            background: isDrag ? 'rgba(196,163,94,0.04)' : SURFACE,
            border: `2px dashed ${isDrag ? GOLD : GOLD_BORDER}`,
            borderRadius: '16px', padding: '72px 40px',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            gap: '16px', textAlign: 'center', transition: 'all 0.15s ease',
          }}
        >
          <div style={{
            width: '56px', height: '56px', borderRadius: '14px',
            background: GOLD_BG, border: `1px solid ${GOLD_BORDER}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px',
          }}>↑</div>
          <div>
            <p style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: TEXT }}>Drop your OPN CSV here</p>
            <p style={{ margin: '6px 0 0', fontSize: '13px', color: TEXT_MUTED }}>or click Browse — .csv files only</p>
          </div>
          <button style={goldBtn} onClick={() => fileInputRef.current?.click()}>Browse File</button>
          <input ref={fileInputRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={onFileChange} />
        </div>
      )}

      {/* ── PHASE: mapping ── */}
      {phase === 'mapping' && preview && (
        <>
          {/* File summary bar */}
          <div style={{ ...card, padding: '18px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '32px', alignItems: 'center' }}>
              <div>
                <p style={{ margin: 0, ...label11 }}>File</p>
                <p style={{ margin: '3px 0 0', fontSize: '14px', fontWeight: 600, color: TEXT }}>{preview.filename}</p>
              </div>
              <div>
                <p style={{ margin: 0, ...label11 }}>Period</p>
                <p style={{ margin: '3px 0 0', fontSize: '14px', fontWeight: 600, color: TEXT }}>
                  {MONTH_NAMES[preview.detectedMonth - 1]} {preview.detectedYear}
                </p>
              </div>
              <div>
                <p style={{ margin: 0, ...label11 }}>THB Rows</p>
                <p style={{ margin: '3px 0 0', fontSize: '14px', fontWeight: 600, color: GOLD }}>{preview.thbRows.toLocaleString()}</p>
              </div>
            </div>
            <button style={ghostBtn} onClick={reset}>Change file</button>
          </div>

          {/* Missing columns warning */}
          {preview.missingCols.length > 0 && (
            <div style={{
              padding: '14px 18px', borderRadius: '12px',
              background: 'rgba(255,80,80,0.06)', border: '1px solid rgba(255,80,80,0.2)',
              fontSize: '13px', color: 'rgba(255,130,130,0.9)',
            }}>
              ⚠️ <strong>Required columns not found:</strong> {preview.missingCols.join(', ')}<br />
              <span style={{ fontSize: '12px', color: TEXT_MUTED }}>
                Headers detected: {preview.headers.slice(0, 12).join(', ')}
                {preview.headers.length > 12 ? ` +${preview.headers.length - 12} more` : ''}
              </span>
            </div>
          )}

          {/* Branch mapping */}
          <div style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
              <div>
                <p style={{ margin: '0 0 4px', ...label11 }}>Branch Mapping</p>
                <p style={{ margin: 0, fontSize: '13px', color: TEXT_MUTED }}>
                  Every branch name from the CSV must be resolved before you can import.
                </p>
              </div>
              {pendingCount > 0 && (
                <span style={{
                  padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 600,
                  background: 'rgba(255,180,50,0.1)', color: '#FFB432',
                  border: '1px solid rgba(255,180,50,0.25)',
                }}>
                  {pendingCount} unresolved
                </span>
              )}
              {pendingCount === 0 && preview.uniqueBranchNames.length > 0 && (
                <span style={{
                  padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 600,
                  background: 'rgba(80,220,100,0.08)', color: '#50DC64',
                  border: '1px solid rgba(80,220,100,0.2)',
                }}>
                  All resolved ✓
                </span>
              )}
            </div>

            {loadingMeta ? (
              <p style={{ fontSize: '13px', color: TEXT_MUTED }}>Loading branches…</p>
            ) : preview.uniqueBranchNames.length === 0 ? (
              <div style={{
                padding: '16px', borderRadius: '10px',
                background: GOLD_BG, border: `1px solid ${GOLD_BORDER}`,
                fontSize: '13px', color: TEXT_MUTED,
              }}>
                No branch column detected in this CSV. All rows will be imported without branch grouping.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {preview.uniqueBranchNames.map(csvName => {
                  const res = resolutions[csvName] ?? { kind: 'pending' }

                  return (
                    <div key={csvName} style={{
                      padding: '16px', borderRadius: '12px',
                      background: SURFACE_2, border: `1px solid ${BORDER}`,
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: res.kind === 'creating' ? '0' : '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          {/* Status dot */}
                          <span style={{
                            width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
                            background:
                              res.kind === 'mapped'   ? '#50DC64' :
                              res.kind === 'skip'     ? TEXT_MUTED :
                              res.kind === 'creating' ? GOLD :
                              '#FFB432',
                          }} />
                          <code style={{
                            fontSize: '13px', fontWeight: 600, color: TEXT,
                            background: GOLD_BG, padding: '3px 10px', borderRadius: '6px',
                          }}>{csvName || '(no branch name)'}</code>
                        </div>

                        {res.kind === 'mapped' && (
                          <span style={{ fontSize: '12px', color: '#50DC64' }}>
                            → {res.branchLabel}
                          </span>
                        )}
                        {res.kind === 'skip' && (
                          <span style={{ fontSize: '12px', color: TEXT_MUTED }}>Rows will be skipped</span>
                        )}
                        {res.kind === 'pending' && (
                          <span style={{ fontSize: '12px', color: '#FFB432' }}>Needs resolution</span>
                        )}
                      </div>

                      {/* Resolution controls */}
                      {res.kind !== 'creating' && (
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          {/* Map to existing branch */}
                          <select
                            value={res.kind === 'mapped' ? res.branchId : ''}
                            onChange={e => {
                              const val = e.target.value
                              if (!val) {
                                setResolution(csvName, { kind: 'pending' })
                              } else {
                                const branch = dbBranches.find(b => b.id === val)
                                if (branch) setResolution(csvName, {
                                  kind: 'mapped',
                                  branchId: branch.id,
                                  branchLabel: `${branch.name} (${branch.partners?.name ?? '?'})`,
                                })
                              }
                            }}
                            style={{
                              flex: 1, minWidth: '180px', padding: '8px 10px',
                              borderRadius: '8px', fontSize: '12px',
                              background: SURFACE, border: `1px solid rgba(255,255,255,0.1)`,
                              color: TEXT, cursor: 'pointer',
                            }}
                          >
                            <option value="">— Map to existing branch —</option>
                            {dbBranches.map(b => (
                              <option key={b.id} value={b.id}>
                                {b.name} ({b.partners?.name ?? '?'}) · {b.revenue_share_pct}%
                              </option>
                            ))}
                          </select>

                          <button
                            style={{
                              padding: '8px 14px', borderRadius: '8px', fontSize: '12px',
                              cursor: 'pointer', border: `1px solid ${GOLD_BORDER}`,
                              background: GOLD_BG, color: GOLD, whiteSpace: 'nowrap',
                            }}
                            onClick={() => setResolution(csvName, { kind: 'creating' })}
                          >
                            + Create branch
                          </button>

                          <button
                            style={{
                              padding: '8px 14px', borderRadius: '8px', fontSize: '12px',
                              cursor: 'pointer', border: `1px solid rgba(255,255,255,0.08)`,
                              background: 'transparent',
                              color: res.kind === 'skip' ? '#FF8080' : TEXT_MUTED,
                              whiteSpace: 'nowrap',
                            }}
                            onClick={() =>
                              setResolution(csvName,
                                res.kind === 'skip' ? { kind: 'pending' } : { kind: 'skip' })
                            }
                          >
                            {res.kind === 'skip' ? 'Undo skip' : 'Skip'}
                          </button>
                        </div>
                      )}

                      {/* Inline create form */}
                      {res.kind === 'creating' && (
                        <CreateBranchForm
                          csvBranchName={csvName}
                          partners={dbPartners}
                          onCreated={branch => {
                            setDbBranches(prev => [...prev, branch])
                            if (branch.partners && !dbPartners.find(p => p.id === branch.partner_id)) {
                              setDbPartners(prev => [...prev, { id: branch.partner_id, name: branch.partners!.name }])
                            }
                            setResolution(csvName, {
                              kind: 'mapped',
                              branchId: branch.id,
                              branchLabel: `${branch.name} (${branch.partners?.name ?? '?'})`,
                            })
                          }}
                          onCancel={() => setResolution(csvName, { kind: 'pending' })}
                        />
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Import options + Proceed */}
          <div style={card}>
            <p style={{ margin: '0 0 16px', ...label11 }}>Import Options</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
              {[
                {
                  id: 'satang', checked: amountInSatang, toggle: () => setAmountInSatang(v => !v),
                  label: 'Amounts are in satang (÷ 100)',
                  desc: 'Check if your OPN CSV shows amounts like 150000 instead of 1500.00',
                },
                {
                  id: 'overwrite', checked: isOverwrite, toggle: () => setIsOverwrite(v => !v),
                  label: 'Overwrite existing report for this month',
                  desc: 'If a monthly report already exists for a branch, replace it with this data',
                },
              ].map(opt => (
                <label key={opt.id} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', cursor: 'pointer' }}>
                  <input
                    type="checkbox" checked={opt.checked} onChange={opt.toggle}
                    style={{ marginTop: '2px', accentColor: GOLD, width: '15px', height: '15px', flexShrink: 0 }}
                  />
                  <div>
                    <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: TEXT }}>{opt.label}</p>
                    <p style={{ margin: '2px 0 0', fontSize: '12px', color: TEXT_MUTED }}>{opt.desc}</p>
                  </div>
                </label>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <button
                onClick={handleImport}
                disabled={!allResolved || preview.missingCols.length > 0}
                style={{
                  ...goldBtn,
                  opacity: (!allResolved || preview.missingCols.length > 0) ? 0.4 : 1,
                  cursor: (!allResolved || preview.missingCols.length > 0) ? 'not-allowed' : 'pointer',
                }}
              >
                Import {preview.thbRows.toLocaleString()} rows →
              </button>

              {!allResolved && pendingCount > 0 && (
                <span style={{ fontSize: '12px', color: '#FFB432' }}>
                  Resolve {pendingCount} branch{pendingCount > 1 ? 'es' : ''} first
                </span>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── PHASE: importing ── */}
      {phase === 'importing' && (
        <div style={{ ...card, textAlign: 'center', padding: '80px 40px' }}>
          <div style={{
            width: '48px', height: '48px', borderRadius: '50%',
            border: `3px solid ${GOLD_BORDER}`, borderTopColor: GOLD,
            margin: '0 auto 20px', animation: 'spin 0.8s linear infinite',
          }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
          <p style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: TEXT }}>Importing…</p>
          <p style={{ margin: '8px 0 0', fontSize: '13px', color: TEXT_MUTED }}>
            Processing rows and writing reports
          </p>
        </div>
      )}

      {/* ── PHASE: done ── */}
      {phase === 'done' && result && (
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
            <div style={{
              width: '38px', height: '38px', borderRadius: '50%',
              background: 'rgba(80,220,100,0.1)', border: '1px solid rgba(80,220,100,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px',
            }}>✓</div>
            <div>
              <p style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: TEXT }}>Import complete</p>
              <p style={{ margin: '2px 0 0', fontSize: '13px', color: TEXT_MUTED }}>
                {MONTH_NAMES[result.reportingMonth - 1]} {result.reportingYear}
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '12px', marginBottom: '24px' }}>
            {[
              { label: 'Rows Imported',       value: result.importedRows.toLocaleString(),   color: '#50DC64' },
              { label: 'Branches Processed',  value: result.branchesProcessed,                color: GOLD },
              { label: 'Rows Skipped',        value: (result.skippedCurrency + result.skippedStatus + result.skippedBranch), color: TEXT_MUTED },
            ].map(s => (
              <div key={s.label} style={{
                background: SURFACE_2, borderRadius: '10px', padding: '16px',
                border: `1px solid ${BORDER}`,
              }}>
                <p style={{ margin: 0, ...label11 }}>{s.label}</p>
                <p style={{ margin: '6px 0 0', fontSize: '24px', fontWeight: 700, color: s.color }}>{s.value}</p>
              </div>
            ))}
          </div>

          {(result.skippedCurrency > 0 || result.skippedStatus > 0 || result.skippedBranch > 0) && (
            <p style={{ fontSize: '12px', color: TEXT_MUTED, marginBottom: '20px' }}>
              {result.skippedCurrency > 0 && `${result.skippedCurrency} non-THB rows excluded. `}
              {result.skippedStatus > 0 && `${result.skippedStatus} non-successful rows excluded. `}
              {result.skippedBranch > 0 && `${result.skippedBranch} rows skipped (branch set to Skip).`}
            </p>
          )}

          <div style={{ display: 'flex', gap: '12px' }}>
            <a href="/admin/reports" style={{
              ...goldBtn, display: 'inline-block', textDecoration: 'none',
            }}>
              View Reports →
            </a>
            <button style={ghostBtn} onClick={reset}>Upload Another</button>
          </div>
        </div>
      )}

      {/* ── PHASE: error ── */}
      {phase === 'error' && (
        <div style={{ ...card, borderColor: 'rgba(255,80,80,0.2)' }}>
          <p style={{ margin: '0 0 8px', fontSize: '15px', fontWeight: 600, color: '#FF8080' }}>Import Failed</p>
          <pre style={{
            margin: '0 0 20px', fontSize: '12px', color: TEXT_MUTED,
            whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            background: SURFACE_2, padding: '12px', borderRadius: '8px',
          }}>{errorMsg}</pre>
          <button onClick={reset} style={{
            ...ghostBtn, borderColor: 'rgba(255,80,80,0.2)', color: '#FF8080',
          }}>
            Try Again
          </button>
        </div>
      )}

      {/* ── Static info cards (idle only) ── */}
      {phase === 'idle' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div style={card}>
            <p style={{ margin: '0 0 16px', ...label11 }}>Import Phases</p>
            {[
              { n: '01', l: 'Upload CSV',       d: 'Select or drop your OPN export file' },
              { n: '02', l: 'Map Branches',      d: 'Resolve every branch name — map, create, or skip. No branch is created automatically.' },
              { n: '03', l: 'Confirm & Import',  d: 'Review options and trigger the import' },
              { n: '04', l: 'Reports Created',   d: 'Monthly reports and transaction rows are written to the database' },
            ].map(s => (
              <div key={s.n} style={{
                display: 'flex', gap: '14px', padding: '10px 0',
                borderBottom: `1px solid rgba(255,255,255,0.04)`,
              }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(196,163,94,0.5)', letterSpacing: '0.1em', paddingTop: '2px', flexShrink: 0 }}>{s.n}</span>
                <div>
                  <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: TEXT }}>{s.l}</p>
                  <p style={{ margin: '2px 0 0', fontSize: '12px', color: TEXT_MUTED }}>{s.d}</p>
                </div>
              </div>
            ))}
          </div>

          <div style={card}>
            <p style={{ margin: '0 0 16px', ...label11 }}>Required CSV Columns</p>
            {[
              ['id / charge_id',       'Transaction identifier'],
              ['amount',               'Gross charge amount'],
              ['net',                  'Net after OPN fees'],
              ['currency',             'Should be THB'],
              ['fee',                  'OPN processing fee (optional)'],
              ['created / created_at', 'Transaction date'],
              ['metadata[branchName]', 'Branch identifier (optional)'],
            ].map(([col, desc]) => (
              <div key={col} style={{
                display: 'flex', gap: '10px', padding: '7px 0',
                borderBottom: `1px solid rgba(255,255,255,0.03)`, alignItems: 'flex-start',
              }}>
                <code style={{
                  fontSize: '11px', color: GOLD, background: GOLD_BG,
                  padding: '2px 6px', borderRadius: '4px', flexShrink: 0,
                }}>{col}</code>
                <span style={{ fontSize: '12px', color: TEXT_MUTED }}>{desc}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

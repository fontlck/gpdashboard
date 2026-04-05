'use client'

import { useRef, useState, useCallback, DragEvent, ChangeEvent, CSSProperties } from 'react'

// ── Types ────────────────────────────────────────────────────────────────────

type Phase = 'idle' | 'preview' | 'importing' | 'done' | 'error'

type PreviewData = {
  filename: string
  totalRows: number
  thbRows: number
  branches: string[]
  detectedMonth: number
  detectedYear: number
  headers: string[]
  missingColumns: string[]
}

type ImportResult = {
  importedRows: number
  skippedCurrency: number
  skippedStatus: number
  skippedOther: number
  branchesProcessed: number
  reportingMonth: number
  reportingYear: number
}

// ── CSV helpers (client-side preview only) ───────────────────────────────────

function parseCsvLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQ = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') { current += '"'; i++ }
      else inQ = !inQ
    } else if (ch === ',' && !inQ) { result.push(current.trim()); current = '' }
    else current += ch
  }
  result.push(current.trim())
  return result
}

function norm(s: string) { return s.toLowerCase().replace(/[\s_\-\[\]\.]/g, '') }

function findCol(headers: string[], ...candidates: string[]): string {
  const idx: Record<string, string> = {}
  headers.forEach(h => { idx[norm(h)] = h })
  for (const c of candidates) {
    const found = idx[norm(c)]
    if (found) return found
  }
  return ''
}

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

// ── Component ────────────────────────────────────────────────────────────────

export function CsvUploadClient() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const [isDragging, setIsDragging] = useState(false)
  const [preview, setPreview] = useState<PreviewData | null>(null)
  const [csvText, setCsvText] = useState('')
  const [isOverwrite, setIsOverwrite] = useState(false)
  const [amountInSatang, setAmountInSatang] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  const processFile = useCallback((file: File) => {
    if (!file.name.endsWith('.csv')) {
      setErrorMsg('Please select a .csv file'); setPhase('error'); return
    }
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      setCsvText(text)

      // Parse first 5000 chars for preview
      const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
      if (lines.length < 2) { setErrorMsg('CSV appears empty'); setPhase('error'); return }

      const headers = parseCsvLine(lines[0])

      // Detect key columns
      const currencyCol  = findCol(headers, 'currency')
      const statusCol    = findCol(headers, 'status')
      const createdCol   = findCol(headers, 'created', 'created_at', 'transaction_date', 'date')
      const branchCol    = findCol(headers, 'metadata[branchName]', 'metadatabranchname', 'branchname', 'branch_name', 'branch', 'Branch Name')
      const chargeIdCol  = findCol(headers, 'id', 'charge_id', 'chargeid', 'transaction_id')
      const amountCol    = findCol(headers, 'amount', 'gross_amount')
      const netCol       = findCol(headers, 'net', 'net_amount')

      const missingColumns: string[] = []
      if (!chargeIdCol) missingColumns.push('charge id (id / charge_id)')
      if (!amountCol)   missingColumns.push('amount')
      if (!netCol)      missingColumns.push('net')
      if (!currencyCol) missingColumns.push('currency')

      // Sample rows
      const VALID = new Set(['successful', 'paid', 'captured', ''])
      let thbRows = 0
      const branchSet = new Set<string>()
      const monthCount: Record<string, number> = {}

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim()
        if (!line) continue
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

      // Most common month
      let detectedMonth = new Date().getMonth() + 1
      let detectedYear  = new Date().getFullYear()
      if (Object.keys(monthCount).length > 0) {
        const topKey = Object.entries(monthCount).sort((a, b) => b[1] - a[1])[0][0]
        const [y, m] = topKey.split('-')
        detectedYear = parseInt(y); detectedMonth = parseInt(m)
      }

      setPreview({
        filename: file.name,
        totalRows: lines.length - 1,
        thbRows,
        branches: [...branchSet],
        detectedMonth,
        detectedYear,
        headers,
        missingColumns,
      })
      setPhase('preview')
    }
    reader.readAsText(file)
  }, [])

  const onFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
    e.target.value = ''
  }

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault(); setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }

  const onDragOver = (e: DragEvent<HTMLDivElement>) => { e.preventDefault(); setIsDragging(true) }
  const onDragLeave = () => setIsDragging(false)

  const handleImport = async () => {
    if (!preview || !csvText) return
    setPhase('importing')
    try {
      const res = await fetch('/api/admin/import-csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          csvText,
          filename: preview.filename,
          isOverwrite,
          amountDivisor: amountInSatang ? 100 : 1,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setErrorMsg(data.error ?? 'Import failed')
        if (data.headersFound) {
          setErrorMsg(prev => prev + `\n\nHeaders in your CSV: ${data.headersFound.join(', ')}`)
        }
        setPhase('error')
        return
      }
      setResult(data)
      setPhase('done')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Network error')
      setPhase('error')
    }
  }

  const reset = () => {
    setPhase('idle'); setPreview(null); setCsvText('')
    setResult(null); setErrorMsg('')
  }

  // ── Styles ──────────────────────────────────────────────────────────────────

  const card: CSSProperties = {
    background: '#0D0F1A', border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '16px', padding: '28px',
  }

  const gold = '#C4A35E'
  const goldBg = 'rgba(196,163,94,0.08)'
  const goldBorder = 'rgba(196,163,94,0.25)'
  const textMuted = 'rgba(240,236,228,0.45)'
  const textMain = '#F0ECE4'

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Drop Zone (always visible in idle) */}
      {(phase === 'idle') && (
        <div
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          style={{
            background: isDragging ? 'rgba(196,163,94,0.05)' : '#0D0F1A',
            border: `2px dashed ${isDragging ? gold : goldBorder}`,
            borderRadius: '16px',
            padding: '64px 40px',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            gap: '16px', textAlign: 'center',
            transition: 'all 0.15s ease',
          }}
        >
          <div style={{
            width: '56px', height: '56px', borderRadius: '14px',
            background: goldBg, border: `1px solid ${goldBorder}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '22px',
          }}>↑</div>

          <div>
            <p style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: textMain }}>
              Drop your OPN CSV here
            </p>
            <p style={{ margin: '6px 0 0', fontSize: '13px', color: textMuted }}>
              or click Browse — .csv files only
            </p>
          </div>

          <button
            onClick={() => fileInputRef.current?.click()}
            style={{
              padding: '10px 28px', borderRadius: '10px',
              background: `linear-gradient(135deg,${gold} 0%,#9A7A3A 100%)`,
              color: '#080A10', fontSize: '13px', fontWeight: 700,
              cursor: 'pointer', border: 'none', letterSpacing: '0.04em',
            }}
          >
            Browse File
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            style={{ display: 'none' }}
            onChange={onFileChange}
          />
        </div>
      )}

      {/* Preview */}
      {phase === 'preview' && preview && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          {/* File summary */}
          <div style={{ ...card, gridColumn: '1 / -1' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <p style={{ margin: 0, fontSize: '13px', color: textMuted }}>File selected</p>
                <p style={{ margin: '4px 0 0', fontSize: '16px', fontWeight: 600, color: textMain }}>
                  {preview.filename}
                </p>
              </div>
              <button onClick={reset} style={{
                background: 'none', border: `1px solid rgba(255,255,255,0.12)`,
                color: textMuted, padding: '6px 14px', borderRadius: '8px',
                cursor: 'pointer', fontSize: '12px',
              }}>Change file</button>
            </div>

            {preview.missingColumns.length > 0 && (
              <div style={{
                marginTop: '16px', padding: '12px 16px',
                background: 'rgba(255,80,80,0.06)', border: '1px solid rgba(255,80,80,0.2)',
                borderRadius: '10px', fontSize: '12px', color: 'rgba(255,120,120,0.9)',
              }}>
                ⚠️ Missing required columns: {preview.missingColumns.join(', ')}<br />
                <span style={{ color: textMuted }}>
                  Headers found: {preview.headers.slice(0, 10).join(', ')}
                  {preview.headers.length > 10 ? ` +${preview.headers.length - 10} more` : ''}
                </span>
              </div>
            )}

            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '16px', marginTop: '20px',
            }}>
              {[
                { label: 'Total Rows', value: preview.totalRows.toLocaleString() },
                { label: 'THB Rows', value: preview.thbRows.toLocaleString() },
                { label: 'Branches Found', value: preview.branches.length || '—' },
              ].map(s => (
                <div key={s.label} style={{
                  background: goldBg, border: `1px solid ${goldBorder}`,
                  borderRadius: '10px', padding: '14px 18px',
                }}>
                  <p style={{ margin: 0, fontSize: '11px', color: textMuted, letterSpacing: '0.07em', textTransform: 'uppercase' }}>{s.label}</p>
                  <p style={{ margin: '6px 0 0', fontSize: '22px', fontWeight: 700, color: gold }}>{s.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Detected period */}
          <div style={card}>
            <p style={{ margin: '0 0 12px', fontSize: '12px', fontWeight: 600, color: textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Detected Period
            </p>
            <p style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: textMain }}>
              {MONTH_NAMES[preview.detectedMonth - 1]} {preview.detectedYear}
            </p>
            <p style={{ margin: '6px 0 0', fontSize: '12px', color: textMuted }}>
              Auto-detected from transaction dates
            </p>
          </div>

          {/* Branches */}
          <div style={card}>
            <p style={{ margin: '0 0 12px', fontSize: '12px', fontWeight: 600, color: textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Branches in CSV
            </p>
            {preview.branches.length === 0 ? (
              <p style={{ margin: 0, fontSize: '13px', color: textMuted }}>
                No branch column detected — rows will go to "Unknown Branch"
              </p>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {preview.branches.map(b => (
                  <span key={b} style={{
                    padding: '4px 12px', borderRadius: '20px',
                    background: goldBg, border: `1px solid ${goldBorder}`,
                    fontSize: '12px', color: gold,
                  }}>{b}</span>
                ))}
              </div>
            )}
          </div>

          {/* Options */}
          <div style={{ ...card, gridColumn: '1 / -1' }}>
            <p style={{ margin: '0 0 16px', fontSize: '12px', fontWeight: 600, color: textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Import Options
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {[
                {
                  id: 'satang',
                  checked: amountInSatang,
                  onChange: () => setAmountInSatang(v => !v),
                  label: 'Amounts are in satang (÷ 100)',
                  desc: 'Check this if your OPN CSV shows amounts like 150000 instead of 1500.00',
                },
                {
                  id: 'overwrite',
                  checked: isOverwrite,
                  onChange: () => setIsOverwrite(v => !v),
                  label: 'Overwrite existing report for this month',
                  desc: 'If a monthly report already exists for a branch, replace it with this data',
                },
              ].map(opt => (
                <label key={opt.id} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', cursor: 'pointer' }}>
                  <input
                    type="checkbox" checked={opt.checked} onChange={opt.onChange}
                    style={{ marginTop: '2px', accentColor: gold, width: '15px', height: '15px', flexShrink: 0 }}
                  />
                  <div>
                    <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: textMain }}>{opt.label}</p>
                    <p style={{ margin: '2px 0 0', fontSize: '12px', color: textMuted }}>{opt.desc}</p>
                  </div>
                </label>
              ))}
            </div>

            <div style={{ marginTop: '24px', display: 'flex', gap: '12px' }}>
              <button
                onClick={handleImport}
                disabled={preview.missingColumns.length > 0}
                style={{
                  padding: '12px 32px', borderRadius: '10px',
                  background: preview.missingColumns.length > 0
                    ? 'rgba(196,163,94,0.3)'
                    : `linear-gradient(135deg,${gold} 0%,#9A7A3A 100%)`,
                  color: '#080A10', fontSize: '14px', fontWeight: 700,
                  cursor: preview.missingColumns.length > 0 ? 'not-allowed' : 'pointer',
                  border: 'none', letterSpacing: '0.04em',
                }}
              >
                Import {preview.thbRows.toLocaleString()} rows
              </button>
              <button onClick={reset} style={{
                padding: '12px 20px', borderRadius: '10px',
                background: 'none', border: `1px solid rgba(255,255,255,0.12)`,
                color: textMuted, fontSize: '14px', cursor: 'pointer',
              }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Importing */}
      {phase === 'importing' && (
        <div style={{ ...card, textAlign: 'center', padding: '80px 40px' }}>
          <div style={{
            width: '48px', height: '48px', borderRadius: '50%',
            border: `3px solid ${goldBorder}`,
            borderTopColor: gold,
            margin: '0 auto 20px',
            animation: 'spin 0.8s linear infinite',
          }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
          <p style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: textMain }}>Importing…</p>
          <p style={{ margin: '8px 0 0', fontSize: '13px', color: textMuted }}>
            Processing rows and creating reports
          </p>
        </div>
      )}

      {/* Done */}
      {phase === 'done' && result && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div style={{ ...card, gridColumn: '1 / -1' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
              <div style={{
                width: '36px', height: '36px', borderRadius: '50%',
                background: 'rgba(80,220,100,0.1)', border: '1px solid rgba(80,220,100,0.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px',
              }}>✓</div>
              <div>
                <p style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: textMain }}>Import complete</p>
                <p style={{ margin: '2px 0 0', fontSize: '13px', color: textMuted }}>
                  {MONTH_NAMES[result.reportingMonth - 1]} {result.reportingYear}
                </p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '12px' }}>
              {[
                { label: 'Rows Imported', value: result.importedRows.toLocaleString(), color: '#50DC64' },
                { label: 'Branches Processed', value: result.branchesProcessed, color: gold },
                { label: 'Rows Skipped', value: result.skippedCurrency + result.skippedStatus + result.skippedOther, color: textMuted },
              ].map(s => (
                <div key={s.label} style={{
                  background: '#080A10', borderRadius: '10px', padding: '16px',
                  border: '1px solid rgba(255,255,255,0.05)',
                }}>
                  <p style={{ margin: 0, fontSize: '11px', color: textMuted, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{s.label}</p>
                  <p style={{ margin: '6px 0 0', fontSize: '24px', fontWeight: 700, color: s.color }}>{s.value}</p>
                </div>
              ))}
            </div>

            {(result.skippedCurrency > 0 || result.skippedStatus > 0) && (
              <p style={{ margin: '16px 0 0', fontSize: '12px', color: textMuted }}>
                {result.skippedCurrency > 0 && `${result.skippedCurrency} non-THB rows skipped. `}
                {result.skippedStatus > 0 && `${result.skippedStatus} non-successful rows skipped.`}
              </p>
            )}

            <div style={{ marginTop: '20px', display: 'flex', gap: '12px' }}>
              <a href="/admin/reports" style={{
                display: 'inline-block', padding: '11px 28px', borderRadius: '10px',
                background: `linear-gradient(135deg,${gold} 0%,#9A7A3A 100%)`,
                color: '#080A10', fontSize: '13px', fontWeight: 700,
                textDecoration: 'none', letterSpacing: '0.04em',
              }}>
                View Reports →
              </a>
              <button onClick={reset} style={{
                padding: '11px 20px', borderRadius: '10px',
                background: 'none', border: `1px solid rgba(255,255,255,0.12)`,
                color: textMuted, fontSize: '13px', cursor: 'pointer',
              }}>
                Upload Another
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {phase === 'error' && (
        <div style={{ ...card, borderColor: 'rgba(255,80,80,0.2)' }}>
          <p style={{ margin: '0 0 8px', fontSize: '15px', fontWeight: 600, color: '#FF8080' }}>Import Failed</p>
          <pre style={{
            margin: '0 0 20px', fontSize: '12px', color: textMuted,
            whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            background: '#080A10', padding: '12px', borderRadius: '8px',
          }}>{errorMsg}</pre>
          <button onClick={reset} style={{
            padding: '10px 24px', borderRadius: '10px',
            background: 'rgba(255,80,80,0.1)', border: '1px solid rgba(255,80,80,0.2)',
            color: '#FF8080', fontSize: '13px', cursor: 'pointer',
          }}>
            Try Again
          </button>
        </div>
      )}

      {/* Static info cards (always shown) */}
      {(phase === 'idle' || phase === 'preview') && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div style={card}>
            <p style={{ margin: '0 0 16px', fontSize: '12px', fontWeight: 600, color: textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Import Phases
            </p>
            {[
              { n: '01', label: 'Validate', desc: 'Check headers and detect columns' },
              { n: '02', label: 'Filter', desc: 'Keep THB + successful transactions only' },
              { n: '03', label: 'Map Branches', desc: 'Match CSV names to DB branches (auto-creates if missing)' },
              { n: '04', label: 'Import', desc: 'Create monthly reports and transaction rows' },
            ].map(s => (
              <div key={s.n} style={{
                display: 'flex', gap: '14px', padding: '10px 0',
                borderBottom: '1px solid rgba(255,255,255,0.04)',
              }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(196,163,94,0.5)', letterSpacing: '0.1em', paddingTop: '2px', flexShrink: 0 }}>{s.n}</span>
                <div>
                  <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: textMain }}>{s.label}</p>
                  <p style={{ margin: '2px 0 0', fontSize: '12px', color: textMuted }}>{s.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div style={card}>
            <p style={{ margin: '0 0 16px', fontSize: '12px', fontWeight: 600, color: textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Required CSV Columns
            </p>
            {[
              ['id / charge_id', 'Transaction identifier'],
              ['amount', 'Gross charge amount'],
              ['net', 'Net after OPN fees'],
              ['currency', 'Should be THB'],
              ['fee', 'OPN processing fee (optional)'],
              ['created / created_at', 'Transaction date'],
              ['metadata[branchName]', 'Branch identifier (optional)'],
            ].map(([col, desc]) => (
              <div key={col} style={{
                display: 'flex', gap: '10px', padding: '7px 0',
                borderBottom: '1px solid rgba(255,255,255,0.03)',
              }}>
                <code style={{ fontSize: '11px', color: gold, background: goldBg, padding: '2px 6px', borderRadius: '4px', flexShrink: 0, alignSelf: 'flex-start' }}>{col}</code>
                <span style={{ fontSize: '12px', color: textMuted }}>{desc}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

// ── CSV Parser ──────────────────────────────────────────────────────────────

function parseCsvLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim()); current = ''
    } else {
      current += ch
    }
  }
  result.push(current.trim())
  return result
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  if (lines.length < 2) return []
  const headers = parseCsvLine(lines[0])
  const rows: Record<string, string>[] = []
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    const values = parseCsvLine(line)
    const row: Record<string, string> = {}
    headers.forEach((h, idx) => { row[h.trim()] = values[idx] ?? '' })
    rows.push(row)
  }
  return rows
}

// ── Column Detection ────────────────────────────────────────────────────────

type ColMap = Record<string, string>

function detectColumns(headers: string[]): ColMap {
  const norm = (s: string) => s.toLowerCase().replace(/[\s_\-\[\]\.]/g, '')
  const idx: Record<string, string> = {}
  headers.forEach(h => { idx[norm(h)] = h })

  const find = (...candidates: string[]): string => {
    for (const c of candidates) {
      const found = idx[norm(c)]
      if (found) return found
    }
    return ''
  }

  return {
    charge_id:       find('id', 'charge_id', 'chargeid', 'transaction_id'),
    amount:          find('amount', 'gross_amount'),
    fee:             find('fee', 'opn_fee', 'charge_fee'),
    fee_vat:         find('vat', 'fee_vat', 'opn_fee_vat', 'feevat', 'interest_vat'),
    net:             find('net', 'net_amount'),
    currency:        find('currency'),
    status:          find('status'),
    created:         find('created', 'created_at', 'transaction_date', 'date', 'charge_date'),
    refunded:        find('refunded', 'is_refunded'),
    refunded_amount: find('amount_refunded', 'refunded_amount', 'opn_refunded_amount'),
    source:          find('source_type', 'payment_method', 'funding_source_type', 'source', 'type'),
    branch_name:     find('metadata[branchName]', 'metadatabranchname', 'branchname', 'branch_name', 'branch', 'Branch Name'),
    artist_name:     find('metadata[artistName]', 'metadataartistname', 'artistname', 'artist_name', 'artist'),
    email:           find('customer_email', 'email', 'customeremail', 'customer[email]'),
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function parseNum(s: string | undefined): number {
  if (!s) return 0
  const n = parseFloat(s.replace(/,/g, ''))
  return isNaN(n) ? 0 : n
}

function parseBool(s: string | undefined): boolean {
  if (!s) return false
  return ['true', '1', 'yes'].includes(s.toLowerCase())
}

function parseDate(s: string | undefined): Date | null {
  if (!s) return null
  const d = new Date(s)
  return isNaN(d.getTime()) ? null : d
}

function branchCode(name: string): string {
  // Generate a short code from the branch name
  return name
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .trim()
    .split(/\s+/)
    .map(w => w[0] ?? '')
    .join('')
    .toUpperCase()
    .slice(0, 6) || 'BR'
}

// ── POST Handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  // Auth
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Body
  let body: { csvText: string; filename: string; isOverwrite?: boolean; amountDivisor?: number }
  try { body = await request.json() }
  catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }) }

  const { csvText, filename, isOverwrite = false, amountDivisor = 1 } = body
  if (!csvText || !filename)
    return NextResponse.json({ error: 'Missing csvText or filename' }, { status: 400 })

  // Parse
  const allRows = parseCSV(csvText)
  if (allRows.length === 0)
    return NextResponse.json({ error: 'CSV has no data rows' }, { status: 400 })

  const colMap = detectColumns(Object.keys(allRows[0]))
  const missing = ['charge_id', 'amount', 'currency', 'net'].filter(k => !colMap[k])
  if (missing.length > 0)
    return NextResponse.json({
      error: `Cannot find required columns: ${missing.join(', ')}`,
      headersFound: Object.keys(allRows[0]),
    }, { status: 400 })

  // Filter rows
  const VALID_STATUSES = new Set(['successful', 'paid', 'captured', ''])
  let skippedCurrency = 0, skippedStatus = 0

  type TxRow = {
    charge_id: string; amount: number; fee: number; fee_vat: number; net: number
    currency: string; status: string; date: Date; refunded: boolean
    refunded_amount: number; source: string; branch_name: string
    artist_name: string; email: string; raw: Record<string, string>
  }

  const txRows: TxRow[] = []
  for (const row of allRows) {
    const currency = (row[colMap.currency] ?? '').toUpperCase()
    if (currency && currency !== 'THB') { skippedCurrency++; continue }

    const status = (row[colMap.status] ?? '').toLowerCase()
    if (colMap.status && !VALID_STATUSES.has(status)) { skippedStatus++; continue }

    const date = parseDate(row[colMap.created]) ?? new Date()

    txRows.push({
      charge_id:       row[colMap.charge_id] ?? '',
      amount:          parseNum(row[colMap.amount]) / amountDivisor,
      fee:             parseNum(row[colMap.fee]) / amountDivisor,
      fee_vat:         parseNum(row[colMap.fee_vat]) / amountDivisor,
      net:             parseNum(row[colMap.net]) / amountDivisor,
      currency,
      status:          row[colMap.status] ?? '',
      date,
      refunded:        parseBool(row[colMap.refunded]),
      refunded_amount: parseNum(row[colMap.refunded_amount]) / amountDivisor,
      source:          row[colMap.source] ?? '',
      branch_name:     row[colMap.branch_name] ?? '',
      artist_name:     row[colMap.artist_name] ?? '',
      email:           row[colMap.email] ?? '',
      raw:             row,
    })
  }

  if (txRows.length === 0)
    return NextResponse.json({
      error: 'No valid THB rows found after filtering',
      skippedCurrency, skippedStatus,
    }, { status: 400 })

  // Determine primary reporting month (most common)
  const monthCount: Record<string, number> = {}
  txRows.forEach(r => {
    const key = `${r.date.getFullYear()}-${r.date.getMonth() + 1}`
    monthCount[key] = (monthCount[key] ?? 0) + 1
  })
  const primaryKey = Object.entries(monthCount).sort((a, b) => b[1] - a[1])[0][0]
  const [yearStr, monthStr] = primaryKey.split('-')
  const reportingYear  = parseInt(yearStr)
  const reportingMonth = parseInt(monthStr)

  // Admin DB client
  const admin = createAdminClient()

  // Get or create branches
  const uniqueBranchNames = [...new Set(txRows.map(r => r.branch_name).filter(Boolean))]
  const branchIdMap: Record<string, string> = {}  // branch_name → branch UUID

  for (const bName of uniqueBranchNames) {
    // Look up branch by name (case-insensitive)
    const { data: existing } = await admin
      .from('branches')
      .select('id')
      .ilike('name', bName)
      .eq('is_active', true)
      .limit(1)
      .single()

    if (existing) {
      branchIdMap[bName] = existing.id
      continue
    }

    // Create partner + branch
    const { data: partner, error: partnerErr } = await admin
      .from('partners')
      .insert({ name: bName, is_vat_registered: false, is_active: true })
      .select('id')
      .single()

    if (partnerErr || !partner)
      return NextResponse.json({ error: `Failed to create partner for branch "${bName}": ${partnerErr?.message}` }, { status: 500 })

    const code = branchCode(bName)
    const { data: branch, error: branchErr } = await admin
      .from('branches')
      .insert({
        partner_id: partner.id,
        name: bName,
        code,
        revenue_share_pct: 50,
        is_active: true,
      })
      .select('id')
      .single()

    if (branchErr || !branch)
      return NextResponse.json({ error: `Failed to create branch "${bName}": ${branchErr?.message}` }, { status: 500 })

    branchIdMap[bName] = branch.id
  }

  // Handle rows with no branch_name — put under a generic branch
  const noBranchRows = txRows.filter(r => !r.branch_name)
  if (noBranchRows.length > 0) {
    const fallbackName = 'Unknown Branch'
    if (!branchIdMap[fallbackName]) {
      const { data: existing } = await admin
        .from('branches').select('id').ilike('name', fallbackName).limit(1).single()

      if (existing) {
        branchIdMap[fallbackName] = existing.id
      } else {
        const { data: partner } = await admin
          .from('partners').insert({ name: fallbackName, is_vat_registered: false, is_active: true })
          .select('id').single()
        if (partner) {
          const { data: branch } = await admin
            .from('branches')
            .insert({ partner_id: partner.id, name: fallbackName, code: 'UNK', revenue_share_pct: 50, is_active: true })
            .select('id').single()
          if (branch) branchIdMap[fallbackName] = branch.id
        }
      }
    }
    noBranchRows.forEach(r => { r.branch_name = fallbackName })
  }

  // Create csv_uploads record
  const storagePath = `imports/${reportingYear}-${String(reportingMonth).padStart(2, '0')}/${Date.now()}-${filename}`
  const { data: csvUpload, error: uploadErr } = await admin
    .from('csv_uploads')
    .insert({
      reporting_month:   reportingMonth,
      reporting_year:    reportingYear,
      uploaded_by:       user.id,
      original_filename: filename,
      storage_path:      storagePath,
      status:            'processing',
      is_overwrite:      isOverwrite,
      row_count_total:   allRows.length,
    })
    .select('id')
    .single()

  if (uploadErr || !csvUpload)
    return NextResponse.json({ error: `Failed to create upload record: ${uploadErr?.message}` }, { status: 500 })

  const csvUploadId = csvUpload.id

  // Group txRows by branch_name
  const byBranch: Record<string, TxRow[]> = {}
  txRows.forEach(r => {
    const key = r.branch_name || 'Unknown Branch'
    ;(byBranch[key] ??= []).push(r)
  })

  // Fetch VAT rate from settings
  const { data: vatSetting } = await admin
    .from('settings').select('value').eq('key', 'vat_rate').single()
  const vatRate = parseFloat(vatSetting?.value ?? '0.07')

  let totalImported = 0
  let totalSkipped = 0
  let branchesProcessed = 0

  for (const [bName, rows] of Object.entries(byBranch)) {
    const branchId = branchIdMap[bName]
    if (!branchId) { totalSkipped += rows.length; continue }

    // Fetch branch + partner details for revenue share / VAT
    const { data: branchData } = await admin
      .from('branches')
      .select('id, revenue_share_pct, partner_id, partners(is_vat_registered)')
      .eq('id', branchId)
      .single()

    const revenueSharePct = branchData?.revenue_share_pct ?? 50
    const isVatRegistered = (branchData?.partners as { is_vat_registered?: boolean } | null)?.is_vat_registered ?? false

    // Financial calculations
    const gross_sales     = rows.reduce((s, r) => s + (r.refunded ? 0 : r.amount), 0)
    const total_opn_fee   = rows.reduce((s, r) => s + r.fee, 0)
    const total_net       = rows.reduce((s, r) => s + r.net, 0)
    const total_refunds   = rows.reduce((s, r) => s + r.refunded_amount, 0)
    const adjusted_net    = total_net - total_refunds
    const partner_share   = adjusted_net * (Number(revenueSharePct) / 100)
    const vat_amount      = isVatRegistered ? partner_share * vatRate : 0
    const final_payout    = partner_share + vat_amount

    // Upsert monthly_report
    const { data: existingReport } = await admin
      .from('monthly_reports')
      .select('id')
      .eq('branch_id', branchId)
      .eq('reporting_month', reportingMonth)
      .eq('reporting_year', reportingYear)
      .single()

    let monthlyReportId: string

    if (existingReport && isOverwrite) {
      // Delete old rows first
      await admin.from('report_rows').delete().eq('monthly_report_id', existingReport.id)
      await admin.from('monthly_reports').update({
        csv_upload_id:             csvUploadId,
        total_transaction_count:   rows.length,
        total_skipped_currency:    skippedCurrency,
        total_skipped_date:        0,
        total_skipped_status:      skippedStatus,
        gross_sales,
        total_opn_fee,
        total_net,
        total_refunds,
        adjusted_net,
        has_negative_adjusted_net: adjusted_net < 0,
        revenue_share_pct_snapshot: revenueSharePct,
        partner_share_base:        partner_share,
        is_vat_registered_snapshot: isVatRegistered,
        vat_rate_snapshot:         vatRate,
        vat_amount,
        final_payout,
        status: 'draft',
      }).eq('id', existingReport.id)
      monthlyReportId = existingReport.id
    } else if (existingReport && !isOverwrite) {
      totalSkipped += rows.length
      continue
    } else {
      const { data: newReport, error: reportErr } = await admin
        .from('monthly_reports')
        .insert({
          branch_id:                 branchId,
          csv_upload_id:             csvUploadId,
          reporting_month:           reportingMonth,
          reporting_year:            reportingYear,
          total_transaction_count:   rows.length,
          total_skipped_currency:    skippedCurrency,
          total_skipped_date:        0,
          total_skipped_status:      skippedStatus,
          gross_sales,
          total_opn_fee,
          total_net,
          total_refunds,
          adjusted_net,
          has_negative_adjusted_net: adjusted_net < 0,
          revenue_share_pct_snapshot: revenueSharePct,
          partner_share_base:        partner_share,
          is_vat_registered_snapshot: isVatRegistered,
          vat_rate_snapshot:         vatRate,
          vat_amount,
          final_payout,
          status: 'draft',
        })
        .select('id')
        .single()

      if (reportErr || !newReport) { totalSkipped += rows.length; continue }
      monthlyReportId = newReport.id
    }

    // Insert report_rows in batches of 500
    const BATCH = 500
    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH).map((r, j) => ({
        monthly_report_id:   monthlyReportId,
        csv_upload_id:       csvUploadId,
        row_number:          i + j + 1,
        charge_id:           r.charge_id,
        transaction_date:    r.date.toISOString(),
        amount:              r.amount,
        currency:            r.currency || 'THB',
        opn_fee:             r.fee,
        opn_fee_vat:         r.fee_vat,
        net:                 r.net,
        opn_refunded_amount: r.refunded_amount,
        opn_refunded:        r.refunded,
        payment_source:      r.source || null,
        branch_name_raw:     r.branch_name || null,
        artist_name_raw:     r.artist_name || null,
        customer_email:      r.email || null,
        raw_data:            r.raw,
      }))
      await admin.from('report_rows').insert(batch)
    }

    totalImported += rows.length
    branchesProcessed++
  }

  // Update csv_uploads status
  await admin.from('csv_uploads').update({
    status:             'completed',
    row_count_imported: totalImported,
    row_count_skipped:  totalSkipped + skippedCurrency + skippedStatus,
    branches_found:     branchesProcessed,
  }).eq('id', csvUploadId)

  return NextResponse.json({
    success: true,
    csvUploadId,
    reportingMonth,
    reportingYear,
    totalRows:         allRows.length,
    importedRows:      totalImported,
    skippedCurrency,
    skippedStatus,
    skippedOther:      totalSkipped,
    branchesProcessed,
    newBranchesCreated: uniqueBranchNames.filter(n => !branchIdMap[n]).length,
  })
}

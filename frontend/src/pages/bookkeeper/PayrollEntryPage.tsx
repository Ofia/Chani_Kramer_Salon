import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { ChevronDown, ChevronUp, Check, Clock, Trash2, RotateCcw } from 'lucide-react'

// ── Date helpers ─────────────────────────────────────────────

function getWednesday(d = new Date()): string {
  const day  = d.getDay()
  const diff = day >= 3 ? day - 3 : day + 4
  const wed  = new Date(d)
  wed.setDate(d.getDate() - diff)
  return wed.toISOString().split('T')[0]
}
function getTuesday(wedStr: string): string {
  const d = new Date(wedStr + 'T00:00:00')
  d.setDate(d.getDate() + 6)
  return d.toISOString().split('T')[0]
}
function firstOfMonth(year: number, month: number) {
  return new Date(year, month - 1, 1).toISOString().split('T')[0]
}
function lastOfMonth(year: number, month: number) {
  return new Date(year, month, 0).toISOString().split('T')[0]
}
function todayStr() { return new Date().toISOString().split('T')[0] }
function fmtDate(str: string) {
  return new Date(str + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
function fmt(n: number | string) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(n))
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const YEARS  = [2023, 2024, 2025, 2026]

// ── Types ────────────────────────────────────────────────────

interface PayrollEntry {
  id: string
  employee_id: string
  week_start: string
  week_end: string
  amount: number
  cash_amount: number
  bank_amount: number
  status: 'pending' | 'paid'
  paid_at: string | null
  pay_type_snapshot: string
  notes: string | null
}

interface HoursSummary {
  employee_id: string
  total_hours: number
  suggested_pay: number | null
  hourly_rate: number | null
}

// ── Employee Row ─────────────────────────────────────────────

function EmployeeRow({
  emp,
  entry,
  hours,
  weekStart,
  weekEnd,
  onSaved,
}: {
  emp: any
  entry: PayrollEntry | undefined
  hours: HoursSummary | undefined
  weekStart: string
  weekEnd: string
  onSaved: () => void
}) {
  const [open, setOpen]           = useState(false)
  const [total, setTotal]         = useState('')
  const [cash, setCash]           = useState('')
  const [notes, setNotes]         = useState('')
  const [error, setError]         = useState('')

  // Sync local state when entry loads or week changes
  useEffect(() => {
    if (entry) {
      setTotal(entry.amount > 0 ? entry.amount.toFixed(2) : '')
      setCash(entry.cash_amount > 0 ? entry.cash_amount.toFixed(2) : '')
      setNotes(entry.notes ?? '')
    } else {
      setTotal('')
      setCash('')
      setNotes('')
    }
    setError('')
  }, [entry, weekStart])

  const totalNum = parseFloat(total) || 0
  const cashNum  = parseFloat(cash)  || 0
  const bankNum  = Math.max(0, totalNum - cashNum)
  const isPaid   = entry?.status === 'paid'

  const qc = useQueryClient()

  const saveMutation = useMutation({
    mutationFn: () => {
      const body = {
        amount: totalNum,
        cash_amount: cashNum,
        bank_amount: bankNum,
        notes: notes || null,
      }
      if (entry) {
        return api.patch(`/payroll/${entry.id}`, body)
      }
      return api.post('/payroll', {
        ...body,
        week_start: weekStart,
        week_end: weekEnd,
        employee_id: emp.id,
        pay_type_snapshot: emp.pay_type,
      })
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['payroll-weekly', weekStart] }); setError(''); onSaved() },
    onError: (e: any) => setError(e?.response?.data?.detail ?? 'Save failed'),
  })

  const markPaidMutation = useMutation({
    mutationFn: () => {
      // If no entry yet, save first then mark paid in sequence
      if (!entry) {
        return api.post('/payroll', {
          amount: totalNum, cash_amount: cashNum, bank_amount: bankNum,
          notes: notes || null, week_start: weekStart, week_end: weekEnd,
          employee_id: emp.id, pay_type_snapshot: emp.pay_type,
        }).then(r => api.post(`/payroll/${r.data.id}/mark-paid`, {}))
      }
      // Save amounts first, then mark paid
      return api.patch(`/payroll/${entry.id}`, {
        amount: totalNum, cash_amount: cashNum, bank_amount: bankNum, notes: notes || null,
      }).then(() => api.post(`/payroll/${entry.id}/mark-paid`, {}))
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['payroll-weekly', weekStart] }); setError(''); setOpen(false) },
    onError: (e: any) => setError(e?.response?.data?.detail ?? 'Failed to mark paid'),
  })

  const markPendingMutation = useMutation({
    mutationFn: () => api.post(`/payroll/${entry!.id}/mark-pending`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['payroll-weekly', weekStart] }),
    onError: (e: any) => setError(e?.response?.data?.detail ?? 'Failed'),
  })

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/payroll/${entry!.id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['payroll-weekly', weekStart] }); setOpen(false) },
  })

  function applySuggested() {
    if (!hours?.suggested_pay) return
    setTotal(hours.suggested_pay.toFixed(2))
  }

  return (
    <div style={{ borderBottom: '1px solid rgba(13,13,13,0.06)' }}>

      {/* ── Collapsed row ── */}
      <div
        onClick={() => !isPaid && setOpen(v => !v)}
        style={{
          ...s.row,
          cursor: isPaid ? 'default' : 'pointer',
          background: open ? 'rgba(13,13,13,0.02)' : 'transparent',
        }}
      >
        <div style={s.rowLeft}>
          <span style={s.empName}>{emp.first_name} {emp.last_name}</span>
          <span style={s.empRole}>{emp.job_title}</span>
        </div>

        <div style={s.rowRight}>
          {/* Hours badge */}
          {hours && (
            <span style={s.hoursBadge}>
              <Clock size={10} color="#5581B1" />
              {hours.total_hours}h
            </span>
          )}

          {/* Amount summary */}
          {entry && entry.amount > 0 ? (
            <span style={s.amountSummary}>
              {fmt(entry.amount)}
              {entry.cash_amount > 0 && entry.bank_amount > 0 && (
                <span style={s.splitHint}>
                  {fmt(entry.cash_amount)} cash · {fmt(entry.bank_amount)} bank
                </span>
              )}
              {entry.cash_amount > 0 && entry.bank_amount === 0 && (
                <span style={s.splitHint}>cash</span>
              )}
              {entry.cash_amount === 0 && entry.bank_amount > 0 && (
                <span style={s.splitHint}>bank</span>
              )}
            </span>
          ) : (
            <span style={s.amountEmpty}>—</span>
          )}

          {/* Status badge */}
          {isPaid ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={s.paidBadge}><Check size={10} /> Paid</span>
              <button
                onClick={e => { e.stopPropagation(); markPendingMutation.mutate() }}
                style={s.undoBtn}
                title="Undo — mark as pending"
              >
                <RotateCcw size={11} />
              </button>
            </div>
          ) : (
            <span style={s.pendingBadge}>Pending</span>
          )}

          {/* Chevron */}
          {!isPaid && (
            <span style={s.chevron}>
              {open ? <ChevronUp size={14} color="rgba(13,13,13,0.35)" /> : <ChevronDown size={14} color="rgba(13,13,13,0.35)" />}
            </span>
          )}
        </div>
      </div>

      {/* ── Expanded panel ── */}
      {open && !isPaid && (
        <div style={s.expandPanel}>

          {/* Suggested pay pill */}
          {hours?.suggested_pay != null && (
            <div style={s.suggestRow}>
              <span style={s.suggestLabel}>Hourly suggestion:</span>
              <button onClick={applySuggested} style={s.suggestPill}>
                {fmt(hours.suggested_pay)} ({hours.total_hours}h × ${hours.hourly_rate}/h)
              </button>
            </div>
          )}

          {/* Inputs */}
          <div style={s.inputGrid}>
            <div style={s.inputGroup}>
              <label style={s.label}>Total Pay</label>
              <div style={s.moneyCell}>
                <span style={s.moneySym}>$</span>
                <input
                  type="number" min="0" step="0.01"
                  value={total}
                  onChange={e => setTotal(e.target.value)}
                  style={s.moneyInput}
                  placeholder="0.00"
                  autoFocus
                />
              </div>
            </div>

            <div style={s.inputGroup}>
              <label style={s.label}>Cash portion</label>
              <div style={s.moneyCell}>
                <span style={s.moneySym}>$</span>
                <input
                  type="number" min="0" step="0.01"
                  value={cash}
                  onChange={e => setCash(e.target.value)}
                  style={s.moneyInput}
                  placeholder="0.00"
                />
              </div>
            </div>

            <div style={s.inputGroup}>
              <label style={s.label}>Bank transfer</label>
              <div style={{ ...s.moneyCell, background: '#f5f4f2', opacity: 0.8 }}>
                <span style={s.moneySym}>$</span>
                <span style={{ ...s.moneyInput, display: 'flex', alignItems: 'center', color: 'rgba(13,13,13,0.55)' }}>
                  {bankNum > 0 ? bankNum.toFixed(2) : '—'}
                </span>
              </div>
            </div>
          </div>

          <div style={s.inputGroup}>
            <label style={s.label}>Notes</label>
            <input
              value={notes}
              onChange={e => setNotes(e.target.value)}
              style={s.notesInput}
              placeholder="Optional notes…"
            />
          </div>

          {error && <div style={s.errorText}>{error}</div>}

          {/* Action buttons */}
          <div style={s.actions}>
            <button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || totalNum <= 0}
              style={{ ...s.saveBtn, opacity: totalNum <= 0 ? 0.4 : 1 }}
            >
              {saveMutation.isPending ? 'Saving…' : 'Save'}
            </button>
            <button
              onClick={() => markPaidMutation.mutate()}
              disabled={markPaidMutation.isPending || totalNum <= 0}
              style={{ ...s.markPaidBtn, opacity: totalNum <= 0 ? 0.4 : 1 }}
            >
              <Check size={13} />
              {markPaidMutation.isPending ? 'Marking…' : 'Mark as Paid'}
            </button>
            {entry && (
              <button
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
                style={s.deleteBtn}
                title="Delete entry"
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────

export default function PayrollEntryPage() {
  const now = new Date()
  const [view, setView]           = useState<'weekly' | 'monthly' | 'range'>('weekly')
  const [weekStart, setWeekStart] = useState(getWednesday())
  const [selYear,  setSelYear]    = useState(now.getFullYear())
  const [selMonth, setSelMonth]   = useState(now.getMonth() + 1)
  const [rangeStart, setRangeStart] = useState(firstOfMonth(now.getFullYear(), now.getMonth() + 1))
  const [rangeEnd,   setRangeEnd]   = useState(todayStr())
  const [savedFlash, setSavedFlash] = useState(false)

  const weekEnd = getTuesday(weekStart)

  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: () => api.get('/employees/?active_only=true').then(r => Array.isArray(r.data) ? r.data : []).catch(() => []),
  })

  const { data: weekPayroll = [] } = useQuery<PayrollEntry[]>({
    queryKey: ['payroll-weekly', weekStart],
    queryFn: () => api.get(`/payroll/?week_start=${weekStart}`).then(r => Array.isArray(r.data) ? r.data : []).catch(() => []),
    enabled: view === 'weekly',
  })

  const { data: hoursSummary = [] } = useQuery<HoursSummary[]>({
    queryKey: ['week-hours', weekStart],
    queryFn: () => api.get(`/time-logs/week-summary/${weekStart}`).then(r => Array.isArray(r.data) ? r.data : []).catch(() => []),
    enabled: view === 'weekly',
  })

  const { data: monthlyData = [], isLoading: monthlyLoading } = useQuery({
    queryKey: ['payroll-monthly', selYear, selMonth],
    queryFn: () =>
      api.get(`/payroll/?start_date=${firstOfMonth(selYear, selMonth)}&end_date=${lastOfMonth(selYear, selMonth)}`)
        .then(r => Array.isArray(r.data) ? r.data : []).catch(() => []),
    enabled: view === 'monthly',
  })

  const { data: rangeData = [], isLoading: rangeLoading } = useQuery({
    queryKey: ['payroll-range', rangeStart, rangeEnd],
    queryFn: () =>
      api.get(`/payroll/?start_date=${rangeStart}&end_date=${rangeEnd}`)
        .then(r => Array.isArray(r.data) ? r.data : []).catch(() => []),
    enabled: view === 'range' && !!rangeStart && !!rangeEnd,
  })

  // Build quick-lookup maps
  const entryMap: Record<string, PayrollEntry> = {}
  ;(weekPayroll as PayrollEntry[]).forEach(e => { entryMap[e.employee_id] = e })

  const hoursMap: Record<string, HoursSummary> = {}
  ;(hoursSummary as HoursSummary[]).forEach(h => { hoursMap[h.employee_id] = h })

  function aggregateByEmployee(rows: any[]): Record<string, number> {
    const agg: Record<string, number> = {}
    rows.forEach((r: any) => { agg[r.employee_id] = (agg[r.employee_id] || 0) + Number(r.amount) })
    return agg
  }

  const monthlyAgg  = aggregateByEmployee(monthlyData as any[])
  const rangeAgg    = aggregateByEmployee(rangeData as any[])
  const monthlyTotal = Object.values(monthlyAgg).reduce((s, v) => s + v, 0)
  const rangeTotal   = Object.values(rangeAgg).reduce((s, v) => s + v, 0)

  const weeklyTotal = (weekPayroll as PayrollEntry[]).reduce((s, e) => s + e.amount, 0)
  const paidCount   = (weekPayroll as PayrollEntry[]).filter(e => e.status === 'paid').length

  const weekLabel  = `${fmtDate(weekStart)} — ${fmtDate(weekEnd)}`
  const monthLabel = new Date(selYear, selMonth - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const rangeLabel = rangeStart && rangeEnd ? `${fmtDate(rangeStart)} — ${fmtDate(rangeEnd)}` : ''
  const subtitle   = view === 'weekly' ? weekLabel : view === 'monthly' ? monthLabel : rangeLabel

  function handleSaved() {
    setSavedFlash(true)
    setTimeout(() => setSavedFlash(false), 2000)
  }

  return (
    <div style={s.page}>

      {/* ── Header ── */}
      <header style={s.header}>
        <div>
          <h1 style={s.title}>Weekly Payroll</h1>
          <p style={s.subtitle}>{subtitle}</p>
        </div>
        <div style={s.headerRight}>
          <div style={s.segmented}>
            <button onClick={() => setView('weekly')}  style={{ ...s.seg, ...(view === 'weekly'  ? s.segActive : {}) }}>Weekly</button>
            <button onClick={() => setView('monthly')} style={{ ...s.seg, ...(view === 'monthly' ? s.segActive : {}) }}>Monthly</button>
            <button onClick={() => setView('range')}   style={{ ...s.seg, ...(view === 'range'   ? s.segActive : {}) }}>Range</button>
          </div>
          {savedFlash && <span style={s.savedBadge}>Saved</span>}
        </div>
      </header>

      {/* ── Controls ── */}
      {view === 'weekly' && (
        <div style={s.controls}>
          <input type="date" value={weekStart} onChange={e => setWeekStart(e.target.value)} style={s.dateInput} />
          <span style={s.rangeSep}>→ {fmtDate(weekEnd)}</span>
          <span style={s.weekNote}>Wed – Tue · paid Thursday</span>
        </div>
      )}
      {view === 'monthly' && (
        <div style={s.controls}>
          <select value={selMonth} onChange={e => setSelMonth(Number(e.target.value))} style={s.dateInput}>
            {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <select value={selYear} onChange={e => setSelYear(Number(e.target.value))} style={s.dateInput}>
            {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      )}
      {view === 'range' && (
        <div style={s.controls}>
          <input type="date" value={rangeStart} onChange={e => setRangeStart(e.target.value)} style={s.dateInput} />
          <span style={s.rangeSep}>—</span>
          <input type="date" value={rangeEnd} onChange={e => setRangeEnd(e.target.value)} style={s.dateInput} />
        </div>
      )}

      {/* ── Weekly view ── */}
      {view === 'weekly' && (
        <>
          {/* Week summary bar */}
          <div style={s.weekBar}>
            <span style={s.weekBarStat}>
              <span style={s.weekBarLabel}>Total</span>
              <span style={s.weekBarValue}>{fmt(weeklyTotal)}</span>
            </span>
            <span style={s.weekBarDivider} />
            <span style={s.weekBarStat}>
              <span style={s.weekBarLabel}>Paid</span>
              <span style={{ ...s.weekBarValue, color: paidCount > 0 ? '#16a34a' : 'rgba(13,13,13,0.35)' }}>
                {paidCount} / {(employees as any[]).length}
              </span>
            </span>
          </div>

          <p style={s.sectionLabel}>Click a row to enter or edit payroll</p>
          <div style={s.card}>
            {(employees as any[]).map((emp: any) => (
              <EmployeeRow
                key={emp.id}
                emp={emp}
                entry={entryMap[emp.id]}
                hours={hoursMap[emp.id]}
                weekStart={weekStart}
                weekEnd={weekEnd}
                onSaved={handleSaved}
              />
            ))}
          </div>
        </>
      )}

      {/* ── Monthly view ── */}
      {view === 'monthly' && (
        monthlyLoading ? <p style={s.muted}>Loading…</p> : (
          <>
            <p style={s.sectionLabel}>Payroll — {monthLabel}</p>
            <AggregateCard employees={employees as any[]} agg={monthlyAgg} total={monthlyTotal} />
          </>
        )
      )}

      {/* ── Range view ── */}
      {view === 'range' && (
        rangeLoading ? <p style={s.muted}>Loading…</p> : (
          <>
            <p style={s.sectionLabel}>Payroll — {rangeLabel}</p>
            <AggregateCard employees={employees as any[]} agg={rangeAgg} total={rangeTotal} />
          </>
        )
      )}
    </div>
  )
}

// ── Aggregate card ───────────────────────────────────────────

function AggregateCard({ employees, agg, total }: {
  employees: any[]; agg: Record<string, number>; total: number
}) {
  const paid = employees.filter(e => (agg[e.id] || 0) > 0)
  if (paid.length === 0) {
    return (
      <div style={s.emptyCard}>
        <p style={s.emptyTitle}>No payroll in this period</p>
        <p style={s.emptyHint}>Switch to Weekly view to enter payroll.</p>
      </div>
    )
  }
  return (
    <div style={s.card}>
      <div style={s.tableHeader}>
        <span style={{ flex: 2 }}>Employee</span>
        <span style={{ flex: 1 }}>Role</span>
        <span style={{ flex: 1, textAlign: 'right' as const }}>Total</span>
      </div>
      {paid.map((emp: any, i: number) => (
        <div key={emp.id} style={{ ...s.row, borderBottom: i < paid.length - 1 ? '1px solid rgba(13,13,13,0.05)' : 'none', cursor: 'default' }}>
          <span style={s.empName}>{emp.first_name} {emp.last_name}</span>
          <span style={s.empRole}>{emp.job_title}</span>
          <span style={{ flex: 1, textAlign: 'right' as const, fontSize: 13, fontWeight: 600, color: '#0d0d0d' }}>
            {fmt(agg[emp.id] || 0)}
          </span>
        </div>
      ))}
      <div style={s.totalRow}>
        <span style={{ flex: 2, fontSize: 13, fontWeight: 600, color: '#0d0d0d' }}>Total Payroll</span>
        <span style={{ flex: 1 }} />
        <span style={s.totalValue}>{fmt(total)}</span>
      </div>
    </div>
  )
}

// ── Styles ───────────────────────────────────────────────────

const BORDER = '1px solid rgba(13,13,13,0.09)'

const s: Record<string, React.CSSProperties> = {
  page:    { fontFamily: "'Inter', -apple-system, sans-serif", letterSpacing: '-0.01em' },
  header:  { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, paddingBottom: 20, borderBottom: BORDER },
  title:   { fontSize: 22, fontWeight: 700, color: '#0d0d0d', margin: 0, letterSpacing: '-0.03em' },
  subtitle:{ fontSize: 12, color: 'rgba(13,13,13,0.42)', margin: '3px 0 0' },
  headerRight: { display: 'flex', alignItems: 'center', gap: 8 },

  segmented: { display: 'flex', background: 'rgba(13,13,13,0.06)', borderRadius: 9, padding: 3, gap: 2 },
  seg:       { padding: '5px 14px', border: 'none', background: 'transparent', borderRadius: 7, fontSize: 12, fontWeight: 500, color: 'rgba(13,13,13,0.42)', cursor: 'pointer', fontFamily: "'Inter', sans-serif" },
  segActive: { background: '#fff', color: '#0d0d0d', boxShadow: '0 1px 4px rgba(0,0,0,0.10)' },
  savedBadge:{ fontSize: 12, fontWeight: 500, color: '#16a34a', padding: '4px 10px', background: '#f0fdf4', borderRadius: 20, border: '1px solid #bbf7d0' },

  controls: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 },
  dateInput: { padding: '5px 10px', border: BORDER, borderRadius: 8, fontSize: 13, fontFamily: "'Inter', sans-serif", color: '#0d0d0d', background: '#fff', outline: 'none' },
  rangeSep:  { fontSize: 12, color: 'rgba(13,13,13,0.35)' },
  weekNote:  { fontSize: 11, color: 'rgba(13,13,13,0.3)', fontStyle: 'italic' },

  weekBar:       { display: 'flex', alignItems: 'center', gap: 0, background: '#fff', border: BORDER, borderRadius: 12, padding: '12px 20px', marginBottom: 16, width: 'fit-content' },
  weekBarStat:   { display: 'flex', flexDirection: 'column' as const, gap: 2, padding: '0 16px' },
  weekBarLabel:  { fontSize: 10, fontWeight: 600, color: 'rgba(13,13,13,0.38)', letterSpacing: '0.06em', textTransform: 'uppercase' as const },
  weekBarValue:  { fontSize: 18, fontWeight: 700, color: '#0d0d0d', letterSpacing: '-0.03em' },
  weekBarDivider:{ width: 1, height: 32, background: 'rgba(13,13,13,0.08)' },

  muted:        { color: 'rgba(13,13,13,0.42)', fontSize: 14 },
  sectionLabel: { fontSize: 10, fontWeight: 600, color: 'rgba(13,13,13,0.35)', letterSpacing: '0.08em', textTransform: 'uppercase' as const, margin: '0 0 8px' },

  card:        { background: '#fff', borderRadius: 14, border: BORDER, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', marginBottom: 12 },
  tableHeader: { display: 'flex', alignItems: 'center', padding: '10px 20px', background: '#f7f7f5', borderBottom: BORDER, fontSize: 10, fontWeight: 600, color: 'rgba(13,13,13,0.4)', letterSpacing: '0.08em', textTransform: 'uppercase' as const },

  // Row
  row:      { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', transition: 'background 0.1s' },
  rowLeft:  { display: 'flex', flexDirection: 'column' as const, gap: 2 },
  rowRight: { display: 'flex', alignItems: 'center', gap: 12 },
  empName:  { fontSize: 13, fontWeight: 500, color: '#0d0d0d', letterSpacing: '-0.01em' },
  empRole:  { fontSize: 11, color: 'rgba(13,13,13,0.4)' },

  hoursBadge:    { display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 500, color: '#5581B1', background: 'rgba(85,129,177,0.08)', borderRadius: 5, padding: '2px 7px' },
  amountSummary: { fontSize: 13, fontWeight: 600, color: '#0d0d0d', display: 'flex', flexDirection: 'column' as const, alignItems: 'flex-end', gap: 2 },
  splitHint:     { fontSize: 10, color: 'rgba(13,13,13,0.4)', fontWeight: 400 },
  amountEmpty:   { fontSize: 13, color: 'rgba(13,13,13,0.2)' },

  paidBadge:   { display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: '#16a34a', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 20, padding: '3px 9px' },
  pendingBadge:{ fontSize: 11, fontWeight: 500, color: 'rgba(13,13,13,0.38)', background: 'rgba(13,13,13,0.05)', borderRadius: 20, padding: '3px 9px' },
  undoBtn:     { background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(13,13,13,0.3)', display: 'flex', alignItems: 'center', padding: 3, borderRadius: 5 },
  chevron:     { display: 'flex', alignItems: 'center' },

  // Expand panel
  expandPanel: { padding: '14px 20px 18px', background: 'rgba(13,13,13,0.015)', borderTop: '1px solid rgba(13,13,13,0.05)', display: 'flex', flexDirection: 'column' as const, gap: 12 },
  suggestRow:  { display: 'flex', alignItems: 'center', gap: 8 },
  suggestLabel:{ fontSize: 11, color: 'rgba(13,13,13,0.45)' },
  suggestPill: { fontSize: 11, fontWeight: 500, color: '#5581B1', background: 'rgba(85,129,177,0.09)', border: '1px solid rgba(85,129,177,0.25)', borderRadius: 6, padding: '3px 10px', cursor: 'pointer', fontFamily: "'Inter', sans-serif" },

  inputGrid:  { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 },
  inputGroup: { display: 'flex', flexDirection: 'column' as const, gap: 5 },
  label:      { fontSize: 10, fontWeight: 600, color: 'rgba(13,13,13,0.45)', letterSpacing: '0.05em', textTransform: 'uppercase' as const },
  moneyCell:  { display: 'flex', alignItems: 'center', border: BORDER, borderRadius: 8, overflow: 'hidden', background: '#fafaf9' },
  moneySym:   { padding: '6px 8px', color: 'rgba(13,13,13,0.4)', fontSize: 12, borderRight: '1px solid rgba(13,13,13,0.07)' },
  moneyInput: { flex: 1, border: 'none', padding: '6px 8px', fontSize: 13, color: '#0d0d0d', outline: 'none', background: 'transparent', fontFamily: "'Inter', sans-serif", width: '100%' },
  notesInput: { border: BORDER, borderRadius: 8, padding: '6px 10px', fontSize: 12, outline: 'none', fontFamily: "'Inter', sans-serif", color: '#0d0d0d', background: '#fafaf9' },

  errorText: { fontSize: 11, color: '#DF5198' },
  actions:   { display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 },
  saveBtn:   { padding: '6px 16px', border: BORDER, borderRadius: 8, fontSize: 13, fontWeight: 500, color: '#0d0d0d', background: '#fff', cursor: 'pointer', fontFamily: "'Inter', sans-serif" },
  markPaidBtn: { display: 'flex', alignItems: 'center', gap: 5, padding: '6px 16px', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#fff', background: '#212121', cursor: 'pointer', fontFamily: "'Inter', sans-serif" },
  deleteBtn:   { background: 'none', border: 'none', color: 'rgba(13,13,13,0.25)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 4, borderRadius: 6, marginLeft: 'auto' },

  totalRow:   { display: 'flex', alignItems: 'center', padding: '13px 20px', background: '#f7f7f5', borderTop: BORDER },
  totalValue: { flex: 1, textAlign: 'right' as const, fontWeight: 700, fontSize: 16, color: '#0d0d0d', letterSpacing: '-0.03em' },

  emptyCard:  { background: '#fff', border: BORDER, borderRadius: 14, padding: '48px 40px', textAlign: 'center' as const, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' },
  emptyTitle: { color: '#0d0d0d', fontSize: 14, fontWeight: 600, margin: '0 0 6px', letterSpacing: '-0.02em' },
  emptyHint:  { color: 'rgba(13,13,13,0.42)', fontSize: 12, margin: 0 },
}

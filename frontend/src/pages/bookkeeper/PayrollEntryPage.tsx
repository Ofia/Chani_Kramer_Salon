import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { Trash2, Clock } from 'lucide-react'

// ── Date helpers ─────────────────────────────────────────────

/** Return the most recent Wednesday on or before `d` as YYYY-MM-DD. */
function getWednesday(d = new Date()): string {
  const day  = d.getDay()                         // 0=Sun … 6=Sat
  const diff = day >= 3 ? day - 3 : day + 4      // days since last Wed
  const wed  = new Date(d)
  wed.setDate(d.getDate() - diff)
  return wed.toISOString().split('T')[0]
}

/** Return Tuesday 6 days after a Wednesday. */
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
function todayStr() {
  return new Date().toISOString().split('T')[0]
}
function fmtDate(str: string) {
  return new Date(str + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
function fmt(n: number | string) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(n))
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const YEARS  = [2023, 2024, 2025, 2026]

// ── Types ────────────────────────────────────────────────────

interface HoursSummary {
  employee_id: string
  employee_name: string
  pay_type: string
  hourly_rate: number | null
  total_hours: number
  suggested_pay: number | null
}

// ── Component ────────────────────────────────────────────────

export default function PayrollEntryPage() {
  const now = new Date()
  const [view, setView] = useState<'weekly' | 'monthly' | 'range'>('weekly')

  // Weekly
  const [weekStart, setWeekStart] = useState(getWednesday())
  const [amounts,   setAmounts]   = useState<Record<string, string>>({})
  const [isEditing, setIsEditing] = useState(false)
  const [saved,     setSaved]     = useState(false)

  // Monthly
  const [selYear,  setSelYear]  = useState(now.getFullYear())
  const [selMonth, setSelMonth] = useState(now.getMonth() + 1)

  // Range
  const [rangeStart, setRangeStart] = useState(firstOfMonth(now.getFullYear(), now.getMonth() + 1))
  const [rangeEnd,   setRangeEnd]   = useState(todayStr())

  const qc      = useQueryClient()
  const weekEnd = getTuesday(weekStart)

  // ── Queries ──────────────────────────────────────────────────

  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: () => api.get('/employees/?active_only=true').then(r => Array.isArray(r.data) ? r.data : []).catch(() => []),
  })

  const { data: existingData } = useQuery({
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

  // Sync existing payroll amounts into local state when week changes
  useEffect(() => {
    if (existingData === undefined) return
    const map: Record<string, string> = {}
    ;(existingData as any[]).forEach((e: any) => {
      map[e.employee_id] = Number(e.amount).toFixed(2)
    })
    setAmounts(map)
    setIsEditing(false)
  }, [existingData])

  // ── Hours lookup by employee_id ───────────────────────────────

  const hoursMap: Record<string, HoursSummary> = {}
  ;(hoursSummary as HoursSummary[]).forEach(h => { hoursMap[h.employee_id] = h })

  // ── Save mutation ─────────────────────────────────────────────

  const mutation = useMutation({
    mutationFn: async () => {
      const promises = (employees as any[])
        .filter((emp: any) => amounts[emp.id] && parseFloat(amounts[emp.id]) > 0)
        .map((emp: any) => {
          const existingEntry = (existingData as any[] ?? []).find((e: any) => e.employee_id === emp.id)
          if (existingEntry) {
            return api.patch(`/payroll/${existingEntry.id}`, { amount: parseFloat(amounts[emp.id]) })
          }
          return api.post('/payroll', {
            week_start: weekStart, week_end: weekEnd,
            employee_id: emp.id, amount: parseFloat(amounts[emp.id]),
            pay_type_snapshot: emp.pay_type,
          })
        })
      return Promise.all(promises)
    },
    onSuccess: () => {
      setSaved(true)
      setIsEditing(false)
      qc.invalidateQueries({ queryKey: ['payroll-weekly'] })
      setTimeout(() => setSaved(false), 2500)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/payroll/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['payroll-weekly'] }),
  })

  function handleDeleteEntry(emp: any) {
    const existingEntry = (existingData as any[] ?? []).find((e: any) => e.employee_id === emp.id)
    if (!existingEntry) return
    deleteMutation.mutate(existingEntry.id)
    setAmounts(prev => { const next = { ...prev }; delete next[emp.id]; return next })
  }

  function handleCancel() {
    const map: Record<string, string> = {}
    ;(existingData as any[] ?? []).forEach((e: any) => { map[e.employee_id] = Number(e.amount).toFixed(2) })
    setAmounts(map)
    setIsEditing(false)
  }

  function acceptSuggested(empId: string, suggested: number) {
    setAmounts(prev => ({ ...prev, [empId]: suggested.toFixed(2) }))
  }

  function aggregateByEmployee(rows: any[]): Record<string, number> {
    const agg: Record<string, number> = {}
    rows.forEach((r: any) => { agg[r.employee_id] = (agg[r.employee_id] || 0) + Number(r.amount) })
    return agg
  }

  const weeklyTotal  = Object.values(amounts).reduce((s, v) => s + (parseFloat(v) || 0), 0)
  const monthlyAgg   = aggregateByEmployee(monthlyData as any[])
  const rangeAgg     = aggregateByEmployee(rangeData as any[])
  const monthlyTotal = Object.values(monthlyAgg).reduce((s, v) => s + v, 0)
  const rangeTotal   = Object.values(rangeAgg).reduce((s, v) => s + v, 0)

  const weekLabel  = `${fmtDate(weekStart)} — ${fmtDate(weekEnd)}`
  const monthLabel = new Date(selYear, selMonth - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const rangeLabel = rangeStart && rangeEnd ? `${fmtDate(rangeStart)} — ${fmtDate(rangeEnd)}` : ''
  const subtitle   = view === 'weekly' ? weekLabel : view === 'monthly' ? monthLabel : rangeLabel

  const hasHours = hoursSummary.length > 0

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
          {view === 'weekly' && !isEditing && (
            <button onClick={() => setIsEditing(true)} style={s.editBtn}>Edit</button>
          )}
          {view === 'weekly' && isEditing && (
            <>
              <button onClick={() => mutation.mutate()} disabled={mutation.isPending} style={s.saveBtn}>
                {mutation.isPending ? 'Saving…' : 'Save'}
              </button>
              <button onClick={handleCancel} style={s.cancelBtn}>Cancel</button>
            </>
          )}
          {saved && <span style={s.savedBadge}>Saved</span>}
        </div>
      </header>

      {/* ── Date controls ── */}
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
          <p style={s.sectionLabel}>Payroll — {weekLabel}</p>
          <div style={s.card}>
            <div style={s.tableHeader}>
              <span style={{ flex: 2 }}>Employee</span>
              <span style={{ flex: 1 }}>Role</span>
              {hasHours && <span style={{ width: 80, textAlign: 'center' as const }}>Hours</span>}
              <span style={{ flex: 1, textAlign: 'right' as const }}>Amount</span>
            </div>

            {(employees as any[]).map((emp: any, i: number) => {
              const hrs = hoursMap[emp.id]
              return (
                <div key={emp.id} style={{ ...s.row, borderBottom: i < (employees as any[]).length - 1 ? '1px solid rgba(13,13,13,0.05)' : 'none' }}>
                  <span style={s.empName}>{emp.first_name} {emp.last_name}</span>
                  <span style={s.empRole}>{emp.job_title}</span>

                  {/* Hours cell */}
                  {hasHours && (
                    <div style={s.hoursCell}>
                      {hrs ? (
                        <span style={s.hoursVal}>
                          <Clock size={10} color="#5581B1" />
                          {hrs.total_hours}h
                        </span>
                      ) : (
                        <span style={s.hoursEmpty}>—</span>
                      )}
                    </div>
                  )}

                  {/* Amount cell */}
                  {isEditing ? (
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                      {/* Suggest button for hourly employees */}
                      {hrs?.suggested_pay != null && (
                        <button
                          onClick={() => acceptSuggested(emp.id, hrs.suggested_pay!)}
                          style={s.suggestBtn}
                          title={`Auto-fill ${fmt(hrs.suggested_pay)} (${hrs.total_hours}h × $${hrs.hourly_rate}/h)`}
                        >
                          {fmt(hrs.suggested_pay)}
                        </button>
                      )}
                      <div style={s.moneyCell}>
                        <span style={s.moneySym}>$</span>
                        <input
                          type="number" min="0" step="0.01"
                          value={amounts[emp.id] || ''}
                          onChange={e => setAmounts(prev => ({ ...prev, [emp.id]: e.target.value }))}
                          style={s.moneyInput} placeholder="0.00"
                        />
                      </div>
                      {(existingData as any[] ?? []).find((e: any) => e.employee_id === emp.id) && (
                        <button
                          onClick={() => handleDeleteEntry(emp)}
                          disabled={deleteMutation.isPending}
                          style={s.deleteBtn}
                          title="Delete entry"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  ) : (
                    <span style={s.amountView}>
                      {amounts[emp.id] && parseFloat(amounts[emp.id]) > 0
                        ? fmt(amounts[emp.id])
                        : <span style={s.amountEmpty}>—</span>
                      }
                    </span>
                  )}
                </div>
              )
            })}

            <div style={s.totalRow}>
              <span style={{ flex: 2, fontSize: 13, fontWeight: 600, color: '#0d0d0d' }}>Total Payroll</span>
              <span style={{ flex: 1 }} />
              {hasHours && <span style={{ width: 80 }} />}
              <span style={s.totalValue}>{fmt(weeklyTotal)}</span>
            </div>
          </div>
          {isEditing && <p style={s.editHint}>Leave blank to skip an employee. Click a suggested amount to auto-fill hourly pay.</p>}
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

// ── Aggregate card (Monthly + Range) ────────────────────────

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
        <div key={emp.id} style={{ ...s.row, borderBottom: i < paid.length - 1 ? '1px solid rgba(13,13,13,0.05)' : 'none' }}>
          <span style={s.empName}>{emp.first_name} {emp.last_name}</span>
          <span style={s.empRole}>{emp.job_title}</span>
          <span style={s.amountView}>{fmt(agg[emp.id] || 0)}</span>
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

const s: Record<string, React.CSSProperties> = {
  page: { fontFamily: "'Inter', -apple-system, sans-serif", letterSpacing: '-0.01em' },

  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    marginBottom: 16, paddingBottom: 20, borderBottom: '1px solid rgba(13,13,13,0.09)',
  },
  title:    { fontSize: 22, fontWeight: 700, color: '#0d0d0d', margin: 0, letterSpacing: '-0.03em' },
  subtitle: { fontSize: 12, color: 'rgba(13,13,13,0.42)', margin: '3px 0 0' },

  headerRight: { display: 'flex', alignItems: 'center', gap: 8 },

  segmented: { display: 'flex', background: 'rgba(13,13,13,0.06)', borderRadius: 9, padding: 3, gap: 2 },
  seg:       { padding: '5px 14px', border: 'none', background: 'transparent', borderRadius: 7, fontSize: 12, fontWeight: 500, color: 'rgba(13,13,13,0.42)', cursor: 'pointer', transition: 'all 0.15s', fontFamily: "'Inter', sans-serif" },
  segActive: { background: '#fff', color: '#0d0d0d', boxShadow: '0 1px 4px rgba(0,0,0,0.10)' },

  editBtn:   { padding: '6px 18px', border: '1px solid rgba(13,13,13,0.12)', borderRadius: 8, fontSize: 13, fontWeight: 500, color: '#0d0d0d', background: '#fff', cursor: 'pointer', fontFamily: "'Inter', sans-serif" },
  saveBtn:   { padding: '6px 18px', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#fff', background: '#212121', cursor: 'pointer', fontFamily: "'Inter', sans-serif" },
  cancelBtn: { padding: '6px 14px', border: '1px solid rgba(13,13,13,0.12)', borderRadius: 8, fontSize: 13, color: 'rgba(13,13,13,0.55)', background: '#fff', cursor: 'pointer', fontFamily: "'Inter', sans-serif" },
  savedBadge:{ fontSize: 12, fontWeight: 500, color: '#16a34a', padding: '4px 10px', background: '#f0fdf4', borderRadius: 20, border: '1px solid #bbf7d0' },

  controls: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 },
  dateInput: { padding: '5px 10px', border: '1px solid rgba(13,13,13,0.12)', borderRadius: 8, fontSize: 13, fontFamily: "'Inter', sans-serif", color: '#0d0d0d', background: '#fff', outline: 'none' },
  rangeSep:  { fontSize: 12, color: 'rgba(13,13,13,0.35)' },
  weekNote:  { fontSize: 11, color: 'rgba(13,13,13,0.3)', fontStyle: 'italic' },

  muted:        { color: 'rgba(13,13,13,0.42)', fontSize: 14 },
  sectionLabel: { fontSize: 10, fontWeight: 600, color: 'rgba(13,13,13,0.35)', letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 8px' },

  card:        { background: '#fff', borderRadius: 14, border: '1px solid rgba(13,13,13,0.09)', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', marginBottom: 12 },
  tableHeader: { display: 'flex', alignItems: 'center', padding: '10px 20px', background: '#f7f7f5', borderBottom: '1px solid rgba(13,13,13,0.07)', fontSize: 10, fontWeight: 600, color: 'rgba(13,13,13,0.4)', letterSpacing: '0.08em', textTransform: 'uppercase' },

  row:     { display: 'flex', alignItems: 'center', padding: '11px 20px' },
  empName: { flex: 2, fontSize: 13, fontWeight: 500, color: '#0d0d0d', letterSpacing: '-0.01em' },
  empRole: { flex: 1, fontSize: 12, color: 'rgba(13,13,13,0.45)' },

  hoursCell:  { width: 80, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  hoursVal:   { display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 500, color: '#5581B1' },
  hoursEmpty: { fontSize: 12, color: 'rgba(13,13,13,0.18)' },

  amountView:  { flex: 1, textAlign: 'right', fontSize: 13, fontWeight: 600, color: '#0d0d0d', letterSpacing: '-0.01em' },
  amountEmpty: { fontSize: 13, color: 'rgba(13,13,13,0.2)', fontWeight: 400 },

  suggestBtn: { fontSize: 11, fontWeight: 500, color: '#5581B1', background: 'rgba(85,129,177,0.09)', border: '1px solid rgba(85,129,177,0.25)', borderRadius: 6, padding: '3px 8px', cursor: 'pointer', whiteSpace: 'nowrap' as const, fontFamily: "'Inter', sans-serif" },
  moneyCell:  { display: 'flex', alignItems: 'center', justifyContent: 'flex-end', border: '1px solid rgba(13,13,13,0.12)', borderRadius: 8, overflow: 'hidden', width: 120, background: '#fafaf9' },
  deleteBtn:  { background: 'none', border: 'none', color: 'rgba(13,13,13,0.25)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 4, borderRadius: 6, flexShrink: 0 },
  moneySym:   { padding: '5px 8px', color: 'rgba(13,13,13,0.4)', fontSize: 12, borderRight: '1px solid rgba(13,13,13,0.07)' },
  moneyInput: { flex: 1, border: 'none', padding: '5px 8px', fontSize: 13, color: '#0d0d0d', outline: 'none', background: 'transparent', fontFamily: "'Inter', sans-serif", width: 70 },

  totalRow:   { display: 'flex', alignItems: 'center', padding: '13px 20px', background: '#f7f7f5', borderTop: '1px solid rgba(13,13,13,0.07)' },
  totalValue: { flex: 1, textAlign: 'right', fontWeight: 700, fontSize: 16, color: '#0d0d0d', letterSpacing: '-0.03em' },

  editHint: { fontSize: 11, color: 'rgba(13,13,13,0.38)', margin: '4px 0 0', fontStyle: 'italic' },

  emptyCard:  { background: '#fff', border: '1px solid rgba(13,13,13,0.09)', borderRadius: 14, padding: '48px 40px', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' },
  emptyTitle: { color: '#0d0d0d', fontSize: 14, fontWeight: 600, margin: '0 0 6px', letterSpacing: '-0.02em' },
  emptyHint:  { color: 'rgba(13,13,13,0.42)', fontSize: 12, margin: 0 },
}

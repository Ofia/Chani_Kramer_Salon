import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { Pencil, Plus, X } from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────

type DaySummary = {
  id: string
  summary_date: string
  cash_collected: number
  quickpay_collected: number
  cc_collected: number
  check_collected: number
  zelle_collected: number
  wig_deposits_total: number
  is_locked: boolean
}

type PaymentsForm = {
  cash: string
  quickpay: string
  cc: string
  check: string
  zelle: string
  wig_deposits: string
}

const EMPTY_FORM: PaymentsForm = {
  cash: '', quickpay: '', cc: '', check: '', zelle: '', wig_deposits: '',
}

// ── Date helpers ─────────────────────────────────────────────

function todayStr() { return new Date().toISOString().split('T')[0] }
function firstOfMonth(year: number, month: number) {
  return new Date(year, month - 1, 1).toISOString().split('T')[0]
}
function lastOfMonth(year: number, month: number) {
  return new Date(year, month, 0).toISOString().split('T')[0]
}
function fmtDateLong(str: string) {
  return new Date(str + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })
}
function fmtDateShort(str: string) {
  return new Date(str + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}
function fmt(n: number | string) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(n))
}
function summaryToForm(s: DaySummary): PaymentsForm {
  return {
    cash:         Number(s.cash_collected)     > 0 ? String(s.cash_collected)     : '',
    quickpay:     Number(s.quickpay_collected) > 0 ? String(s.quickpay_collected) : '',
    cc:           Number(s.cc_collected)       > 0 ? String(s.cc_collected)       : '',
    check:        Number(s.check_collected)    > 0 ? String(s.check_collected)    : '',
    zelle:        Number(s.zelle_collected)    > 0 ? String(s.zelle_collected)    : '',
    wig_deposits: Number(s.wig_deposits_total) > 0 ? String(s.wig_deposits_total) : '',
  }
}
function rowTotal(s: DaySummary) {
  return Number(s.cash_collected) + Number(s.quickpay_collected) +
    Number(s.cc_collected) + Number(s.check_collected) + Number(s.zelle_collected)
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const YEARS  = [2023, 2024, 2025, 2026]

// ── Component ────────────────────────────────────────────────

export default function DepositsPage() {
  const now = new Date()
  const [view, setView] = useState<'daily' | 'monthly' | 'range'>('daily')

  // Daily
  const [selectedDate, setSelectedDate] = useState(todayStr())
  const [showForm,      setShowForm]      = useState(false)
  const [isEditing,     setIsEditing]     = useState(false)  // true = PATCH, false = POST
  const [form, setForm] = useState<PaymentsForm>(EMPTY_FORM)

  // Monthly
  const [selYear,  setSelYear]  = useState(now.getFullYear())
  const [selMonth, setSelMonth] = useState(now.getMonth() + 1)

  // Range
  const [rangeStart, setRangeStart] = useState(firstOfMonth(now.getFullYear(), now.getMonth() + 1))
  const [rangeEnd,   setRangeEnd]   = useState(todayStr())

  const qc = useQueryClient()

  // ── Queries — all source from daily_summary ──────────────────

  const { data: dayData, isLoading: dailyLoading } = useQuery<DaySummary | null>({
    queryKey: ['daily-summary', selectedDate],
    queryFn: () =>
      api.get(`/daily-summary/${selectedDate}`).then(r => r.data).catch(() => null),
    enabled: view === 'daily',
    staleTime: 0,
    refetchOnMount: 'always',
  })

  const { data: monthlyRows = [], isLoading: monthlyLoading } = useQuery<DaySummary[]>({
    queryKey: ['daily-summary-range', firstOfMonth(selYear, selMonth), lastOfMonth(selYear, selMonth)],
    queryFn: () =>
      api.get(`/daily-summary/?start_date=${firstOfMonth(selYear, selMonth)}&end_date=${lastOfMonth(selYear, selMonth)}`)
        .then(r => Array.isArray(r.data) ? r.data : []).catch(() => []),
    enabled: view === 'monthly',
    staleTime: 0,
    refetchOnMount: 'always',
  })

  const { data: rangeRows = [], isLoading: rangeLoading } = useQuery<DaySummary[]>({
    queryKey: ['daily-summary-range', rangeStart, rangeEnd],
    queryFn: () =>
      api.get(`/daily-summary/?start_date=${rangeStart}&end_date=${rangeEnd}`)
        .then(r => Array.isArray(r.data) ? r.data : []).catch(() => []),
    enabled: view === 'range' && !!rangeStart && !!rangeEnd,
    staleTime: 0,
    refetchOnMount: 'always',
  })

  // ── Mutations ────────────────────────────────────────────────

  type SaveVars =
    | { mode: 'patch'; summaryDate: string; fields: object }
    | { mode: 'post';  summaryDate: string; fields: object }

  const saveMutation = useMutation({
    mutationFn: (vars: SaveVars) =>
      vars.mode === 'patch'
        ? api.patch(`/daily-summary/${vars.summaryDate}`, vars.fields)
        : api.post('/daily-summary/', vars.fields),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['daily-summary'] })
      qc.invalidateQueries({ queryKey: ['daily-summary-range'] })
      closeForm()
    },
  })

  // ── Form helpers ─────────────────────────────────────────────

  function openEdit(record: DaySummary) {
    setIsEditing(true)
    setForm(summaryToForm(record))
    setShowForm(true)
  }

  function openAdd() {
    setIsEditing(false)
    setForm(EMPTY_FORM)
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setIsEditing(false)
    setForm(EMPTY_FORM)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const paymentFields = {
      cash_collected:      parseFloat(form.cash)         || 0,
      quickpay_collected:  parseFloat(form.quickpay)     || 0,
      cc_collected:        parseFloat(form.cc)           || 0,
      check_collected:     parseFloat(form.check)        || 0,
      zelle_collected:     parseFloat(form.zelle)        || 0,
      wig_deposits_total:  parseFloat(form.wig_deposits) || 0,
    }

    if (isEditing) {
      // Day already exists — PATCH just the payment fields
      saveMutation.mutate({ mode: 'patch', summaryDate: selectedDate, fields: paymentFields })
    } else {
      // No daily summary yet — POST a new one (all non-payment fields default to 0)
      saveMutation.mutate({
        mode: 'post',
        summaryDate: selectedDate,
        fields: { summary_date: selectedDate, ...paymentFields },
      })
    }
  }

  // ── Derived values ───────────────────────────────────────────

  const existingForDate = dayData ?? null
  const isToday = selectedDate === todayStr()

  const activeRows: DaySummary[] = view === 'daily'
    ? (existingForDate ? [existingForDate] : [])
    : view === 'monthly' ? monthlyRows
    : rangeRows

  const isLoading = view === 'daily' ? dailyLoading
    : view === 'monthly' ? monthlyLoading
    : rangeLoading

  const grandTotal = activeRows.reduce((s, r) => s + rowTotal(r), 0)

  const monthLabel = new Date(selYear, selMonth - 1, 1)
    .toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const rangeLabel = rangeStart && rangeEnd
    ? `${fmtDateShort(rangeStart)} — ${fmtDateShort(rangeEnd)}` : ''
  const subtitle = view === 'daily' ? fmtDateLong(selectedDate)
    : view === 'monthly' ? monthLabel : rangeLabel

  // Live total inside form
  const formTotal = (parseFloat(form.cash) || 0) + (parseFloat(form.quickpay) || 0) +
    (parseFloat(form.cc) || 0) + (parseFloat(form.check) || 0) + (parseFloat(form.zelle) || 0)

  return (
    <div style={s.page}>

      {/* ── Header ── */}
      <header style={s.header}>
        <div>
          <h1 style={s.title}>Deposits</h1>
          <p style={s.subtitle}>{subtitle}</p>
        </div>
        <div style={s.headerRight}>

          <div style={s.segmented}>
            <button onClick={() => { setView('daily');   closeForm() }} style={{ ...s.seg, ...(view === 'daily'   ? s.segActive : {}) }}>Daily</button>
            <button onClick={() => { setView('monthly'); closeForm() }} style={{ ...s.seg, ...(view === 'monthly' ? s.segActive : {}) }}>Monthly</button>
            <button onClick={() => { setView('range');   closeForm() }} style={{ ...s.seg, ...(view === 'range'   ? s.segActive : {}) }}>Range</button>
          </div>

          {view === 'daily' && !showForm && !existingForDate && (
            <button onClick={openAdd} style={s.addBtn}>
              <Plus size={13} style={{ marginRight: 4 }} />Add
            </button>
          )}
          {view === 'daily' && !showForm && existingForDate && !existingForDate.is_locked && (
            <button onClick={() => openEdit(existingForDate)} style={s.editBtn}>
              <Pencil size={13} style={{ marginRight: 4 }} />Edit
            </button>
          )}
          {view === 'daily' && showForm && (
            <button onClick={closeForm} style={s.cancelFormBtn}>
              <X size={13} style={{ marginRight: 4 }} />Cancel
            </button>
          )}
        </div>
      </header>

      {/* ── Date controls ── */}
      {view === 'daily' && (
        <div style={s.controls}>
          <input
            type="date" value={selectedDate}
            onChange={e => { setSelectedDate(e.target.value); closeForm() }}
            style={s.dateInput}
          />
          {!isToday && (
            <button onClick={() => { setSelectedDate(todayStr()); closeForm() }} style={s.todayBtn}>
              Today
            </button>
          )}
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

      {/* ── Add / Edit form (daily only) ── */}
      {view === 'daily' && showForm && (
        <div style={s.formCard}>
          <p style={s.formTitle}>
            {isEditing ? `Edit Payments — ${fmtDateLong(selectedDate)}` : `New Entry — ${fmtDateLong(selectedDate)}`}
          </p>
          <form onSubmit={handleSubmit}>
            <div style={s.formGrid}>
              <MoneyField label="Cash"        value={form.cash}         onChange={v => setForm(p => ({ ...p, cash: v }))} />
              <MoneyField label="QuickPay"    value={form.quickpay}     onChange={v => setForm(p => ({ ...p, quickpay: v }))} />
              <MoneyField label="Credit Card" value={form.cc}           onChange={v => setForm(p => ({ ...p, cc: v }))} />
              <MoneyField label="Check"       value={form.check}        onChange={v => setForm(p => ({ ...p, check: v }))} />
              <MoneyField label="Zelle"       value={form.zelle}        onChange={v => setForm(p => ({ ...p, zelle: v }))} />
              <MoneyField label="Wig Deposits (not revenue)" value={form.wig_deposits} onChange={v => setForm(p => ({ ...p, wig_deposits: v }))} />
            </div>

            {formTotal > 0 && (
              <div style={s.formTotal}>
                <span style={{ fontSize: 12, fontWeight: 500, color: 'rgba(13,13,13,0.5)' }}>Total Collected</span>
                <span style={{ fontSize: 15, fontWeight: 700, color: '#0d0d0d', letterSpacing: '-0.02em' }}>{fmt(formTotal)}</span>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button type="submit" disabled={saveMutation.isPending} style={s.submitBtn}>
                {saveMutation.isPending ? 'Saving…' : isEditing ? 'Update' : 'Save Entry'}
              </button>
              <button type="button" onClick={closeForm} style={s.cancelFormBtn}>Cancel</button>
            </div>
            {saveMutation.isError && (
              <p style={s.errorMsg}>
                {(saveMutation.error as any)?.response?.status === 423
                  ? 'This day is locked and cannot be edited.'
                  : 'Error saving. Try again.'}
              </p>
            )}
          </form>
        </div>
      )}

      {/* ── List ── */}
      <p style={s.sectionLabel}>
        {view === 'daily'   && (isToday ? "Today's Payments" : `Payments — ${fmtDateLong(selectedDate)}`)}
        {view === 'monthly' && `Payments — ${monthLabel}`}
        {view === 'range'   && `Payments — ${rangeLabel}`}
      </p>

      {isLoading ? (
        <p style={s.muted}>Loading…</p>
      ) : (
        <div style={s.card}>
          {activeRows.length === 0 ? (
            <div style={s.emptyState}>
              <p style={s.emptyTitle}>No payments recorded</p>
              <p style={s.emptyHint}>
                {view === 'daily'
                  ? 'Enter via Daily Entry → Payments tab, or use + Add above.'
                  : 'No daily entries found for this period.'}
              </p>
            </div>
          ) : (
            <>
              {/* Table header */}
              <div style={s.tableHeader}>
                {view !== 'daily' && <span style={s.colDate}>Date</span>}
                <span style={s.colAmt}>Cash</span>
                <span style={s.colAmt}>QP</span>
                <span style={s.colAmt}>CC</span>
                <span style={s.colAmt}>Check</span>
                <span style={s.colAmt}>Zelle</span>
                <span style={{ ...s.colAmt, color: '#5581B1' }}>Wig Dep.</span>
                <span style={s.colTotal}>Total</span>
                {view === 'daily' && <span style={{ width: 28 }} />}
              </div>

              {activeRows.map((row, i) => {
                const total = rowTotal(row)
                return (
                  <div
                    key={row.id}
                    style={{ ...s.row, borderBottom: i < activeRows.length - 1 ? '1px solid rgba(13,13,13,0.05)' : 'none' }}
                  >
                    {view !== 'daily' && (
                      <span style={{ ...s.colDate, color: 'rgba(13,13,13,0.5)', fontSize: 12, fontWeight: 400 }}>
                        {fmtDateShort(row.summary_date)}
                      </span>
                    )}
                    <span style={s.cell}>{Number(row.cash_collected)     > 0 ? fmt(row.cash_collected)     : <Dash />}</span>
                    <span style={s.cell}>{Number(row.quickpay_collected) > 0 ? fmt(row.quickpay_collected) : <Dash />}</span>
                    <span style={s.cell}>{Number(row.cc_collected)       > 0 ? fmt(row.cc_collected)       : <Dash />}</span>
                    <span style={s.cell}>{Number(row.check_collected)    > 0 ? fmt(row.check_collected)    : <Dash />}</span>
                    <span style={s.cell}>{Number(row.zelle_collected)    > 0 ? fmt(row.zelle_collected)    : <Dash />}</span>
                    <span style={{ ...s.cell, color: '#5581B1' }}>
                      {Number(row.wig_deposits_total) > 0 ? fmt(row.wig_deposits_total) : <Dash />}
                    </span>
                    <span style={s.colTotal}>{fmt(total)}</span>
                    {view === 'daily' && !row.is_locked && (
                      <button onClick={() => openEdit(row)} style={s.editRowBtn} title="Edit">
                        <Pencil size={13} />
                      </button>
                    )}
                    {view === 'daily' && row.is_locked && (
                      <span style={s.lockedDot} title="Locked" />
                    )}
                  </div>
                )
              })}

              <div style={s.totalRow}>
                <span style={s.totalLabel}>
                  {activeRows.length > 1 ? `Total (${activeRows.length} days)` : 'Total Collected'}
                </span>
                <span style={s.totalValue}>{fmt(grandTotal)}</span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ── Sub-components ───────────────────────────────────────────

function MoneyField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div style={s.field}>
      <label style={s.fieldLabel}>{label}</label>
      <div style={s.moneyRow}>
        <span style={s.moneySym}>$</span>
        <input
          type="number" min="0" step="0.01" value={value}
          onChange={e => onChange(e.target.value)}
          style={s.moneyInput} placeholder="0.00"
        />
      </div>
    </div>
  )
}

function Dash() {
  return <span style={{ color: 'rgba(13,13,13,0.2)', fontWeight: 400 }}>—</span>
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

  addBtn:        { display: 'flex', alignItems: 'center', padding: '6px 14px', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#fff', background: '#212121', cursor: 'pointer', fontFamily: "'Inter', sans-serif" },
  editBtn:       { display: 'flex', alignItems: 'center', padding: '6px 14px', border: '1px solid rgba(13,13,13,0.12)', borderRadius: 8, fontSize: 13, fontWeight: 500, color: '#0d0d0d', background: '#fff', cursor: 'pointer', fontFamily: "'Inter', sans-serif" },
  cancelFormBtn: { display: 'flex', alignItems: 'center', padding: '6px 14px', border: '1px solid rgba(13,13,13,0.12)', borderRadius: 8, fontSize: 13, color: 'rgba(13,13,13,0.55)', background: '#fff', cursor: 'pointer', fontFamily: "'Inter', sans-serif" },

  controls:  { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 },
  dateInput: { padding: '5px 10px', border: '1px solid rgba(13,13,13,0.12)', borderRadius: 8, fontSize: 13, fontFamily: "'Inter', sans-serif", color: '#0d0d0d', background: '#fff', outline: 'none' },
  todayBtn:  { padding: '5px 12px', border: '1px solid rgba(13,13,13,0.12)', borderRadius: 8, fontSize: 12, fontWeight: 500, color: 'rgba(13,13,13,0.55)', background: '#fff', cursor: 'pointer', fontFamily: "'Inter', sans-serif" },
  rangeSep:  { fontSize: 12, color: 'rgba(13,13,13,0.35)' },

  formCard:  { background: '#fff', borderRadius: 14, padding: '20px 22px', marginBottom: 18, border: '1px solid rgba(13,13,13,0.09)', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' },
  formTitle: { fontSize: 13, fontWeight: 600, color: '#0d0d0d', margin: '0 0 14px', letterSpacing: '-0.01em' },
  formGrid:  { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 },
  formTotal: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f7f7f5', borderRadius: 10, padding: '10px 14px', marginBottom: 4 },

  field:     { display: 'flex', flexDirection: 'column', gap: 5 },
  fieldLabel:{ fontSize: 10, fontWeight: 600, color: 'rgba(13,13,13,0.4)', letterSpacing: '0.06em', textTransform: 'uppercase' },
  moneyRow:  { display: 'flex', alignItems: 'center', border: '1px solid rgba(13,13,13,0.12)', borderRadius: 8, overflow: 'hidden', background: '#fafaf9' },
  moneySym:  { padding: '7px 8px', color: 'rgba(13,13,13,0.4)', fontSize: 12, borderRight: '1px solid rgba(13,13,13,0.08)' },
  moneyInput:{ flex: 1, border: 'none', padding: '7px 8px', fontSize: 13, color: '#0d0d0d', outline: 'none', background: 'transparent', fontFamily: "'Inter', sans-serif" },
  submitBtn: { padding: '7px 18px', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#fff', background: '#212121', cursor: 'pointer', fontFamily: "'Inter', sans-serif" },
  errorMsg:  { color: '#dc2626', fontSize: 12, margin: '8px 0 0' },

  muted:        { color: 'rgba(13,13,13,0.42)', fontSize: 14 },
  sectionLabel: { fontSize: 10, fontWeight: 600, color: 'rgba(13,13,13,0.35)', letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 8px' },

  card:       { background: '#fff', borderRadius: 14, border: '1px solid rgba(13,13,13,0.09)', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' },
  emptyState: { padding: '48px 40px', textAlign: 'center' },
  emptyTitle: { color: '#0d0d0d', fontSize: 14, fontWeight: 600, margin: '0 0 6px', letterSpacing: '-0.02em' },
  emptyHint:  { color: 'rgba(13,13,13,0.42)', fontSize: 12, margin: 0 },

  tableHeader: {
    display: 'flex', alignItems: 'center', padding: '10px 20px',
    background: '#f7f7f5', borderBottom: '1px solid rgba(13,13,13,0.07)',
    fontSize: 10, fontWeight: 600, color: 'rgba(13,13,13,0.4)', letterSpacing: '0.07em', textTransform: 'uppercase',
  },

  row:     { display: 'flex', alignItems: 'center', padding: '12px 20px' },
  colDate: { flex: '0 0 120px', fontSize: 10, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase' },
  colAmt:  { flex: 1, fontSize: 10 },
  colTotal:{ flex: '0 0 90px', textAlign: 'right' as const, fontSize: 14, fontWeight: 700, color: '#0d0d0d', letterSpacing: '-0.02em' },
  cell:    { flex: 1, fontSize: 13, fontWeight: 500, color: '#0d0d0d', letterSpacing: '-0.01em' },

  editRowBtn: { background: 'none', border: 'none', color: 'rgba(13,13,13,0.25)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 4, borderRadius: 6, marginLeft: 8, flexShrink: 0 },
  lockedDot:  { width: 6, height: 6, borderRadius: '50%', background: 'rgba(13,13,13,0.2)', marginLeft: 8, flexShrink: 0 },

  totalRow:   { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '13px 20px', background: '#f7f7f5', borderTop: '1px solid rgba(13,13,13,0.07)' },
  totalLabel: { fontSize: 12, fontWeight: 600, color: 'rgba(13,13,13,0.5)', letterSpacing: '0.04em', textTransform: 'uppercase' },
  totalValue: { fontSize: 17, fontWeight: 700, color: '#0d0d0d', letterSpacing: '-0.03em' },
}

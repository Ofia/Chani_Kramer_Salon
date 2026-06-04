import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { Trash2, Plus, X } from 'lucide-react'

// ── Category labels ──────────────────────────────────────────

const CATEGORIES = [
  { value: 'rent_facilities',         label: 'Rent & Facilities' },
  { value: 'utilities',               label: 'Utilities' },
  { value: 'supplies_materials',      label: 'Supplies & Materials' },
  { value: 'cost_of_goods',           label: 'Cost of Goods' },
  { value: 'marketing_advertising',   label: 'Marketing & Advertising' },
  { value: 'transportation_shipping', label: 'Transportation & Shipping' },
  { value: 'maintenance_repairs',     label: 'Maintenance & Repairs' },
  { value: 'food_beverages',          label: 'Food & Beverages' },
  { value: 'professional_services',   label: 'Professional Services' },
  { value: 'taxes_fees',              label: 'Taxes & Fees' },
  { value: 'charitable_giving',       label: 'Charitable Giving (מעשרות)' },
  { value: 'reconciliation',          label: 'Reconciliation' },
  { value: 'other',                   label: 'Other' },
]

function catLabel(v: string) {
  return CATEGORIES.find(c => c.value === v)?.label ?? v
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
  return new Date(str + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
function fmt(n: number | string) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(n))
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const YEARS  = [2023, 2024, 2025, 2026]
const EMPTY  = { category: 'other', amount: '', vendor: '', notes: '' }

// ── Component ────────────────────────────────────────────────

export default function ExpensesPage() {
  const now = new Date()
  const [view, setView] = useState<'daily' | 'monthly' | 'range'>('daily')

  // Daily
  const [selectedDate, setSelectedDate] = useState(todayStr())
  const [showForm, setShowForm]         = useState(false)
  const [form, setForm]                 = useState(EMPTY)

  // Monthly
  const [selYear,  setSelYear]  = useState(now.getFullYear())
  const [selMonth, setSelMonth] = useState(now.getMonth() + 1)

  // Range
  const [rangeStart, setRangeStart] = useState(firstOfMonth(now.getFullYear(), now.getMonth() + 1))
  const [rangeEnd,   setRangeEnd]   = useState(todayStr())

  const qc = useQueryClient()

  // ── Queries ──────────────────────────────────────────────────

  const { data: dailyExpenses = [], isLoading: dailyLoading } = useQuery({
    queryKey: ['expenses-daily', selectedDate],
    queryFn: () => api.get(`/expenses/?start_date=${selectedDate}&end_date=${selectedDate}`).then(r => Array.isArray(r.data) ? r.data : []).catch(() => []),
    enabled: view === 'daily',
  })

  const { data: monthlyExpenses = [], isLoading: monthlyLoading } = useQuery({
    queryKey: ['expenses-monthly', selYear, selMonth],
    queryFn: () =>
      api.get(`/expenses/?start_date=${firstOfMonth(selYear, selMonth)}&end_date=${lastOfMonth(selYear, selMonth)}`)
        .then(r => Array.isArray(r.data) ? r.data : []).catch(() => []),
    enabled: view === 'monthly',
  })

  const { data: rangeExpenses = [], isLoading: rangeLoading } = useQuery({
    queryKey: ['expenses-range', rangeStart, rangeEnd],
    queryFn: () =>
      api.get(`/expenses/?start_date=${rangeStart}&end_date=${rangeEnd}`)
        .then(r => Array.isArray(r.data) ? r.data : []).catch(() => []),
    enabled: view === 'range' && !!rangeStart && !!rangeEnd,
  })

  // ── Mutations ────────────────────────────────────────────────

  const [createError, setCreateError] = useState<string | null>(null)

  const createMutation = useMutation({
    mutationFn: (data: object) => api.post('/expenses/', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses-daily'] })
      qc.invalidateQueries({ queryKey: ['operation-overview'] })
      setForm(EMPTY)
      setShowForm(false)
      setCreateError(null)
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.detail ?? err?.message ?? 'Failed to save expense'
      setCreateError(typeof msg === 'string' ? msg : JSON.stringify(msg))
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/expenses/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses-daily'] })
      qc.invalidateQueries({ queryKey: ['operation-overview'] })
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.amount) return
    createMutation.mutate({
      expense_date: selectedDate,
      category:     form.category,
      amount:       parseFloat(form.amount),
      vendor:       form.vendor || null,
      notes:        form.notes  || null,
    })
  }

  // ── Labels ───────────────────────────────────────────────────

  const isToday    = selectedDate === todayStr()
  const monthLabel = new Date(selYear, selMonth - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const rangeLabel = rangeStart && rangeEnd ? `${fmtDateShort(rangeStart)} — ${fmtDateShort(rangeEnd)}` : ''
  const subtitle   = view === 'daily' ? fmtDateLong(selectedDate) : view === 'monthly' ? monthLabel : rangeLabel

  const activeExpenses = view === 'daily' ? dailyExpenses as any[]
    : view === 'monthly' ? monthlyExpenses as any[]
    : rangeExpenses as any[]
  const total = activeExpenses.reduce((s: number, e: any) => s + Number(e.amount), 0)
  const isLoading = view === 'daily' ? dailyLoading : view === 'monthly' ? monthlyLoading : rangeLoading

  return (
    <div style={s.page}>

      {/* ── Header ── */}
      <header style={s.header}>
        <div>
          <h1 style={s.title}>Expenses</h1>
          <p style={s.subtitle}>{subtitle}</p>
        </div>
        <div style={s.headerRight}>
          {/* Segmented switcher */}
          <div style={s.segmented}>
            <button onClick={() => { setView('daily'); setShowForm(false) }}   style={{ ...s.seg, ...(view === 'daily'   ? s.segActive : {}) }}>Daily</button>
            <button onClick={() => { setView('monthly'); setShowForm(false) }} style={{ ...s.seg, ...(view === 'monthly' ? s.segActive : {}) }}>Monthly</button>
            <button onClick={() => { setView('range'); setShowForm(false) }}   style={{ ...s.seg, ...(view === 'range'   ? s.segActive : {}) }}>Range</button>
          </div>

          {/* Add — daily only */}
          {view === 'daily' && (
            <button onClick={() => setShowForm(v => !v)} style={showForm ? s.cancelFormBtn : s.addBtn}>
              {showForm
                ? <><X size={13} style={{ marginRight: 4 }} />Cancel</>
                : <><Plus size={13} style={{ marginRight: 4 }} />Add</>
              }
            </button>
          )}
        </div>
      </header>

      {/* ── Date controls ── */}
      {view === 'daily' && (
        <div style={s.controls}>
          <input type="date" value={selectedDate} onChange={e => { setSelectedDate(e.target.value); setShowForm(false) }} style={s.dateInput} />
          {!isToday && <button onClick={() => setSelectedDate(todayStr())} style={s.todayBtn}>Today</button>}
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

      {/* ── Add form (daily only) ── */}
      {view === 'daily' && showForm && (
        <div style={s.formCard}>
          <p style={s.formTitle}>New Expense — {fmtDateLong(selectedDate)}</p>
          <form onSubmit={handleSubmit}>
            <div style={s.formGrid}>
              <div style={s.field}>
                <label style={s.fieldLabel}>Category</label>
                <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} style={s.input}>
                  {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div style={s.field}>
                <label style={s.fieldLabel}>Amount</label>
                <div style={s.moneyRow}>
                  <span style={s.moneySym}>$</span>
                  <input type="number" min="0" step="0.01" value={form.amount}
                    onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
                    style={s.moneyInput} placeholder="0.00" required />
                </div>
              </div>
              <div style={s.field}>
                <label style={s.fieldLabel}>Vendor</label>
                <input value={form.vendor} onChange={e => setForm(p => ({ ...p, vendor: e.target.value }))} style={s.input} placeholder="Optional" />
              </div>
              <div style={s.field}>
                <label style={s.fieldLabel}>Notes</label>
                <input value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} style={s.input} placeholder="Optional" />
              </div>
            </div>
            {createError && <p style={s.errorMsg}>{createError}</p>}
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <button type="submit" disabled={createMutation.isPending} style={s.submitBtn}>
                {createMutation.isPending ? 'Saving…' : 'Add Expense'}
              </button>
              <button type="button" onClick={() => { setShowForm(false); setCreateError(null) }} style={s.cancelFormBtn}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* ── Expense list ── */}
      <p style={s.sectionLabel}>
        {view === 'daily'   && (isToday ? "Today's Expenses" : `Expenses — ${fmtDateLong(selectedDate)}`)}
        {view === 'monthly' && `Expenses — ${monthLabel}`}
        {view === 'range'   && `Expenses — ${rangeLabel}`}
      </p>

      {isLoading ? (
        <p style={s.muted}>Loading…</p>
      ) : (
        <div style={s.card}>
          {activeExpenses.length === 0 ? (
            <div style={s.emptyCard}>
              <p style={s.emptyTitle}>No expenses for this period</p>
              <p style={s.emptyHint}>{view === 'daily' ? 'Use + Add to log one.' : 'Try a different date range.'}</p>
            </div>
          ) : (
            <>
              {activeExpenses.map((e: any, i: number) => (
                <div key={e.id} style={{ ...s.row, borderBottom: i < activeExpenses.length - 1 ? '1px solid rgba(13,13,13,0.05)' : 'none' }}>
                  <div style={{ flex: 1 }}>
                    <p style={s.rowCat}>{catLabel(e.category)}</p>
                    {e.vendor && <p style={s.rowVendor}>{e.vendor}</p>}
                    {view !== 'daily' && e.expense_date && (
                      <p style={s.rowDate}>{fmtDateShort(e.expense_date)}</p>
                    )}
                  </div>
                  <span style={s.rowAmount}>{fmt(e.amount)}</span>
                  {view === 'daily' && (
                    <button onClick={() => deleteMutation.mutate(e.id)} style={s.deleteBtn} title="Delete">
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              ))}
              <div style={s.totalRow}>
                <span style={s.totalLabel}>Total</span>
                <span style={s.totalValue}>{fmt(total)}</span>
              </div>
            </>
          )}
        </div>
      )}
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

  addBtn: { display: 'flex', alignItems: 'center', padding: '6px 14px', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#fff', background: '#212121', cursor: 'pointer', fontFamily: "'Inter', sans-serif" },
  cancelFormBtn: { display: 'flex', alignItems: 'center', padding: '6px 14px', border: '1px solid rgba(13,13,13,0.12)', borderRadius: 8, fontSize: 13, color: 'rgba(13,13,13,0.55)', background: '#fff', cursor: 'pointer', fontFamily: "'Inter', sans-serif" },

  controls:  { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 },
  dateInput: { padding: '5px 10px', border: '1px solid rgba(13,13,13,0.12)', borderRadius: 8, fontSize: 13, fontFamily: "'Inter', sans-serif", color: '#0d0d0d', background: '#fff', outline: 'none' },
  todayBtn:  { padding: '5px 12px', border: '1px solid rgba(13,13,13,0.12)', borderRadius: 8, fontSize: 12, fontWeight: 500, color: 'rgba(13,13,13,0.55)', background: '#fff', cursor: 'pointer', fontFamily: "'Inter', sans-serif" },
  rangeSep:  { fontSize: 12, color: 'rgba(13,13,13,0.35)' },

  formCard:  { background: '#fff', borderRadius: 14, padding: '20px 22px', marginBottom: 18, border: '1px solid rgba(13,13,13,0.09)', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' },
  formTitle: { fontSize: 13, fontWeight: 600, color: '#0d0d0d', margin: '0 0 14px', letterSpacing: '-0.01em' },
  formGrid:  { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 },
  field:     { display: 'flex', flexDirection: 'column', gap: 5 },
  fieldLabel:{ fontSize: 10, fontWeight: 600, color: 'rgba(13,13,13,0.4)', letterSpacing: '0.06em', textTransform: 'uppercase' },
  input:     { border: '1px solid rgba(13,13,13,0.12)', borderRadius: 8, padding: '7px 10px', fontSize: 13, color: '#0d0d0d', background: '#fafaf9', outline: 'none', fontFamily: "'Inter', sans-serif" },
  moneyRow:  { display: 'flex', alignItems: 'center', border: '1px solid rgba(13,13,13,0.12)', borderRadius: 8, overflow: 'hidden', background: '#fafaf9' },
  moneySym:  { padding: '7px 8px', color: 'rgba(13,13,13,0.4)', fontSize: 12, borderRight: '1px solid rgba(13,13,13,0.08)' },
  moneyInput:{ flex: 1, border: 'none', padding: '7px 8px', fontSize: 13, color: '#0d0d0d', outline: 'none', background: 'transparent', fontFamily: "'Inter', sans-serif" },
  submitBtn: { padding: '7px 18px', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#fff', background: '#212121', cursor: 'pointer', fontFamily: "'Inter', sans-serif" },
  errorMsg:  { fontSize: 12, color: '#dc2626', margin: '0 0 8px', padding: '8px 10px', background: '#fef2f2', borderRadius: 8, border: '1px solid #fecaca' },

  muted:        { color: 'rgba(13,13,13,0.42)', fontSize: 14 },
  sectionLabel: { fontSize: 10, fontWeight: 600, color: 'rgba(13,13,13,0.35)', letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 8px' },

  card:       { background: '#fff', borderRadius: 14, border: '1px solid rgba(13,13,13,0.09)', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' },
  emptyCard:  { padding: '48px 40px', textAlign: 'center' },
  emptyTitle: { color: '#0d0d0d', fontSize: 14, fontWeight: 600, margin: '0 0 6px', letterSpacing: '-0.02em' },
  emptyHint:  { color: 'rgba(13,13,13,0.42)', fontSize: 12, margin: 0 },

  row:       { display: 'flex', alignItems: 'center', padding: '13px 20px', gap: 12 },
  rowCat:    { fontSize: 13, fontWeight: 500, color: '#0d0d0d', margin: 0, letterSpacing: '-0.01em' },
  rowVendor: { fontSize: 11, color: 'rgba(13,13,13,0.42)', margin: '2px 0 0' },
  rowDate:   { fontSize: 11, color: 'rgba(13,13,13,0.3)', margin: '2px 0 0' },
  rowAmount: { fontSize: 14, fontWeight: 600, color: '#0d0d0d', letterSpacing: '-0.02em', flexShrink: 0 },
  deleteBtn: { background: 'none', border: 'none', color: 'rgba(13,13,13,0.25)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 4, borderRadius: 6, flexShrink: 0 },

  totalRow:   { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '13px 20px', background: '#f7f7f5', borderTop: '1px solid rgba(13,13,13,0.07)' },
  totalLabel: { fontSize: 12, fontWeight: 600, color: 'rgba(13,13,13,0.5)', letterSpacing: '0.04em', textTransform: 'uppercase' },
  totalValue: { fontSize: 17, fontWeight: 700, color: '#0d0d0d', letterSpacing: '-0.03em' },
}

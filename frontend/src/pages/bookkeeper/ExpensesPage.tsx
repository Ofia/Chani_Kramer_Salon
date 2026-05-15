import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { Trash2, Plus, X } from 'lucide-react'

const CATEGORIES = [
  { value: 'itzik',           label: 'Itzik (Maintenance)' },
  { value: 'grossman',        label: 'Grossman (Supplier)' },
  { value: 'monsey_driver',   label: 'Monsey Driver (נהג מונסי)' },
  { value: 'rent',            label: 'Rent (שכירות)' },
  { value: 'phone_internet',  label: 'Phone & Internet' },
  { value: 'hair_supplies',   label: 'Hair Supplies' },
  { value: 'shipping',        label: 'Shipping' },
  { value: 'dalia_instagram', label: 'Dalia Instagram' },
  { value: 'work_purchases',  label: 'Work Purchases (קניות לעבודה)' },
  { value: 'food',            label: 'Food / Meals (אוכל)' },
  { value: 'sales_tax',       label: 'Sales Tax' },
  { value: 'reconciliation',  label: 'Reconciliation / Extra' },
  { value: 'misc',            label: 'Misc (הוצאות שונות)' },
  { value: 'other',           label: 'Other' },
]

function todayStr() {
  return new Date().toISOString().split('T')[0]
}
function fmtDate(str: string) {
  return new Date(str + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })
}
function fmt(n: number | string) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(n))
}

const EMPTY = { category: 'misc', amount: '', vendor: '', notes: '' }

export default function ExpensesPage() {
  const [selectedDate, setSelectedDate] = useState(todayStr())
  const [showForm, setShowForm]         = useState(false)
  const [form, setForm]                 = useState(EMPTY)
  const qc = useQueryClient()

  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ['expenses', selectedDate],
    queryFn: () =>
      api.get(`/expenses?start_date=${selectedDate}&end_date=${selectedDate}`).then(r => r.data),
  })

  const createMutation = useMutation({
    mutationFn: (data: object) => api.post('/expenses', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] })
      setForm(EMPTY)
      setShowForm(false)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/expenses/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['expenses'] }),
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.amount) return
    createMutation.mutate({
      expense_date: selectedDate,
      category:     form.category,
      amount:       parseFloat(form.amount),
      vendor:       form.vendor  || null,
      notes:        form.notes   || null,
    })
  }

  const total = (expenses as any[]).reduce((s: number, e: any) => s + Number(e.amount), 0)
  const isToday = selectedDate === todayStr()

  return (
    <div style={s.page}>

      {/* ── Header ── */}
      <header style={s.header}>
        <div>
          <h1 style={s.title}>Expenses</h1>
          <p style={s.subtitle}>{fmtDate(selectedDate)}</p>
        </div>
        <div style={s.headerRight}>
          <input
            type="date"
            value={selectedDate}
            onChange={e => { setSelectedDate(e.target.value); setShowForm(false) }}
            style={s.dateInput}
          />
          {!isToday && (
            <button onClick={() => setSelectedDate(todayStr())} style={s.todayBtn}>Today</button>
          )}
          <button
            onClick={() => setShowForm(v => !v)}
            style={showForm ? s.cancelFormBtn : s.addBtn}
          >
            {showForm
              ? <><X size={13} style={{ marginRight: 4 }} />Cancel</>
              : <><Plus size={13} style={{ marginRight: 4 }} />Add</>
            }
          </button>
        </div>
      </header>

      {/* ── Add form (inline, slides in) ── */}
      {showForm && (
        <div style={s.formCard}>
          <p style={s.formTitle}>New Expense — {fmtDate(selectedDate)}</p>
          <form onSubmit={handleSubmit}>
            <div style={s.formGrid}>
              <div style={s.field}>
                <label style={s.fieldLabel}>Category</label>
                <select
                  value={form.category}
                  onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                  style={s.input}
                >
                  {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div style={s.field}>
                <label style={s.fieldLabel}>Amount</label>
                <div style={s.moneyRow}>
                  <span style={s.moneySym}>$</span>
                  <input
                    type="number" min="0" step="0.01"
                    value={form.amount}
                    onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
                    style={s.moneyInput}
                    placeholder="0.00"
                    required
                  />
                </div>
              </div>
              <div style={s.field}>
                <label style={s.fieldLabel}>Vendor</label>
                <input
                  value={form.vendor}
                  onChange={e => setForm(p => ({ ...p, vendor: e.target.value }))}
                  style={s.input}
                  placeholder="Optional"
                />
              </div>
              <div style={s.field}>
                <label style={s.fieldLabel}>Notes</label>
                <input
                  value={form.notes}
                  onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                  style={s.input}
                  placeholder="Optional"
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <button type="submit" disabled={createMutation.isPending} style={s.submitBtn}>
                {createMutation.isPending ? 'Saving…' : 'Add Expense'}
              </button>
              <button type="button" onClick={() => setShowForm(false)} style={s.cancelFormBtn2}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Expense list ── */}
      <p style={s.sectionLabel}>
        {isToday ? "Today's Expenses" : `Expenses — ${fmtDate(selectedDate)}`}
      </p>

      {isLoading ? (
        <p style={s.muted}>Loading…</p>
      ) : (
        <div style={s.card}>
          {(expenses as any[]).length === 0 ? (
            <div style={s.emptyCard}>
              <p style={s.emptyTitle}>No expenses{isToday ? ' today' : ' on this day'}</p>
              <p style={s.emptyHint}>Use <strong>+ Add</strong> to log one.</p>
            </div>
          ) : (
            <>
              {(expenses as any[]).map((e: any, i: number) => (
                <div
                  key={e.id}
                  style={{
                    ...s.row,
                    borderBottom: i < (expenses as any[]).length - 1
                      ? '1px solid rgba(13,13,13,0.05)'
                      : 'none',
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <p style={s.rowCat}>
                      {CATEGORIES.find(c => c.value === e.category)?.label ?? e.category}
                    </p>
                    {e.vendor && <p style={s.rowVendor}>{e.vendor}</p>}
                  </div>
                  <span style={s.rowAmount}>{fmt(e.amount)}</span>
                  <button
                    onClick={() => deleteMutation.mutate(e.id)}
                    style={s.deleteBtn}
                    title="Delete"
                  >
                    <Trash2 size={13} />
                  </button>
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

const s: Record<string, React.CSSProperties> = {
  page: { fontFamily: "'Inter', -apple-system, sans-serif", letterSpacing: '-0.01em' },

  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    marginBottom: 20, paddingBottom: 20, borderBottom: '1px solid rgba(13,13,13,0.09)',
  },
  title:    { fontSize: 22, fontWeight: 700, color: '#0d0d0d', margin: 0, letterSpacing: '-0.03em' },
  subtitle: { fontSize: 12, color: 'rgba(13,13,13,0.42)', margin: '3px 0 0' },

  headerRight: { display: 'flex', alignItems: 'center', gap: 8 },
  dateInput: {
    padding: '5px 10px', border: '1px solid rgba(13,13,13,0.12)', borderRadius: 8,
    fontSize: 13, fontFamily: "'Inter', sans-serif", color: '#0d0d0d', background: '#fff', outline: 'none',
  },
  todayBtn: {
    padding: '5px 12px', border: '1px solid rgba(13,13,13,0.12)', borderRadius: 8,
    fontSize: 12, fontWeight: 500, color: 'rgba(13,13,13,0.55)', background: '#fff',
    cursor: 'pointer', fontFamily: "'Inter', sans-serif",
  },
  addBtn: {
    display: 'flex', alignItems: 'center',
    padding: '6px 14px', border: 'none', borderRadius: 8,
    fontSize: 13, fontWeight: 600, color: '#fff', background: '#212121',
    cursor: 'pointer', fontFamily: "'Inter', sans-serif",
  },
  cancelFormBtn: {
    display: 'flex', alignItems: 'center',
    padding: '6px 14px', border: '1px solid rgba(13,13,13,0.12)', borderRadius: 8,
    fontSize: 13, fontWeight: 400, color: 'rgba(13,13,13,0.55)', background: '#fff',
    cursor: 'pointer', fontFamily: "'Inter', sans-serif",
  },

  // Add form
  formCard: {
    background: '#fff', borderRadius: 14, padding: '20px 22px', marginBottom: 20,
    border: '1px solid rgba(13,13,13,0.09)', boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
  },
  formTitle: {
    fontSize: 13, fontWeight: 600, color: '#0d0d0d', margin: '0 0 14px', letterSpacing: '-0.01em',
  },
  formGrid:  { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 },
  field:     { display: 'flex', flexDirection: 'column', gap: 5 },
  fieldLabel:{ fontSize: 10, fontWeight: 600, color: 'rgba(13,13,13,0.4)', letterSpacing: '0.06em', textTransform: 'uppercase' },
  input: {
    border: '1px solid rgba(13,13,13,0.12)', borderRadius: 8, padding: '7px 10px',
    fontSize: 13, color: '#0d0d0d', background: '#fafaf9', outline: 'none',
    fontFamily: "'Inter', sans-serif",
  },
  moneyRow: {
    display: 'flex', alignItems: 'center',
    border: '1px solid rgba(13,13,13,0.12)', borderRadius: 8, overflow: 'hidden', background: '#fafaf9',
  },
  moneySym:  { padding: '7px 8px', color: 'rgba(13,13,13,0.4)', fontSize: 12, borderRight: '1px solid rgba(13,13,13,0.08)' },
  moneyInput:{ flex: 1, border: 'none', padding: '7px 8px', fontSize: 13, color: '#0d0d0d', outline: 'none', background: 'transparent', fontFamily: "'Inter', sans-serif" },
  submitBtn: {
    padding: '7px 18px', border: 'none', borderRadius: 8,
    fontSize: 13, fontWeight: 600, color: '#fff', background: '#212121',
    cursor: 'pointer', fontFamily: "'Inter', sans-serif",
  },
  cancelFormBtn2: {
    padding: '7px 14px', border: '1px solid rgba(13,13,13,0.12)', borderRadius: 8,
    fontSize: 13, color: 'rgba(13,13,13,0.55)', background: '#fff',
    cursor: 'pointer', fontFamily: "'Inter', sans-serif",
  },

  sectionLabel: {
    fontSize: 10, fontWeight: 600, color: 'rgba(13,13,13,0.35)',
    letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 8px',
  },
  muted: { color: 'rgba(13,13,13,0.42)', fontSize: 14 },

  card: {
    background: '#fff', borderRadius: 14,
    border: '1px solid rgba(13,13,13,0.09)',
    overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
  },
  emptyCard: { padding: '48px 40px', textAlign: 'center' },
  emptyTitle:{ color: '#0d0d0d', fontSize: 14, fontWeight: 600, margin: '0 0 6px', letterSpacing: '-0.02em' },
  emptyHint: { color: 'rgba(13,13,13,0.42)', fontSize: 12, margin: 0 },

  row:       { display: 'flex', alignItems: 'center', padding: '13px 20px', gap: 12 },
  rowCat:    { fontSize: 13, fontWeight: 500, color: '#0d0d0d', margin: 0, letterSpacing: '-0.01em' },
  rowVendor: { fontSize: 11, color: 'rgba(13,13,13,0.42)', margin: '2px 0 0' },
  rowAmount: { fontSize: 14, fontWeight: 600, color: '#0d0d0d', letterSpacing: '-0.02em', flexShrink: 0 },
  deleteBtn: {
    background: 'none', border: 'none', color: 'rgba(13,13,13,0.25)',
    cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 4, borderRadius: 6,
    flexShrink: 0,
  },

  totalRow:  {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '13px 20px', background: '#f7f7f5', borderTop: '1px solid rgba(13,13,13,0.07)',
  },
  totalLabel:{ fontSize: 12, fontWeight: 600, color: 'rgba(13,13,13,0.5)', letterSpacing: '0.04em', textTransform: 'uppercase' },
  totalValue:{ fontSize: 17, fontWeight: 700, color: '#0d0d0d', letterSpacing: '-0.03em' },
}

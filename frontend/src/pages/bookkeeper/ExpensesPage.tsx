import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { Trash2 } from 'lucide-react'

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

const EMPTY = { expense_date: new Date().toISOString().split('T')[0], category: 'misc', amount: '', vendor: '', notes: '' }

export default function ExpensesPage() {
  const [form, setForm]     = useState(EMPTY)
  const [showForm, setShowForm] = useState(false)
  const qc = useQueryClient()
  const today = new Date().toISOString().split('T')[0]

  const { data: expenses = [] } = useQuery({
    queryKey: ['expenses', today],
    queryFn: () => api.get(`/expenses?start_date=${today}&end_date=${today}`).then(r => r.data),
  })

  const createMutation = useMutation({
    mutationFn: (data: object) => api.post('/expenses', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['expenses'] }); setForm(EMPTY); setShowForm(false) },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/expenses/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['expenses'] }),
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    createMutation.mutate({
      expense_date: form.expense_date,
      category: form.category,
      amount: parseFloat(form.amount),
      vendor: form.vendor || null,
      notes: form.notes || null,
    })
  }

  const total = expenses.reduce((s: number, e: any) => s + Number(e.amount), 0)

  return (
    <div style={s.page}>
      <header style={s.header}>
        <h1 style={s.title}>Expenses</h1>
        <button onClick={() => setShowForm(!showForm)} style={showForm ? s.cancelBtn : s.addBtn}>
          {showForm ? 'Cancel' : '+ Add Expense'}
        </button>
      </header>

      {/* Add expense form */}
      {showForm && (
        <form onSubmit={handleSubmit} style={s.formCard}>
          <h3 style={s.formTitle}>New Expense</h3>
          <div style={s.formGrid}>
            <Field label="Date">
              <input type="date" value={form.expense_date}
                onChange={e => setForm(p => ({ ...p, expense_date: e.target.value }))}
                style={s.input} required />
            </Field>
            <Field label="Category">
              <select value={form.category}
                onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                style={s.input}>
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </Field>
            <Field label="Amount">
              <div style={s.moneyRow}>
                <span style={s.moneySym}>$</span>
                <input type="number" min="0" step="0.01" value={form.amount}
                  onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
                  style={s.moneyInput} placeholder="0.00" required />
              </div>
            </Field>
            <Field label="Vendor">
              <input value={form.vendor}
                onChange={e => setForm(p => ({ ...p, vendor: e.target.value }))}
                style={s.input} placeholder="Optional" />
            </Field>
          </div>
          <Field label="Notes">
            <input value={form.notes}
              onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
              style={s.input} placeholder="Optional" />
          </Field>
          <button type="submit" disabled={createMutation.isPending} style={s.submitBtn}>
            {createMutation.isPending ? 'Saving…' : 'Add Expense'}
          </button>
        </form>
      )}

      {/* Expense list */}
      <p style={s.sectionLabel}>Today's Expenses</p>
      <div style={s.list}>
        {expenses.length === 0 ? (
          <div style={s.empty}>No expenses today.</div>
        ) : (
          <>
            {expenses.map((e: any, i: number) => (
              <div key={e.id} style={{
                ...s.row,
                borderBottom: i < expenses.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none',
              }}>
                <div style={{ flex: 1 }}>
                  <p style={s.rowCat}>{CATEGORIES.find(c => c.value === e.category)?.label || e.category}</p>
                  {e.vendor && <p style={s.rowVendor}>{e.vendor}</p>}
                </div>
                <span style={s.rowAmount}>${Number(e.amount).toFixed(2)}</span>
                <button onClick={() => deleteMutation.mutate(e.id)} style={s.deleteBtn}>
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
            <div style={s.totalRow}>
              <span style={{ color: '#71717a', fontSize: 13 }}>Total Today</span>
              <span style={{ fontWeight: 700, fontSize: 17, color: '#18181b', letterSpacing: '-0.02em' }}>
                ${total.toFixed(2)}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label style={{ fontSize: 12, fontWeight: 500, color: '#71717a', letterSpacing: '-0.01em' }}>{label}</label>
      {children}
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  page: { maxWidth: 600 },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, paddingBottom: 20, borderBottom: '1px solid rgba(0,0,0,0.07)' },
  title: { fontSize: 26, fontWeight: 700, color: '#18181b', margin: 0, letterSpacing: '-0.03em' },
  addBtn: { background: '#212121', color: '#fff', border: 'none', borderRadius: 10, padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  cancelBtn: { background: 'rgba(0,0,0,0.06)', color: '#18181b', border: 'none', borderRadius: 10, padding: '9px 18px', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' },

  formCard: { background: '#fff', borderRadius: 16, padding: '24px', marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.05)' },
  formTitle: { fontSize: 16, fontWeight: 600, color: '#18181b', margin: 0, letterSpacing: '-0.02em' },
  formGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 },
  input: { border: '1px solid rgba(0,0,0,0.12)', borderRadius: 10, padding: '9px 12px', fontSize: 14, color: '#18181b', background: '#f9f9f9', outline: 'none', fontFamily: 'inherit' },
  moneyRow: { display: 'flex', alignItems: 'center', border: '1px solid rgba(0,0,0,0.12)', borderRadius: 10, overflow: 'hidden', background: '#f9f9f9' },
  moneySym: { padding: '0 10px', color: '#71717a', fontSize: 14, borderRight: '1px solid rgba(0,0,0,0.08)', paddingTop: 9, paddingBottom: 9 },
  moneyInput: { flex: 1, border: 'none', padding: '9px 10px', fontSize: 14, color: '#18181b', outline: 'none', background: 'transparent', fontFamily: 'inherit' },
  submitBtn: { background: '#212121', color: '#fff', border: 'none', borderRadius: 10, padding: '11px 24px', fontSize: 14, fontWeight: 600, cursor: 'pointer', alignSelf: 'flex-start', fontFamily: 'inherit' },

  sectionLabel: { fontSize: 11, fontWeight: 600, color: '#a1a1aa', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 },
  list: { background: '#fff', borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.05)' },
  empty: { padding: '40px', textAlign: 'center', color: '#71717a', fontSize: 14 },
  row: { display: 'flex', alignItems: 'center', padding: '14px 20px', gap: 12 },
  rowCat: { fontSize: 14, fontWeight: 500, color: '#18181b', margin: 0, letterSpacing: '-0.01em' },
  rowVendor: { fontSize: 12, color: '#71717a', margin: '2px 0 0' },
  rowAmount: { fontSize: 15, fontWeight: 600, color: '#18181b', letterSpacing: '-0.02em' },
  deleteBtn: { background: 'none', border: 'none', color: '#a1a1aa', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 4, borderRadius: 6 },
  totalRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', background: '#f4f4f5', borderTop: '1px solid rgba(0,0,0,0.06)' },
}

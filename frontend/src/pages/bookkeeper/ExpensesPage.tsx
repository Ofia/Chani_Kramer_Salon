import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'

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
  const [form, setForm]       = useState(EMPTY)
  const [showForm, setShowForm] = useState(false)
  const qc = useQueryClient()

  const today = new Date().toISOString().split('T')[0]

  const { data: expenses = [] } = useQuery({
    queryKey: ['expenses', today],
    queryFn: () => api.get(`/expenses?start_date=${today}&end_date=${today}`).then(r => r.data),
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
    <div style={styles.page}>
      <header style={styles.header}>
        <h1 style={styles.title}>Expenses</h1>
        <button onClick={() => setShowForm(!showForm)} style={styles.addBtn}>
          {showForm ? 'Cancel' : '+ Add Expense'}
        </button>
      </header>

      {showForm && (
        <form onSubmit={handleSubmit} style={styles.formCard}>
          <h3 style={styles.formTitle}>New Expense</h3>
          <div style={styles.formGrid}>
            <div style={styles.field}>
              <label style={styles.label}>Date</label>
              <input type="date" value={form.expense_date} onChange={e => setForm(p => ({ ...p, expense_date: e.target.value }))} style={styles.input} required />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Category</label>
              <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} style={styles.input}>
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Amount</label>
              <div style={styles.moneyWrapper}>
                <span style={styles.moneySym}>$</span>
                <input type="number" min="0" step="0.01" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} style={styles.moneyInput} placeholder="0.00" required />
              </div>
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Vendor</label>
              <input value={form.vendor} onChange={e => setForm(p => ({ ...p, vendor: e.target.value }))} style={styles.input} placeholder="Optional" />
            </div>
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Notes</label>
            <input value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} style={styles.input} placeholder="Optional" />
          </div>
          <button type="submit" disabled={createMutation.isPending} style={styles.saveBtn}>
            {createMutation.isPending ? 'Saving…' : 'Add Expense'}
          </button>
        </form>
      )}

      <div style={styles.list}>
        {expenses.length === 0 ? (
          <div style={styles.empty}><p>No expenses today.</p></div>
        ) : (
          <>
            {expenses.map((e: any) => (
              <div key={e.id} style={styles.row}>
                <div>
                  <p style={styles.rowCat}>{CATEGORIES.find(c => c.value === e.category)?.label || e.category}</p>
                  {e.vendor && <p style={styles.rowVendor}>{e.vendor}</p>}
                </div>
                <div style={styles.rowRight}>
                  <span style={styles.rowAmount}>${Number(e.amount).toFixed(2)}</span>
                  <button onClick={() => deleteMutation.mutate(e.id)} style={styles.deleteBtn}>×</button>
                </div>
              </div>
            ))}
            <div style={styles.totalRow}>
              <span>Total Today</span>
              <span style={{ fontWeight: 600 }}>${total.toFixed(2)}</span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: { maxWidth: 640 },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  title: { fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 32, fontWeight: 500, color: '#0E0C09', margin: 0 },
  addBtn: { background: '#0E0C09', color: '#fff', border: 'none', borderRadius: 2, padding: '9px 18px', fontSize: 13, cursor: 'pointer' },
  formCard: { background: '#fff', border: '1px solid rgba(14,12,9,0.07)', borderRadius: 2, padding: '24px', marginBottom: 24, display: 'flex', flexDirection: 'column', gap: 16 },
  formTitle: { fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 18, fontWeight: 500, margin: 0 },
  formGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 },
  field: { display: 'flex', flexDirection: 'column', gap: 5 },
  label: { fontSize: 11, fontWeight: 600, color: '#6A6560', letterSpacing: '0.08em', textTransform: 'uppercase' },
  input: { border: '1px solid rgba(14,12,9,0.14)', borderRadius: 2, padding: '8px 10px', fontSize: 13, color: '#0E0C09' },
  moneyWrapper: { display: 'flex', alignItems: 'center', border: '1px solid rgba(14,12,9,0.14)', borderRadius: 2, overflow: 'hidden' },
  moneySym: { padding: '0 10px', color: '#6A6560', fontSize: 13, background: '#F3F1ED', borderRight: '1px solid rgba(14,12,9,0.14)' },
  moneyInput: { flex: 1, border: 'none', padding: '8px 10px', fontSize: 13, color: '#0E0C09', outline: 'none' },
  saveBtn: { background: '#0E0C09', color: '#fff', border: 'none', borderRadius: 2, padding: '10px 20px', fontSize: 13, cursor: 'pointer', alignSelf: 'flex-start' },
  list: { background: '#fff', border: '1px solid rgba(14,12,9,0.07)', borderRadius: 2 },
  row: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid rgba(14,12,9,0.05)' },
  rowCat: { fontSize: 14, color: '#0E0C09', margin: 0, fontWeight: 500 },
  rowVendor: { fontSize: 12, color: '#6A6560', margin: '2px 0 0' },
  rowRight: { display: 'flex', alignItems: 'center', gap: 12 },
  rowAmount: { fontSize: 15, fontWeight: 600, color: '#0E0C09' },
  deleteBtn: { background: 'none', border: 'none', color: '#C0BAB4', fontSize: 18, cursor: 'pointer', lineHeight: 1 },
  totalRow: { display: 'flex', justifyContent: 'space-between', padding: '14px 20px', background: '#F3F1ED', fontSize: 14, color: '#0E0C09' },
  empty: { padding: '32px', textAlign: 'center', color: '#6A6560', fontSize: 14 },
}

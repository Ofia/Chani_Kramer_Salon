import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'

type DepositForm = { cash: string; checks: string; credit_card: string; zelle: string; notes: string }
const EMPTY: DepositForm = { cash: '', checks: '', credit_card: '', zelle: '', notes: '' }

export default function DepositsPage() {
  const [depositDate, setDepositDate] = useState(new Date().toISOString().split('T')[0])
  const [form, setForm] = useState<DepositForm>(EMPTY)
  const [saved, setSaved] = useState(false)
  const qc = useQueryClient()

  const { data: existing } = useQuery({
    queryKey: ['deposit', depositDate],
    queryFn: () => api.get(`/deposits/${depositDate}`).then(r => r.data).catch(() => null),
  })

  useEffect(() => {
    if (existing) {
      setForm({
        cash: String(existing.cash), checks: String(existing.checks),
        credit_card: String(existing.credit_card), zelle: String(existing.zelle),
        notes: existing.notes || '',
      })
    } else {
      setForm(EMPTY)
    }
  }, [existing, depositDate])

  const mutation = useMutation({
    mutationFn: (data: object) =>
      existing ? api.patch(`/deposits/${depositDate}`, data) : api.post('/deposits', data),
    onSuccess: () => {
      setSaved(true)
      qc.invalidateQueries({ queryKey: ['deposit'] })
      setTimeout(() => setSaved(false), 3000)
    },
  })

  function set(field: keyof DepositForm, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const cashNum = parseFloat(form.cash) || 0
  const checksNum = parseFloat(form.checks) || 0
  const ccNum = parseFloat(form.credit_card) || 0
  const zelleNum = parseFloat(form.zelle) || 0

  const taxCash     = cashNum * 0.08875
  const taxOther    = (checksNum + ccNum + zelleNum) * 0.045
  const totalDeposit = cashNum + checksNum + ccNum + zelleNum

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    mutation.mutate({
      deposit_date: depositDate,
      cash: cashNum, checks: checksNum, credit_card: ccNum, zelle: zelleNum,
      notes: form.notes || null,
    })
  }

  return (
    <div style={styles.page}>
      <h1 style={styles.title}>Deposits</h1>

      <div style={styles.datePicker}>
        <label style={styles.label}>Date</label>
        <input type="date" value={depositDate} onChange={e => setDepositDate(e.target.value)} style={styles.input} />
      </div>

      <form onSubmit={handleSubmit} style={styles.card}>
        <div style={styles.grid}>
          <MoneyField label="Cash"        value={form.cash}        onChange={v => set('cash', v)} />
          <MoneyField label="Checks"      value={form.checks}      onChange={v => set('checks', v)} />
          <MoneyField label="Credit Card" value={form.credit_card} onChange={v => set('credit_card', v)} />
          <MoneyField label="Zelle"       value={form.zelle}       onChange={v => set('zelle', v)} />
        </div>

        {/* Auto-calculated sales tax */}
        <div style={styles.taxSection}>
          <h3 style={styles.taxTitle}>Sales Tax (auto-calculated)</h3>
          <div style={styles.taxGrid}>
            <div style={styles.taxRow}>
              <span style={styles.taxLabel}>Cash × 8.875%</span>
              <span style={styles.taxValue}>${taxCash.toFixed(2)}</span>
            </div>
            <div style={styles.taxRow}>
              <span style={styles.taxLabel}>CC / Checks / Zelle × 4.5%</span>
              <span style={styles.taxValue}>${taxOther.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div style={styles.totalRow}>
          <span>Total Deposit</span>
          <span style={styles.totalValue}>${totalDeposit.toFixed(2)}</span>
        </div>

        <div style={styles.field}>
          <label style={styles.label}>Notes</label>
          <input value={form.notes} onChange={e => set('notes', e.target.value)} style={styles.input} placeholder="Optional" />
        </div>

        <div style={styles.actions}>
          <button type="submit" disabled={mutation.isPending} style={styles.saveBtn}>
            {mutation.isPending ? 'Saving…' : existing ? 'Update' : 'Save Deposit'}
          </button>
          {saved && <span style={styles.success}>Saved.</span>}
        </div>
      </form>
    </div>
  )
}

function MoneyField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div style={styles.field}>
      <label style={styles.label}>{label}</label>
      <div style={styles.moneyWrapper}>
        <span style={styles.moneySym}>$</span>
        <input type="number" min="0" step="0.01" value={value} onChange={e => onChange(e.target.value)} style={styles.moneyInput} placeholder="0.00" />
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: { maxWidth: 600 },
  title: { fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 32, fontWeight: 500, color: '#0E0C09', margin: '0 0 28px' },
  datePicker: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 },
  card: { background: '#fff', border: '1px solid rgba(14,12,9,0.07)', borderRadius: 2, padding: '28px', display: 'flex', flexDirection: 'column', gap: 20 },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 },
  field: { display: 'flex', flexDirection: 'column', gap: 5 },
  label: { fontSize: 11, fontWeight: 600, color: '#6A6560', letterSpacing: '0.08em', textTransform: 'uppercase' },
  input: { border: '1px solid rgba(14,12,9,0.14)', borderRadius: 2, padding: '8px 10px', fontSize: 13, color: '#0E0C09' },
  moneyWrapper: { display: 'flex', alignItems: 'center', border: '1px solid rgba(14,12,9,0.14)', borderRadius: 2, overflow: 'hidden' },
  moneySym: { padding: '0 10px', color: '#6A6560', fontSize: 13, background: '#F3F1ED', borderRight: '1px solid rgba(14,12,9,0.14)' },
  moneyInput: { flex: 1, border: 'none', padding: '8px 10px', fontSize: 13, color: '#0E0C09', outline: 'none' },
  taxSection: { background: '#F3F1ED', borderRadius: 2, padding: '16px 20px' },
  taxTitle: { fontSize: 11, fontWeight: 600, color: '#6A6560', letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 12px' },
  taxGrid: { display: 'flex', flexDirection: 'column', gap: 8 },
  taxRow: { display: 'flex', justifyContent: 'space-between', fontSize: 13 },
  taxLabel: { color: '#6A6560' },
  taxValue: { color: '#0E0C09', fontWeight: 500 },
  totalRow: { display: 'flex', justifyContent: 'space-between', padding: '14px 0', borderTop: '1px solid rgba(14,12,9,0.1)', borderBottom: '1px solid rgba(14,12,9,0.1)', fontSize: 14, color: '#0E0C09' },
  totalValue: { fontWeight: 700, fontSize: 18 },
  actions: { display: 'flex', alignItems: 'center', gap: 16 },
  saveBtn: { background: '#0E0C09', color: '#fff', border: 'none', borderRadius: 2, padding: '10px 24px', fontSize: 14, cursor: 'pointer', fontWeight: 500 },
  success: { color: '#27ae60', fontSize: 13 },
}

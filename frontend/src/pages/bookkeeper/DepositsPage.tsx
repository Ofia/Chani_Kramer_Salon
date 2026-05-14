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
      setForm({ cash: String(existing.cash), checks: String(existing.checks), credit_card: String(existing.credit_card), zelle: String(existing.zelle), notes: existing.notes || '' })
    } else {
      setForm(EMPTY)
    }
  }, [existing, depositDate])

  const mutation = useMutation({
    mutationFn: (data: object) =>
      existing ? api.patch(`/deposits/${depositDate}`, data) : api.post('/deposits', data),
    onSuccess: () => { setSaved(true); qc.invalidateQueries({ queryKey: ['deposit'] }); setTimeout(() => setSaved(false), 3000) },
  })

  function set(field: keyof DepositForm, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const cashNum   = parseFloat(form.cash)        || 0
  const checksNum = parseFloat(form.checks)      || 0
  const ccNum     = parseFloat(form.credit_card) || 0
  const zelleNum  = parseFloat(form.zelle)       || 0
  const taxCash   = cashNum * 0.08875
  const taxOther  = (checksNum + ccNum + zelleNum) * 0.045
  const total     = cashNum + checksNum + ccNum + zelleNum

  // For dashboard chart — percentages
  const hasData = total > 0
  const pcts = {
    cash:  hasData ? (cashNum   / total) * 100 : 0,
    check: hasData ? (checksNum / total) * 100 : 0,
    cc:    hasData ? (ccNum     / total) * 100 : 0,
    zelle: hasData ? (zelleNum  / total) * 100 : 0,
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    mutation.mutate({ deposit_date: depositDate, cash: cashNum, checks: checksNum, credit_card: ccNum, zelle: zelleNum, notes: form.notes || null })
  }

  return (
    <div style={s.shell}>
      {/* ── Left: form ── */}
      <div style={s.formCol}>
        <header style={s.header}>
          <h1 style={s.title}>Deposits</h1>
          <div style={s.datePicker}>
            <label style={s.dateLabel}>Date</label>
            <input type="date" value={depositDate} onChange={e => setDepositDate(e.target.value)} style={s.dateInput} />
          </div>
        </header>

        <form onSubmit={handleSubmit}>
          <p style={s.sectionLabel}>Deposit Amounts</p>
          <div style={s.card}>
            <div style={s.grid}>
              <MoneyField label="Cash"        value={form.cash}        onChange={v => set('cash', v)} />
              <MoneyField label="Checks"      value={form.checks}      onChange={v => set('checks', v)} />
              <MoneyField label="Credit Card" value={form.credit_card} onChange={v => set('credit_card', v)} />
              <MoneyField label="Zelle"       value={form.zelle}       onChange={v => set('zelle', v)} />
            </div>
          </div>

          <p style={s.sectionLabel}>Sales Tax (auto-calculated)</p>
          <div style={s.taxCard}>
            <div style={s.taxRow}><span style={s.taxLabel}>Cash × 8.875%</span><span style={s.taxValue}>${taxCash.toFixed(2)}</span></div>
            <div style={{ ...s.taxRow, borderBottom: 'none' }}><span style={s.taxLabel}>CC / Checks / Zelle × 4.5%</span><span style={s.taxValue}>${taxOther.toFixed(2)}</span></div>
          </div>

          <div style={s.totalBanner}>
            <span style={s.totalLabel}>Total Deposit</span>
            <span style={s.totalValue}>${total.toFixed(2)}</span>
          </div>

          <div style={s.notesField}>
            <label style={s.dateLabel}>Notes (optional)</label>
            <input value={form.notes} onChange={e => set('notes', e.target.value)} style={s.notesInput} placeholder="Optional" />
          </div>

          <div style={s.actions}>
            <button type="submit" disabled={mutation.isPending} style={s.primaryBtn}>
              {mutation.isPending ? 'Saving…' : existing ? 'Update Deposit' : 'Save Deposit'}
            </button>
            {saved && <span style={s.success}>Saved.</span>}
          </div>
        </form>
      </div>

      {/* ── Right: dashboard panel ── */}
      <div style={s.dashCol}>

        {/* Total card */}
        <div style={s.bigCard}>
          <p style={s.bigCardLabel}>Total Today</p>
          <p style={s.bigCardValue}>${total.toFixed(2)}</p>
          <p style={s.bigCardSub}>{depositDate}</p>
        </div>

        {/* Payment method breakdown */}
        <div style={s.breakdownCard}>
          <p style={s.breakTitle}>Payment Breakdown</p>
          <MiniBar label="Cash"        pct={pcts.cash}  amount={cashNum}   color="#DF5198" />
          <MiniBar label="Checks"      pct={pcts.check} amount={checksNum} color="#97BBE9" />
          <MiniBar label="Credit Card" pct={pcts.cc}    amount={ccNum}     color="#E3CD94" />
          <MiniBar label="Zelle"       pct={pcts.zelle} amount={zelleNum}  color="#5581B1" />
        </div>

        {/* Tax summary */}
        <div style={s.taxSummaryCard}>
          <p style={s.breakTitle}>Tax Summary</p>
          <TaxLine label="Cash tax (8.875%)"        value={taxCash}  color="#EDCADB" />
          <TaxLine label="CC/Check/Zelle (4.5%)"    value={taxOther} color="#5581B1" last />
        </div>

      </div>
    </div>
  )
}

// ── Sub-components ───────────────────────────────────────────

function MoneyField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label style={{ fontSize: 12, fontWeight: 500, color: '#71717a' }}>{label}</label>
      <div style={s.moneyRow}>
        <span style={s.moneySym}>$</span>
        <input type="number" min="0" step="0.01" value={value}
          onChange={e => onChange(e.target.value)} style={s.moneyInput} placeholder="0.00" />
      </div>
    </div>
  )
}

function MiniBar({ label, pct, amount, color }: { label: string; pct: number; amount: number; color: string }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
        <span style={{ fontSize: 12, color: '#71717a' }}>{label}</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#18181b' }}>${amount.toFixed(2)}</span>
      </div>
      <div style={{ height: 6, background: '#f4f4f5', borderRadius: 99 }}>
        <div style={{ height: 6, width: `${Math.min(pct, 100)}%`, background: color, borderRadius: 99, transition: 'width 0.4s ease' }} />
      </div>
    </div>
  )
}

function TaxLine({ label, value, color, last = false }: { label: string; value: number; color: string; last?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: last ? 'none' : '1px solid rgba(0,0,0,0.05)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
        <span style={{ fontSize: 12, color: '#71717a' }}>{label}</span>
      </div>
      <span style={{ fontSize: 13, fontWeight: 600, color: '#18181b' }}>${value.toFixed(2)}</span>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  shell: { display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 28, alignItems: 'start' },

  /* Form column */
  formCol: { minWidth: 0 },

  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, paddingBottom: 20, borderBottom: '1px solid rgba(0,0,0,0.07)' },
  title: { fontSize: 26, fontWeight: 700, color: '#18181b', margin: 0, letterSpacing: '-0.03em' },
  datePicker: { display: 'flex', alignItems: 'center', gap: 10 },
  dateLabel: { fontSize: 12, fontWeight: 500, color: '#71717a' },
  dateInput: { border: '1px solid rgba(0,0,0,0.12)', borderRadius: 8, padding: '7px 10px', fontSize: 13, color: '#18181b', background: '#fff', fontFamily: 'inherit', outline: 'none' },

  sectionLabel: { fontSize: 11, fontWeight: 600, color: '#a1a1aa', letterSpacing: '0.06em', textTransform: 'uppercase', margin: '0 0 8px' },
  card: { background: '#fff', borderRadius: 16, padding: '22px', boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.05)', marginBottom: 20 },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 },
  moneyRow: { display: 'flex', alignItems: 'center', border: '1px solid rgba(0,0,0,0.12)', borderRadius: 10, overflow: 'hidden', background: '#f9f9f9' },
  moneySym: { padding: '10px 10px', color: '#71717a', fontSize: 14, borderRight: '1px solid rgba(0,0,0,0.08)' },
  moneyInput: { flex: 1, border: 'none', padding: '10px 10px', fontSize: 15, color: '#18181b', outline: 'none', background: 'transparent', fontFamily: 'inherit' },

  taxCard: { background: '#fff', borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.05)', marginBottom: 20 },
  taxRow: { display: 'flex', justifyContent: 'space-between', padding: '13px 20px', borderBottom: '1px solid rgba(0,0,0,0.05)' },
  taxLabel: { fontSize: 14, color: '#71717a' },
  taxValue: { fontSize: 14, fontWeight: 600, color: '#18181b', letterSpacing: '-0.01em' },

  totalBanner: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f4f4f5', border: '1px solid #e4e4e7', borderRadius: 12, padding: '16px 20px', marginBottom: 20 },
  totalLabel: { fontSize: 13, fontWeight: 500, color: '#71717a' },
  totalValue: { fontSize: 24, fontWeight: 700, color: '#18181b', letterSpacing: '-0.03em' },

  notesField: { display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 24 },
  notesInput: { border: '1px solid rgba(0,0,0,0.12)', borderRadius: 10, padding: '9px 12px', fontSize: 14, color: '#18181b', background: '#fff', outline: 'none', fontFamily: 'inherit' },

  actions: { display: 'flex', alignItems: 'center', gap: 16 },
  primaryBtn: { background: '#212121', color: '#fff', border: 'none', borderRadius: 12, padding: '13px 28px', fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '-0.01em' },
  success: { color: '#10b981', fontSize: 13, fontWeight: 500 },

  /* Dashboard column */
  dashCol: { flex: 1, display: 'flex', flexDirection: 'column', gap: 14, position: 'sticky', top: 36 },

  bigCard: { background: '#fff', borderRadius: 12, padding: '20px 22px', border: '1px solid #e4e4e7' },
  bigCardLabel: { fontSize: 11, fontWeight: 500, color: '#71717a', letterSpacing: '0.04em', textTransform: 'uppercase', margin: '0 0 6px' },
  bigCardValue: { fontSize: 32, fontWeight: 700, color: '#18181b', letterSpacing: '-0.03em', margin: '0 0 4px' },
  bigCardSub: { fontSize: 11, color: '#a1a1aa', margin: 0 },

  breakdownCard: { background: '#fff', borderRadius: 16, padding: '18px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.05)' },
  breakTitle: { fontSize: 12, fontWeight: 600, color: '#18181b', margin: '0 0 16px', letterSpacing: '-0.01em' },

  taxSummaryCard: { background: '#fff', borderRadius: 16, padding: '18px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.05)' },
}

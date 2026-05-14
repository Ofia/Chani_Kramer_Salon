import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'

type FormData = {
  summary_date: string
  total_wash_set: string; total_wig_sales: string; total_repairs: string; total_other: string
  cash_collected: string; quickpay_collected: string; cc_collected: string
  check_collected: string; zelle_collected: string
  new_wigs_sold: string; wigs_paid_full: string; chani_cuts: string; notes: string
}

const EMPTY: FormData = {
  summary_date: new Date().toISOString().split('T')[0],
  total_wash_set: '', total_wig_sales: '', total_repairs: '', total_other: '',
  cash_collected: '', quickpay_collected: '', cc_collected: '', check_collected: '', zelle_collected: '',
  new_wigs_sold: '', wigs_paid_full: '', chani_cuts: '', notes: '',
}

const STEPS = ['Revenue', 'Payments', 'Activity', 'Review']

export default function DailyEntryPage() {
  const [step, setStep]   = useState(0)
  const [form, setForm]   = useState<FormData>(EMPTY)
  const [saved, setSaved] = useState(false)
  const qc = useQueryClient()

  const { data: existing, isLoading } = useQuery({
    queryKey: ['daily-summary', form.summary_date],
    queryFn: () => api.get(`/daily-summary/${form.summary_date}`).then(r => r.data).catch(() => null),
  })

  useEffect(() => {
    if (existing) {
      setForm(prev => ({
        ...prev,
        total_wash_set: String(existing.total_wash_set),
        total_wig_sales: String(existing.total_wig_sales),
        total_repairs: String(existing.total_repairs),
        total_other: String(existing.total_other),
        cash_collected: String(existing.cash_collected),
        quickpay_collected: String(existing.quickpay_collected),
        cc_collected: String(existing.cc_collected),
        check_collected: String(existing.check_collected),
        zelle_collected: String(existing.zelle_collected),
        new_wigs_sold: String(existing.new_wigs_sold),
        wigs_paid_full: String(existing.wigs_paid_full),
        chani_cuts: String(existing.chani_cuts),
        notes: existing.notes || '',
      }))
    }
  }, [existing])

  const mutation = useMutation({
    mutationFn: (data: object) =>
      existing ? api.patch(`/daily-summary/${form.summary_date}`, data) : api.post('/daily-summary', data),
    onSuccess: () => { setSaved(true); qc.invalidateQueries({ queryKey: ['daily-summary'] }); setTimeout(() => setSaved(false), 3000) },
  })

  const lockMutation = useMutation({
    mutationFn: () => api.post(`/daily-summary/${form.summary_date}/lock`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['daily-summary'] }),
  })

  function set(field: keyof FormData, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  function numericTotal(...fields: (keyof FormData)[]) {
    return fields.reduce((sum, f) => sum + (parseFloat(form[f] as string) || 0), 0)
  }

  function handleSubmit() {
    mutation.mutate({
      summary_date: form.summary_date,
      total_wash_set: parseFloat(form.total_wash_set) || 0,
      total_wig_sales: parseFloat(form.total_wig_sales) || 0,
      total_repairs: parseFloat(form.total_repairs) || 0,
      total_other: parseFloat(form.total_other) || 0,
      cash_collected: parseFloat(form.cash_collected) || 0,
      quickpay_collected: parseFloat(form.quickpay_collected) || 0,
      cc_collected: parseFloat(form.cc_collected) || 0,
      check_collected: parseFloat(form.check_collected) || 0,
      zelle_collected: parseFloat(form.zelle_collected) || 0,
      new_wigs_sold: parseInt(form.new_wigs_sold) || 0,
      wigs_paid_full: parseInt(form.wigs_paid_full) || 0,
      chani_cuts: parseInt(form.chani_cuts) || 0,
      notes: form.notes || null,
    })
  }

  if (isLoading) return <p style={{ color: '#71717a', fontSize: 14 }}>Loading…</p>
  const isLocked = existing?.is_locked

  const totalRevenue = numericTotal('total_wash_set', 'total_wig_sales', 'total_repairs', 'total_other')
  const totalPayments = numericTotal('cash_collected', 'quickpay_collected', 'cc_collected', 'check_collected', 'zelle_collected')
  const ws  = parseFloat(form.total_wash_set)  || 0
  const wigs = parseFloat(form.total_wig_sales) || 0
  const rep  = parseFloat(form.total_repairs)   || 0

  return (
    <div style={s.shell}>
      {/* ── Left: form ── */}
      <div style={s.formCol}>
        <header style={s.header}>
          <div>
            <h1 style={s.title}>Daily Entry</h1>
            <input type="date" value={form.summary_date}
              onChange={e => setForm({ ...EMPTY, summary_date: e.target.value })}
              style={s.dateInput} disabled={isLocked} />
          </div>
          {isLocked && <span style={s.lockedBadge}>Locked</span>}
        </header>

        {isLocked ? (
          <LockedView data={existing} />
        ) : (
          <>
            <div style={s.segmented}>
              {STEPS.map((label, i) => (
                <button key={label} onClick={() => setStep(i)}
                  style={{ ...s.seg, ...(step === i ? s.segActive : {}) }}>
                  {label}
                </button>
              ))}
            </div>

            <div style={s.card}>
              {step === 0 && (
                <Section title="Revenue">
                  <MoneyField label="Wash & Set"  value={form.total_wash_set}  onChange={v => set('total_wash_set', v)} />
                  <MoneyField label="Wig Sales"   value={form.total_wig_sales} onChange={v => set('total_wig_sales', v)} />
                  <MoneyField label="Repairs"     value={form.total_repairs}   onChange={v => set('total_repairs', v)} />
                  <MoneyField label="Other"       value={form.total_other}     onChange={v => set('total_other', v)} />
                  <Subtotal label="Total Revenue" value={totalRevenue} />
                </Section>
              )}
              {step === 1 && (
                <Section title="Payment Methods">
                  <MoneyField label="Cash"        value={form.cash_collected}     onChange={v => set('cash_collected', v)} />
                  <MoneyField label="QuickPay"    value={form.quickpay_collected} onChange={v => set('quickpay_collected', v)} />
                  <MoneyField label="Credit Card" value={form.cc_collected}       onChange={v => set('cc_collected', v)} />
                  <MoneyField label="Check"       value={form.check_collected}    onChange={v => set('check_collected', v)} />
                  <MoneyField label="Zelle"       value={form.zelle_collected}    onChange={v => set('zelle_collected', v)} />
                  <Subtotal label="Total Collected" value={totalPayments} />
                </Section>
              )}
              {step === 2 && (
                <Section title="Activity">
                  <CountField label="New Wigs Sold"     value={form.new_wigs_sold}  onChange={v => set('new_wigs_sold', v)} />
                  <CountField label="Wigs Paid in Full" value={form.wigs_paid_full} onChange={v => set('wigs_paid_full', v)} />
                  <CountField label="Chani Cuts"        value={form.chani_cuts}     onChange={v => set('chani_cuts', v)} />
                  <div style={s.field}>
                    <label style={s.fieldLabel}>Notes (optional)</label>
                    <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
                      style={s.textarea} rows={3} placeholder="Any notes for today…" />
                  </div>
                </Section>
              )}
              {step === 3 && (
                <Section title="Review & Save">
                  <ReviewRow label="Wash & Set"     value={`$${form.total_wash_set || '0'}`} />
                  <ReviewRow label="Wig Sales"       value={`$${form.total_wig_sales || '0'}`} />
                  <ReviewRow label="Repairs"         value={`$${form.total_repairs || '0'}`} />
                  <ReviewRow label="Cash"            value={`$${form.cash_collected || '0'}`} />
                  <ReviewRow label="QuickPay"        value={`$${form.quickpay_collected || '0'}`} />
                  <ReviewRow label="Credit Card"     value={`$${form.cc_collected || '0'}`} />
                  <ReviewRow label="Zelle"           value={`$${form.zelle_collected || '0'}`} />
                  <ReviewRow label="New Wigs Sold"   value={form.new_wigs_sold || '0'} />
                  <ReviewRow label="Chani Cuts"      value={form.chani_cuts || '0'} last />
                  <div style={s.actions}>
                    <button onClick={handleSubmit} disabled={mutation.isPending} style={s.primaryBtn}>
                      {mutation.isPending ? 'Saving…' : existing ? 'Update' : 'Save Day'}
                    </button>
                    {existing && !existing.is_locked && (
                      <button onClick={() => lockMutation.mutate()} disabled={lockMutation.isPending} style={s.ghostBtn}>
                        {lockMutation.isPending ? 'Locking…' : 'Lock Day'}
                      </button>
                    )}
                  </div>
                  {saved && <p style={s.success}>Saved successfully.</p>}
                  {mutation.isError && <p style={s.errorMsg}>Error saving. Try again.</p>}
                </Section>
              )}
            </div>

            <div style={s.navRow}>
              {step > 0 && <button onClick={() => setStep(p => p - 1)} style={s.navBtn}>← Previous</button>}
              {step < STEPS.length - 1 && <button onClick={() => setStep(p => p + 1)} style={{ ...s.navBtn, marginLeft: 'auto', color: '#212121' }}>Next →</button>}
            </div>
          </>
        )}
      </div>

      {/* ── Right: live dashboard ── */}
      <div style={s.dashCol}>

        {/* Total Revenue */}
        <div style={s.bigCard}>
          <p style={s.bigCardLabel}>Total Revenue</p>
          <p style={s.bigCardValue}>${totalRevenue.toFixed(2)}</p>
          <p style={s.bigCardSub}>Live preview</p>
        </div>

        {/* Revenue breakdown bars */}
        <div style={s.breakdownCard}>
          <p style={s.breakTitle}>Revenue by Stream</p>
          <MiniBar label="Wash & Set" amount={ws}   pct={totalRevenue ? (ws / totalRevenue) * 100 : 0}   color="#DF5198" />
          <MiniBar label="Wig Sales"  amount={wigs}  pct={totalRevenue ? (wigs / totalRevenue) * 100 : 0} color="#97BBE9" />
          <MiniBar label="Repairs"   amount={rep}   pct={totalRevenue ? (rep / totalRevenue) * 100 : 0}  color="#E3CD94" />
        </div>

        {/* Payment vs Revenue */}
        <div style={s.breakdownCard}>
          <p style={s.breakTitle}>Collections vs Revenue</p>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
            <span style={{ fontSize: 13, color: '#71717a' }}>Revenue entered</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#18181b' }}>${totalRevenue.toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0' }}>
            <span style={{ fontSize: 13, color: '#71717a' }}>Payments collected</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: totalPayments === totalRevenue ? '#10b981' : '#f59e0b' }}>
              ${totalPayments.toFixed(2)}
            </span>
          </div>
          {totalRevenue > 0 && (
            <div style={{ padding: '8px 12px', background: totalPayments === totalRevenue ? 'rgba(16,185,129,0.1)' : 'rgba(255,149,0,0.1)', borderRadius: 8, fontSize: 12, color: totalPayments === totalRevenue ? '#10b981' : '#f59e0b', fontWeight: 500 }}>
              {totalPayments === totalRevenue ? '✓ Balanced' : `Difference: $${Math.abs(totalRevenue - totalPayments).toFixed(2)}`}
            </div>
          )}
        </div>

        {/* Activity counts */}
        <div style={s.countGrid}>
          <CountCard label="Wigs Sold" value={parseInt(form.new_wigs_sold) || 0} color="#DF5198" />
          <CountCard label="Chani Cuts" value={parseInt(form.chani_cuts) || 0} color="#5581B1" />
        </div>

      </div>
    </div>
  )
}

// ── Sub-components ───────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <div><h2 style={s.sectionTitle}>{title}</h2><div style={s.fields}>{children}</div></div>
}

function MoneyField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div style={s.field}>
      <label style={s.fieldLabel}>{label}</label>
      <div style={s.moneyRow}>
        <span style={s.moneySym}>$</span>
        <input type="number" min="0" step="0.01" value={value}
          onChange={e => onChange(e.target.value)} style={s.moneyInput} placeholder="0.00" />
      </div>
    </div>
  )
}

function CountField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div style={s.field}>
      <label style={s.fieldLabel}>{label}</label>
      <input type="number" min="0" step="1" value={value}
        onChange={e => onChange(e.target.value)} style={s.input} placeholder="0" />
    </div>
  )
}

function Subtotal({ label, value }: { label: string; value: number }) {
  return (
    <div style={s.subtotal}>
      <span style={{ color: '#71717a', fontSize: 13 }}>{label}</span>
      <span style={{ fontWeight: 700, color: '#18181b', fontSize: 17, letterSpacing: '-0.02em' }}>${value.toFixed(2)}</span>
    </div>
  )
}

function ReviewRow({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '11px 0', borderBottom: last ? 'none' : '1px solid rgba(0,0,0,0.06)' }}>
      <span style={{ color: '#71717a', fontSize: 14 }}>{label}</span>
      <span style={{ color: '#18181b', fontWeight: 500, fontSize: 14 }}>{value}</span>
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

function CountCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ background: '#fff', borderRadius: 14, padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.05)', flex: 1 }}>
      <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, marginBottom: 10 }} />
      <p style={{ fontSize: 28, fontWeight: 700, color: '#18181b', margin: '0 0 4px', letterSpacing: '-0.03em' }}>{value}</p>
      <p style={{ fontSize: 11, color: '#a1a1aa', margin: 0, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</p>
    </div>
  )
}

function LockedView({ data }: { data: any }) {
  const fmt = (n: number) => `$${Number(n).toFixed(2)}`
  return (
    <div style={s.card}>
      <p style={{ color: '#71717a', fontSize: 14, marginBottom: 20 }}>This day has been locked and cannot be edited.</p>
      <ReviewRow label="Wash & Set" value={fmt(data.total_wash_set)} />
      <ReviewRow label="Wig Sales"  value={fmt(data.total_wig_sales)} />
      <ReviewRow label="Repairs"    value={fmt(data.total_repairs)} />
      <ReviewRow label="Total"      value={fmt(data.total_revenue)} last />
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  shell: { display: 'flex', gap: 28, alignItems: 'flex-start' },
  formCol: { flex: '0 0 480px', minWidth: 0 },
  dashCol: { flex: 1, display: 'flex', flexDirection: 'column', gap: 14, position: 'sticky', top: 36 },

  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, paddingBottom: 20, borderBottom: '1px solid rgba(0,0,0,0.07)' },
  title: { fontSize: 26, fontWeight: 700, color: '#18181b', margin: '0 0 10px', letterSpacing: '-0.03em' },
  dateInput: { border: '1px solid rgba(0,0,0,0.12)', borderRadius: 8, padding: '6px 10px', fontSize: 13, color: '#18181b', background: '#fff', fontFamily: 'inherit', outline: 'none' },
  lockedBadge: { background: '#18181b', color: '#fff', padding: '5px 14px', borderRadius: 20, fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' },

  segmented: { display: 'flex', background: 'rgba(120,120,128,0.12)', borderRadius: 10, padding: 3, marginBottom: 16, gap: 2 },
  seg: { flex: 1, padding: '6px 0', border: 'none', background: 'transparent', borderRadius: 8, fontSize: 13, fontWeight: 500, color: '#71717a', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' },
  segActive: { background: '#fff', color: '#18181b', boxShadow: '0 1px 4px rgba(0,0,0,0.12)' },

  card: { background: '#fff', borderRadius: 16, padding: '22px', boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.05)' },
  sectionTitle: { fontSize: 13, fontWeight: 600, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.01em', margin: '0 0 16px' },
  fields: { display: 'flex', flexDirection: 'column', gap: 14 },

  field: { display: 'flex', flexDirection: 'column', gap: 5 },
  fieldLabel: { fontSize: 12, fontWeight: 500, color: '#71717a' },
  moneyRow: { display: 'flex', alignItems: 'center', border: '1px solid rgba(0,0,0,0.12)', borderRadius: 10, overflow: 'hidden', background: '#f9f9f9' },
  moneySym: { padding: '10px 10px', color: '#71717a', fontSize: 14, borderRight: '1px solid rgba(0,0,0,0.08)' },
  moneyInput: { flex: 1, border: 'none', padding: '10px 10px', fontSize: 15, color: '#18181b', outline: 'none', background: 'transparent', fontFamily: 'inherit' },
  input: { border: '1px solid rgba(0,0,0,0.12)', borderRadius: 10, padding: '10px 12px', fontSize: 15, color: '#18181b', background: '#f9f9f9', outline: 'none', fontFamily: 'inherit' },
  textarea: { border: '1px solid rgba(0,0,0,0.12)', borderRadius: 10, padding: '10px 12px', fontSize: 14, color: '#18181b', background: '#f9f9f9', resize: 'vertical', outline: 'none', fontFamily: 'inherit' },

  subtotal: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4, padding: '12px 14px', background: '#f4f4f5', borderRadius: 10 },

  actions: { display: 'flex', gap: 10, marginTop: 22 },
  primaryBtn: { flex: 1, background: '#212121', color: '#fff', border: 'none', borderRadius: 12, padding: '13px', fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  ghostBtn: { background: 'none', border: '1px solid rgba(0,0,0,0.14)', borderRadius: 12, padding: '13px 20px', fontSize: 14, cursor: 'pointer', color: '#71717a', fontFamily: 'inherit' },
  success: { color: '#10b981', fontSize: 13, marginTop: 10 },
  errorMsg: { color: '#ff3b30', fontSize: 13, marginTop: 10 },

  navRow: { display: 'flex', justifyContent: 'space-between', marginTop: 12 },
  navBtn: { background: 'none', border: 'none', padding: '8px 0', fontSize: 14, cursor: 'pointer', color: '#71717a', fontFamily: 'inherit' },

  /* Dashboard column */
  bigCard: { background: '#fff', borderRadius: 12, padding: '20px 22px', border: '1px solid #e4e4e7' },
  bigCardLabel: { fontSize: 11, fontWeight: 500, color: '#71717a', letterSpacing: '0.04em', textTransform: 'uppercase', margin: '0 0 6px' },
  bigCardValue: { fontSize: 32, fontWeight: 700, color: '#18181b', letterSpacing: '-0.03em', margin: '0 0 4px' },
  bigCardSub: { fontSize: 11, color: '#a1a1aa', margin: 0 },

  breakdownCard: { background: '#fff', borderRadius: 16, padding: '18px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.05)' },
  breakTitle: { fontSize: 12, fontWeight: 600, color: '#18181b', margin: '0 0 14px', letterSpacing: '-0.01em' },
  countGrid: { display: 'flex', gap: 10 },
}

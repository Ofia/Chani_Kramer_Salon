/**
 * Daily Entry — Tzipora's guided data entry flow.
 *
 * Step 1: Revenue (W&S, Wigs, Repairs, Other)
 * Step 2: Payment methods (Cash, QuickPay, CC, Check, Zelle)
 * Step 3: Activity counts (new wigs, paid in full, Chani cuts)
 * Step 4: Review & submit
 *
 * If a record already exists for today, it loads it for editing.
 * If the day is locked, show read-only view.
 */

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'

type FormData = {
  summary_date: string
  total_wash_set: string
  total_wig_sales: string
  total_repairs: string
  total_other: string
  cash_collected: string
  quickpay_collected: string
  cc_collected: string
  check_collected: string
  zelle_collected: string
  new_wigs_sold: string
  wigs_paid_full: string
  chani_cuts: string
  notes: string
}

const EMPTY_FORM: FormData = {
  summary_date: new Date().toISOString().split('T')[0],
  total_wash_set: '',
  total_wig_sales: '',
  total_repairs: '',
  total_other: '',
  cash_collected: '',
  quickpay_collected: '',
  cc_collected: '',
  check_collected: '',
  zelle_collected: '',
  new_wigs_sold: '',
  wigs_paid_full: '',
  chani_cuts: '',
  notes: '',
}

const STEPS = ['Revenue', 'Payments', 'Activity', 'Review']

export default function DailyEntryPage() {
  const [step, setStep]   = useState(0)
  const [form, setForm]   = useState<FormData>(EMPTY_FORM)
  const [saved, setSaved] = useState(false)
  const qc = useQueryClient()

  const { data: existing, isLoading } = useQuery({
    queryKey: ['daily-summary', form.summary_date],
    queryFn: () => api.get(`/daily-summary/${form.summary_date}`).then(r => r.data).catch(() => null),
  })

  // Pre-fill form if record already exists
  useEffect(() => {
    if (existing) {
      setForm(prev => ({
        ...prev,
        total_wash_set:     String(existing.total_wash_set),
        total_wig_sales:    String(existing.total_wig_sales),
        total_repairs:      String(existing.total_repairs),
        total_other:        String(existing.total_other),
        cash_collected:     String(existing.cash_collected),
        quickpay_collected: String(existing.quickpay_collected),
        cc_collected:       String(existing.cc_collected),
        check_collected:    String(existing.check_collected),
        zelle_collected:    String(existing.zelle_collected),
        new_wigs_sold:      String(existing.new_wigs_sold),
        wigs_paid_full:     String(existing.wigs_paid_full),
        chani_cuts:         String(existing.chani_cuts),
        notes:              existing.notes || '',
      }))
    }
  }, [existing])

  const mutation = useMutation({
    mutationFn: (data: object) =>
      existing
        ? api.patch(`/daily-summary/${form.summary_date}`, data)
        : api.post('/daily-summary', data),
    onSuccess: () => {
      setSaved(true)
      qc.invalidateQueries({ queryKey: ['daily-summary'] })
      setTimeout(() => setSaved(false), 3000)
    },
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
    const payload = {
      summary_date:       form.summary_date,
      total_wash_set:     parseFloat(form.total_wash_set)  || 0,
      total_wig_sales:    parseFloat(form.total_wig_sales) || 0,
      total_repairs:      parseFloat(form.total_repairs)   || 0,
      total_other:        parseFloat(form.total_other)     || 0,
      cash_collected:     parseFloat(form.cash_collected)  || 0,
      quickpay_collected: parseFloat(form.quickpay_collected) || 0,
      cc_collected:       parseFloat(form.cc_collected)    || 0,
      check_collected:    parseFloat(form.check_collected) || 0,
      zelle_collected:    parseFloat(form.zelle_collected) || 0,
      new_wigs_sold:      parseInt(form.new_wigs_sold)     || 0,
      wigs_paid_full:     parseInt(form.wigs_paid_full)    || 0,
      chani_cuts:         parseInt(form.chani_cuts)        || 0,
      notes:              form.notes || null,
    }
    mutation.mutate(payload)
  }

  if (isLoading) return <p style={{ color: '#6A6560' }}>Loading…</p>

  const isLocked = existing?.is_locked

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>Daily Entry</h1>
          <input
            type="date"
            value={form.summary_date}
            onChange={e => setForm({ ...EMPTY_FORM, summary_date: e.target.value })}
            style={styles.dateInput}
            disabled={isLocked}
          />
        </div>
        {isLocked && <span style={styles.lockedBadge}>Locked</span>}
      </header>

      {isLocked ? (
        <LockedView data={existing} />
      ) : (
        <>
          {/* Step indicators */}
          <div style={styles.steps}>
            {STEPS.map((s, i) => (
              <button
                key={s}
                onClick={() => setStep(i)}
                style={{ ...styles.stepBtn, ...(step === i ? styles.stepBtnActive : {}) }}
              >
                <span style={styles.stepNum}>{i + 1}</span>
                {s}
              </button>
            ))}
          </div>

          {/* Step content */}
          <div style={styles.card}>
            {step === 0 && (
              <Step title="Revenue">
                <MoneyField label="Wash & Set"  value={form.total_wash_set}  onChange={v => set('total_wash_set', v)} />
                <MoneyField label="Wig Sales"   value={form.total_wig_sales} onChange={v => set('total_wig_sales', v)} />
                <MoneyField label="Repairs"     value={form.total_repairs}   onChange={v => set('total_repairs', v)} />
                <MoneyField label="Other"       value={form.total_other}     onChange={v => set('total_other', v)} />
                <div style={styles.subtotal}>
                  Total Revenue: <strong>${numericTotal('total_wash_set','total_wig_sales','total_repairs','total_other').toFixed(2)}</strong>
                </div>
              </Step>
            )}

            {step === 1 && (
              <Step title="Payment Methods">
                <MoneyField label="Cash"        value={form.cash_collected}     onChange={v => set('cash_collected', v)} />
                <MoneyField label="QuickPay"    value={form.quickpay_collected} onChange={v => set('quickpay_collected', v)} />
                <MoneyField label="Credit Card" value={form.cc_collected}       onChange={v => set('cc_collected', v)} />
                <MoneyField label="Check"       value={form.check_collected}    onChange={v => set('check_collected', v)} />
                <MoneyField label="Zelle"       value={form.zelle_collected}    onChange={v => set('zelle_collected', v)} />
                <div style={styles.subtotal}>
                  Total Collected: <strong>${numericTotal('cash_collected','quickpay_collected','cc_collected','check_collected','zelle_collected').toFixed(2)}</strong>
                </div>
              </Step>
            )}

            {step === 2 && (
              <Step title="Activity">
                <CountField label="New Wigs Sold"     value={form.new_wigs_sold}  onChange={v => set('new_wigs_sold', v)} />
                <CountField label="Wigs Paid in Full" value={form.wigs_paid_full} onChange={v => set('wigs_paid_full', v)} />
                <CountField label="Chani Cuts"        value={form.chani_cuts}     onChange={v => set('chani_cuts', v)} />
                <div style={styles.field}>
                  <label style={styles.label}>Notes (optional)</label>
                  <textarea
                    value={form.notes}
                    onChange={e => set('notes', e.target.value)}
                    style={styles.textarea}
                    rows={3}
                    placeholder="Any notes for today…"
                  />
                </div>
              </Step>
            )}

            {step === 3 && (
              <Step title="Review & Save">
                <ReviewRow label="Wash & Set"         value={`$${form.total_wash_set || '0'}`} />
                <ReviewRow label="Wig Sales"          value={`$${form.total_wig_sales || '0'}`} />
                <ReviewRow label="Repairs"            value={`$${form.total_repairs || '0'}`} />
                <ReviewRow label="Cash Collected"     value={`$${form.cash_collected || '0'}`} />
                <ReviewRow label="QuickPay"           value={`$${form.quickpay_collected || '0'}`} />
                <ReviewRow label="CC"                 value={`$${form.cc_collected || '0'}`} />
                <ReviewRow label="Zelle"              value={`$${form.zelle_collected || '0'}`} />
                <ReviewRow label="New Wigs Sold"      value={form.new_wigs_sold || '0'} />
                <ReviewRow label="Chani Cuts"         value={form.chani_cuts || '0'} />

                <div style={styles.actions}>
                  <button onClick={handleSubmit} disabled={mutation.isPending} style={styles.saveBtn}>
                    {mutation.isPending ? 'Saving…' : existing ? 'Update' : 'Save Day'}
                  </button>
                  {existing && !existing.is_locked && (
                    <button onClick={() => lockMutation.mutate()} disabled={lockMutation.isPending} style={styles.lockBtn}>
                      {lockMutation.isPending ? 'Locking…' : 'Lock Day'}
                    </button>
                  )}
                </div>

                {saved && <p style={styles.success}>Saved successfully.</p>}
                {mutation.isError && <p style={styles.errorMsg}>Error saving. Try again.</p>}
              </Step>
            )}
          </div>

          {/* Prev / Next */}
          <div style={styles.nav}>
            {step > 0 && (
              <button onClick={() => setStep(s => s - 1)} style={styles.navBtn}>← Previous</button>
            )}
            {step < STEPS.length - 1 && (
              <button onClick={() => setStep(s => s + 1)} style={{ ...styles.navBtn, ...styles.navBtnNext }}>
                Next →
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ── Sub-components ───────────────────────────────────────────

function Step({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 style={styles.stepTitle}>{title}</h2>
      <div style={styles.fields}>{children}</div>
    </div>
  )
}

function MoneyField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div style={styles.field}>
      <label style={styles.label}>{label}</label>
      <div style={styles.moneyWrapper}>
        <span style={styles.moneySym}>$</span>
        <input
          type="number"
          min="0"
          step="0.01"
          value={value}
          onChange={e => onChange(e.target.value)}
          style={styles.moneyInput}
          placeholder="0.00"
        />
      </div>
    </div>
  )
}

function CountField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div style={styles.field}>
      <label style={styles.label}>{label}</label>
      <input
        type="number"
        min="0"
        step="1"
        value={value}
        onChange={e => onChange(e.target.value)}
        style={styles.input}
        placeholder="0"
      />
    </div>
  )
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.reviewRow}>
      <span style={styles.reviewLabel}>{label}</span>
      <span style={styles.reviewValue}>{value}</span>
    </div>
  )
}

function LockedView({ data }: { data: any }) {
  const fmt = (n: number) => `$${Number(n).toFixed(2)}`
  return (
    <div style={styles.lockedView}>
      <p style={styles.lockedMsg}>This day has been locked and cannot be edited.</p>
      <div style={styles.lockedGrid}>
        <ReviewRow label="Wash & Set"  value={fmt(data.total_wash_set)} />
        <ReviewRow label="Wig Sales"   value={fmt(data.total_wig_sales)} />
        <ReviewRow label="Repairs"     value={fmt(data.total_repairs)} />
        <ReviewRow label="Total"       value={fmt(data.total_revenue)} />
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: { maxWidth: 640 },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 },
  title: { fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 32, fontWeight: 500, color: '#0E0C09', margin: '0 0 8px' },
  dateInput: { border: '1px solid rgba(14,12,9,0.14)', borderRadius: 2, padding: '6px 10px', fontSize: 14, color: '#0E0C09', background: '#fff' },
  lockedBadge: { background: '#0E0C09', color: '#fff', padding: '4px 12px', borderRadius: 2, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase' },
  steps: { display: 'flex', gap: 4, marginBottom: 24 },
  stepBtn: { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', border: '1px solid rgba(14,12,9,0.14)', borderRadius: 2, background: '#fff', cursor: 'pointer', fontSize: 13, color: '#6A6560' },
  stepBtnActive: { background: '#0E0C09', color: '#fff', borderColor: '#0E0C09' },
  stepNum: { width: 18, height: 18, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700 },
  card: { background: '#fff', border: '1px solid rgba(14,12,9,0.07)', borderRadius: 2, padding: '28px 32px' },
  stepTitle: { fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 22, fontWeight: 500, color: '#0E0C09', margin: '0 0 24px' },
  fields: { display: 'flex', flexDirection: 'column', gap: 16 },
  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: 11, fontWeight: 600, color: '#6A6560', letterSpacing: '0.08em', textTransform: 'uppercase' },
  moneyWrapper: { display: 'flex', alignItems: 'center', border: '1px solid rgba(14,12,9,0.14)', borderRadius: 2, overflow: 'hidden' },
  moneySym: { padding: '0 12px', color: '#6A6560', fontSize: 14, background: '#F3F1ED', borderRight: '1px solid rgba(14,12,9,0.14)', height: '100%', display: 'flex', alignItems: 'center' },
  moneyInput: { flex: 1, border: 'none', padding: '10px 12px', fontSize: 14, color: '#0E0C09', outline: 'none' },
  input: { border: '1px solid rgba(14,12,9,0.14)', borderRadius: 2, padding: '10px 12px', fontSize: 14, color: '#0E0C09' },
  textarea: { border: '1px solid rgba(14,12,9,0.14)', borderRadius: 2, padding: '10px 12px', fontSize: 14, color: '#0E0C09', resize: 'vertical' },
  subtotal: { marginTop: 8, padding: '12px 16px', background: '#F3F1ED', borderRadius: 2, fontSize: 14, color: '#6A6560' },
  reviewRow: { display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid rgba(14,12,9,0.07)', fontSize: 14 },
  reviewLabel: { color: '#6A6560' },
  reviewValue: { color: '#0E0C09', fontWeight: 500 },
  actions: { display: 'flex', gap: 12, marginTop: 24 },
  saveBtn: { flex: 1, background: '#0E0C09', color: '#fff', border: 'none', borderRadius: 2, padding: '12px', fontSize: 14, cursor: 'pointer', fontWeight: 500 },
  lockBtn: { background: 'none', border: '1px solid rgba(14,12,9,0.2)', borderRadius: 2, padding: '12px 20px', fontSize: 14, cursor: 'pointer', color: '#6A6560' },
  success: { color: '#27ae60', fontSize: 13, marginTop: 8 },
  errorMsg: { color: '#c0392b', fontSize: 13, marginTop: 8 },
  nav: { display: 'flex', justifyContent: 'space-between', marginTop: 16 },
  navBtn: { background: 'none', border: '1px solid rgba(14,12,9,0.14)', borderRadius: 2, padding: '8px 16px', fontSize: 13, cursor: 'pointer', color: '#6A6560' },
  navBtnNext: { marginLeft: 'auto' },
  lockedView: { background: '#fff', border: '1px solid rgba(14,12,9,0.07)', borderRadius: 2, padding: '32px' },
  lockedMsg: { color: '#6A6560', fontSize: 14, marginBottom: 24 },
  lockedGrid: { display: 'flex', flexDirection: 'column' },
}

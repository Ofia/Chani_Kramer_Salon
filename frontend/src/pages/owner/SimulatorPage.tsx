/**
 * Simulator — owner "what if" tool.
 *
 * Owner types in hypothetical revenue / expenses / payroll numbers
 * and sees the full financial breakdown update in real time.
 * Nothing is saved — this is a scratch pad.
 *
 * Great for: "what if we had $10k more in wig sales this month?"
 */

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { api } from '../../lib/api'

type Result = {
  net_profit: number; bank_portion: number; owner_portion: number
  bank_tithes: number; owner_tithes: number; total_tithes: number; final_take_home: number
}

function fmt(n: number | string) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(n))
}

export default function SimulatorPage() {
  const [revenue,  setRevenue]  = useState('')
  const [expenses, setExpenses] = useState('')
  const [payroll,  setPayroll]  = useState('')
  const [result,   setResult]   = useState<Result | null>(null)

  const mutation = useMutation({
    mutationFn: (data: object) => api.post('/financials/simulate', data).then(r => r.data),
    onSuccess: (data: Result) => setResult(data),
  })

  function handleRun() {
    mutation.mutate({
      total_revenue:  parseFloat(revenue)  || 0,
      total_expenses: parseFloat(expenses) || 0,
      total_payroll:  parseFloat(payroll)  || 0,
    })
  }

  // Live preview — updates as you type (no network call needed — pure math)
  const rev  = parseFloat(revenue)  || 0
  const exp  = parseFloat(expenses) || 0
  const pay  = parseFloat(payroll)  || 0
  const net  = rev - exp - pay
  const bank = net * 0.40
  const own  = net * 0.60
  const bt   = (bank * 0.91125) * 0.10
  const ot   = own * 0.10
  const takeHome = net - bt - ot

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>Simulator</h1>
          <p style={styles.subtitle}>Change the numbers and see what happens.</p>
        </div>
      </header>

      <div style={styles.layout}>
        {/* Inputs */}
        <div style={styles.inputs}>
          <h2 style={styles.inputTitle}>Inputs</h2>

          <SliderField
            label="Total Revenue"
            value={revenue}
            onChange={setRevenue}
            min={0} max={100000} step={500}
          />
          <SliderField
            label="Total Expenses"
            value={expenses}
            onChange={setExpenses}
            min={0} max={50000} step={100}
          />
          <SliderField
            label="Total Payroll"
            value={payroll}
            onChange={setPayroll}
            min={0} max={50000} step={100}
          />
        </div>

        {/* Live output */}
        <div style={styles.output}>
          <h2 style={styles.inputTitle}>Result (live)</h2>

          <div style={styles.resultCard}>
            <ResultRow label="Revenue"         value={fmt(rev)} />
            <ResultRow label="Expenses"        value={`(${fmt(exp)})`} negative />
            <ResultRow label="Payroll"         value={`(${fmt(pay)})`} negative />
            <ResultRow label="Net Profit"      value={fmt(net)} divider bold />
            <ResultRow label="Bank (40%)"      value={fmt(bank)} />
            <ResultRow label="Owner (60%)"     value={fmt(own)} />
            <ResultRow label="Bank Tithes"     value={`(${fmt(bt)})`} negative />
            <ResultRow label="Owner Tithes"    value={`(${fmt(ot)})`} negative />
            <ResultRow label="Final Take-Home" value={fmt(takeHome)} divider bold accent />
          </div>

          <p style={styles.disclaimer}>
            This is a simulation only. Results are not saved.
          </p>
        </div>
      </div>
    </div>
  )
}

// ── Sub-components ───────────────────────────────────────────

function SliderField({ label, value, onChange, min, max, step }: {
  label: string; value: string; onChange: (v: string) => void
  min: number; max: number; step: number
}) {
  const num = parseFloat(value) || 0
  return (
    <div style={styles.sliderField}>
      <div style={styles.sliderHeader}>
        <label style={styles.label}>{label}</label>
        <div style={styles.moneyWrapper}>
          <span style={styles.moneySym}>$</span>
          <input
            type="number" min={min} step={step} value={value}
            onChange={e => onChange(e.target.value)}
            style={styles.moneyInput} placeholder="0"
          />
        </div>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={num}
        onChange={e => onChange(e.target.value)}
        style={styles.slider}
      />
      <div style={styles.sliderRange}>
        <span>${min.toLocaleString()}</span>
        <span>${max.toLocaleString()}</span>
      </div>
    </div>
  )
}

function ResultRow({ label, value, negative = false, bold = false, accent = false, divider = false }: {
  label: string; value: string; negative?: boolean; bold?: boolean; accent?: boolean; divider?: boolean
}) {
  return (
    <div style={{ ...styles.resRow, ...(divider ? styles.resRowDivider : {}), ...(bold ? styles.resRowBold : {}) }}>
      <span style={styles.resLabel}>{label}</span>
      <span style={{
        ...styles.resValue,
        ...(negative ? { color: '#c0392b' } : {}),
        ...(accent ? { color: '#27ae60', fontSize: 20 } : {}),
      }}>
        {value}
      </span>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: { maxWidth: 1000 },
  header: { marginBottom: 36 },
  title: { fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 36, fontWeight: 500, color: '#0E0C09', margin: 0 },
  subtitle: { color: '#6A6560', fontSize: 14, marginTop: 4 },
  layout: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32, alignItems: 'start' },
  inputs: { background: '#fff', border: '1px solid rgba(14,12,9,0.07)', borderRadius: 2, padding: '28px' },
  output: { background: '#fff', border: '1px solid rgba(14,12,9,0.07)', borderRadius: 2, padding: '28px' },
  inputTitle: { fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 20, fontWeight: 500, color: '#0E0C09', margin: '0 0 24px' },
  sliderField: { marginBottom: 28 },
  sliderHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  label: { fontSize: 11, fontWeight: 600, color: '#6A6560', letterSpacing: '0.08em', textTransform: 'uppercase' },
  moneyWrapper: { display: 'flex', alignItems: 'center', border: '1px solid rgba(14,12,9,0.14)', borderRadius: 2, overflow: 'hidden' },
  moneySym: { padding: '0 8px', color: '#6A6560', fontSize: 12, background: '#F3F1ED', borderRight: '1px solid rgba(14,12,9,0.14)' },
  moneyInput: { border: 'none', padding: '6px 8px', fontSize: 13, color: '#0E0C09', outline: 'none', width: 90 },
  slider: { width: '100%', accentColor: '#0E0C09' },
  sliderRange: { display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#C0BAB4', marginTop: 4 },
  resultCard: { display: 'flex', flexDirection: 'column' },
  resRow: { display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid rgba(14,12,9,0.05)', fontSize: 14 },
  resRowDivider: { borderTop: '1px solid rgba(14,12,9,0.14)', borderBottom: '1px solid rgba(14,12,9,0.14)', padding: '12px 0', marginTop: 4 },
  resRowBold: { fontWeight: 600 },
  resLabel: { color: '#6A6560' },
  resValue: { color: '#0E0C09', fontWeight: 500 },
  disclaimer: { fontSize: 11, color: '#C0BAB4', marginTop: 20, textAlign: 'center', letterSpacing: '0.04em' },
}

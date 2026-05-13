import { useState } from 'react'
import { api } from '../../lib/api'
import { useMutation } from '@tanstack/react-query'

function fmt(n: number | string) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(n))
}

export default function SimulatorPage() {
  const [revenue,  setRevenue]  = useState('')
  const [expenses, setExpenses] = useState('')
  const [payroll,  setPayroll]  = useState('')

  const rev  = parseFloat(revenue)  || 0
  const exp  = parseFloat(expenses) || 0
  const pay  = parseFloat(payroll)  || 0
  const net  = rev - exp - pay
  const bank = net * 0.40
  const own  = net * 0.60
  const bt   = (bank * 0.91125) * 0.10
  const ot   = own * 0.10
  const takeHome = net - bt - ot

  useMutation({ mutationFn: (data: object) => api.post('/financials/simulate', data).then(r => r.data) })

  return (
    <div style={s.page}>
      <header style={s.header}>
        <h1 style={s.title}>Simulator</h1>
        <p style={s.subtitle}>Change numbers, see what happens. Nothing is saved.</p>
      </header>

      <div style={s.layout}>
        {/* Left — inputs */}
        <div>
          <p style={s.sectionLabel}>Inputs</p>
          <div style={s.card}>
            <SliderField label="Total Revenue"   value={revenue}  onChange={setRevenue}  min={0} max={100000} step={500} />
            <div style={s.divider} />
            <SliderField label="Total Expenses"  value={expenses} onChange={setExpenses} min={0} max={50000}  step={100} />
            <div style={s.divider} />
            <SliderField label="Total Payroll"   value={payroll}  onChange={setPayroll}  min={0} max={50000}  step={100} />
          </div>
        </div>

        {/* Right — live results */}
        <div>
          <p style={s.sectionLabel}>Result (live)</p>
          <div style={s.resultCard}>
            <ResultRow label="Revenue"         value={fmt(rev)} />
            <ResultRow label="Expenses"        value={fmt(exp)} red />
            <ResultRow label="Payroll"         value={fmt(pay)} red />
            <ResultRow label="Net Profit"      value={fmt(net)} bold />
            <ResultRow label="Bank (40%)"      value={fmt(bank)} />
            <ResultRow label="Owner (60%)"     value={fmt(own)} />
            <ResultRow label="Bank Tithes"     value={fmt(bt)} red />
            <ResultRow label="Owner Tithes"    value={fmt(ot)} red />
            <ResultRow label="Final Take-Home" value={fmt(takeHome)} bold green last />
          </div>
          <p style={s.disclaimer}>Simulation only — results are not saved.</p>
        </div>
      </div>
    </div>
  )
}

function SliderField({ label, value, onChange, min, max, step }: {
  label: string; value: string; onChange: (v: string) => void; min: number; max: number; step: number
}) {
  const num = parseFloat(value) || 0
  return (
    <div style={s.sliderField}>
      <div style={s.sliderHeader}>
        <span style={s.sliderLabel}>{label}</span>
        <div style={s.moneyBox}>
          <span style={s.sym}>$</span>
          <input type="number" min={min} step={step} value={value}
            onChange={e => onChange(e.target.value)}
            style={s.moneyInput} placeholder="0" />
        </div>
      </div>
      <input type="range" min={min} max={max} step={step} value={num}
        onChange={e => onChange(e.target.value)} style={s.slider} />
      <div style={s.sliderRange}>
        <span>${min.toLocaleString()}</span>
        <span>${max.toLocaleString()}</span>
      </div>
    </div>
  )
}

function ResultRow({ label, value, red = false, green = false, bold = false, last = false }: {
  label: string; value: string; red?: boolean; green?: boolean; bold?: boolean; last?: boolean
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 0', borderBottom: last ? 'none' : '1px solid rgba(0,0,0,0.06)', background: bold ? 'rgba(0,0,0,0.02)' : 'transparent' }}>
      <span style={{ fontSize: 14, color: '#71717a', fontWeight: bold ? 600 : 400 }}>{label}</span>
      <span style={{ fontSize: bold ? 17 : 14, fontWeight: bold ? 700 : 500, color: red ? '#ff3b30' : green ? '#10b981' : '#18181b', letterSpacing: '-0.02em' }}>
        {red ? `(${value})` : value}
      </span>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  page: { maxWidth: 940 },
  header: { marginBottom: 32, paddingBottom: 24, borderBottom: '1px solid rgba(0,0,0,0.07)' },
  title: { fontSize: 26, fontWeight: 700, color: '#18181b', margin: '0 0 4px', letterSpacing: '-0.03em' },
  subtitle: { color: '#71717a', fontSize: 13, margin: 0 },

  layout: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'start' },
  sectionLabel: { fontSize: 11, fontWeight: 600, color: '#a1a1aa', letterSpacing: '0.06em', textTransform: 'uppercase', margin: '0 0 8px' },

  card: { background: '#fff', borderRadius: 16, padding: '8px 24px', boxShadow: '0 1px 4px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.05)' },
  divider: { height: 1, background: 'rgba(0,0,0,0.05)', margin: '0 -24px' },

  sliderField: { padding: '20px 0' },
  sliderHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sliderLabel: { fontSize: 14, fontWeight: 500, color: '#18181b', letterSpacing: '-0.01em' },
  moneyBox: { display: 'flex', alignItems: 'center', border: '1px solid rgba(0,0,0,0.12)', borderRadius: 8, overflow: 'hidden', background: '#f9f9f9' },
  sym: { padding: '0 8px', color: '#71717a', fontSize: 13, borderRight: '1px solid rgba(0,0,0,0.08)', paddingTop: 5, paddingBottom: 5 },
  moneyInput: { border: 'none', padding: '5px 8px', fontSize: 13, color: '#18181b', outline: 'none', background: 'transparent', fontFamily: 'inherit', width: 80 },
  slider: { width: '100%', accentColor: '#ec4899', marginBottom: 4 },
  sliderRange: { display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#a1a1aa' },

  resultCard: { background: '#fff', borderRadius: 16, padding: '4px 24px', boxShadow: '0 1px 4px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.05)' },
  disclaimer: { fontSize: 11, color: '#a1a1aa', marginTop: 12, textAlign: 'center' },
}

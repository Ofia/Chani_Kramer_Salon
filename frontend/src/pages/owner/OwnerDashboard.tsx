import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'

function fmt(n: number | string) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(n))
}

export default function OwnerDashboard() {
  const [view, setView] = useState<'summary' | 'detailed'>('summary')
  const now = new Date()

  const { data: monthly, isLoading } = useQuery({
    queryKey: ['monthly-summary', now.getFullYear(), now.getMonth() + 1],
    queryFn: () => api.get(`/financials/monthly-summary?year=${now.getFullYear()}&month=${now.getMonth() + 1}`).then(r => r.data),
  })

  const { data: snapshots = [] } = useQuery({
    queryKey: ['snapshots-recent'],
    queryFn: () => {
      const end   = now.toISOString().split('T')[0]
      const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      return api.get(`/financials/snapshots?start_date=${start}&end_date=${end}`).then(r => r.data)
    },
  })

  const monthLabel = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  return (
    <div>
      <header style={s.header}>
        <div>
          <h1 style={s.title}>Overview</h1>
          <p style={s.subtitle}>{monthLabel}</p>
        </div>
        <div style={s.segmented}>
          <button onClick={() => setView('summary')}  style={{ ...s.seg, ...(view === 'summary'  ? s.segActive : {}) }}>Summary</button>
          <button onClick={() => setView('detailed')} style={{ ...s.seg, ...(view === 'detailed' ? s.segActive : {}) }}>Detailed</button>
        </div>
      </header>

      {isLoading ? (
        <p style={s.muted}>Loading…</p>
      ) : !monthly || monthly.days_with_data === 0 ? (
        <div style={s.emptyCard}><p style={s.emptyText}>No data yet this month.</p></div>
      ) : (
        <>
          {/* Top KPI strip */}
          <div style={s.kpiGrid}>
            <KpiCard label="Revenue"    value={fmt(monthly.total_revenue)} />
            <KpiCard label="Expenses"   value={fmt(monthly.total_expenses)} />
            <KpiCard label="Payroll"    value={fmt(monthly.total_payroll)} />
            <KpiCard label="Net Profit" value={fmt(monthly.net_profit)} dark />
          </div>

          {/* Summary cards */}
          {view === 'summary' && (
            <div style={s.summaryGrid}>
              <MetricCard label="Bank Portion (40%)"  value={fmt(monthly.bank_portion)} />
              <MetricCard label="Owner Portion (60%)" value={fmt(monthly.owner_portion)} />
              <MetricCard label="Total Tithes"        value={fmt(monthly.total_tithes)} />
              <MetricCard label="Final Take-Home"     value={fmt(monthly.final_take_home)} green />
            </div>
          )}

          {/* Charts */}
          <div style={s.chartsGrid}>
            <div style={s.chartCard}>
              <p style={s.chartTitle}>Revenue — Last 30 Days</p>
              {snapshots.length === 0 ? (
                <div style={s.chartEmpty}>No data yet.</div>
              ) : (
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={snapshots} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(13,13,13,0.06)" />
                    <XAxis dataKey="snapshot_date" tick={{ fontSize: 10, fill: 'rgba(13,13,13,0.42)', fontFamily: 'Inter' }} tickFormatter={d => d.slice(5)} />
                    <YAxis tick={{ fontSize: 10, fill: 'rgba(13,13,13,0.42)', fontFamily: 'Inter' }} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} width={38} />
                    <Tooltip contentStyle={{ border: '1px solid rgba(13,13,13,0.09)', borderRadius: 10, fontSize: 12, fontFamily: 'Inter' }}
                      formatter={(v: number) => [`$${Number(v).toLocaleString()}`, 'Revenue']} />
                    <Line type="monotone" dataKey="total_revenue" stroke="#DF5198" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>

            <div style={s.chartCard}>
              <p style={s.chartTitle}>Revenue by Stream — {now.toLocaleDateString('en-US', { month: 'long' })}</p>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart
                  data={[
                    { name: 'Wash & Set', amount: Number(monthly.total_wash_set ?? 0) },
                    { name: 'Wig Sales',  amount: Number(monthly.total_wig_sales ?? 0) },
                    { name: 'Repairs',    amount: Number(monthly.total_repairs ?? 0) },
                  ]}
                  margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(13,13,13,0.06)" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'rgba(13,13,13,0.42)', fontFamily: 'Inter' }} />
                  <YAxis tick={{ fontSize: 10, fill: 'rgba(13,13,13,0.42)', fontFamily: 'Inter' }} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} width={38} />
                  <Tooltip contentStyle={{ border: '1px solid rgba(13,13,13,0.09)', borderRadius: 10, fontSize: 12, fontFamily: 'Inter' }}
                    formatter={(v: number) => [`$${Number(v).toLocaleString()}`, 'Revenue']} />
                  <Bar dataKey="amount" fill="#DF5198" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Detailed breakdown */}
          {view === 'detailed' && (
            <div>
              <p style={s.sectionLabel}>Financial Breakdown</p>
              <div style={s.breakdownCard}>
                <BreakRow label="Total Revenue"       value={fmt(monthly.total_revenue)} />
                <BreakRow label="Total Expenses"      value={fmt(monthly.total_expenses)} red />
                <BreakRow label="Total Payroll"       value={fmt(monthly.total_payroll)} red />
                <BreakRow label="Net Profit"          value={fmt(monthly.net_profit)} bold />
                <BreakRow label="Bank Portion (40%)"  value={fmt(monthly.bank_portion)} />
                <BreakRow label="Owner Portion (60%)" value={fmt(monthly.owner_portion)} />
                <BreakRow label="Bank Tithes"         value={fmt(monthly.bank_tithes)} red />
                <BreakRow label="Owner Tithes"        value={fmt(monthly.owner_tithes)} red />
                <BreakRow label="Final Take-Home"     value={fmt(monthly.final_take_home)} bold green last />
              </div>

              {snapshots.length > 0 && (
                <>
                  <p style={{ ...s.sectionLabel, marginTop: 28 }}>Daily Snapshots ({snapshots.length} days)</p>
                  <div style={s.snapshotCard}>
                    <div style={s.snapshotHeader}>
                      <span style={{ flex: 2 }}>Date</span>
                      <span style={{ flex: 1, textAlign: 'right' }}>Revenue</span>
                      <span style={{ flex: 1, textAlign: 'right' }}>Net Profit</span>
                      <span style={{ flex: 1, textAlign: 'right' }}>Take-Home</span>
                    </div>
                    {snapshots.map((snap: any, i: number) => (
                      <div key={snap.id} style={{ ...s.snapshotRow, borderBottom: i < snapshots.length - 1 ? '1px solid rgba(13,13,13,0.06)' : 'none' }}>
                        <span style={{ flex: 2, color: 'rgba(13,13,13,0.42)', fontSize: 13, fontFamily: 'Inter' }}>{snap.snapshot_date}</span>
                        <span style={{ flex: 1, textAlign: 'right', fontSize: 13, color: '#0d0d0d' }}>{fmt(snap.total_revenue)}</span>
                        <span style={{ flex: 1, textAlign: 'right', fontSize: 13, fontWeight: 500, color: '#0d0d0d' }}>{fmt(snap.net_profit)}</span>
                        <span style={{ flex: 1, textAlign: 'right', fontSize: 13, fontWeight: 600, color: '#16a34a' }}>{fmt(snap.final_take_home)}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── Sub-components ───────────────────────────────────────────

function KpiCard({ label, value, dark = false }: { label: string; value: string; dark?: boolean }) {
  return (
    <div style={{ ...s.kpiCard, ...(dark ? s.kpiCardDark : {}) }}>
      <p style={{ ...s.kpiLabel, ...(dark ? { color: 'rgba(255,255,255,0.5)' } : {}) }}>{label}</p>
      <p style={{ ...s.kpiValue, ...(dark ? { color: '#fff' } : {}) }}>{value}</p>
    </div>
  )
}

function MetricCard({ label, value, green = false }: { label: string; value: string; green?: boolean }) {
  return (
    <div style={s.metricCard}>
      <p style={s.metricLabel}>{label}</p>
      <p style={{ ...s.metricValue, ...(green ? { color: '#16a34a' } : {}) }}>{value}</p>
    </div>
  )
}

function BreakRow({ label, value, red = false, green = false, bold = false, last = false }: {
  label: string; value: string; red?: boolean; green?: boolean; bold?: boolean; last?: boolean
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 20px', borderBottom: last ? 'none' : '1px solid rgba(13,13,13,0.06)', background: bold ? '#f7f7f5' : 'transparent' }}>
      <span style={{ fontSize: 14, color: 'rgba(13,13,13,0.55)', fontWeight: bold ? 600 : 400 }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: bold ? 700 : 500, color: red ? '#dc2626' : green ? '#16a34a' : '#0d0d0d', letterSpacing: '-0.01em' }}>
        {red ? `(${value})` : value}
      </span>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32, paddingBottom: 24, borderBottom: '1px solid rgba(13,13,13,0.09)' },
  title: { fontSize: 26, fontWeight: 700, color: '#0d0d0d', margin: '0 0 4px', letterSpacing: '-0.03em' },
  subtitle: { color: 'rgba(13,13,13,0.42)', fontSize: 13, margin: 0, fontFamily: "'Inter', sans-serif" },
  muted: { color: 'rgba(13,13,13,0.42)', fontSize: 14 },

  segmented: { display: 'flex', background: 'rgba(13,13,13,0.06)', borderRadius: 10, padding: 3, gap: 2 },
  seg: { padding: '6px 20px', border: 'none', background: 'transparent', borderRadius: 8, fontSize: 13, fontWeight: 500, color: 'rgba(13,13,13,0.42)', cursor: 'pointer', fontFamily: "'Inter', sans-serif", transition: 'all 0.15s' },
  segActive: { background: '#fff', color: '#0d0d0d', boxShadow: '0 1px 4px rgba(0,0,0,0.10)' },

  kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 20 },
  kpiCard: { background: '#fff', borderRadius: 14, padding: '18px 20px', border: '1px solid rgba(13,13,13,0.09)', boxShadow: '0 2px 4px rgba(0,0,0,0.03)' },
  kpiCardDark: { background: '#0d0d0d', border: 'none', boxShadow: '0 2px 12px rgba(0,0,0,0.15)' },
  kpiLabel: { fontSize: 10, fontWeight: 600, color: 'rgba(13,13,13,0.42)', letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 8px', fontFamily: "'Inter', sans-serif" },
  kpiValue: { fontSize: 20, fontWeight: 700, color: '#0d0d0d', margin: 0, letterSpacing: '-0.03em' },

  summaryGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 24 },
  metricCard: { background: '#fff', borderRadius: 14, padding: '18px 20px', border: '1px solid rgba(13,13,13,0.09)', boxShadow: '0 2px 4px rgba(0,0,0,0.03)' },
  metricLabel: { fontSize: 10, fontWeight: 600, color: 'rgba(13,13,13,0.42)', letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 8px', fontFamily: "'Inter', sans-serif" },
  metricValue: { fontSize: 18, fontWeight: 700, color: '#0d0d0d', margin: 0, letterSpacing: '-0.02em' },

  chartsGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 28 },
  chartCard: { background: '#fff', borderRadius: 14, padding: '20px 20px', border: '1px solid rgba(13,13,13,0.09)', boxShadow: '0 2px 4px rgba(0,0,0,0.03)' },
  chartTitle: { fontSize: 10, fontWeight: 600, color: 'rgba(13,13,13,0.42)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 14, fontFamily: "'Inter', sans-serif" },
  chartEmpty: { height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(13,13,13,0.35)', fontSize: 13 },

  sectionLabel: { fontSize: 10, fontWeight: 600, color: 'rgba(13,13,13,0.42)', letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 8px', fontFamily: "'Inter', sans-serif" },
  breakdownCard: { background: '#fff', borderRadius: 14, overflow: 'hidden', border: '1px solid rgba(13,13,13,0.09)', boxShadow: '0 2px 4px rgba(0,0,0,0.03)', marginBottom: 0 },
  snapshotCard: { background: '#fff', borderRadius: 14, overflow: 'hidden', border: '1px solid rgba(13,13,13,0.09)', boxShadow: '0 2px 4px rgba(0,0,0,0.03)' },
  snapshotHeader: { display: 'flex', padding: '10px 20px', background: '#f7f7f5', fontSize: 10, fontWeight: 600, color: 'rgba(13,13,13,0.42)', letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: "'Inter', sans-serif" },
  snapshotRow: { display: 'flex', padding: '11px 20px' },

  emptyCard: { background: '#fff', borderRadius: 14, padding: 48, textAlign: 'center', border: '1px solid rgba(13,13,13,0.09)', boxShadow: '0 2px 4px rgba(0,0,0,0.03)' },
  emptyText: { color: 'rgba(13,13,13,0.42)', fontSize: 15, margin: 0 },
}

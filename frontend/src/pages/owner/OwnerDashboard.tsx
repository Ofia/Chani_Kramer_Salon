import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import {
  ResponsiveContainer,
  LineChart, Line,
  BarChart, Bar,
  PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts'

// Costal Glam palette
const STREAM_COLORS  = ['#DF5198', '#97BBE9', '#E3CD94']       // W&S, Wigs, Repairs
const COST_COLORS    = ['#DF5198', '#E3CD94', '#5581B1', '#97BBE9'] // Revenue, Expenses, Payroll, Profit
const SPLIT_COLORS   = ['#212121', '#97BBE9']                  // Bank, Owner

function fmt(n: number | string) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(n))
}
function fmtShort(n: number) {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`
  return `$${n.toFixed(0)}`
}

export default function OwnerDashboard() {
  const [view, setView] = useState<'analysis' | 'glance'>('analysis')
  const now = new Date()

  const { data: monthly, isLoading } = useQuery({
    queryKey: ['monthly-summary', now.getFullYear(), now.getMonth() + 1],
    queryFn: () =>
      api.get(`/financials/monthly-summary?year=${now.getFullYear()}&month=${now.getMonth() + 1}`)
        .then(r => r.data),
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

  // Always show the board — default to zeros when no data exists yet
  const m = {
    days_with_data:  monthly?.days_with_data  ?? 0,
    total_revenue:   monthly?.total_revenue   ?? 0,
    total_expenses:  monthly?.total_expenses  ?? 0,
    total_payroll:   monthly?.total_payroll   ?? 0,
    net_profit:      monthly?.net_profit      ?? 0,
    bank_portion:    monthly?.bank_portion    ?? 0,
    owner_portion:   monthly?.owner_portion   ?? 0,
    total_tithes:    monthly?.total_tithes    ?? 0,
    final_take_home: monthly?.final_take_home ?? 0,
    bank_tithes:     monthly?.bank_tithes     ?? 0,
    owner_tithes:    monthly?.owner_tithes    ?? 0,
    total_wash_set:  monthly?.total_wash_set  ?? 0,
    total_wig_sales: monthly?.total_wig_sales ?? 0,
    total_repairs:   monthly?.total_repairs   ?? 0,
  }
  const hasData = m.days_with_data > 0

  return (
    <div>
      <header style={s.header}>
        <div>
          <h1 style={s.title}>Main Board</h1>
          <p style={s.subtitle}>{monthLabel}</p>
        </div>
        <div style={s.segmented}>
          <button onClick={() => setView('analysis')} style={{ ...s.seg, ...(view === 'analysis' ? s.segActive : {}) }}>Analysis</button>
          <button onClick={() => setView('glance')}   style={{ ...s.seg, ...(view === 'glance'   ? s.segActive : {}) }}>At a Glance</button>
        </div>
      </header>

      {isLoading ? (
        <p style={s.muted}>Loading…</p>
      ) : (
        <>
          {/* ── No-data notice ── */}
          {!hasData && (
            <div style={s.noDataBanner}>
              <span style={s.noDataDot} />
              No daily entries yet for {monthLabel}. Data appears here once Tzipora submits daily records.
            </div>
          )}

          {/* ── KPI strip — always visible ── */}
          <div style={s.kpiGrid}>
            <KpiCard label="Revenue"    value={fmt(m.total_revenue)} />
            <KpiCard label="Expenses"   value={fmt(m.total_expenses)} />
            <KpiCard label="Payroll"    value={fmt(m.total_payroll)} />
            <KpiCard label="Net Profit" value={fmt(m.net_profit)} dark />
          </div>

          {view === 'analysis' && (
            <AnalysisTab monthly={m} snapshots={snapshots} now={now} />
          )}

          {view === 'glance' && (
            <GlanceTab monthly={m} />
          )}
        </>
      )}
    </div>
  )
}

// ── Analysis Tab ─────────────────────────────────────────────

function AnalysisTab({ monthly, snapshots, now }: { monthly: any; snapshots: any[]; now: Date }) {

  // Derived insights
  const bestDay    = snapshots.reduce((best: any, s: any) =>
    (!best || Number(s.total_revenue) > Number(best.total_revenue)) ? s : best, null)
  const avgRevenue = snapshots.length > 0
    ? snapshots.reduce((sum: number, s: any) => sum + Number(s.total_revenue), 0) / snapshots.length
    : 0
  const streams    = [
    { name: 'Wash & Set', v: Number(monthly.total_wash_set  ?? 0) },
    { name: 'Wig Sales',  v: Number(monthly.total_wig_sales ?? 0) },
    { name: 'Repairs',    v: Number(monthly.total_repairs   ?? 0) },
  ]
  const dominant = streams.reduce((a, b) => a.v > b.v ? a : b)

  return (
    <div>
      {/* ── Insights row ── */}
      <p style={s.sectionLabel}>Insights</p>
      <div style={s.insightGrid}>
        <InsightCard label="Avg Daily Revenue" value={fmtShort(avgRevenue)} sub="last 30 days" />
        <InsightCard label="Best Day"          value={fmtShort(Number(bestDay?.total_revenue ?? 0))} sub={bestDay?.snapshot_date ?? '—'} />
        <InsightCard label="Days Tracked"      value={String(monthly.days_with_data)} sub="this month" />
        <InsightCard label="Top Stream"        value={dominant.name} sub={fmt(dominant.v)} accent />
      </div>

      {/* ── Charts ── */}
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
                <YAxis tick={{ fontSize: 10, fill: 'rgba(13,13,13,0.42)', fontFamily: 'Inter' }} tickFormatter={fmtShort} width={44} />
                <Tooltip contentStyle={{ border: '1px solid rgba(13,13,13,0.09)', borderRadius: 10, fontSize: 12, fontFamily: 'Inter' }}
                  formatter={(v: number) => [fmt(v), 'Revenue']} />
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
                { name: 'Wash & Set', amount: Number(monthly.total_wash_set  ?? 0) },
                { name: 'Wig Sales',  amount: Number(monthly.total_wig_sales ?? 0) },
                { name: 'Repairs',    amount: Number(monthly.total_repairs   ?? 0) },
              ]}
              margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(13,13,13,0.06)" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'rgba(13,13,13,0.42)', fontFamily: 'Inter' }} />
              <YAxis tick={{ fontSize: 10, fill: 'rgba(13,13,13,0.42)', fontFamily: 'Inter' }} tickFormatter={fmtShort} width={44} />
              <Tooltip contentStyle={{ border: '1px solid rgba(13,13,13,0.09)', borderRadius: 10, fontSize: 12, fontFamily: 'Inter' }}
                formatter={(v: number) => [fmt(v), 'Revenue']} />
              <Bar dataKey="amount" fill="#DF5198" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Full financial breakdown ── */}
      <p style={s.sectionLabel}>Financial Breakdown</p>
      <div style={s.breakdownCard}>
        <BreakRow label="Total Revenue"       value={fmt(monthly.total_revenue)} />
        <BreakRow label="Total Expenses"      value={fmt(monthly.total_expenses)} red />
        <BreakRow label="Total Payroll"       value={fmt(monthly.total_payroll)}  red />
        <BreakRow label="Net Profit"          value={fmt(monthly.net_profit)}     bold />
        <BreakRow label="Bank Portion (40%)"  value={fmt(monthly.bank_portion)} />
        <BreakRow label="Owner Portion (60%)" value={fmt(monthly.owner_portion)} />
        <BreakRow label="Bank Tithes"         value={fmt(monthly.bank_tithes)}    red />
        <BreakRow label="Owner Tithes"        value={fmt(monthly.owner_tithes)}   red />
        <BreakRow label="Final Take-Home"     value={fmt(monthly.final_take_home)} bold green last />
      </div>

      {/* ── Daily log ── */}
      {snapshots.length > 0 && (
        <>
          <p style={{ ...s.sectionLabel, marginTop: 28 }}>Daily Log ({snapshots.length} days)</p>
          <div style={s.snapshotCard}>
            <div style={s.snapshotHeader}>
              <span style={{ flex: 2 }}>Date</span>
              <span style={{ flex: 1, textAlign: 'right' }}>Revenue</span>
              <span style={{ flex: 1, textAlign: 'right' }}>Net Profit</span>
              <span style={{ flex: 1, textAlign: 'right' }}>Take-Home</span>
            </div>
            {snapshots.map((snap: any, i: number) => (
              <div key={snap.id ?? i} style={{ ...s.snapshotRow, borderBottom: i < snapshots.length - 1 ? '1px solid rgba(13,13,13,0.06)' : 'none' }}>
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
  )
}

// ── At a Glance Tab ──────────────────────────────────────────

function GlanceTab({ monthly }: { monthly: any }) {
  const revenue    = Number(monthly.total_revenue)
  const expenses   = Number(monthly.total_expenses)
  const payroll    = Number(monthly.total_payroll)
  const netProfit  = Number(monthly.net_profit)
  const takeHome   = Number(monthly.final_take_home)
  const bank       = Number(monthly.bank_portion)
  const owner      = Number(monthly.owner_portion)
  const ws         = Number(monthly.total_wash_set  ?? 0)
  const wigs       = Number(monthly.total_wig_sales ?? 0)
  const repairs    = Number(monthly.total_repairs   ?? 0)

  const streamPie = [
    { name: 'Wash & Set', value: ws },
    { name: 'Wig Sales',  value: wigs },
    { name: 'Repairs',    value: repairs },
  ].filter(d => d.value > 0)

  const costPie = [
    { name: 'Net Profit', value: netProfit  },
    { name: 'Expenses',   value: expenses   },
    { name: 'Payroll',    value: payroll    },
  ].filter(d => d.value > 0)

  const splitPie = [
    { name: 'Bank (40%)',  value: bank  },
    { name: 'Owner (60%)', value: owner },
  ].filter(d => d.value > 0)

  return (
    <div>
      {/* ── 3 Headline numbers ── */}
      <div style={s.headlineRow}>
        <HeadlineNum label="Total Revenue" value={fmt(revenue)} />
        <div style={s.headlineDivider} />
        <HeadlineNum label="Net Profit" value={fmt(netProfit)} />
        <div style={s.headlineDivider} />
        <HeadlineNum label="Final Take-Home" value={fmt(takeHome)} green />
      </div>

      {/* ── Summary sentence ── */}
      <p style={s.summarySentence}>
        40% <strong>({fmt(bank)})</strong> goes to the bank — 60% <strong>({fmt(owner)})</strong> stays with the owners.
      </p>

      {/* ── 3 Pie charts ── */}
      <div style={s.pieGrid}>
        <PieBlock
          title="Revenue Mix"
          data={streamPie}
          colors={STREAM_COLORS}
          legend={[
            { label: 'Wash & Set', color: '#DF5198', value: fmt(ws) },
            { label: 'Wig Sales',  color: '#97BBE9', value: fmt(wigs) },
            { label: 'Repairs',    color: '#E3CD94', value: fmt(repairs) },
          ]}
        />
        <PieBlock
          title="Where the Money Goes"
          data={costPie}
          colors={['#DF5198', '#E3CD94', '#5581B1']}
          legend={[
            { label: 'Net Profit', color: '#DF5198', value: fmt(netProfit) },
            { label: 'Expenses',   color: '#E3CD94', value: fmt(expenses)  },
            { label: 'Payroll',    color: '#5581B1', value: fmt(payroll)   },
          ]}
        />
        <PieBlock
          title="Profit Split"
          data={splitPie}
          colors={SPLIT_COLORS}
          legend={[
            { label: 'Bank (40%)',  color: '#212121', value: fmt(bank)  },
            { label: 'Owner (60%)', color: '#97BBE9', value: fmt(owner) },
          ]}
        />
      </div>
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

function InsightCard({ label, value, sub, accent = false }: { label: string; value: string; sub: string; accent?: boolean }) {
  return (
    <div style={s.insightCard}>
      <p style={s.insightLabel}>{label}</p>
      <p style={{ ...s.insightValue, ...(accent ? { color: '#DF5198' } : {}) }}>{value}</p>
      <p style={s.insightSub}>{sub}</p>
    </div>
  )
}

function HeadlineNum({ label, value, green = false }: { label: string; value: string; green?: boolean }) {
  return (
    <div style={s.headlineNum}>
      <p style={s.headlineLabel}>{label}</p>
      <p style={{ ...s.headlineValue, ...(green ? { color: '#16a34a' } : {}) }}>{value}</p>
    </div>
  )
}

function PieBlock({ title, data, colors, legend }: {
  title: string
  data: { name: string; value: number }[]
  colors: string[]
  legend: { label: string; color: string; value: string }[]
}) {
  return (
    <div style={s.pieCard}>
      <p style={s.chartTitle}>{title}</p>
      <ResponsiveContainer width="100%" height={160}>
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={44} outerRadius={68} paddingAngle={2} dataKey="value" strokeWidth={0}>
            {data.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
          </Pie>
          <Tooltip
            contentStyle={{ border: '1px solid rgba(13,13,13,0.09)', borderRadius: 8, fontSize: 12, fontFamily: 'Inter' }}
            formatter={(v: number) => [fmt(v)]}
          />
        </PieChart>
      </ResponsiveContainer>
      <div style={s.pieLegend}>
        {legend.map(({ label, color, value }) => (
          <div key={label} style={s.pieLegendRow}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }} />
              <span style={s.pieLegendLabel}>{label}</span>
            </div>
            <span style={s.pieLegendValue}>{value}</span>
          </div>
        ))}
      </div>
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
  header:   { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28, paddingBottom: 24, borderBottom: '1px solid rgba(13,13,13,0.09)' },
  title:    { fontSize: 26, fontWeight: 700, color: '#0d0d0d', margin: '0 0 4px', letterSpacing: '-0.03em' },
  subtitle: { color: 'rgba(13,13,13,0.42)', fontSize: 13, margin: 0, fontFamily: "'Inter', sans-serif" },
  muted:    { color: 'rgba(13,13,13,0.42)', fontSize: 14 },

  segmented: { display: 'flex', background: 'rgba(13,13,13,0.06)', borderRadius: 10, padding: 3, gap: 2 },
  seg:       { padding: '6px 20px', border: 'none', background: 'transparent', borderRadius: 8, fontSize: 13, fontWeight: 500, color: 'rgba(13,13,13,0.42)', cursor: 'pointer', fontFamily: "'Inter', sans-serif", transition: 'all 0.15s' },
  segActive: { background: '#fff', color: '#0d0d0d', boxShadow: '0 1px 4px rgba(0,0,0,0.10)' },

  // KPI strip
  kpiGrid:    { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 28 },
  kpiCard:    { background: '#fff', borderRadius: 14, padding: '18px 20px', border: '1px solid rgba(13,13,13,0.09)', boxShadow: '0 2px 4px rgba(0,0,0,0.03)' },
  kpiCardDark:{ background: '#0d0d0d', border: 'none', boxShadow: '0 2px 12px rgba(0,0,0,0.15)' },
  kpiLabel:   { fontSize: 10, fontWeight: 600, color: 'rgba(13,13,13,0.42)', letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 8px', fontFamily: "'Inter', sans-serif" },
  kpiValue:   { fontSize: 20, fontWeight: 700, color: '#0d0d0d', margin: 0, letterSpacing: '-0.03em' },

  // Insights row
  insightGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 24 },
  insightCard: { background: '#fff', borderRadius: 14, padding: '16px 18px', border: '1px solid rgba(13,13,13,0.09)', boxShadow: '0 1px 4px rgba(0,0,0,0.03)' },
  insightLabel:{ fontSize: 10, fontWeight: 600, color: 'rgba(13,13,13,0.4)', letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 6px', fontFamily: "'Inter', sans-serif" },
  insightValue:{ fontSize: 20, fontWeight: 700, color: '#0d0d0d', margin: '0 0 2px', letterSpacing: '-0.03em' },
  insightSub:  { fontSize: 11, color: 'rgba(13,13,13,0.38)', margin: 0, fontFamily: "'Inter', sans-serif" },

  // Charts
  chartsGrid:  { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 28 },
  chartCard:   { background: '#fff', borderRadius: 14, padding: '20px', border: '1px solid rgba(13,13,13,0.09)', boxShadow: '0 2px 4px rgba(0,0,0,0.03)' },
  chartTitle:  { fontSize: 10, fontWeight: 600, color: 'rgba(13,13,13,0.42)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 14, fontFamily: "'Inter', sans-serif" },
  chartEmpty:  { height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(13,13,13,0.35)', fontSize: 13 },

  sectionLabel: { fontSize: 10, fontWeight: 600, color: 'rgba(13,13,13,0.42)', letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 8px', fontFamily: "'Inter', sans-serif" },
  breakdownCard:{ background: '#fff', borderRadius: 14, overflow: 'hidden', border: '1px solid rgba(13,13,13,0.09)', boxShadow: '0 2px 4px rgba(0,0,0,0.03)', marginBottom: 0 },
  snapshotCard: { background: '#fff', borderRadius: 14, overflow: 'hidden', border: '1px solid rgba(13,13,13,0.09)', boxShadow: '0 2px 4px rgba(0,0,0,0.03)' },
  snapshotHeader:{ display: 'flex', padding: '10px 20px', background: '#f7f7f5', fontSize: 10, fontWeight: 600, color: 'rgba(13,13,13,0.42)', letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: "'Inter', sans-serif" },
  snapshotRow:  { display: 'flex', padding: '11px 20px' },

  // At a Glance
  headlineRow: {
    display: 'flex', alignItems: 'stretch',
    background: '#fff', border: '1px solid rgba(13,13,13,0.09)',
    borderRadius: 16, marginBottom: 14,
    boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
    overflow: 'hidden',
  },
  headlineNum:     { flex: 1, padding: '28px 32px', display: 'flex', flexDirection: 'column', justifyContent: 'center' },
  headlineDivider: { width: 1, background: 'rgba(13,13,13,0.08)', flexShrink: 0 },
  headlineLabel:   { fontSize: 10, fontWeight: 600, color: 'rgba(13,13,13,0.38)', letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 8px', fontFamily: "'Inter', sans-serif" },
  headlineValue:   { fontSize: 32, fontWeight: 700, color: '#0d0d0d', margin: 0, letterSpacing: '-0.04em' },

  summarySentence: {
    fontSize: 13, color: 'rgba(13,13,13,0.5)', margin: '0 0 28px',
    fontFamily: "'Inter', sans-serif", lineHeight: 1.5,
    padding: '0 2px',
  },

  pieGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 },
  pieCard: {
    background: '#fff', border: '1px solid rgba(13,13,13,0.09)',
    borderRadius: 14, padding: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.03)',
  },
  pieLegend:      { marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 },
  pieLegendRow:   { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  pieLegendLabel: { fontSize: 12, color: 'rgba(13,13,13,0.55)', fontFamily: "'Inter', sans-serif" },
  pieLegendValue: { fontSize: 12, fontWeight: 600, color: '#0d0d0d', letterSpacing: '-0.01em', fontFamily: "'Inter', sans-serif" },

  noDataBanner: {
    display: 'flex', alignItems: 'center', gap: 8,
    background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10,
    padding: '10px 16px', marginBottom: 20,
    fontSize: 13, color: '#92400e', fontFamily: "'Inter', sans-serif",
  },
  noDataDot: {
    width: 7, height: 7, borderRadius: '50%', background: '#f59e0b', flexShrink: 0,
  },
}

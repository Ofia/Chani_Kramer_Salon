import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'

// Costal Glam palette — matches DailyEntryPage MiniBar colors
const STREAM_COLORS = ['#DF5198', '#97BBE9', '#E3CD94']

function fmt(n: number | string) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(n))
}
function today() {
  return new Date().toISOString().split('T')[0]
}

export default function BookkeeperDashboard() {
  const [view, setView] = useState<'daily' | 'monthly'>('daily')
  const now = new Date()

  const { data: summary, isLoading: dailyLoading } = useQuery({
    queryKey: ['daily-summary', today()],
    queryFn: () => api.get(`/daily-summary/${today()}`).then(r => r.data).catch(() => null),
  })

  const { data: monthly, isLoading: monthlyLoading } = useQuery({
    queryKey: ['monthly-summary', now.getFullYear(), now.getMonth() + 1],
    queryFn: () =>
      api.get(`/financials/monthly-summary?year=${now.getFullYear()}&month=${now.getMonth() + 1}`)
        .then(r => r.data).catch(() => null),
    enabled: view === 'monthly',
  })

  const dateLabel = now.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })
  const monthLabel = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  return (
    <div style={s.page}>
      <header style={s.header}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 style={s.title}>Dashboard</h1>
            {summary?.is_locked && view === 'daily' && <span style={s.locked}>Locked</span>}
          </div>
          <p style={s.date}>{view === 'daily' ? dateLabel : monthLabel}</p>
        </div>
        <div style={s.segmented}>
          <button onClick={() => setView('daily')}   style={{ ...s.seg, ...(view === 'daily'   ? s.segActive : {}) }}>Daily</button>
          <button onClick={() => setView('monthly')} style={{ ...s.seg, ...(view === 'monthly' ? s.segActive : {}) }}>Monthly</button>
        </div>
      </header>

      {view === 'daily'
        ? <DailyView summary={summary} isLoading={dailyLoading} />
        : <MonthlyView monthly={monthly} isLoading={monthlyLoading} />
      }
    </div>
  )
}

// ── Daily View ───────────────────────────────────────────────

function DailyView({ summary, isLoading }: { summary: any; isLoading: boolean }) {
  if (isLoading) return <p style={s.muted}>Loading…</p>
  if (!summary) return (
    <div style={s.emptyCard}>
      <p style={s.emptyTitle}>No data entered yet today</p>
      <p style={s.emptyHint}>Go to <strong>Daily Entry</strong> to start today's records.</p>
    </div>
  )

  const ws   = Number(summary.total_wash_set)  || 0
  const wigs = Number(summary.total_wig_sales) || 0
  const rep  = Number(summary.total_repairs)   || 0
  const total = Number(summary.total_revenue)  || 0

  const pieData = [
    { name: 'Wash & Set', value: ws },
    { name: 'Wig Sales',  value: wigs },
    { name: 'Repairs',    value: rep },
  ].filter(d => d.value > 0)

  const emptyPie = pieData.length === 0

  return (
    <div style={s.content}>

      {/* ── Revenue + Donut ── */}
      <Label>Revenue</Label>
      <div style={s.revenueCard}>
        {/* Stat rows */}
        <div style={s.statRows}>
          <StatRow label="Wash & Set"  value={fmt(ws)}   dot="#DF5198" />
          <StatRow label="Wig Sales"   value={fmt(wigs)} dot="#97BBE9" />
          <StatRow label="Repairs"     value={fmt(rep)}  dot="#E3CD94" />
          <div style={s.divider} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={s.totalLabel}>Total Revenue</span>
            <span style={s.totalValue}>{fmt(total)}</span>
          </div>
        </div>

        {/* Donut chart */}
        <div style={s.chartWrap}>
          {emptyPie ? (
            <div style={s.emptyDonut}>
              <div style={s.emptyDonutRing} />
              <span style={s.emptyDonutText}>No data</span>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%" cy="50%"
                  innerRadius={44} outerRadius={68}
                  paddingAngle={2}
                  dataKey="value"
                  strokeWidth={0}
                >
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={STREAM_COLORS[i]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ border: '1px solid rgba(13,13,13,0.09)', borderRadius: 8, fontSize: 12, fontFamily: 'Inter' }}
                  formatter={(v: number) => [fmt(v)]}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── Collected by Method ── */}
      <Label>Collected by Method</Label>
      <div style={s.methodCard}>
        <MethodChip label="Cash"        value={fmt(summary.cash_collected)} />
        <div style={s.methodDivider} />
        <MethodChip label="QuickPay"    value={fmt(summary.quickpay_collected)} />
        <div style={s.methodDivider} />
        <MethodChip label="Credit Card" value={fmt(summary.cc_collected)} />
        <div style={s.methodDivider} />
        <MethodChip label="Check"       value={fmt(summary.check_collected)} />
        <div style={s.methodDivider} />
        <MethodChip label="Zelle"       value={fmt(summary.zelle_collected)} />
      </div>

      {/* ── Activity ── */}
      <Label>Activity</Label>
      <div style={s.activityCard}>
        <ActivityStat label="Wigs Sold"    value={summary.new_wigs_sold} />
        <div style={s.methodDivider} />
        <ActivityStat label="Paid in Full" value={summary.wigs_paid_full} />
        <div style={s.methodDivider} />
        <ActivityStat label="Chani Cuts"   value={summary.chani_cuts} />
      </div>

    </div>
  )
}

// ── Monthly View ─────────────────────────────────────────────

function MonthlyView({ monthly, isLoading }: { monthly: any; isLoading: boolean }) {
  if (isLoading) return <p style={s.muted}>Loading…</p>
  if (!monthly || monthly.days_with_data === 0) return (
    <div style={s.emptyCard}>
      <p style={s.emptyTitle}>No data yet this month</p>
      <p style={s.emptyHint}>Data will appear as daily entries are added.</p>
    </div>
  )

  return (
    <div style={s.content}>
      <Label>Monthly Summary</Label>
      <div style={s.monthCard}>
        <MonthRow label="Total Revenue"      value={fmt(monthly.total_revenue)} />
        <MonthRow label="Total Expenses"     value={fmt(monthly.total_expenses)} red />
        <MonthRow label="Total Payroll"      value={fmt(monthly.total_payroll)}  red />
        <div style={s.divider} />
        <MonthRow label="Net Profit"         value={fmt(monthly.net_profit)}     bold />
        <MonthRow label="Bank Portion (40%)" value={fmt(monthly.bank_portion)} />
        <MonthRow label="Owner Portion (60%)"value={fmt(monthly.owner_portion)} />
        <MonthRow label="Total Tithes"       value={fmt(monthly.total_tithes)}   red />
        <div style={s.divider} />
        <MonthRow label="Final Take-Home"    value={fmt(monthly.final_take_home)} bold green last />
      </div>

      <Label style={{ marginTop: 24 }}>
        {monthly.days_with_data} day{monthly.days_with_data !== 1 ? 's' : ''} with data this month
      </Label>
    </div>
  )
}

// ── Sub-components ───────────────────────────────────────────

function Label({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <p style={{ ...s.sectionLabel, ...style }}>{children}</p>
}

function StatRow({ label, value, dot }: { label: string; value: string; dot: string }) {
  return (
    <div style={s.statRow}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 7, height: 7, borderRadius: '50%', background: dot, flexShrink: 0 }} />
        <span style={s.statLabel}>{label}</span>
      </div>
      <span style={s.statValue}>{value}</span>
    </div>
  )
}

function MethodChip({ label, value }: { label: string; value: string }) {
  return (
    <div style={s.chip}>
      <span style={s.chipLabel}>{label}</span>
      <span style={s.chipValue}>{value}</span>
    </div>
  )
}

function ActivityStat({ label, value }: { label: string; value: number }) {
  return (
    <div style={s.activityItem}>
      <span style={s.activityCount}>{value ?? 0}</span>
      <span style={s.activityLabel}>{label}</span>
    </div>
  )
}

function MonthRow({ label, value, red = false, green = false, bold = false, last = false }: {
  label: string; value: string; red?: boolean; green?: boolean; bold?: boolean; last?: boolean
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: last ? 'none' : '1px solid rgba(13,13,13,0.05)' }}>
      <span style={{ fontSize: 13, color: bold ? '#0d0d0d' : 'rgba(13,13,13,0.55)', fontWeight: bold ? 600 : 400 }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: bold ? 700 : 500, letterSpacing: '-0.01em', color: red ? '#dc2626' : green ? '#16a34a' : '#0d0d0d' }}>
        {red ? `(${value})` : value}
      </span>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  page: { fontFamily: "'Inter', -apple-system, sans-serif", letterSpacing: '-0.01em' },

  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    marginBottom: 28, paddingBottom: 20, borderBottom: '1px solid rgba(13,13,13,0.09)',
  },
  title: { fontSize: 22, fontWeight: 700, color: '#0d0d0d', margin: 0, letterSpacing: '-0.03em' },
  date: { fontSize: 12, color: 'rgba(13,13,13,0.42)', margin: '3px 0 0', fontWeight: 400 },
  locked: {
    background: '#212121', color: '#fff', padding: '3px 10px', borderRadius: 20,
    fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase',
  },

  segmented: { display: 'flex', background: 'rgba(13,13,13,0.06)', borderRadius: 9, padding: 3, gap: 2 },
  seg: { padding: '5px 16px', border: 'none', background: 'transparent', borderRadius: 7, fontSize: 12, fontWeight: 500, color: 'rgba(13,13,13,0.42)', cursor: 'pointer', transition: 'all 0.15s' },
  segActive: { background: '#fff', color: '#0d0d0d', boxShadow: '0 1px 4px rgba(0,0,0,0.10)' },

  muted: { color: 'rgba(13,13,13,0.42)', fontSize: 14 },
  content: { display: 'flex', flexDirection: 'column', gap: 6 },
  sectionLabel: {
    fontSize: 10, fontWeight: 600, color: 'rgba(13,13,13,0.35)',
    letterSpacing: '0.08em', textTransform: 'uppercase', margin: '12px 0 6px',
  },

  // Revenue card — stats + donut side by side
  revenueCard: {
    display: 'grid', gridTemplateColumns: '1fr 180px',
    background: '#fff', border: '1px solid rgba(13,13,13,0.09)',
    borderRadius: 14, overflow: 'hidden',
    boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
  },
  statRows: { padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 2, justifyContent: 'center' },
  statRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0' },
  statLabel: { fontSize: 13, color: 'rgba(13,13,13,0.6)', fontWeight: 400 },
  statValue: { fontSize: 13, fontWeight: 600, color: '#0d0d0d', letterSpacing: '-0.01em' },
  divider: { height: 1, background: 'rgba(13,13,13,0.07)', margin: '6px 0' },
  totalLabel: { fontSize: 13, fontWeight: 600, color: '#0d0d0d' },
  totalValue: { fontSize: 18, fontWeight: 700, color: '#0d0d0d', letterSpacing: '-0.03em' },

  chartWrap: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    borderLeft: '1px solid rgba(13,13,13,0.06)', padding: '16px 8px',
    background: '#fafaf9',
  },
  emptyDonut: { position: 'relative', width: 100, height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  emptyDonutRing: {
    position: 'absolute', inset: 0,
    borderRadius: '50%', border: '14px solid rgba(13,13,13,0.07)',
  },
  emptyDonutText: { fontSize: 10, color: 'rgba(13,13,13,0.3)', fontWeight: 500 },

  // Payment methods
  methodCard: {
    background: '#fff', border: '1px solid rgba(13,13,13,0.09)',
    borderRadius: 14, padding: '14px 22px',
    display: 'flex', alignItems: 'center', gap: 0,
    boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
  },
  methodDivider: { width: 1, height: 28, background: 'rgba(13,13,13,0.08)', flexShrink: 0, margin: '0 16px' },
  chip: { display: 'flex', flexDirection: 'column', gap: 2, flex: 1 },
  chipLabel: { fontSize: 10, fontWeight: 600, color: 'rgba(13,13,13,0.4)', letterSpacing: '0.06em', textTransform: 'uppercase' },
  chipValue: { fontSize: 14, fontWeight: 600, color: '#0d0d0d', letterSpacing: '-0.02em' },

  // Activity
  activityCard: {
    background: '#fff', border: '1px solid rgba(13,13,13,0.09)',
    borderRadius: 14, padding: '14px 22px',
    display: 'flex', alignItems: 'center',
    boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
  },
  activityItem: { display: 'flex', alignItems: 'baseline', gap: 6, flex: 1 },
  activityCount: { fontSize: 22, fontWeight: 700, color: '#0d0d0d', letterSpacing: '-0.04em' },
  activityLabel: { fontSize: 12, color: 'rgba(13,13,13,0.45)', fontWeight: 400 },

  // Monthly
  monthCard: {
    background: '#fff', border: '1px solid rgba(13,13,13,0.09)',
    borderRadius: 14, padding: '4px 22px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
  },

  emptyCard: {
    background: '#ffffff', border: '1px solid rgba(13,13,13,0.09)',
    borderRadius: 14, padding: '52px 40px', textAlign: 'center',
    boxShadow: '0 2px 4px rgba(0,0,0,0.03)',
  },
  emptyTitle: { color: '#0d0d0d', fontSize: 15, fontWeight: 600, margin: '0 0 8px', letterSpacing: '-0.02em' },
  emptyHint: { color: 'rgba(13,13,13,0.42)', fontSize: 13, margin: 0 },
}

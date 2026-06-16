/**
 * Operation Overview — replaces Daily Entry + Daily Summary.
 * Aggregates revenue, payments, expenses, payroll, and summary
 * for a selected Day / Month / date Range. All data is read-only —
 * editing happens on the dedicated POS, Expenses, and Payroll pages.
 */

import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts'
import { Link } from 'react-router-dom'
import { ExternalLink } from 'lucide-react'
import { api } from '../../lib/api'

// ── Types ─────────────────────────────────────────────────────

type PeriodMode = 'day' | 'month' | 'range'

type ReportRevenue = {
  wash_set: number; repairs: number; product_sales: number
  wig_sales: number; wig_deposits: number; repair_deposits: number; total: number
}
type ReportPayments = {
  cash: number; credit_card: number; quickpay: number
  check: number; zelle: number; total: number; tax_collected: number
}
type ExpensePieSlice  = { category: string; label: string; amount: number }
type ExpenseEntry     = { id: string; expense_date: string; category: string; amount: number; vendor?: string; notes?: string }
type PayrollBar       = { name: string; amount: number }
type ReportData = {
  period_start: string; period_end: string
  revenue: ReportRevenue
  payments: ReportPayments
  expense_by_category: ExpensePieSlice[]
  expense_entries: ExpenseEntry[]
  payroll_by_employee: PayrollBar[]
  total_expenses: number; total_payroll: number
  net_profit: number; tithes: number
}

// ── Brand colors ──────────────────────────────────────────────

const PINK  = '#DF5198'
const BLUE  = '#97BBE9'
const SAND  = '#E3CD94'
const BLUSH = '#EDCADB'
const NAVY  = '#5581B1'

const REVENUE_COLORS  = [PINK, SAND, BLUE, NAVY]
const PAYMENT_COLORS  = [PINK, SAND, NAVY, BLUE, BLUSH]
const EXPENSE_COLORS  = [PINK, NAVY, SAND, BLUE, BLUSH, '#a78bfa', '#34d399', '#fb923c', '#38bdf8', '#f472b6', '#a3e635', '#facc15', '#94a3b8']

// ── Helpers ───────────────────────────────────────────────────

function todayStr() { return new Date().toISOString().split('T')[0] }

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
}

function fmtPeriod(mode: PeriodMode, day: string, year: number, month: number, rangeStart: string, rangeEnd: string) {
  if (mode === 'day') {
    return new Date(day + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  }
  if (mode === 'month') {
    return new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  }
  const s = new Date(rangeStart + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const e = new Date(rangeEnd   + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  return `${s} – ${e}`
}

function lastOfMonth(y: number, m: number) {
  return new Date(y, m, 0).toISOString().split('T')[0]
}
function firstOfMonth(y: number, m: number) {
  return new Date(y, m - 1, 1).toISOString().split('T')[0]
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const YEARS  = [2024, 2025, 2026]
const TABS   = ['Revenue', 'Payments', 'Expenses', 'Payroll', 'Summary'] as const
type Tab = typeof TABS[number]

// ── Custom tooltip for pie/bar ────────────────────────────────

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const { name, value } = payload[0]
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e5e5', borderRadius: 8, padding: '8px 12px', fontSize: 13, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
      <div style={{ fontWeight: 600, color: '#18181b', marginBottom: 2 }}>{name}</div>
      <div style={{ color: '#71717a' }}>{fmt(value)}</div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────

export default function OperationOverviewPage() {
  const now = new Date()

  const [mode, setMode]           = useState<PeriodMode>('day')
  const [day, setDay]             = useState(todayStr())
  const [year, setYear]           = useState(now.getFullYear())
  const [month, setMonth]         = useState(now.getMonth() + 1)
  const [rangeStart, setRangeStart] = useState(firstOfMonth(now.getFullYear(), now.getMonth() + 1))
  const [rangeEnd, setRangeEnd]   = useState(todayStr())
  const [activeTab, setActiveTab] = useState<Tab>('Revenue')

  // ── Compute start / end from selected mode ──────────────────
  const { start, end } = useMemo(() => {
    if (mode === 'day')   return { start: day, end: day }
    if (mode === 'month') return { start: firstOfMonth(year, month), end: lastOfMonth(year, month) }
    return { start: rangeStart, end: rangeEnd }
  }, [mode, day, year, month, rangeStart, rangeEnd])

  const { data, isLoading, isError } = useQuery<ReportData>({
    queryKey: ['operation-overview', start, end],
    queryFn: () => api.get(`/reports/?start=${start}&end=${end}`).then(r => r.data),
    enabled: !!start && !!end && start <= end,
    staleTime: 0,   // always refetch — data changes whenever POS/expenses/payroll change
  })

  const periodLabel = fmtPeriod(mode, day, year, month, rangeStart, rangeEnd)

  return (
    <div style={s.page}>
      {/* ── Header ── */}
      <div style={s.header}>
        <div>
          <h1 style={s.title}>Operation Overview</h1>
          <p style={s.subtitle}>{periodLabel}</p>
        </div>

        {/* ── Period selector ── */}
        <div style={s.periodBar}>
          <div style={s.modeToggle}>
            {(['day','month','range'] as PeriodMode[]).map(m => (
              <button key={m} onClick={() => setMode(m)}
                style={{ ...s.modeBtn, ...(mode === m ? s.modeBtnActive : {}) }}>
                {m === 'day' ? 'Day' : m === 'month' ? 'Month' : 'Range'}
              </button>
            ))}
          </div>

          {mode === 'day' && (
            <input type="date" value={day} onChange={e => setDay(e.target.value)} style={s.dateInput} />
          )}
          {mode === 'month' && (
            <div style={{ display: 'flex', gap: 8 }}>
              <select value={month} onChange={e => setMonth(Number(e.target.value))} style={s.select}>
                {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
              </select>
              <select value={year} onChange={e => setYear(Number(e.target.value))} style={s.select}>
                {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          )}
          {mode === 'range' && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="date" value={rangeStart} onChange={e => setRangeStart(e.target.value)} style={s.dateInput} />
              <span style={{ color: '#71717a', fontSize: 13 }}>→</span>
              <input type="date" value={rangeEnd} onChange={e => setRangeEnd(e.target.value)} style={s.dateInput} />
            </div>
          )}
        </div>
      </div>

      {/* ── Tabs ── */}
      <div style={s.tabBar}>
        {TABS.map(t => (
          <button key={t} onClick={() => setActiveTab(t)}
            style={{ ...s.tab, ...(activeTab === t ? s.tabActive : {}) }}>
            {t}
          </button>
        ))}
      </div>

      {/* ── Content ── */}
      <div style={s.content}>
        {isLoading && <div style={s.state}>Loading…</div>}
        {isError   && <div style={{ ...s.state, color: '#ef4444' }}>Failed to load report.</div>}
        {!isLoading && !isError && data && (
          <>
            {activeTab === 'Revenue'  && <RevenueTab  data={data} />}
            {activeTab === 'Payments' && <PaymentsTab data={data} />}
            {activeTab === 'Expenses' && <ExpensesTab data={data} />}
            {activeTab === 'Payroll'  && <PayrollTab  data={data} />}
            {activeTab === 'Summary'  && <SummaryTab  data={data} />}
          </>
        )}
        {!isLoading && !isError && !data && (
          <div style={s.state}>No data for this period.</div>
        )}
      </div>
    </div>
  )
}

// ── Revenue Tab ───────────────────────────────────────────────

function RevenueTab({ data }: { data: ReportData }) {
  const { revenue } = data
  const slices = [
    { name: 'Wash & Set',    value: revenue.wash_set       },
    { name: 'Repairs',       value: revenue.repairs        },
    { name: 'Products',      value: revenue.product_sales  },
    { name: 'Wig Sales',     value: revenue.wig_sales      },
  ].filter(s => s.value > 0)

  return (
    <div style={s.tabContent}>
      <div style={s.twoCol}>
        {/* Chart */}
        <div style={s.chartCard}>
          <p style={s.chartTitle}>Revenue Mix</p>
          {slices.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={slices} dataKey="value" nameKey="name"
                  cx="50%" cy="50%" innerRadius={70} outerRadius={110}
                  paddingAngle={2}>
                  {slices.map((_, i) => <Cell key={i} fill={REVENUE_COLORS[i % REVENUE_COLORS.length]} />)}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend iconType="circle" iconSize={10} wrapperStyle={{ fontSize: 13 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </div>

        {/* Stats */}
        <div style={s.statsCol}>
          <StatRow label="Wash & Set"   value={revenue.wash_set}      color={PINK}  />
          <StatRow label="Repairs"      value={revenue.repairs}       color={SAND}  />
          <StatRow label="Products"     value={revenue.product_sales} color={BLUE}  />
          <StatRow label="Wig Sales"    value={revenue.wig_sales}     color={NAVY}  />
          <div style={s.divider} />
          <StatRow label="Total Revenue" value={revenue.total} bold />
          {(revenue.wig_deposits > 0 || revenue.repair_deposits > 0) && (
            <div style={{ marginTop: 16, padding: '12px 16px', background: '#fafaf9', border: '1px solid #e5e5e5', borderRadius: 10 }}>
              <p style={{ margin: 0, fontSize: 11, color: '#71717a', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>Deposits Held</p>
              <p style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#18181b' }}>{fmt(revenue.wig_deposits + revenue.repair_deposits)}</p>
              <p style={{ margin: '4px 0 0', fontSize: 11, color: '#71717a' }}>Cash received, not yet recognized as revenue</p>
              {revenue.wig_deposits > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                  <span style={{ fontSize: 12, color: '#71717a' }}>Wig deposits</span>
                  <span style={{ fontSize: 12, color: '#18181b', fontWeight: 600 }}>{fmt(revenue.wig_deposits)}</span>
                </div>
              )}
              {revenue.repair_deposits > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                  <span style={{ fontSize: 12, color: '#71717a' }}>Repairs (pending wig)</span>
                  <span style={{ fontSize: 12, color: '#18181b', fontWeight: 600 }}>{fmt(revenue.repair_deposits)}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Payments Tab ──────────────────────────────────────────────

function PaymentsTab({ data }: { data: ReportData }) {
  const { payments } = data
  const slices = [
    { name: 'Cash',        value: payments.cash        },
    { name: 'Credit Card', value: payments.credit_card },
    { name: 'Zelle',       value: payments.zelle       },
    { name: 'QuickPay',    value: payments.quickpay    },
    { name: 'Check',       value: payments.check       },
  ].filter(s => s.value > 0)

  return (
    <div style={s.tabContent}>
      <div style={s.twoCol}>
        {/* Chart */}
        <div style={s.chartCard}>
          <p style={s.chartTitle}>Payment Methods</p>
          {slices.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={slices} dataKey="value" nameKey="name"
                  cx="50%" cy="50%" innerRadius={70} outerRadius={110}
                  paddingAngle={2}>
                  {slices.map((_, i) => <Cell key={i} fill={PAYMENT_COLORS[i % PAYMENT_COLORS.length]} />)}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend iconType="circle" iconSize={10} wrapperStyle={{ fontSize: 13 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </div>

        {/* Stats */}
        <div style={s.statsCol}>
          <StatRow label="Cash"         value={payments.cash}         color={PINK}  />
          <StatRow label="Credit Card"  value={payments.credit_card}  color={SAND}  />
          <StatRow label="Zelle"        value={payments.zelle}        color={NAVY}  />
          <StatRow label="QuickPay"     value={payments.quickpay}     color={BLUE}  />
          <StatRow label="Check"        value={payments.check}        color={BLUSH} />
          <div style={s.divider} />
          <StatRow label="Total Collected" value={payments.total} bold />

          {/* Tax collected box */}
          <div style={{ marginTop: 16, padding: '14px 16px', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 10 }}>
            <p style={{ margin: 0, fontSize: 11, color: '#92400e', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>Tax Collected — Set Aside for NY State</p>
            <p style={{ margin: 0, fontSize: 26, fontWeight: 700, color: '#92400e' }}>{fmt(payments.tax_collected)}</p>
            <p style={{ margin: '6px 0 0', fontSize: 11, color: '#b45309' }}>4.5% on services · 8.875% on goods</p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Expenses Tab ──────────────────────────────────────────────

function ExpensesTab({ data }: { data: ReportData }) {
  const { expense_by_category, expense_entries, total_expenses } = data

  const pieData = expense_by_category.map(e => ({ name: e.label, value: e.amount }))

  return (
    <div style={s.tabContent}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <Link to="/bookkeeper/expenses" style={s.linkBtn}>
          <ExternalLink size={12} style={{ marginRight: 5 }} />
          Manage Expenses
        </Link>
      </div>

      <div style={s.twoCol}>
        {/* Chart */}
        <div style={s.chartCard}>
          <p style={s.chartTitle}>Expenses by Category</p>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name"
                  cx="50%" cy="50%" innerRadius={70} outerRadius={110}
                  paddingAngle={2}>
                  {pieData.map((_, i) => <Cell key={i} fill={EXPENSE_COLORS[i % EXPENSE_COLORS.length]} />)}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend iconType="circle" iconSize={10} wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </div>

        {/* Category breakdown */}
        <div style={s.statsCol}>
          {expense_by_category.map((e, i) => (
            <StatRow key={e.category} label={e.label} value={e.amount}
              color={EXPENSE_COLORS[i % EXPENSE_COLORS.length]} />
          ))}
          {expense_by_category.length > 0 && <div style={s.divider} />}
          <StatRow label="Total Expenses" value={total_expenses} bold />
        </div>
      </div>

      {/* Entry list */}
      {expense_entries.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <p style={s.listTitle}>All Expense Entries</p>
          <table style={s.table}>
            <thead>
              <tr>
                {['Date', 'Category', 'Vendor', 'Notes', 'Amount'].map(h => (
                  <th key={h} style={s.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {expense_entries.map(e => (
                <tr key={e.id}>
                  <td style={s.td}>{new Date(e.expense_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</td>
                  <td style={s.td}>{data.expense_by_category.find(c => c.category === e.category)?.label ?? e.category}</td>
                  <td style={s.td}>{e.vendor || '—'}</td>
                  <td style={{ ...s.td, color: '#71717a' }}>{e.notes || '—'}</td>
                  <td style={{ ...s.td, fontWeight: 600, textAlign: 'right' }}>{fmt(e.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Payroll Tab ───────────────────────────────────────────────

function PayrollTab({ data }: { data: ReportData }) {
  const { payroll_by_employee, total_payroll } = data
  const barData = [...payroll_by_employee].sort((a, b) => b.amount - a.amount)

  return (
    <div style={s.tabContent}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <Link to="/bookkeeper/payroll" style={s.linkBtn}>
          <ExternalLink size={12} style={{ marginRight: 5 }} />
          Manage Payroll
        </Link>
      </div>

      {barData.length > 0 ? (
        <>
          <div style={s.chartCard}>
            <p style={s.chartTitle}>Payroll by Employee</p>
            <ResponsiveContainer width="100%" height={Math.max(240, barData.length * 36 + 40)}>
              <BarChart data={barData} layout="vertical" margin={{ left: 20, right: 40, top: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                <XAxis type="number" tick={{ fontSize: 12, fill: '#71717a' }}
                  tickFormatter={v => `$${(v / 1000).toFixed(1)}k`} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: '#18181b' }} width={110} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
                <Bar dataKey="amount" name="Payroll" fill={NAVY} radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
            <div style={s.totalPill}>
              <span style={{ fontSize: 12, color: '#71717a' }}>Total Payroll</span>
              <span style={{ fontSize: 20, fontWeight: 700, color: '#18181b' }}>{fmt(total_payroll)}</span>
            </div>
          </div>
        </>
      ) : (
        <div style={s.emptyState}>
          <p style={{ color: '#71717a', fontSize: 14 }}>No payroll entries for this period.</p>
          <p style={{ color: '#a1a1aa', fontSize: 13 }}>Payroll is entered weekly — check monthly view for full coverage.</p>
        </div>
      )}
    </div>
  )
}

// ── Summary Tab ───────────────────────────────────────────────

function SummaryTab({ data }: { data: ReportData }) {
  return (
    <div style={s.tabContent}>
      <div style={s.summaryGrid}>
        <SummaryCard label="Total Revenue"  value={data.revenue.total}    color={PINK}  note="W&S + Repairs + Products + Wigs" />
        <SummaryCard label="Total Expenses" value={data.total_expenses}   color={SAND}  note="All expense entries" />
        <SummaryCard label="Total Payroll"  value={data.total_payroll}    color={BLUE}  note="Weekly payroll in period" />
        <SummaryCard label="Net Profit"     value={data.net_profit}       color={data.net_profit >= 0 ? NAVY : '#ef4444'}
          note="Revenue − Expenses − Payroll" big />
      </div>

      <div style={s.divider} />

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ ...s.infoBox, flex: 1, minWidth: 200, background: '#fff7ed', border: '1px solid #fed7aa' }}>
          <p style={{ ...s.infoLabel, color: '#92400e' }}>Tax to Remit</p>
          <p style={{ ...s.infoValue, color: '#92400e' }}>{fmt(data.payments.tax_collected)}</p>
          <p style={{ ...s.infoNote, color: '#b45309' }}>NY Sales Tax collected via POS</p>
        </div>
        <div style={{ ...s.infoBox, flex: 1, minWidth: 200, background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
          <p style={{ ...s.infoLabel, color: '#166534' }}>Deposits Held</p>
          <p style={{ ...s.infoValue, color: '#166534' }}>{fmt(data.revenue.wig_deposits + data.revenue.repair_deposits)}</p>
          <p style={{ ...s.infoNote, color: '#15803d' }}>Not revenue — awaiting pickup</p>
          {data.revenue.wig_deposits > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
              <span style={{ fontSize: 12, color: '#15803d' }}>Wig deposits</span>
              <span style={{ fontSize: 12, color: '#166534', fontWeight: 600 }}>{fmt(data.revenue.wig_deposits)}</span>
            </div>
          )}
          {data.revenue.repair_deposits > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
              <span style={{ fontSize: 12, color: '#15803d' }}>Repairs (pending wig)</span>
              <span style={{ fontSize: 12, color: '#166534', fontWeight: 600 }}>{fmt(data.revenue.repair_deposits)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Shared sub-components ─────────────────────────────────────

function StatRow({ label, value, color, bold }: { label: string; value: number; color?: string; bold?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid #f4f4f5' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {color && <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }} />}
        <span style={{ fontSize: 13, color: bold ? '#18181b' : '#52525b', fontWeight: bold ? 700 : 400 }}>{label}</span>
      </div>
      <span style={{ fontSize: 13, fontWeight: bold ? 700 : 600, color: '#18181b' }}>{fmt(value)}</span>
    </div>
  )
}

function SummaryCard({ label, value, color, note, big }: { label: string; value: number; color: string; note: string; big?: boolean }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e5e5', borderRadius: 12, padding: '20px 24px', flex: 1, minWidth: 180 }}>
      <p style={{ margin: 0, fontSize: 11, color: '#71717a', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>{label}</p>
      <p style={{ margin: 0, fontSize: big ? 32 : 24, fontWeight: 700, color, letterSpacing: '-0.02em' }}>{fmt(value)}</p>
      <p style={{ margin: '6px 0 0', fontSize: 12, color: '#a1a1aa' }}>{note}</p>
    </div>
  )
}

function EmptyChart() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: '#a1a1aa', fontSize: 13 }}>
      No data for this period
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  page:        { fontFamily: "'Inter', -apple-system, sans-serif", color: '#18181b', maxWidth: 1100 },
  header:      { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28, flexWrap: 'wrap', gap: 16 },
  title:       { fontSize: 26, fontWeight: 700, color: '#18181b', margin: '0 0 4px', letterSpacing: '-0.03em' },
  subtitle:    { margin: 0, fontSize: 14, color: '#71717a' },
  periodBar:   { display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  modeToggle:  { display: 'flex', background: '#f4f4f5', borderRadius: 8, padding: 3, gap: 2 },
  modeBtn:     { background: 'none', border: 'none', padding: '5px 14px', borderRadius: 6, fontSize: 13, cursor: 'pointer', color: '#71717a', fontWeight: 500 },
  modeBtnActive: { background: '#fff', color: '#18181b', fontWeight: 600, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' },
  dateInput:   { border: '1px solid rgba(0,0,0,0.12)', borderRadius: 8, padding: '6px 10px', fontSize: 13, color: '#18181b', background: '#fff', fontFamily: 'inherit', outline: 'none' },
  select:      { border: '1px solid rgba(0,0,0,0.12)', borderRadius: 8, padding: '6px 10px', fontSize: 13, color: '#18181b', background: '#fff', fontFamily: 'inherit', outline: 'none', cursor: 'pointer' },
  tabBar:      { display: 'flex', gap: 4, borderBottom: '2px solid #f4f4f5', marginBottom: 28 },
  tab:         { background: 'none', border: 'none', padding: '10px 18px', fontSize: 14, cursor: 'pointer', color: '#71717a', fontWeight: 500, borderBottom: '2px solid transparent', marginBottom: -2 },
  tabActive:   { color: '#18181b', fontWeight: 600, borderBottomColor: '#18181b' },
  content:     { minHeight: 300 },
  state:       { display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: '#71717a', fontSize: 14 },
  tabContent:  { paddingBottom: 32 },
  twoCol:      { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'start' },
  chartCard:   { background: '#fff', border: '1px solid #e5e5e5', borderRadius: 12, padding: '20px 16px' },
  chartTitle:  { margin: '0 0 12px', fontSize: 13, fontWeight: 600, color: '#71717a', letterSpacing: '0.04em', textTransform: 'uppercase' },
  statsCol:    { display: 'flex', flexDirection: 'column', gap: 0 },
  divider:     { height: 1, background: '#f4f4f5', margin: '10px 0' },
  listTitle:   { fontSize: 13, fontWeight: 600, color: '#71717a', letterSpacing: '0.04em', textTransform: 'uppercase', margin: '0 0 10px' },
  table:       { width: '100%', borderCollapse: 'collapse' },
  th:          { textAlign: 'left', padding: '8px 12px', fontSize: 11, fontWeight: 600, color: '#71717a', borderBottom: '2px solid #f4f4f5', letterSpacing: '0.04em', textTransform: 'uppercase' },
  td:          { padding: '10px 12px', fontSize: 13, borderBottom: '1px solid #f9f9f9' },
  summaryGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 },
  infoBox:     { background: '#fafaf9', border: '1px solid #e5e5e5', borderRadius: 10, padding: '16px 20px' },
  infoLabel:   { margin: 0, fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6, color: '#52525b' },
  infoValue:   { margin: 0, fontSize: 24, fontWeight: 700, color: '#18181b', marginBottom: 4 },
  infoNote:    { margin: 0, fontSize: 12, color: '#a1a1aa' },
  totalPill:   { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 },
  linkBtn:     { display: 'inline-flex', alignItems: 'center', fontSize: 12, color: '#18181b', fontWeight: 600, textDecoration: 'none', padding: '6px 12px', border: '1px solid rgba(0,0,0,0.12)', borderRadius: 8, background: '#fff' },
  emptyState:  { textAlign: 'center', padding: '60px 20px' },
}

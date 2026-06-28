/**
 * Operation Overview — replaces Daily Entry + Daily Summary.
 * Aggregates revenue, payments, expenses, payroll, and summary
 * for a selected Day / Month / date Range. All data is read-only —
 * editing happens on the dedicated POS, Expenses, and Payroll pages.
 */

import { useState, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts'
import { Link } from 'react-router-dom'
import { ExternalLink, ChevronDown, Printer, Plus, Trash2, X } from 'lucide-react'
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

type SalePayment = { id: string; payment_method: string; amount: number; created_at: string }
type SaleItem    = {
  id: string; item_type: string; description: string
  quantity: number; unit_price: number; subtotal: number
  tax_amount: number; notes?: string; inventory_item_id?: string
  wig_serial?: string; wig_brand?: string; wig_color?: string
  wig_length?: string; wig_size?: string; wig_front?: string
}
type Sale = {
  id: string; customer_name: string; customer_phone?: string
  sale_date: string; notes?: string
  total_amount: number; amount_paid: number; balance_due: number
  tax_amount: number; discount_amount: number
  items: SaleItem[]; payments: SalePayment[]
  created_at: string
}
type EditItem = {
  id?: string          // undefined = new item not yet saved
  item_type: string
  description: string
  unit_price: string
  quantity: number
  tax_rate: string     // '0' | '0.045' | '0.08875'
  notes: string
  isWig: boolean
  delete: boolean
}
type SaleEditState = { items: EditItem[]; discount: string; dirty: boolean }

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
const TABS   = ['Revenue', 'Payments', 'Expenses', 'Payroll', 'Summary', 'Sales History'] as const
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
        {activeTab === 'Sales History' ? (
          <SalesHistoryTab start={start} end={end} />
        ) : (
          <>
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
          </>
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

// ── Sales History Tab ─────────────────────────────────────────

const TAX_OPTIONS = [
  { label: '0% (Exempt)',    value: '0'       },
  { label: '4.5% (Service)', value: '0.045'   },
  { label: '8.875% (Prod)',  value: '0.08875' },
]
const ADD_ITEM_TYPES = [
  { label: 'Wash & Set', value: 'wash_set'  },
  { label: 'Repair',     value: 'repair'    },
  { label: 'Product',    value: 'inventory' },
]

function inferTaxRate(tax_amount: number, subtotal: number): string {
  if (!subtotal || tax_amount === 0) return '0'
  const raw = tax_amount / subtotal
  if (raw < 0.02) return '0'
  if (raw < 0.07) return '0.045'
  return '0.08875'
}

// Shows "Mark as Abandoned" only when this sale has a wig whose deposit is
// still pending (not paid in full) — checks live status since SaleItem only
// has the price at time of sale, not current payment state.
function AbandonSaleButton({ sale, onDone }: { sale: Sale; onDone: () => void }) {
  const wigItems = sale.items.filter(i => i.item_type === 'wig' && i.inventory_item_id)
  const ids = wigItems.map(w => w.inventory_item_id).join(',')

  const { data: wigStates = [] } = useQuery({
    queryKey: ['wig-live-state', ids],
    queryFn: () => Promise.all(
      wigItems.map(w => api.get(`/inventory/${w.inventory_item_id}`).then(r => r.data))
    ),
    enabled: wigItems.length > 0,
  })

  const [busy, setBusy] = useState(false)
  const eligible = wigStates.find((w: any) => w.sale_status !== 'paid_in_full' && Number(w.amount_paid) > 0)
  if (!eligible) return null

  return (
    <button
      disabled={busy}
      onClick={async () => {
        const label = eligible.daysmart_serial || eligible.brand || 'this wig'
        if (!window.confirm(
          `Mark "${label}" as abandoned?\n\n$${Number(eligible.amount_paid).toFixed(2)} deposit will be kept as revenue and the wig returned to inventory. This cannot be undone.`
        )) return
        setBusy(true)
        try {
          await api.post(`/inventory/${eligible.id}/abandon-sale`)
          onDone()
        } finally {
          setBusy(false)
        }
      }}
      style={{ padding: '7px 14px', background: '#fef3c7', border: '1px solid rgba(217,119,6,0.3)', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#92400e', cursor: busy ? 'default' : 'pointer', fontFamily: 'inherit' }}
    >
      {busy ? 'Marking…' : 'Mark as Abandoned'}
    </button>
  )
}

function SalesHistoryTab({ start, end }: { start: string; end: string }) {
  const queryClient = useQueryClient()

  const { data: sales = [], isLoading, isError } = useQuery<Sale[]>({
    queryKey: ['sales-range', start, end],
    queryFn: () => api.get(`/pos-sales/?start=${start}&end=${end}`).then(r => r.data),
    enabled: !!start && !!end && start <= end,
    staleTime: 0,
  })

  const [expandedId,   setExpandedId]   = useState<string | null>(null)
  const [editMap,      setEditMap]      = useState<Record<string, SaleEditState>>({})
  const [saving,       setSaving]       = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [deleteReason, setDeleteReason] = useState('')
  const [deleting,     setDeleting]     = useState(false)

  const byDate: [string, Sale[]][] = useMemo(() => {
    const groups: Record<string, Sale[]> = {}
    for (const sale of sales) {
      if (!groups[sale.sale_date]) groups[sale.sale_date] = []
      groups[sale.sale_date].push(sale)
    }
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a))
  }, [sales])

  function openSale(sale: Sale) {
    if (expandedId === sale.id) { setExpandedId(null); return }
    setExpandedId(sale.id)
    if (!editMap[sale.id]) {
      setEditMap(m => ({
        ...m,
        [sale.id]: {
          items: sale.items.map(i => ({
            id: i.id,
            item_type: i.item_type,
            description: i.description,
            unit_price: String(i.unit_price),
            quantity: i.quantity,
            tax_rate: inferTaxRate(i.tax_amount, i.subtotal),
            notes: i.notes || '',
            isWig: i.item_type === 'wig',
            delete: false,
          })),
          discount: String(sale.discount_amount),
          dirty: false,
        },
      }))
    }
  }

  function updateItem(saleId: string, idx: number, patch: Partial<EditItem>) {
    setEditMap(m => {
      const es = m[saleId]
      if (!es) return m
      const items = [...es.items]
      items[idx] = { ...items[idx], ...patch }
      return { ...m, [saleId]: { ...es, items, dirty: true } }
    })
  }

  function removeItem(saleId: string, idx: number) {
    setEditMap(m => {
      const es = m[saleId]
      if (!es) return m
      const item = es.items[idx]
      if (!item.id) {
        // New unsaved item — remove from array directly
        const items = es.items.filter((_, i) => i !== idx)
        return { ...m, [saleId]: { ...es, items, dirty: true } }
      }
      // Existing item — mark for server-side deletion
      const items = [...es.items]
      items[idx] = { ...items[idx], delete: true }
      return { ...m, [saleId]: { ...es, items, dirty: true } }
    })
  }

  function addItem(saleId: string) {
    setEditMap(m => {
      const es = m[saleId]
      if (!es) return m
      return {
        ...m,
        [saleId]: {
          ...es,
          items: [...es.items, {
            id: undefined, item_type: 'wash_set', description: '',
            unit_price: '', quantity: 1, tax_rate: '0.045',
            notes: '', isWig: false, delete: false,
          }],
          dirty: true,
        },
      }
    })
  }

  function previewTotals(es: SaleEditState) {
    const active = es.items.filter(i => !i.delete)
    const subtotal = active.reduce((s, i) => s + (parseFloat(i.unit_price) || 0) * i.quantity, 0)
    const tax      = active.reduce((s, i) => {
      const price = (parseFloat(i.unit_price) || 0) * i.quantity
      return s + price * (parseFloat(i.tax_rate) || 0)
    }, 0)
    const disc = parseFloat(es.discount) || 0
    return { subtotal, tax, total: subtotal + tax - disc }
  }

  async function saveSale(saleId: string) {
    const es = editMap[saleId]
    if (!es) return
    setSaving(saleId)
    try {
      await api.put(`/pos-sales/${saleId}/items`, {
        items: es.items.map(i => ({
          id:          i.id ?? null,
          item_type:   i.item_type,
          description: i.description,
          unit_price:  parseFloat(i.unit_price) || 0,
          quantity:    i.quantity,
          tax_rate:    parseFloat(i.tax_rate) || 0,
          notes:       i.notes || null,
          delete:      i.delete,
        })),
        discount_amount: parseFloat(es.discount) || 0,
      })
      setEditMap(m => ({ ...m, [saleId]: { ...m[saleId], dirty: false } }))
      queryClient.invalidateQueries({ queryKey: ['sales-range'] })
      queryClient.invalidateQueries({ queryKey: ['operation-overview'] })
    } catch (e: any) {
      alert(e?.response?.data?.detail || 'Save failed')
    } finally {
      setSaving(null)
    }
  }

  async function doDelete() {
    if (!deleteTarget || !deleteReason.trim()) return
    setDeleting(true)
    try {
      await api.delete(`/pos-sales/${deleteTarget}`, { data: { reason: deleteReason.trim() } })
      setDeleteTarget(null)
      setDeleteReason('')
      if (expandedId === deleteTarget) setExpandedId(null)
      queryClient.invalidateQueries({ queryKey: ['sales-range'] })
      queryClient.invalidateQueries({ queryKey: ['operation-overview'] })
    } catch (e: any) {
      alert(e?.response?.data?.detail || 'Delete failed')
    } finally {
      setDeleting(false)
    }
  }

  function printDailyList() {
    const win = window.open('', '_blank', 'width=640,height=800')
    if (!win) return
    const dateLabel = start === end
      ? new Date(start + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
      : `${start} — ${end}`
    const saleBlocks = sales.map(sale => {
      const itemLines = sale.items.map(i =>
        `  ${i.description.padEnd(32, '.')} ${fmt(i.unit_price)}`
      ).join('\n')
      const pmtLine = sale.payments.map(p => `${p.payment_method.replace(/_/g,' ')}: ${fmt(p.amount)}`).join('  |  ')
      return [
        sale.customer_name + (sale.customer_phone ? `   ${sale.customer_phone}` : ''),
        itemLines,
        `  ${'─'.repeat(42)}`,
        `  Tax: ${fmt(sale.tax_amount)}   Disc: -${fmt(sale.discount_amount)}   TOTAL: ${fmt(sale.total_amount)}`,
        `  ${pmtLine}`,
      ].join('\n')
    }).join('\n\n' + '═'.repeat(50) + '\n\n')
    const grandTotal = sales.reduce((s, x) => s + x.total_amount, 0)
    win.document.write(`<pre style="font-family:monospace;font-size:12px;padding:24px;white-space:pre-wrap">THE SALON — Daily Sales Report\n${dateLabel}\n${'═'.repeat(50)}\n\n${saleBlocks}\n\n${'═'.repeat(50)}\nTotal: ${sales.length} sale${sales.length !== 1 ? 's' : ''}   Grand Total: ${fmt(grandTotal)}</pre>`)
    win.document.close()
    win.focus()
    setTimeout(() => win.print(), 300)
  }

  function printReceipt(sale: Sale) {
    const win = window.open('', '_blank', 'width=900,height=700')
    if (!win) return

    const fmtDate = (iso: string) =>
      new Date(iso).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })

    const ordDate = fmtDate(sale.created_at || sale.sale_date + 'T00:00:00')

    const itemRows = sale.items.map(i => {
      const wigCols = i.wig_serial
        ? `<td>${i.wig_serial}</td><td>${i.wig_brand ?? ''}</td><td>${i.wig_length ?? ''}</td><td>${i.wig_color ?? ''}</td><td>${i.wig_front ?? ''}</td>`
        : `<td colspan="5" style="color:#888;font-style:italic">${i.description}${i.notes ? ` — ${i.notes}` : ''}</td>`
      return `<tr>
        ${wigCols}
        <td style="text-align:right">${fmt(i.unit_price * i.quantity)}</td>
        <td style="color:#888">${ordDate}</td>
      </tr>`
    }).join('')

    const pmtRows = sale.payments.map(p => `<tr>
      <td style="text-align:right">${fmt(p.amount)}</td>
      <td>${fmtDate(p.created_at)}</td>
      <td style="text-transform:capitalize">${p.payment_method.replace(/_/g, ' ')}</td>
    </tr>`).join('')

    const totalPaid   = sale.payments.reduce((s, p) => s + p.amount, 0)

    win.document.write(`<html><head><title>Receipt — ${sale.customer_name}</title>
    <style>
      body { font-family: Arial, sans-serif; font-size: 12px; padding: 24px; color: #111; }
      h2 { margin: 0 0 2px; font-size: 15px; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
      th, td { border: 1px solid #ccc; padding: 5px 8px; }
      th { background: #f5f5f5; font-size: 11px; text-align: left; }
      .header-table td { border: none; padding: 3px 8px; }
      .section-label { font-size: 11px; font-weight: bold; margin: 14px 0 4px; color: #555; text-transform: uppercase; letter-spacing: 0.05em; }
      .totals { text-align: right; font-size: 12px; margin-top: 8px; }
      .totals td { border: none; padding: 2px 8px; }
      @media print { body { padding: 8px; } }
    </style></head><body>

    <h2>THE SALON</h2>

    <table class="header-table" style="margin-bottom:12px">
      <tr>
        <th>Last Name</th><th>First Name</th><th>Phone</th><th>Order Date</th><th>Total Amt</th>${sale.notes ? '<th>Note</th>' : ''}
      </tr>
      <tr>
        ${(() => { const parts = sale.customer_name.split(' '); const first = parts[0]; const last = parts.slice(1).join(' ') || ''; return `<td>${last}</td><td>${first}</td>` })()}
        <td>${sale.customer_phone ?? ''}</td>
        <td>${ordDate}</td>
        <td><b>${fmt(sale.total_amount)}</b></td>
        ${sale.notes ? `<td>${sale.notes}</td>` : ''}
      </tr>
    </table>

    <div class="section-label">Order Detail</div>
    <table>
      <thead><tr>
        <th>Wig</th><th>Company</th><th>Length</th><th>Color</th><th>Front</th><th style="text-align:right">Total</th><th>Date</th>
      </tr></thead>
      <tbody>${itemRows}</tbody>
    </table>

    ${sale.discount_amount > 0 ? `<div style="text-align:right;font-size:12px;margin-bottom:8px">Discount: <b>-${fmt(sale.discount_amount)}</b></div>` : ''}

    <div class="section-label">Payments</div>
    <table>
      <thead><tr><th style="text-align:right">Amount</th><th>Date</th><th>Method</th></tr></thead>
      <tbody>${pmtRows}</tbody>
    </table>

    <table class="totals">
      <tr><td>Total Payment:</td><td><b>${fmt(totalPaid)}</b></td></tr>
      ${sale.balance_due > 0 ? `<tr><td style="color:#c00">Balance Due:</td><td style="color:#c00"><b>${fmt(sale.balance_due)}</b></td></tr>` : ''}
    </table>

    <script>window.onload=()=>setTimeout(()=>window.print(),200)</script>
    </body></html>`)
    win.document.close()
  }

  if (isLoading) return <div style={s.state}>Loading sales…</div>
  if (isError)   return <div style={{ ...s.state, color: '#ef4444' }}>Failed to load sales.</div>

  return (
    <div style={s.tabContent}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <p style={{ ...s.listTitle, margin: 0 }}>{sales.length} sale{sales.length !== 1 ? 's' : ''} in period</p>
        {sales.length > 0 && (
          <button onClick={printDailyList} style={{ ...s.linkBtn, gap: 6 }}>
            <Printer size={13} />Print Daily List
          </button>
        )}
      </div>

      {sales.length === 0 && (
        <div style={s.emptyState}>
          <p style={{ color: '#a1a1aa', fontSize: 14 }}>No sales in this period.</p>
        </div>
      )}

      {byDate.map(([dateStr, dateSales]) => {
        const dayTotal = dateSales.reduce((sum, x) => sum + x.total_amount, 0)
        const dayLabel = new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
          weekday: 'short', month: 'short', day: 'numeric',
        })
        return (
          <div key={dateStr} style={{ marginBottom: 28 }}>
            {/* Date group header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#71717a', letterSpacing: '0.07em', textTransform: 'uppercase' }}>{dayLabel}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#71717a' }}>{fmt(dayTotal)}</span>
            </div>

            {/* Sale rows */}
            <div style={{ border: '1px solid #e5e5e5', borderRadius: 10, overflow: 'hidden' }}>
              {dateSales.map((sale, si) => {
                const isExpanded = expandedId === sale.id
                const es = editMap[sale.id]
                const pmtLabel = sale.payments.map(p => p.payment_method.replace(/_/g, ' ')).join(' · ')
                const isLast = si === dateSales.length - 1

                return (
                  <div key={sale.id} style={{ borderBottom: isLast ? 'none' : '1px solid #f4f4f5' }}>
                    {/* Row header */}
                    <div
                      onClick={() => openSale(sale)}
                      style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', cursor: 'pointer', background: isExpanded ? '#f9f9f9' : '#fff', gap: 12, userSelect: 'none' }}
                    >
                      <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: '#18181b' }}>{sale.customer_name}</span>
                        {sale.customer_phone && <span style={{ fontSize: 12, color: '#a1a1aa' }}>{sale.customer_phone}</span>}
                        {sale.items.filter(i => i.wig_serial).map(i => (
                          <span key={i.id} style={{ fontSize: 11, fontWeight: 600, background: '#f4f4f5', color: '#71717a', borderRadius: 4, padding: '1px 7px', letterSpacing: '0.02em' }}>
                            {i.wig_serial}
                          </span>
                        ))}
                      </div>
                      <span style={{ fontSize: 12, color: '#a1a1aa', flexShrink: 0 }}>{sale.items.length} item{sale.items.length !== 1 ? 's' : ''}</span>
                      <span style={{ fontSize: 12, color: '#71717a', flexShrink: 0 }}>{pmtLabel}</span>
                      {sale.balance_due > 0 && (
                        <span style={{ fontSize: 11, fontWeight: 600, color: '#ef4444', background: '#fef2f2', padding: '2px 6px', borderRadius: 4, flexShrink: 0 }}>
                          Owes {fmt(sale.balance_due)}
                        </span>
                      )}
                      <span style={{ fontSize: 14, fontWeight: 700, color: '#18181b', flexShrink: 0 }}>{fmt(sale.total_amount)}</span>
                      <ChevronDown size={15} style={{ color: '#71717a', flexShrink: 0, transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
                    </div>

                    {/* Expanded detail */}
                    {isExpanded && es && (
                      <div style={{ background: '#fafaf9', borderTop: '1px solid #f0f0f0', padding: '16px 20px' }}>

                        {/* Items table */}
                        <table style={{ ...s.table, marginBottom: 12 }}>
                          <thead>
                            <tr>
                              <th style={s.th}>Item</th>
                              <th style={{ ...s.th, width: 100 }}>Price</th>
                              <th style={{ ...s.th, width: 140 }}>Tax Rate</th>
                              <th style={{ ...s.th, width: 32 }} />
                            </tr>
                          </thead>
                          <tbody>
                            {es.items.map((item, idx) => item.delete ? null : (
                              <tr key={idx}>
                                {/* Description cell */}
                                <td style={s.td}>
                                  {/* Type selector for new items */}
                                  {!item.id && (
                                    <select
                                      value={item.item_type}
                                      onChange={e => updateItem(sale.id, idx, { item_type: e.target.value })}
                                      style={{ marginBottom: 4, width: '100%', border: '1px solid #e5e5e5', borderRadius: 6, padding: '4px 8px', fontSize: 12, fontFamily: 'inherit', outline: 'none', background: '#fff', cursor: 'pointer' }}
                                    >
                                      {ADD_ITEM_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                    </select>
                                  )}
                                  {/* Description: read-only for wigs, editable for all else */}
                                  {item.isWig ? (() => {
                                    const orig = sale.items.find(o => o.id === item.id)
                                    const specs = [orig?.wig_serial, orig?.wig_brand, orig?.wig_color, orig?.wig_length, orig?.wig_front].filter(Boolean)
                                    return (
                                      <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                          <span style={{ fontSize: 13, color: '#18181b' }}>{item.description}</span>
                                          <span style={{ fontSize: 10, background: '#f4f4f5', color: '#71717a', padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>Wig</span>
                                        </div>
                                        {specs.length > 0 && (
                                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                                            {specs.map((v, i) => (
                                              <span key={i} style={{ fontSize: 11, color: '#71717a', background: 'rgba(113,113,122,0.08)', borderRadius: 4, padding: '1px 6px' }}>{v}</span>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    )
                                  })() : (
                                    <>
                                      <input
                                        value={item.description}
                                        placeholder="Description…"
                                        onChange={e => updateItem(sale.id, idx, { description: e.target.value })}
                                        style={{ width: '100%', border: '1px solid #e5e5e5', borderRadius: 6, padding: '4px 8px', fontSize: 13, fontFamily: 'inherit', outline: 'none', background: '#fff', boxSizing: 'border-box' }}
                                      />
                                      <input
                                        value={item.notes}
                                        placeholder="Notes…"
                                        onChange={e => updateItem(sale.id, idx, { notes: e.target.value })}
                                        style={{ marginTop: 4, width: '100%', border: '1px solid #f0f0f0', borderRadius: 6, padding: '3px 8px', fontSize: 11, fontFamily: 'inherit', outline: 'none', background: '#fff', color: '#71717a', boxSizing: 'border-box' }}
                                      />
                                    </>
                                  )}
                                </td>
                                {/* Price */}
                                <td style={s.td}>
                                  <input
                                    type="number"
                                    value={item.unit_price}
                                    onChange={e => updateItem(sale.id, idx, { unit_price: e.target.value })}
                                    style={{ width: 84, border: '1px solid #e5e5e5', borderRadius: 6, padding: '4px 8px', fontSize: 13, fontFamily: 'inherit', outline: 'none', background: '#fff' }}
                                  />
                                </td>
                                {/* Tax rate */}
                                <td style={s.td}>
                                  {item.isWig ? (
                                    <span style={{ fontSize: 12, color: '#a1a1aa' }}>—</span>
                                  ) : (
                                    <select
                                      value={item.tax_rate}
                                      onChange={e => updateItem(sale.id, idx, { tax_rate: e.target.value })}
                                      style={{ border: '1px solid #e5e5e5', borderRadius: 6, padding: '4px 8px', fontSize: 12, fontFamily: 'inherit', outline: 'none', background: '#fff', cursor: 'pointer' }}
                                    >
                                      {TAX_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                    </select>
                                  )}
                                </td>
                                {/* Delete */}
                                <td style={{ ...s.td, textAlign: 'center', paddingLeft: 0 }}>
                                  {!item.isWig && (
                                    <button onClick={() => removeItem(sale.id, idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d1d5db', padding: 4, lineHeight: 1 }}>
                                      <X size={14} />
                                    </button>
                                  )}
                                </td>
                              </tr>
                            ))}
                            {/* Add item row */}
                            <tr>
                              <td colSpan={4} style={{ padding: '8px 12px' }}>
                                <button onClick={() => addItem(sale.id)} style={{ background: 'none', border: '1px dashed #d1d5db', borderRadius: 6, padding: '4px 12px', fontSize: 12, color: '#71717a', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: 'inherit' }}>
                                  <Plus size={12} />Add item
                                </button>
                              </td>
                            </tr>
                          </tbody>
                        </table>

                        {/* Sale-level discount */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                          <span style={{ fontSize: 12, color: '#71717a', minWidth: 70 }}>Discount:</span>
                          <input
                            type="number"
                            value={es.discount}
                            onChange={e => setEditMap(m => ({ ...m, [sale.id]: { ...m[sale.id], discount: e.target.value, dirty: true } }))}
                            style={{ width: 84, border: '1px solid #e5e5e5', borderRadius: 6, padding: '4px 8px', fontSize: 13, fontFamily: 'inherit', outline: 'none', background: '#fff' }}
                          />
                        </div>

                        {/* Totals preview (only when edits are pending) */}
                        {es.dirty && (() => {
                          const p = previewTotals(es)
                          return (
                            <div style={{ background: '#fff', border: '1px solid #e5e5e5', borderRadius: 8, padding: '9px 14px', marginBottom: 12, display: 'flex', gap: 20, fontSize: 12, flexWrap: 'wrap' }}>
                              <span style={{ color: '#71717a' }}>Subtotal: <b style={{ color: '#18181b' }}>{fmt(p.subtotal)}</b></span>
                              <span style={{ color: '#71717a' }}>Tax: <b style={{ color: '#18181b' }}>{fmt(p.tax)}</b></span>
                              <span style={{ color: '#71717a' }}>Total: <b style={{ color: '#18181b', fontSize: 13 }}>{fmt(p.total)}</b></span>
                            </div>
                          )
                        })()}

                        {/* Action bar */}
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <button
                            onClick={() => saveSale(sale.id)}
                            disabled={!es.dirty || saving === sale.id}
                            style={{ padding: '7px 16px', background: es.dirty ? '#18181b' : '#e5e5e5', color: es.dirty ? '#fff' : '#a1a1aa', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: es.dirty ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}
                          >
                            {saving === sale.id ? 'Saving…' : 'Save Changes'}
                          </button>
                          <button
                            onClick={() => printReceipt(sale)}
                            style={{ padding: '7px 14px', background: 'none', border: '1px solid #e5e5e5', borderRadius: 8, fontSize: 13, color: '#71717a', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: 'inherit' }}
                          >
                            <Printer size={13} />Receipt
                          </button>
                          <div style={{ flex: 1 }} />
                          <AbandonSaleButton
                            sale={sale}
                            onDone={() => {
                              queryClient.invalidateQueries({ queryKey: ['sales-range'] })
                              queryClient.invalidateQueries({ queryKey: ['operation-overview'] })
                            }}
                          />
                          <button
                            onClick={() => { setDeleteTarget(sale.id); setDeleteReason('') }}
                            style={{ padding: '7px 14px', background: 'none', border: '1px solid #fecaca', borderRadius: 8, fontSize: 13, color: '#ef4444', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: 'inherit' }}
                          >
                            <Trash2 size={13} />Delete Sale
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      {/* Delete confirmation dialog */}
      {deleteTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: '28px 32px', maxWidth: 400, width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 17, fontWeight: 700, color: '#18181b' }}>Delete Sale</h3>
            <p style={{ margin: '0 0 16px', fontSize: 13, color: '#71717a' }}>This cannot be undone. Provide a reason for the deletion.</p>
            <textarea
              value={deleteReason}
              onChange={e => setDeleteReason(e.target.value)}
              placeholder="Reason for deletion…"
              style={{ width: '100%', border: '1px solid #e5e5e5', borderRadius: 8, padding: '10px 12px', fontSize: 13, fontFamily: 'inherit', outline: 'none', resize: 'vertical', minHeight: 72, boxSizing: 'border-box' }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button onClick={() => { setDeleteTarget(null); setDeleteReason('') }} style={{ flex: 1, padding: '9px 0', background: '#f4f4f5', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#71717a', fontFamily: 'inherit' }}>
                Cancel
              </button>
              <button
                onClick={doDelete}
                disabled={!deleteReason.trim() || deleting}
                style={{ flex: 1, padding: '9px 0', background: deleteReason.trim() ? '#ef4444' : '#fecaca', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: deleteReason.trim() ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
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

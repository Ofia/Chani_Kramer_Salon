import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Trash2 } from 'lucide-react'
import { api } from '../../lib/api'

type WigPayment = {
  id: string
  payment_date: string
  amount: number
  payment_method: string
  payment_type: string
}

type WigOrder = {
  id: string
  daysmart_serial?: string
  customer_name: string
  customer_phone?: string
  brand?: string
  length?: string
  color?: string
  size?: string
  front?: string
  base_price: number
  fill_lace_price: number
  total_price: number
  amount_paid: number
  balance_due: number
  status: 'ordered' | 'ready' | 'paid_in_full'
  order_date: string
  pickup_date?: string
  notes?: string
  payments: WigPayment[]
}

const STATUS_LABEL: Record<string, string> = {
  ordered: 'In Production',
  ready: 'Ready for Pickup',
  paid_in_full: 'Paid in Full',
}

const STATUS_COLOR: Record<string, string> = {
  ordered: '#E3CD94',
  ready: '#97BBE9',
  paid_in_full: '#10b981',
}

const METHOD_LABEL: Record<string, string> = {
  cash: 'Cash', credit_card: 'CC', quickpay: 'QuickPay', check: 'Check', zelle: 'Zelle',
}

export default function WigOrdersPage() {
  const [tab, setTab] = useState<'in_progress' | 'completed'>('in_progress')
  const [expanded, setExpanded] = useState<string | null>(null)

  const qc = useQueryClient()

  const { data: allWigs = [], isLoading } = useQuery<WigOrder[]>({
    queryKey: ['wig-orders-all'],
    queryFn: () => api.get('/wig-orders/').then(r => r.data),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/wig-orders/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wig-orders-all'] }),
  })

  function handleDelete(w: WigOrder) {
    if (!confirm(`Delete wig order for ${w.customer_name}? This cannot be undone.`)) return
    deleteMutation.mutate(w.id)
  }

  const inProgress = allWigs.filter(w => w.status !== 'paid_in_full')
  const completed  = allWigs.filter(w => w.status === 'paid_in_full')
  const wigs = tab === 'in_progress' ? inProgress : completed

  const totalBalance   = inProgress.reduce((s, w) => s + Number(w.balance_due), 0)
  const totalCompleted = completed.reduce((s, w) => s + Number(w.total_price), 0)

  return (
    <div>
      <header style={s.header}>
        <div>
          <h1 style={s.title}>Wig Orders</h1>
          <p style={s.subtitle}>Track every wig from sale to pickup</p>
        </div>

        {/* Stats */}
        <div style={s.statsRow}>
          <StatPill label="In Progress" value={inProgress.length} color="#DF5198" />
          <StatPill label="Outstanding" value={`$${totalBalance.toFixed(0)}`} color="#E3CD94" />
          <StatPill label="Completed" value={completed.length} color="#10b981" />
          <StatPill label="Revenue (sold)" value={`$${totalCompleted.toFixed(0)}`} color="#97BBE9" />
        </div>
      </header>

      {/* Tabs */}
      <div style={s.tabRow}>
        <TabBtn active={tab === 'in_progress'} onClick={() => setTab('in_progress')}>
          In Progress <span style={s.tabBadge}>{inProgress.length}</span>
        </TabBtn>
        <TabBtn active={tab === 'completed'} onClick={() => setTab('completed')}>
          Completed <span style={s.tabBadge}>{completed.length}</span>
        </TabBtn>
      </div>

      {isLoading ? (
        <p style={{ color: '#71717a', fontSize: 14 }}>Loading…</p>
      ) : wigs.length === 0 ? (
        <div style={s.empty}>
          <p style={s.emptyText}>{tab === 'in_progress' ? 'No wigs in progress.' : 'No completed orders yet.'}</p>
        </div>
      ) : (
        <div style={s.table}>
          {/* Header row */}
          <div style={s.tableHead}>
            <Cell w={140}>Client</Cell>
            <Cell w={110}>Serial / Brand</Cell>
            <Cell w={90}>Specs</Cell>
            <Cell w={90} right>Total</Cell>
            <Cell w={90} right>{tab === 'in_progress' ? 'Balance' : 'Paid'}</Cell>
            <Cell w={110}>
              {tab === 'in_progress' ? 'Status' : 'Picked Up'}
            </Cell>
            <Cell w={90}>Order Date</Cell>
            <Cell w={36} />
          </div>

          {wigs.map(w => (
            <div key={w.id}>
              <div
                style={{ ...s.tableRow, cursor: 'pointer', background: expanded === w.id ? '#fafaf9' : '#fff' }}
                onClick={() => setExpanded(expanded === w.id ? null : w.id)}
              >
                <Cell w={140}>
                  <span style={s.clientName}>{w.customer_name}</span>
                  {w.customer_phone && <span style={s.phone}>{w.customer_phone}</span>}
                </Cell>
                <Cell w={110}>
                  <span style={s.serial}>{w.daysmart_serial || '—'}</span>
                  {w.brand && <span style={s.brand}>{w.brand}</span>}
                </Cell>
                <Cell w={90}>
                  <span style={s.specs}>
                    {[w.length, w.color].filter(Boolean).join(' · ') || '—'}
                  </span>
                </Cell>
                <Cell w={90} right>
                  <span style={s.price}>${Number(w.total_price).toFixed(2)}</span>
                </Cell>
                <Cell w={90} right>
                  {tab === 'in_progress' ? (
                    <span style={{ ...s.price, color: w.balance_due > 0 ? '#DF5198' : '#10b981' }}>
                      ${Number(w.balance_due).toFixed(2)}
                    </span>
                  ) : (
                    <span style={{ ...s.price, color: '#10b981' }}>${Number(w.amount_paid).toFixed(2)}</span>
                  )}
                </Cell>
                <Cell w={110}>
                  {tab === 'in_progress' ? (
                    <span style={{ ...s.badge, background: STATUS_COLOR[w.status] + '33', color: STATUS_COLOR[w.status] }}>
                      {STATUS_LABEL[w.status]}
                    </span>
                  ) : (
                    <span style={s.specs}>{w.pickup_date ? fmt(w.pickup_date) : '—'}</span>
                  )}
                </Cell>
                <Cell w={90}>
                  <span style={s.specs}>{fmt(w.order_date)}</span>
                </Cell>
                <Cell w={36}>
                  <button
                    onClick={e => { e.stopPropagation(); handleDelete(w) }}
                    disabled={deleteMutation.isPending}
                    style={s.deleteBtn}
                    title="Delete wig order"
                  >
                    <Trash2 size={14} />
                  </button>
                </Cell>
              </div>

              {/* Expanded payment history */}
              {expanded === w.id && (
                <div style={s.expandedRow}>
                  <div style={s.expandedInner}>
                    <p style={s.expandedTitle}>Payment History</p>
                    {w.payments.length === 0 ? (
                      <p style={{ fontSize: 12, color: '#a1a1aa' }}>No payments recorded.</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {w.payments.map(p => (
                          <div key={p.id} style={s.paymentRow}>
                            <span style={s.paymentDate}>{fmt(p.payment_date)}</span>
                            <span style={{ ...s.paymentType, color: p.payment_type === 'final' ? '#10b981' : '#5581B1' }}>
                              {p.payment_type.charAt(0).toUpperCase() + p.payment_type.slice(1)}
                            </span>
                            <span style={s.paymentMethod}>{METHOD_LABEL[p.payment_method] ?? p.payment_method}</span>
                            <span style={s.paymentAmount}>${Number(p.amount).toFixed(2)}</span>
                          </div>
                        ))}
                        <div style={s.paymentRow}>
                          <span style={{ ...s.paymentDate, color: '#71717a' }}>Total paid</span>
                          <span />
                          <span />
                          <span style={{ ...s.paymentAmount, fontWeight: 700 }}>${Number(w.amount_paid).toFixed(2)}</span>
                        </div>
                      </div>
                    )}
                    {w.notes && (
                      <p style={{ fontSize: 12, color: '#71717a', marginTop: 8 }}>Note: {w.notes}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Helpers ──────────────────────────────────────────────────

function fmt(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
}

function Cell({ children, w, right }: { children?: React.ReactNode; w: number; right?: boolean }) {
  return (
    <div style={{ width: w, flexShrink: 0, textAlign: right ? 'right' : 'left', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      {children}
    </div>
  )
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{ ...s.tab, color: active ? '#18181b' : '#71717a', fontWeight: active ? 600 : 500 }}>
      {children}
      <span style={{
        position: 'absolute', bottom: -1, left: 0, right: 0,
        height: 2, background: active ? '#18181b' : 'transparent',
        pointerEvents: 'none',
      }} />
    </button>
  )
}

function StatPill({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div style={s.statPill}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
      <span style={s.statLabel}>{label}</span>
      <span style={{ ...s.statValue, color }}>{value}</span>
    </div>
  )
}

// ── Styles ───────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  header: { marginBottom: 28 },
  title: { fontSize: 26, fontWeight: 700, color: '#18181b', margin: '0 0 4px', letterSpacing: '-0.03em' },
  subtitle: { fontSize: 13, color: '#71717a', margin: '0 0 20px' },

  statsRow: { display: 'flex', gap: 10, flexWrap: 'wrap' },
  statPill: {
    display: 'flex', alignItems: 'center', gap: 7,
    padding: '8px 14px', background: '#fff',
    border: '1px solid rgba(0,0,0,0.08)', borderRadius: 10,
  },
  statLabel: { fontSize: 12, color: '#71717a' },
  statValue: { fontSize: 13, fontWeight: 700 },

  tabRow: { display: 'flex', gap: 0, marginBottom: 16, borderBottom: '1px solid rgba(0,0,0,0.08)' },
  tab: {
    position: 'relative',
    padding: '8px 18px 10px', border: 'none', background: 'transparent',
    fontSize: 13, fontWeight: 500, color: '#71717a', cursor: 'pointer',
    fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6,
  },
  tabBadge: {
    background: 'rgba(0,0,0,0.07)', color: '#71717a',
    borderRadius: 20, padding: '1px 7px', fontSize: 11, fontWeight: 600,
  },

  empty: { padding: '60px 0', textAlign: 'center' },
  emptyText: { fontSize: 14, color: '#a1a1aa' },

  table: { display: 'flex', flexDirection: 'column', border: '1px solid rgba(0,0,0,0.07)', borderRadius: 14, overflow: 'hidden' },

  tableHead: {
    display: 'flex', gap: 12, padding: '10px 16px',
    background: '#fafaf9', borderBottom: '1px solid rgba(0,0,0,0.07)',
  },
  tableRow: {
    display: 'flex', gap: 12, padding: '12px 16px',
    borderBottom: '1px solid rgba(0,0,0,0.05)',
    transition: 'background 0.1s',
  },

  clientName: { fontSize: 13, fontWeight: 600, color: '#18181b', display: 'block' },
  phone: { fontSize: 11, color: '#a1a1aa', display: 'block' },
  serial: { fontSize: 12, fontWeight: 600, color: '#18181b', display: 'block', fontFamily: 'monospace' },
  brand: { fontSize: 11, color: '#71717a', display: 'block' },
  specs: { fontSize: 12, color: '#71717a' },
  price: { fontSize: 13, fontWeight: 700, color: '#18181b' },
  badge: { fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 6, display: 'inline-block' },

  expandedRow: { background: '#fafaf9', borderBottom: '1px solid rgba(0,0,0,0.05)' },
  expandedInner: { padding: '14px 16px 14px 28px' },
  expandedTitle: { fontSize: 11, fontWeight: 700, color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 10px' },

  deleteBtn: {
    background: 'none', border: 'none', cursor: 'pointer',
    color: '#a1a1aa', padding: 4, borderRadius: 6, display: 'flex', alignItems: 'center',
    transition: 'color 0.15s',
  },
  paymentRow: { display: 'flex', gap: 16, alignItems: 'center', padding: '6px 0', borderBottom: '1px solid rgba(0,0,0,0.04)' },
  paymentDate: { fontSize: 12, color: '#18181b', width: 90 },
  paymentType: { fontSize: 11, fontWeight: 600, width: 70 },
  paymentMethod: { fontSize: 12, color: '#71717a', width: 80 },
  paymentAmount: { fontSize: 13, fontWeight: 600, color: '#18181b', marginLeft: 'auto' },
}

/**
 * Owner Dashboard — analysis + interactive data.
 *
 * Shows:
 *   - Monthly financial summary (current month)
 *   - Revenue vs. expense trend (last 30 days of snapshots)
 *   - Toggle: detailed view vs. summary view
 */

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'

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
      const end = now.toISOString().split('T')[0]
      const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      return api.get(`/financials/snapshots?start_date=${start}&end_date=${end}`).then(r => r.data)
    },
  })

  return (
    <div>
      {/* Header + toggle */}
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>Overview</h1>
          <p style={styles.subtitle}>{now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>
        </div>
        <div style={styles.toggle}>
          <button
            onClick={() => setView('summary')}
            style={{ ...styles.toggleBtn, ...(view === 'summary' ? styles.toggleBtnActive : {}) }}
          >
            Summary
          </button>
          <button
            onClick={() => setView('detailed')}
            style={{ ...styles.toggleBtn, ...(view === 'detailed' ? styles.toggleBtnActive : {}) }}
          >
            Detailed
          </button>
        </div>
      </header>

      {isLoading ? (
        <p style={{ color: '#6A6560', fontSize: 14 }}>Loading…</p>
      ) : !monthly || monthly.days_with_data === 0 ? (
        <div style={styles.emptyCard}>
          <p style={styles.emptyText}>No data yet this month.</p>
        </div>
      ) : (
        <>
          {/* Key numbers — always visible */}
          <div style={styles.statsBar}>
            <BigStat label="Revenue"      value={fmt(monthly.total_revenue)}   />
            <BigStat label="Expenses"     value={fmt(monthly.total_expenses)}  />
            <BigStat label="Payroll"      value={fmt(monthly.total_payroll)}   />
            <BigStat label="Net Profit"   value={fmt(monthly.net_profit)}      highlight />
          </div>

          {/* Summary view */}
          {view === 'summary' && (
            <div style={styles.summaryGrid}>
              <MetricCard label="Bank Portion (40%)"  value={fmt(monthly.bank_portion)} />
              <MetricCard label="Owner Portion (60%)" value={fmt(monthly.owner_portion)} />
              <MetricCard label="Total Tithes"        value={fmt(monthly.total_tithes)} />
              <MetricCard label="Final Take-Home"     value={fmt(monthly.final_take_home)} accent />
            </div>
          )}

          {/* Detailed view */}
          {view === 'detailed' && (
            <div style={styles.detailSection}>
              <h2 style={styles.sectionTitle}>Financial Breakdown</h2>
              <div style={styles.breakdownTable}>
                <Row label="Total Revenue"    value={fmt(monthly.total_revenue)} />
                <Row label="Total Expenses"   value={fmt(monthly.total_expenses)} negative />
                <Row label="Total Payroll"    value={fmt(monthly.total_payroll)} negative />
                <Row label="Net Profit"       value={fmt(monthly.net_profit)} bold />
                <Row label="Bank Portion (40%)"  value={fmt(monthly.bank_portion)} />
                <Row label="Owner Portion (60%)" value={fmt(monthly.owner_portion)} />
                <Row label="Bank Tithes"      value={fmt(monthly.bank_tithes)} negative />
                <Row label="Owner Tithes"     value={fmt(monthly.owner_tithes)} negative />
                <Row label="Final Take-Home"  value={fmt(monthly.final_take_home)} bold accent />
              </div>

              <h2 style={{ ...styles.sectionTitle, marginTop: 36 }}>Daily Snapshots ({snapshots.length} days)</h2>
              {snapshots.length === 0 ? (
                <p style={{ color: '#6A6560', fontSize: 13 }}>No snapshot data yet.</p>
              ) : (
                <div style={styles.snapshotList}>
                  {snapshots.map((s: any) => (
                    <div key={s.id} style={styles.snapshotRow}>
                      <span style={styles.snapshotDate}>{s.snapshot_date}</span>
                      <span style={styles.snapshotRevenue}>{fmt(s.total_revenue)}</span>
                      <span style={styles.snapshotProfit}>{fmt(s.net_profit)}</span>
                      <span style={styles.snapshotTakeHome}>{fmt(s.final_take_home)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── Sub-components ───────────────────────────────────────────

function BigStat({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{ ...styles.bigStat, ...(highlight ? styles.bigStatHighlight : {}) }}>
      <p style={{ ...styles.bigStatLabel, ...(highlight ? { color: 'rgba(255,255,255,0.6)' } : {}) }}>{label}</p>
      <p style={{ ...styles.bigStatValue, ...(highlight ? { color: '#fff' } : {}) }}>{value}</p>
    </div>
  )
}

function MetricCard({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div style={{ ...styles.metricCard, ...(accent ? styles.metricCardAccent : {}) }}>
      <p style={styles.metricLabel}>{label}</p>
      <p style={{ ...styles.metricValue, ...(accent ? { color: '#0E0C09', fontSize: 28 } : {}) }}>{value}</p>
    </div>
  )
}

function Row({ label, value, negative = false, bold = false, accent = false }: {
  label: string; value: string; negative?: boolean; bold?: boolean; accent?: boolean
}) {
  return (
    <div style={{ ...styles.tableRow, ...(bold ? styles.tableRowBold : {}) }}>
      <span style={styles.tableLabel}>{label}</span>
      <span style={{ ...styles.tableValue, ...(negative ? { color: '#c0392b' } : {}), ...(accent ? { color: '#27ae60' } : {}) }}>
        {negative ? `(${value})` : value}
      </span>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 36 },
  title: { fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 36, fontWeight: 500, color: '#0E0C09', margin: 0 },
  subtitle: { color: '#6A6560', fontSize: 14, marginTop: 4 },
  toggle: { display: 'flex', border: '1px solid rgba(14,12,9,0.14)', borderRadius: 2, overflow: 'hidden' },
  toggleBtn: { padding: '8px 20px', border: 'none', background: '#fff', cursor: 'pointer', fontSize: 13, color: '#6A6560' },
  toggleBtnActive: { background: '#0E0C09', color: '#fff' },

  statsBar: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 },
  bigStat: { background: '#fff', border: '1px solid rgba(14,12,9,0.07)', borderRadius: 2, padding: '20px 22px' },
  bigStatHighlight: { background: '#0E0C09' },
  bigStatLabel: { fontSize: 11, color: '#6A6560', letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 8px' },
  bigStatValue: { fontSize: 24, fontWeight: 700, color: '#0E0C09', margin: 0 },

  summaryGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 },
  metricCard: { background: '#fff', border: '1px solid rgba(14,12,9,0.07)', borderRadius: 2, padding: '20px 22px' },
  metricCardAccent: { background: '#F3F1ED', border: '1px solid rgba(14,12,9,0.14)' },
  metricLabel: { fontSize: 11, color: '#6A6560', letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 8px' },
  metricValue: { fontSize: 20, fontWeight: 600, color: '#0E0C09', margin: 0 },

  detailSection: {},
  sectionTitle: { fontSize: 11, fontWeight: 600, color: '#6A6560', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 14 },
  breakdownTable: { background: '#fff', border: '1px solid rgba(14,12,9,0.07)', borderRadius: 2 },
  tableRow: { display: 'flex', justifyContent: 'space-between', padding: '12px 20px', borderBottom: '1px solid rgba(14,12,9,0.05)', fontSize: 14 },
  tableRowBold: { background: '#F3F1ED', fontWeight: 600 },
  tableLabel: { color: '#6A6560' },
  tableValue: { color: '#0E0C09', fontWeight: 500 },

  snapshotList: { background: '#fff', border: '1px solid rgba(14,12,9,0.07)', borderRadius: 2 },
  snapshotRow: { display: 'grid', gridTemplateColumns: '120px 1fr 1fr 1fr', padding: '10px 20px', borderBottom: '1px solid rgba(14,12,9,0.05)', fontSize: 13 },
  snapshotDate: { color: '#6A6560' },
  snapshotRevenue: { color: '#0E0C09' },
  snapshotProfit: { color: '#0E0C09', fontWeight: 500 },
  snapshotTakeHome: { color: '#27ae60', fontWeight: 600 },

  emptyCard: { background: '#fff', border: '1px solid rgba(14,12,9,0.07)', borderRadius: 2, padding: 40, textAlign: 'center' },
  emptyText: { color: '#6A6560', fontSize: 15, margin: 0 },
}

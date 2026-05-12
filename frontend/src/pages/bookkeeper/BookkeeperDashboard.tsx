import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'

// Format a number as USD currency
function fmt(n: number | string) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(n))
}

function today() {
  return new Date().toISOString().split('T')[0]
}

export default function BookkeeperDashboard() {
  const { data: summary, isLoading } = useQuery({
    queryKey: ['daily-summary', today()],
    queryFn: () => api.get(`/daily-summary/${today()}`).then(r => r.data).catch(() => null),
  })

  return (
    <div>
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>Today's Summary</h1>
          <p style={styles.date}>{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
        {summary?.is_locked && <span style={styles.locked}>Day Locked</span>}
      </header>

      {isLoading ? (
        <p style={styles.empty}>Loading…</p>
      ) : !summary ? (
        <div style={styles.emptyCard}>
          <p style={styles.emptyText}>No data entered yet today.</p>
          <p style={styles.emptyHint}>Go to <strong>Daily Entry</strong> to start today's records.</p>
        </div>
      ) : (
        <div>
          {/* Revenue breakdown */}
          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>Revenue</h2>
            <div style={styles.grid4}>
              <StatCard label="Wash & Set"  value={fmt(summary.total_wash_set)} />
              <StatCard label="Wig Sales"   value={fmt(summary.total_wig_sales)} />
              <StatCard label="Repairs"     value={fmt(summary.total_repairs)} />
              <StatCard label="Total"       value={fmt(summary.total_revenue)} highlight />
            </div>
          </section>

          {/* Payment methods */}
          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>Collected By Method</h2>
            <div style={styles.grid5}>
              <StatCard label="Cash"       value={fmt(summary.cash_collected)} />
              <StatCard label="QuickPay"   value={fmt(summary.quickpay_collected)} />
              <StatCard label="Credit Card"value={fmt(summary.cc_collected)} />
              <StatCard label="Check"      value={fmt(summary.check_collected)} />
              <StatCard label="Zelle"      value={fmt(summary.zelle_collected)} />
            </div>
          </section>

          {/* Counts */}
          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>Activity</h2>
            <div style={styles.grid3}>
              <StatCard label="New Wigs Sold"   value={summary.new_wigs_sold} />
              <StatCard label="Paid in Full"    value={summary.wigs_paid_full} />
              <StatCard label="Chani Cuts"      value={summary.chani_cuts} />
            </div>
          </section>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, highlight = false }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div style={{ ...styles.card, ...(highlight ? styles.cardHighlight : {}) }}>
      <p style={styles.cardLabel}>{label}</p>
      <p style={{ ...styles.cardValue, ...(highlight ? styles.cardValueHighlight : {}) }}>{value}</p>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 40 },
  title: { fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 32, fontWeight: 500, color: '#0E0C09', margin: 0 },
  date: { color: '#6A6560', fontSize: 14, marginTop: 4 },
  locked: { background: '#0E0C09', color: '#fff', padding: '4px 12px', borderRadius: 2, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase' },
  section: { marginBottom: 36 },
  sectionTitle: { fontSize: 11, fontWeight: 600, color: '#6A6560', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 14 },
  grid4: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 },
  grid5: { display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 },
  grid3: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 },
  card: { background: '#fff', border: '1px solid rgba(14,12,9,0.07)', borderRadius: 2, padding: '18px 20px' },
  cardHighlight: { background: '#0E0C09' },
  cardLabel: { fontSize: 11, color: '#6A6560', letterSpacing: '0.06em', textTransform: 'uppercase', margin: '0 0 8px' },
  cardValue: { fontSize: 22, fontWeight: 600, color: '#0E0C09', margin: 0 },
  cardValueHighlight: { color: '#fff' },
  emptyCard: { background: '#fff', border: '1px solid rgba(14,12,9,0.07)', borderRadius: 2, padding: '40px', textAlign: 'center' },
  emptyText: { color: '#0E0C09', fontSize: 16, fontWeight: 500, margin: '0 0 8px' },
  emptyHint: { color: '#6A6560', fontSize: 14, margin: 0 },
  empty: { color: '#6A6560', fontSize: 14 },
}

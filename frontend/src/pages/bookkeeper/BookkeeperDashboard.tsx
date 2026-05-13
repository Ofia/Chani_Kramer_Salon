import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'

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

  const dateLabel = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })

  return (
    <div style={s.page}>
      {/* Page header */}
      <header style={s.header}>
        <div>
          <h1 style={s.title}>Today's Summary</h1>
          <p style={s.date}>{dateLabel}</p>
        </div>
        {summary?.is_locked && <span style={s.locked}>Day Locked</span>}
      </header>

      {isLoading ? (
        <p style={s.muted}>Loading…</p>
      ) : !summary ? (
        <div style={s.emptyCard}>
          <p style={s.emptyTitle}>No data entered yet today</p>
          <p style={s.emptyHint}>Go to <strong>Daily Entry</strong> to start today's records.</p>
        </div>
      ) : (
        <div style={s.content}>
          <Section title="Revenue">
            <div style={s.grid4}>
              <StatCard label="Wash & Set"    value={fmt(summary.total_wash_set)} />
              <StatCard label="Wig Sales"     value={fmt(summary.total_wig_sales)} />
              <StatCard label="Repairs"       value={fmt(summary.total_repairs)} />
              <StatCard label="Total Revenue" value={fmt(summary.total_revenue)} accent />
            </div>
          </Section>

          <Section title="Collected by Method">
            <div style={s.grid5}>
              <StatCard label="Cash"        value={fmt(summary.cash_collected)} />
              <StatCard label="QuickPay"    value={fmt(summary.quickpay_collected)} />
              <StatCard label="Credit Card" value={fmt(summary.cc_collected)} />
              <StatCard label="Check"       value={fmt(summary.check_collected)} />
              <StatCard label="Zelle"       value={fmt(summary.zelle_collected)} />
            </div>
          </Section>

          <Section title="Activity">
            <div style={s.grid3}>
              <StatCard label="New Wigs Sold" value={summary.new_wigs_sold} />
              <StatCard label="Paid in Full"  value={summary.wigs_paid_full} />
              <StatCard label="Chani Cuts"    value={summary.chani_cuts} />
            </div>
          </Section>
        </div>
      )}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={s.section}>
      <h2 style={s.sectionTitle}>{title}</h2>
      {children}
    </section>
  )
}

function StatCard({ label, value, accent = false }: {
  label: string; value: string | number; accent?: boolean
}) {
  return (
    <div style={{ ...s.card, ...(accent ? s.cardAccent : {}) }}>
      <p style={{ ...s.cardLabel, ...(accent ? s.cardLabelAccent : {}) }}>{label}</p>
      <p style={{ ...s.cardValue, ...(accent ? s.cardValueAccent : {}) }}>{value}</p>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  page: {
    fontFamily: "'Inter', -apple-system, sans-serif",
    letterSpacing: '-0.01em',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 36,
    paddingBottom: 24,
    borderBottom: '1px solid rgba(13,13,13,0.09)',
  },
  title: {
    fontSize: 26,
    fontWeight: 700,
    color: '#0d0d0d',
    margin: '0 0 4px',
    letterSpacing: '-0.03em',
  },
  date: {
    fontSize: 13,
    color: 'rgba(13,13,13,0.42)',
    margin: 0,
    fontWeight: 400,
    fontFamily: "'Inter', sans-serif",
  },
  locked: {
    background: '#0d0d0d',
    color: '#fff',
    padding: '5px 14px',
    borderRadius: 20,
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    fontFamily: "'Inter', sans-serif",
  },
  muted: { color: 'rgba(13,13,13,0.42)', fontSize: 14 },

  content: { display: 'flex', flexDirection: 'column' },
  section: { marginBottom: 28 },
  sectionTitle: {
    fontSize: 10,
    fontWeight: 600,
    color: 'rgba(13,13,13,0.35)',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    marginBottom: 10,
    fontFamily: "'Inter', sans-serif",
  },

  grid4: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 },
  grid5: { display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 },
  grid3: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 },

  card: {
    background: '#ffffff',
    border: '1px solid rgba(13,13,13,0.09)',
    borderRadius: 14,
    padding: '18px 20px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.03)',
    transition: 'border-color 0.16s, box-shadow 0.16s',
  },
  cardAccent: {
    background: '#212121',
    border: 'none',
    boxShadow: '0 4px 20px rgba(33,33,33,0.12)',
  },
  cardLabel: {
    fontSize: 10,
    fontWeight: 600,
    color: 'rgba(13,13,13,0.42)',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    margin: '0 0 8px',
    fontFamily: "'Inter', sans-serif",
  },
  cardLabelAccent: { color: 'rgba(255,255,255,0.6)' },
  cardValue: {
    fontSize: 22,
    fontWeight: 700,
    color: '#0d0d0d',
    margin: 0,
    letterSpacing: '-0.03em',
    lineHeight: 1,
  },
  cardValueAccent: { color: '#ffffff' },

  emptyCard: {
    background: '#ffffff',
    border: '1px solid rgba(13,13,13,0.09)',
    borderRadius: 14,
    padding: '52px 40px',
    textAlign: 'center',
    boxShadow: '0 2px 4px rgba(0,0,0,0.03)',
  },
  emptyTitle: { color: '#0d0d0d', fontSize: 16, fontWeight: 600, margin: '0 0 8px', letterSpacing: '-0.02em' },
  emptyHint: { color: 'rgba(13,13,13,0.42)', fontSize: 14, margin: 0 },
}

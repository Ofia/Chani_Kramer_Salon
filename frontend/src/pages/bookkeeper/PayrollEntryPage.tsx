import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'

function getMonday(d = new Date()) {
  const day  = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  return new Date(d.setDate(diff)).toISOString().split('T')[0]
}
function getSunday(mondayStr: string) {
  const d = new Date(mondayStr + 'T00:00:00')
  d.setDate(d.getDate() + 6)
  return d.toISOString().split('T')[0]
}
function fmtDate(str: string) {
  return new Date(str + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
function fmt(n: number | string) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(n))
}

export default function PayrollEntryPage() {
  const [weekStart, setWeekStart] = useState(getMonday())
  const [amounts,   setAmounts]   = useState<Record<string, string>>({})
  const [isEditing, setIsEditing] = useState(false)
  const [saved,     setSaved]     = useState(false)
  const qc      = useQueryClient()
  const weekEnd = getSunday(weekStart)

  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: () => api.get('/employees/?active_only=true').then(r => r.data),
  })

  const { data: existing = [], isLoading: payrollLoading } = useQuery({
    queryKey: ['payroll', weekStart],
    queryFn: () => api.get(`/payroll/?week_start=${weekStart}`).then(r => r.data),
  })

  // TanStack Query v5: populate amounts from fetched data (onSuccess removed in v5)
  useEffect(() => {
    const map: Record<string, string> = {}
    if (existing && (existing as any[]).length > 0) {
      ;(existing as any[]).forEach((e: any) => {
        map[e.employee_id] = Number(e.amount).toFixed(2)
      })
    }
    setAmounts(map)
    setIsEditing(false)
  }, [existing])

  const mutation = useMutation({
    mutationFn: async () => {
      const promises = (employees as any[])
        .filter((emp: any) => amounts[emp.id] && parseFloat(amounts[emp.id]) > 0)
        .map((emp: any) => {
          const existingEntry = (existing as any[]).find((e: any) => e.employee_id === emp.id)
          if (existingEntry) {
            return api.patch(`/payroll/${existingEntry.id}`, { amount: parseFloat(amounts[emp.id]) })
          } else {
            return api.post('/payroll', {
              week_start: weekStart, week_end: weekEnd,
              employee_id: emp.id, amount: parseFloat(amounts[emp.id]),
              pay_type_snapshot: emp.pay_type,
            })
          }
        })
      return Promise.all(promises)
    },
    onSuccess: () => {
      setSaved(true)
      setIsEditing(false)
      qc.invalidateQueries({ queryKey: ['payroll'] })
      setTimeout(() => setSaved(false), 2500)
    },
  })

  function handleCancel() {
    // Restore amounts to what was fetched
    const map: Record<string, string> = {}
    ;(existing as any[]).forEach((e: any) => { map[e.employee_id] = Number(e.amount).toFixed(2) })
    setAmounts(map)
    setIsEditing(false)
  }

  const total = Object.values(amounts).reduce((s, v) => s + (parseFloat(v) || 0), 0)
  const weekLabel = `${fmtDate(weekStart)} — ${fmtDate(weekEnd)}`

  return (
    <div style={s.page}>

      {/* ── Header ── */}
      <header style={s.header}>
        <div>
          <h1 style={s.title}>Weekly Payroll</h1>
          <p style={s.subtitle}>{weekLabel}</p>
        </div>
        <div style={s.headerRight}>
          <input
            type="date"
            value={weekStart}
            onChange={e => setWeekStart(e.target.value)}
            style={s.dateInput}
          />
          {!isEditing ? (
            <button onClick={() => setIsEditing(true)} style={s.editBtn}>Edit</button>
          ) : (
            <>
              <button
                onClick={() => mutation.mutate()}
                disabled={mutation.isPending}
                style={s.saveBtn}
              >
                {mutation.isPending ? 'Saving…' : 'Save'}
              </button>
              <button onClick={handleCancel} style={s.cancelBtn}>Cancel</button>
            </>
          )}
          {saved && <span style={s.savedBadge}>Saved</span>}
        </div>
      </header>

      {/* ── Payroll card ── */}
      {payrollLoading ? (
        <p style={s.muted}>Loading…</p>
      ) : (
        <>
          <p style={s.sectionLabel}>Payroll — {weekLabel}</p>
          <div style={s.card}>
            {/* Column headers */}
            <div style={s.tableHeader}>
              <span style={{ flex: 2 }}>Employee</span>
              <span style={{ flex: 1 }}>Role</span>
              <span style={{ flex: 1, textAlign: 'right' }}>Amount</span>
            </div>

            {(employees as any[]).map((emp: any, i: number) => (
              <div
                key={emp.id}
                style={{
                  ...s.row,
                  borderBottom: i < (employees as any[]).length - 1
                    ? '1px solid rgba(13,13,13,0.05)'
                    : 'none',
                }}
              >
                <span style={s.empName}>{emp.first_name} {emp.last_name}</span>
                <span style={s.empRole}>{emp.job_title}</span>

                {isEditing ? (
                  <div style={s.moneyCell}>
                    <span style={s.moneySym}>$</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={amounts[emp.id] || ''}
                      onChange={e => setAmounts(prev => ({ ...prev, [emp.id]: e.target.value }))}
                      style={s.moneyInput}
                      placeholder="0.00"
                    />
                  </div>
                ) : (
                  <span style={s.amountView}>
                    {amounts[emp.id] && parseFloat(amounts[emp.id]) > 0
                      ? fmt(amounts[emp.id])
                      : <span style={s.amountEmpty}>—</span>
                    }
                  </span>
                )}
              </div>
            ))}

            {/* Total row */}
            <div style={s.totalRow}>
              <span style={{ flex: 2, fontSize: 13, fontWeight: 600, color: '#0d0d0d', letterSpacing: '-0.01em' }}>Total Payroll</span>
              <span style={{ flex: 1 }} />
              <span style={s.totalValue}>{fmt(total)}</span>
            </div>
          </div>

          {isEditing && (
            <p style={s.editHint}>Enter amounts for each stylist. Leave blank to skip.</p>
          )}
        </>
      )}
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  page: { fontFamily: "'Inter', -apple-system, sans-serif", letterSpacing: '-0.01em' },

  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    marginBottom: 20, paddingBottom: 20, borderBottom: '1px solid rgba(13,13,13,0.09)',
  },
  title:    { fontSize: 22, fontWeight: 700, color: '#0d0d0d', margin: 0, letterSpacing: '-0.03em' },
  subtitle: { fontSize: 12, color: 'rgba(13,13,13,0.42)', margin: '3px 0 0' },

  headerRight: { display: 'flex', alignItems: 'center', gap: 8 },

  dateInput: {
    padding: '5px 10px', border: '1px solid rgba(13,13,13,0.12)', borderRadius: 8,
    fontSize: 13, fontFamily: "'Inter', sans-serif", color: '#0d0d0d', background: '#fff', outline: 'none',
  },
  editBtn: {
    padding: '6px 18px', border: '1px solid rgba(13,13,13,0.12)', borderRadius: 8,
    fontSize: 13, fontWeight: 500, color: '#0d0d0d', background: '#fff', cursor: 'pointer',
    fontFamily: "'Inter', sans-serif",
  },
  saveBtn: {
    padding: '6px 18px', border: 'none', borderRadius: 8,
    fontSize: 13, fontWeight: 600, color: '#fff', background: '#212121', cursor: 'pointer',
    fontFamily: "'Inter', sans-serif",
  },
  cancelBtn: {
    padding: '6px 14px', border: '1px solid rgba(13,13,13,0.12)', borderRadius: 8,
    fontSize: 13, fontWeight: 400, color: 'rgba(13,13,13,0.55)', background: '#fff', cursor: 'pointer',
    fontFamily: "'Inter', sans-serif",
  },
  savedBadge: {
    fontSize: 12, fontWeight: 500, color: '#16a34a',
    padding: '4px 10px', background: '#f0fdf4', borderRadius: 20, border: '1px solid #bbf7d0',
  },

  muted: { color: 'rgba(13,13,13,0.42)', fontSize: 14 },

  sectionLabel: {
    fontSize: 10, fontWeight: 600, color: 'rgba(13,13,13,0.35)',
    letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 8px',
  },

  card: {
    background: '#fff', borderRadius: 14,
    border: '1px solid rgba(13,13,13,0.09)',
    overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
    marginBottom: 12,
  },
  tableHeader: {
    display: 'flex', padding: '10px 20px',
    background: '#f7f7f5', borderBottom: '1px solid rgba(13,13,13,0.07)',
    fontSize: 10, fontWeight: 600, color: 'rgba(13,13,13,0.4)',
    letterSpacing: '0.08em', textTransform: 'uppercase',
  },

  row:     { display: 'flex', alignItems: 'center', padding: '11px 20px' },
  empName: { flex: 2, fontSize: 13, fontWeight: 500, color: '#0d0d0d', letterSpacing: '-0.01em' },
  empRole: { flex: 1, fontSize: 12, color: 'rgba(13,13,13,0.45)' },

  // View mode amount
  amountView:  { flex: 1, textAlign: 'right', fontSize: 13, fontWeight: 600, color: '#0d0d0d', letterSpacing: '-0.01em' },
  amountEmpty: { fontSize: 13, color: 'rgba(13,13,13,0.2)', fontWeight: 400 },

  // Edit mode input
  moneyCell: {
    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
    border: '1px solid rgba(13,13,13,0.12)', borderRadius: 8,
    overflow: 'hidden', maxWidth: 120, background: '#fafaf9', marginLeft: 'auto',
  },
  moneySym: {
    padding: '5px 8px', color: 'rgba(13,13,13,0.4)', fontSize: 12,
    borderRight: '1px solid rgba(13,13,13,0.07)',
  },
  moneyInput: {
    flex: 1, border: 'none', padding: '5px 8px', fontSize: 13, color: '#0d0d0d',
    outline: 'none', background: 'transparent', fontFamily: "'Inter', sans-serif", width: 70,
  },

  totalRow: {
    display: 'flex', alignItems: 'center', padding: '13px 20px',
    background: '#f7f7f5', borderTop: '1px solid rgba(13,13,13,0.07)',
  },
  totalValue: {
    flex: 1, textAlign: 'right', fontWeight: 700, fontSize: 16,
    color: '#0d0d0d', letterSpacing: '-0.03em',
  },

  editHint: {
    fontSize: 11, color: 'rgba(13,13,13,0.38)', margin: '4px 0 0', fontStyle: 'italic',
  },
}

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'

function getMonday(d = new Date()) {
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  const monday = new Date(d.setDate(diff))
  return monday.toISOString().split('T')[0]
}

function getSunday(mondayStr: string) {
  const d = new Date(mondayStr)
  d.setDate(d.getDate() + 6)
  return d.toISOString().split('T')[0]
}

export default function PayrollEntryPage() {
  const [weekStart, setWeekStart] = useState(getMonday())
  const [amounts, setAmounts]     = useState<Record<string, string>>({})
  const [saved, setSaved]         = useState(false)
  const qc = useQueryClient()
  const weekEnd = getSunday(weekStart)

  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: () => api.get('/employees?active_only=true').then(r => r.data),
  })

  const { data: existing = [] } = useQuery({
    queryKey: ['payroll', weekStart],
    queryFn: () => api.get(`/payroll?week_start=${weekStart}`).then(r => r.data),
    onSuccess: (data: any[]) => {
      const map: Record<string, string> = {}
      data.forEach((e: any) => { map[e.employee_id] = String(e.amount) })
      setAmounts(map)
    },
  })

  const mutation = useMutation({
    mutationFn: async () => {
      const promises = employees
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
      qc.invalidateQueries({ queryKey: ['payroll'] })
      setTimeout(() => setSaved(false), 3000)
    },
  })

  const total = Object.values(amounts).reduce((s, v) => s + (parseFloat(v) || 0), 0)

  return (
    <div style={s.page}>
      <header style={s.header}>
        <h1 style={s.title}>Weekly Payroll</h1>
        <div style={s.weekPicker}>
          <label style={s.weekLabel}>Week of</label>
          <input type="date" value={weekStart}
            onChange={e => { setWeekStart(e.target.value); setAmounts({}) }}
            style={s.dateInput} />
          <span style={s.weekArrow}>→ {weekEnd}</span>
        </div>
      </header>

      {/* Employee list */}
      <div style={s.card}>
        {/* Column headers */}
        <div style={s.tableHeader}>
          <span style={{ flex: 2 }}>Employee</span>
          <span style={{ flex: 1 }}>Role</span>
          <span style={{ flex: 1, textAlign: 'right' }}>Amount</span>
        </div>

        {employees.map((emp: any, i: number) => (
          <div key={emp.id} style={{
            ...s.row,
            borderBottom: i < employees.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none',
          }}>
            <span style={s.empName}>{emp.first_name} {emp.last_name}</span>
            <span style={s.empRole}>{emp.job_title}</span>
            <div style={s.moneyCell}>
              <span style={s.moneySym}>$</span>
              <input type="number" min="0" step="0.01"
                value={amounts[emp.id] || ''}
                onChange={e => setAmounts(prev => ({ ...prev, [emp.id]: e.target.value }))}
                style={s.moneyInput} placeholder="0.00" />
            </div>
          </div>
        ))}

        {/* Total row */}
        <div style={s.totalRow}>
          <span style={{ flex: 2, fontWeight: 600, color: '#18181b' }}>Total Payroll</span>
          <span style={{ flex: 1 }} />
          <span style={s.totalValue}>${total.toFixed(2)}</span>
        </div>
      </div>

      <div style={s.actions}>
        <button onClick={() => mutation.mutate()} disabled={mutation.isPending} style={s.primaryBtn}>
          {mutation.isPending ? 'Saving…' : 'Save Payroll'}
        </button>
        {saved && <span style={s.success}>Saved.</span>}
      </div>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  page: { maxWidth: 680 },

  header: { marginBottom: 24, paddingBottom: 20, borderBottom: '1px solid rgba(0,0,0,0.07)' },
  title: { fontSize: 26, fontWeight: 700, color: '#18181b', margin: '0 0 16px', letterSpacing: '-0.03em' },
  weekPicker: { display: 'flex', alignItems: 'center', gap: 12 },
  weekLabel: { fontSize: 12, fontWeight: 500, color: '#71717a' },
  dateInput: { border: '1px solid rgba(0,0,0,0.12)', borderRadius: 8, padding: '7px 10px', fontSize: 13, color: '#18181b', background: '#fff', fontFamily: 'inherit', outline: 'none' },
  weekArrow: { fontSize: 13, color: '#71717a' },

  card: { background: '#fff', borderRadius: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.05)', overflow: 'hidden', marginBottom: 20 },

  tableHeader: { display: 'flex', padding: '10px 20px', background: '#f4f4f5', fontSize: 11, fontWeight: 600, color: '#a1a1aa', letterSpacing: '0.06em', textTransform: 'uppercase' },

  row: { display: 'flex', alignItems: 'center', padding: '12px 20px' },
  empName: { flex: 2, fontSize: 14, fontWeight: 500, color: '#18181b', letterSpacing: '-0.01em' },
  empRole: { flex: 1, fontSize: 12, color: '#71717a' },

  moneyCell: { flex: 1, display: 'flex', alignItems: 'center', border: '1px solid rgba(0,0,0,0.1)', borderRadius: 8, overflow: 'hidden', maxWidth: 120, background: '#f9f9f9' },
  moneySym: { padding: '0 8px', color: '#71717a', fontSize: 13, borderRight: '1px solid rgba(0,0,0,0.07)', paddingTop: 6, paddingBottom: 6 },
  moneyInput: { flex: 1, border: 'none', padding: '6px 8px', fontSize: 13, color: '#18181b', outline: 'none', background: 'transparent', fontFamily: 'inherit', width: 70 },

  totalRow: { display: 'flex', alignItems: 'center', padding: '14px 20px', background: '#f4f4f5', borderTop: '1px solid rgba(0,0,0,0.07)' },
  totalValue: { flex: 1, textAlign: 'right', fontWeight: 700, fontSize: 17, color: '#18181b', letterSpacing: '-0.02em' },

  actions: { display: 'flex', alignItems: 'center', gap: 16 },
  primaryBtn: { background: '#212121', color: '#fff', border: 'none', borderRadius: 12, padding: '12px 32px', fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '-0.01em' },
  success: { color: '#34c759', fontSize: 13, fontWeight: 500 },
}

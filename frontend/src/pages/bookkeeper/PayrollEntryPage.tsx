/**
 * Payroll Entry — enter weekly pay for each employee.
 * Tzipora selects the week, then enters an amount per employee.
 * Skipping an employee = $0 that week.
 */

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'

function getMonday(d = new Date()) {
  const day  = d.getDay()
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
              week_start: weekStart,
              week_end: weekEnd,
              employee_id: emp.id,
              amount: parseFloat(amounts[emp.id]),
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
    <div style={styles.page}>
      <h1 style={styles.title}>Weekly Payroll</h1>

      <div style={styles.weekPicker}>
        <label style={styles.label}>Week of</label>
        <input
          type="date"
          value={weekStart}
          onChange={e => { setWeekStart(e.target.value); setAmounts({}) }}
          style={styles.input}
        />
        <span style={styles.weekRange}>→ {weekEnd}</span>
      </div>

      <div style={styles.card}>
        <div style={styles.tableHeader}>
          <span style={styles.col1}>Employee</span>
          <span style={styles.col2}>Role</span>
          <span style={styles.col3}>Amount</span>
        </div>

        {employees.map((emp: any) => (
          <div key={emp.id} style={styles.row}>
            <span style={styles.col1}>{emp.first_name} {emp.last_name}</span>
            <span style={styles.col2}>{emp.job_title}</span>
            <div style={styles.col3}>
              <div style={styles.moneyWrapper}>
                <span style={styles.moneySym}>$</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={amounts[emp.id] || ''}
                  onChange={e => setAmounts(prev => ({ ...prev, [emp.id]: e.target.value }))}
                  style={styles.moneyInput}
                  placeholder="0.00"
                />
              </div>
            </div>
          </div>
        ))}

        <div style={styles.totalRow}>
          <span style={styles.col1}>Total Payroll</span>
          <span style={{ ...styles.col3, fontWeight: 600, fontSize: 16 }}>${total.toFixed(2)}</span>
        </div>
      </div>

      <div style={styles.actions}>
        <button onClick={() => mutation.mutate()} disabled={mutation.isPending} style={styles.saveBtn}>
          {mutation.isPending ? 'Saving…' : 'Save Payroll'}
        </button>
        {saved && <span style={styles.success}>Saved.</span>}
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: { maxWidth: 700 },
  title: { fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 32, fontWeight: 500, color: '#0E0C09', margin: '0 0 28px' },
  weekPicker: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 },
  label: { fontSize: 11, fontWeight: 600, color: '#6A6560', letterSpacing: '0.08em', textTransform: 'uppercase' },
  input: { border: '1px solid rgba(14,12,9,0.14)', borderRadius: 2, padding: '7px 10px', fontSize: 14, color: '#0E0C09' },
  weekRange: { fontSize: 13, color: '#6A6560' },
  card: { background: '#fff', border: '1px solid rgba(14,12,9,0.07)', borderRadius: 2 },
  tableHeader: { display: 'flex', padding: '10px 20px', background: '#F3F1ED', borderBottom: '1px solid rgba(14,12,9,0.07)', fontSize: 11, fontWeight: 600, color: '#6A6560', letterSpacing: '0.08em', textTransform: 'uppercase' },
  row: { display: 'flex', alignItems: 'center', padding: '10px 20px', borderBottom: '1px solid rgba(14,12,9,0.05)', fontSize: 14 },
  totalRow: { display: 'flex', alignItems: 'center', padding: '14px 20px', background: '#F3F1ED', fontSize: 14, fontWeight: 500 },
  col1: { flex: 2, color: '#0E0C09' },
  col2: { flex: 1, color: '#6A6560', fontSize: 12 },
  col3: { flex: 1 },
  moneyWrapper: { display: 'flex', alignItems: 'center', border: '1px solid rgba(14,12,9,0.14)', borderRadius: 2, overflow: 'hidden', maxWidth: 120 },
  moneySym: { padding: '0 8px', color: '#6A6560', fontSize: 13, background: '#F3F1ED', borderRight: '1px solid rgba(14,12,9,0.14)' },
  moneyInput: { flex: 1, border: 'none', padding: '7px 8px', fontSize: 13, color: '#0E0C09', outline: 'none', width: 80 },
  actions: { display: 'flex', alignItems: 'center', gap: 16, marginTop: 20 },
  saveBtn: { background: '#0E0C09', color: '#fff', border: 'none', borderRadius: 2, padding: '11px 28px', fontSize: 14, cursor: 'pointer', fontWeight: 500 },
  success: { color: '#27ae60', fontSize: 13 },
}

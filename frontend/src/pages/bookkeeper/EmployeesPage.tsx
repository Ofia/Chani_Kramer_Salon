import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { Plus, Pencil, UserX, UserCheck, Clock, Trash2, X } from 'lucide-react'

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

// ── Types ─────────────────────────────────────────────────────

type Employee = {
  id: string
  first_name: string
  last_name: string
  job_title: string
  pay_type: 'weekly_flat' | 'commission_pct' | 'hourly'
  weekly_rate?: number
  commission_rate?: number
  hourly_rate?: number
  hired_at?: string
  notes?: string
  is_active: boolean
}

// ── Helpers ───────────────────────────────────────────────────

const PAY_TYPE_LABEL: Record<string, string> = {
  weekly_flat:    'Weekly Flat',
  commission_pct: 'Commission %',
  hourly:         'Hourly',
}

const PAY_TYPES = [
  { value: 'weekly_flat',    label: 'Weekly Flat' },
  { value: 'commission_pct', label: 'Commission %' },
  { value: 'hourly',         label: 'Hourly' },
]

function rateDisplay(emp: Employee): string {
  if (emp.pay_type === 'weekly_flat' && emp.weekly_rate)
    return `$${Number(emp.weekly_rate).toFixed(0)}/wk`
  if (emp.pay_type === 'commission_pct' && emp.commission_rate)
    return `${(Number(emp.commission_rate) * 100).toFixed(1)}%`
  if (emp.pay_type === 'hourly' && emp.hourly_rate)
    return `$${Number(emp.hourly_rate).toFixed(2)}/hr`
  return '—'
}

function fmtDate(str: string) {
  return new Date(str + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const EMPTY_FORM = {
  first_name: '', last_name: '', job_title: '', pay_type: 'weekly_flat',
  weekly_rate: '', commission_rate: '', hourly_rate: '', hired_at: '', notes: '',
}

// ── Component ─────────────────────────────────────────────────

export default function EmployeesPage() {
  const [showInactive, setShowInactive] = useState(false)
  const [modalEmp, setModalEmp] = useState<Employee | null | 'new'>(null)
  const [timeLogEmp, setTimeLogEmp] = useState<Employee | null>(null)
  const qc = useQueryClient()

  const { data: employees = [], isLoading } = useQuery<Employee[]>({
    queryKey: ['employees-page', showInactive],
    queryFn: () => api.get(`/employees/?active_only=${!showInactive}`).then(r => Array.isArray(r.data) ? r.data : []).catch(() => []),
  })

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/employees/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['employees'] }),
  })

  const reactivateMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/employees/${id}`, { is_active: true }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['employees'] }),
  })

  function invalidateAll() {
    qc.invalidateQueries({ queryKey: ['employees'] })
    qc.invalidateQueries({ queryKey: ['employees-page'] })
  }

  const active   = employees.filter(e => e.is_active)
  const inactive = employees.filter(e => !e.is_active)
  const shown    = showInactive ? employees : active

  return (
    <div>
      {/* ── Header ── */}
      <header style={s.header}>
        <div>
          <h1 style={s.title}>Employees</h1>
          <p style={s.subtitle}>
            {active.length} active{inactive.length > 0 ? ` · ${inactive.length} inactive` : ''}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {inactive.length > 0 && (
            <button onClick={() => setShowInactive(v => !v)} style={s.toggleBtn}>
              {showInactive ? 'Hide Inactive' : 'Show Inactive'}
            </button>
          )}
          <button onClick={() => setModalEmp('new')} style={s.addBtn}>
            <Plus size={14} />
            Add Employee
          </button>
        </div>
      </header>

      {/* ── Table ── */}
      {isLoading ? (
        <p style={s.muted}>Loading…</p>
      ) : shown.length === 0 ? (
        <div style={s.empty}>
          <p style={s.muted}>No employees yet. Add one to get started.</p>
        </div>
      ) : (
        <div style={s.table}>
          <div style={s.tableHead}>
            <Cell w={200}>Name</Cell>
            <Cell w={150}>Job Title</Cell>
            <Cell w={120}>Pay Type</Cell>
            <Cell w={100} right>Rate</Cell>
            <Cell w={110}>Hired</Cell>
            <Cell w={70}>Status</Cell>
            <Cell w={100} right>Actions</Cell>
          </div>

          {shown.map((emp, i) => (
            <div key={emp.id} style={{ ...s.tableRow, borderBottom: i < shown.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none', opacity: emp.is_active ? 1 : 0.5 }}>
              <Cell w={200}>
                <span style={s.empName}>{emp.first_name} {emp.last_name}</span>
              </Cell>
              <Cell w={150}>
                <span style={s.muted}>{emp.job_title}</span>
              </Cell>
              <Cell w={120}>
                <span style={s.badge}>{PAY_TYPE_LABEL[emp.pay_type]}</span>
              </Cell>
              <Cell w={100} right>
                <span style={s.rate}>{rateDisplay(emp)}</span>
              </Cell>
              <Cell w={110}>
                <span style={s.muted}>{emp.hired_at ? fmtDate(emp.hired_at) : '—'}</span>
              </Cell>
              <Cell w={70}>
                <span style={{ ...s.statusDot, color: emp.is_active ? '#10b981' : '#a1a1aa' }}>
                  {emp.is_active ? 'Active' : 'Inactive'}
                </span>
              </Cell>
              <Cell w={100} right>
                <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                  <IconBtn title="Time Log" onClick={() => setTimeLogEmp(emp)}>
                    <Clock size={13} />
                  </IconBtn>
                  <IconBtn title="Edit" onClick={() => setModalEmp(emp)}>
                    <Pencil size={13} />
                  </IconBtn>
                  {emp.is_active ? (
                    <IconBtn
                      title="Deactivate"
                      onClick={() => {
                        if (confirm(`Deactivate ${emp.first_name} ${emp.last_name}? They won't appear in payroll lists.`))
                          deactivateMutation.mutate(emp.id)
                      }}
                    >
                      <UserX size={13} />
                    </IconBtn>
                  ) : (
                    <IconBtn title="Reactivate" onClick={() => reactivateMutation.mutate(emp.id)}>
                      <UserCheck size={13} />
                    </IconBtn>
                  )}
                </div>
              </Cell>
            </div>
          ))}
        </div>
      )}

      {/* ── Employee edit modal ── */}
      {modalEmp !== null && (
        <EmployeeModal
          employee={modalEmp === 'new' ? null : modalEmp}
          onClose={() => setModalEmp(null)}
          onSaved={() => { invalidateAll(); setModalEmp(null) }}
        />
      )}

      {/* ── Time log modal ── */}
      {timeLogEmp !== null && (
        <TimeLogModal
          employee={timeLogEmp}
          onClose={() => setTimeLogEmp(null)}
        />
      )}
    </div>
  )
}

// ── Employee Form Modal ───────────────────────────────────────

function EmployeeModal({
  employee,
  onClose,
  onSaved,
}: {
  employee: Employee | null
  onClose: () => void
  onSaved: () => void
}) {
  const isEdit = employee !== null
  const [form, setForm] = useState(
    employee
      ? {
          first_name:      employee.first_name,
          last_name:       employee.last_name,
          job_title:       employee.job_title,
          pay_type:        employee.pay_type,
          weekly_rate:     employee.weekly_rate     ? String(employee.weekly_rate)                         : '',
          commission_rate: employee.commission_rate ? String(Number(employee.commission_rate) * 100)       : '',
          hourly_rate:     employee.hourly_rate     ? String(employee.hourly_rate)                         : '',
          hired_at:        employee.hired_at        ? employee.hired_at                                    : '',
          notes:           employee.notes           ? employee.notes                                       : '',
        }
      : EMPTY_FORM
  )
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: (data: object) =>
      isEdit
        ? api.patch(`/employees/${employee!.id}`, data).then(r => r.data)
        : api.post('/employees/', data).then(r => r.data),
    onSuccess: onSaved,
    onError: () => setError('Failed to save. Please try again.'),
  })

  function set(field: string, value: string) {
    setForm(p => ({ ...p, [field]: value }))
  }

  function handleSave() {
    if (!form.first_name || !form.last_name || !form.job_title) {
      setError('First name, last name, and job title are required.')
      return
    }
    setError('')
    mutation.mutate({
      first_name:      form.first_name,
      last_name:       form.last_name,
      job_title:       form.job_title,
      pay_type:        form.pay_type,
      weekly_rate:     form.pay_type === 'weekly_flat'    && form.weekly_rate     ? parseFloat(form.weekly_rate)         : null,
      commission_rate: form.pay_type === 'commission_pct' && form.commission_rate ? parseFloat(form.commission_rate) / 100 : null,
      hourly_rate:     form.pay_type === 'hourly'         && form.hourly_rate     ? parseFloat(form.hourly_rate)         : null,
      hired_at:        form.hired_at || null,
      notes:           form.notes    || null,
    })
  }

  return (
    <div style={s.overlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={s.modalBox}>
        <div style={s.modalHeader}>
          <p style={s.modalTitle}>{isEdit ? 'Edit Employee' : 'New Employee'}</p>
          <button onClick={onClose} style={s.closeBtn}>×</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={s.grid2}>
            <Field label="First Name *">
              <input value={form.first_name} onChange={e => set('first_name', e.target.value)} style={s.input} />
            </Field>
            <Field label="Last Name *">
              <input value={form.last_name} onChange={e => set('last_name', e.target.value)} style={s.input} />
            </Field>
          </div>
          <Field label="Job Title *">
            <input value={form.job_title} onChange={e => set('job_title', e.target.value)} style={s.input} placeholder="e.g. Stylist" />
          </Field>
          <Field label="Pay Type">
            <select value={form.pay_type} onChange={e => set('pay_type', e.target.value)} style={s.select}>
              {PAY_TYPES.map(pt => <option key={pt.value} value={pt.value}>{pt.label}</option>)}
            </select>
          </Field>
          {form.pay_type === 'weekly_flat' && (
            <Field label="Weekly Rate ($)">
              <input type="number" min="0" step="0.01" value={form.weekly_rate}
                onChange={e => set('weekly_rate', e.target.value)} style={s.input} placeholder="0.00" />
            </Field>
          )}
          {form.pay_type === 'commission_pct' && (
            <Field label="Commission Rate (%)">
              <input type="number" min="0" max="100" step="0.1" value={form.commission_rate}
                onChange={e => set('commission_rate', e.target.value)} style={s.input} placeholder="e.g. 30" />
            </Field>
          )}
          {form.pay_type === 'hourly' && (
            <Field label="Hourly Rate ($)">
              <input type="number" min="0" step="0.01" value={form.hourly_rate}
                onChange={e => set('hourly_rate', e.target.value)} style={s.input} placeholder="0.00" />
            </Field>
          )}
          <Field label="Hire Date">
            <input type="date" value={form.hired_at} onChange={e => set('hired_at', e.target.value)} style={s.input} />
          </Field>
          <Field label="Notes">
            <input value={form.notes} onChange={e => set('notes', e.target.value)} style={s.input} placeholder="Optional" />
          </Field>
        </div>

        {error && <p style={s.errorMsg}>{error}</p>}

        <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
          <button onClick={handleSave} disabled={mutation.isPending} style={s.primaryBtn}>
            {mutation.isPending ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Employee'}
          </button>
          <button onClick={onClose} style={s.ghostBtn}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────

function Cell({ children, w, right }: { children: React.ReactNode; w: number; right?: boolean }) {
  return (
    <div style={{ width: w, flexShrink: 0, textAlign: right ? 'right' : 'left', display: 'flex', alignItems: 'center' }}>
      {children}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label style={s.fieldLabel}>{label}</label>
      {children}
    </div>
  )
}

function IconBtn({ children, onClick, title }: { children: React.ReactNode; onClick: () => void; title: string }) {
  return (
    <button onClick={onClick} title={title} style={s.iconBtn}>{children}</button>
  )
}

// ── Time Log Modal ────────────────────────────────────────────

type TimeLog = {
  id: string
  employee_id: string
  employee_name: string
  clock_in: string
  clock_out: string | null
  date: string
  hours: number | null
  notes: string | null
}

function TimeLogModal({ employee, onClose }: { employee: Employee; onClose: () => void }) {
  const { session } = useAuth()
  const token = session?.access_token ?? null
  const qc = useQueryClient()

  const [showAdd, setShowAdd] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({ log_date: '', clock_in_time: '', clock_out_time: '' })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const headers = { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }

  const { data: logs = [], isLoading, isError } = useQuery<TimeLog[]>({
    queryKey: ['time-logs-employee', employee.id],
    queryFn: async () => {
      const r = await fetch(`${API}/api/v1/time-logs/employee/${employee.id}`, { headers })
      if (!r.ok) throw new Error(`${r.status} ${r.statusText}`)
      return r.json()
    },
  })

  function invalidate() { qc.invalidateQueries({ queryKey: ['time-logs-employee', employee.id] }) }

  function fmtTime(iso: string | null) {
    if (!iso) return '—'
    return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
  }

  function toTimeInput(iso: string | null) {
    if (!iso) return ''
    const d = new Date(iso)
    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
  }

  function startEdit(log: TimeLog) {
    setEditId(log.id)
    setForm({
      log_date: log.date,
      clock_in_time: toTimeInput(log.clock_in),
      clock_out_time: toTimeInput(log.clock_out),
    })
    setShowAdd(false)
  }

  function resetForm() {
    setForm({ log_date: '', clock_in_time: '', clock_out_time: '' })
    setShowAdd(false)
    setEditId(null)
    setErr('')
  }

  async function handleSave() {
    if (!form.log_date || !form.clock_in_time) { setErr('Date and clock-in time are required.'); return }
    setSaving(true); setErr('')
    try {
      if (editId) {
        const r = await fetch(`${API}/api/v1/time-logs/${editId}`, {
          method: 'PATCH', headers,
          body: JSON.stringify({ log_date: form.log_date, clock_in_time: form.clock_in_time, clock_out_time: form.clock_out_time || null }),
        })
        if (!r.ok) throw new Error(await r.text())
      } else {
        const r = await fetch(`${API}/api/v1/time-logs/manual`, {
          method: 'POST', headers,
          body: JSON.stringify({ employee_id: employee.id, log_date: form.log_date, clock_in_time: form.clock_in_time, clock_out_time: form.clock_out_time || null }),
        })
        if (!r.ok) throw new Error(await r.text())
      }
      invalidate(); resetForm()
    } catch (e: any) { setErr(e.message) }
    finally { setSaving(false) }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this time entry?')) return
    await fetch(`${API}/api/v1/time-logs/${id}`, { method: 'DELETE', headers })
    invalidate()
  }

  return (
    <div style={s.overlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ ...s.modalBox, maxWidth: 560 }}>

        <div style={s.modalHeader}>
          <div>
            <p style={s.modalTitle}>{employee.first_name} {employee.last_name} — Time Log</p>
            <p style={{ margin: 0, fontSize: 12, color: '#71717a' }}>{logs.length} entr{logs.length === 1 ? 'y' : 'ies'}</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => { setShowAdd(true); setEditId(null); setForm({ log_date: '', clock_in_time: '', clock_out_time: '' }) }} style={{ ...s.primaryBtn, flex: 'none', padding: '7px 14px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Plus size={13} /> Add Entry
            </button>
            <button onClick={onClose} style={{ ...s.closeBtn }}><X size={16} /></button>
          </div>
        </div>

        {/* Add / Edit form */}
        {(showAdd || editId) && (
          <div style={{ background: '#f9f9f8', borderRadius: 10, padding: 16, margin: '0 0 16px', border: '1px solid rgba(0,0,0,0.08)' }}>
            <p style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 600, color: '#18181b' }}>{editId ? 'Edit Entry' : 'New Entry'}</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              <Field label="Date">
                <input type="date" style={s.input} value={form.log_date} onChange={e => setForm(f => ({ ...f, log_date: e.target.value }))} />
              </Field>
              <Field label="Clock In">
                <input type="time" style={s.input} value={form.clock_in_time} onChange={e => setForm(f => ({ ...f, clock_in_time: e.target.value }))} />
              </Field>
              <Field label="Clock Out">
                <input type="time" style={s.input} value={form.clock_out_time} onChange={e => setForm(f => ({ ...f, clock_out_time: e.target.value }))} />
              </Field>
            </div>
            {err && <p style={{ ...s.errorMsg, marginTop: 8 }}>{err}</p>}
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button onClick={handleSave} disabled={saving} style={{ ...s.primaryBtn, flex: 'none', padding: '8px 16px', fontSize: 13 }}>
                {saving ? 'Saving…' : editId ? 'Save' : 'Add'}
              </button>
              <button onClick={resetForm} style={{ ...s.ghostBtn, padding: '8px 14px', fontSize: 13 }}>Cancel</button>
            </div>
          </div>
        )}

        {/* Log list */}
        {isLoading ? (
          <p style={{ color: '#71717a', fontSize: 13 }}>Loading…</p>
        ) : isError ? (
          <p style={{ color: '#ef4444', fontSize: 13, padding: '12px 0' }}>Failed to load time logs. Check that the backend is running and deployed.</p>
        ) : logs.length === 0 ? (
          <p style={{ color: '#a1a1aa', fontSize: 13, textAlign: 'center', padding: '24px 0' }}>No time entries yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, maxHeight: 400, overflowY: 'auto' }}>
            {logs.map(log => (
              <div key={log.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 4px', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                <span style={{ width: 90, fontSize: 12, fontWeight: 600, color: '#18181b', flexShrink: 0 }}>{log.date}</span>
                <span style={{ width: 80, fontSize: 12, color: '#5581B1', flexShrink: 0 }}>{fmtTime(log.clock_in)}</span>
                <span style={{ width: 10, fontSize: 11, color: '#a1a1aa' }}>→</span>
                <span style={{ width: 80, fontSize: 12, color: log.clock_out ? '#DF5198' : '#f59e0b', flexShrink: 0 }}>{fmtTime(log.clock_out)}</span>
                <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: '#18181b' }}>
                  {log.hours != null ? `${log.hours}h` : <span style={{ color: '#f59e0b', fontSize: 11 }}>open</span>}
                </span>
                {log.notes && <span style={{ fontSize: 11, color: '#a1a1aa', flex: 1 }}>{log.notes}</span>}
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  <IconBtn title="Edit" onClick={() => startEdit(log)}><Pencil size={12} /></IconBtn>
                  <IconBtn title="Delete" onClick={() => handleDelete(log.id)}><Trash2 size={12} /></IconBtn>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  header:    { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 },
  title:     { fontSize: 26, fontWeight: 700, color: '#18181b', margin: '0 0 4px', letterSpacing: '-0.03em' },
  subtitle:  { fontSize: 13, color: '#71717a', margin: 0 },

  addBtn:    { display: 'flex', alignItems: 'center', gap: 6, background: '#212121', color: '#fff', border: 'none', borderRadius: 10, padding: '9px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  toggleBtn: { background: 'none', border: '1px solid rgba(0,0,0,0.12)', borderRadius: 10, padding: '9px 14px', fontSize: 13, color: '#71717a', cursor: 'pointer', fontFamily: 'inherit' },

  table:     { border: '1px solid rgba(0,0,0,0.07)', borderRadius: 14, overflow: 'hidden' },
  tableHead: { display: 'flex', gap: 12, padding: '10px 16px', background: '#fafaf9', borderBottom: '1px solid rgba(0,0,0,0.07)' },
  tableRow:  { display: 'flex', gap: 12, padding: '12px 16px', background: '#fff', transition: 'background 0.1s' },

  empName:   { fontSize: 13, fontWeight: 600, color: '#18181b' },
  muted:     { fontSize: 12, color: '#71717a' },
  rate:      { fontSize: 13, fontWeight: 600, color: '#18181b' },
  badge:     { fontSize: 11, fontWeight: 500, background: 'rgba(0,0,0,0.06)', color: '#71717a', padding: '3px 8px', borderRadius: 6 },
  statusDot: { fontSize: 11, fontWeight: 600 },

  iconBtn:   { background: 'none', border: 'none', cursor: 'pointer', color: '#a1a1aa', padding: 4, borderRadius: 6, display: 'flex', alignItems: 'center' },

  empty:     { padding: '60px 0', textAlign: 'center' },

  overlay:   { position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modalBox:  { background: '#fff', borderRadius: 18, padding: 24, width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto' as const, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  modalTitle:  { margin: 0, fontSize: 15, fontWeight: 700, color: '#18181b' },
  closeBtn:    { background: 'none', border: 'none', cursor: 'pointer', color: '#71717a', fontSize: 20, lineHeight: 1, padding: 0 },

  grid2:     { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
  fieldLabel: { fontSize: 12, fontWeight: 500, color: '#71717a' },
  input:     { border: '1px solid rgba(0,0,0,0.12)', borderRadius: 10, padding: '10px 12px', fontSize: 14, color: '#18181b', background: '#f9f9f9', outline: 'none', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' as const },
  select:    { border: '1px solid rgba(0,0,0,0.12)', borderRadius: 10, padding: '10px 12px', fontSize: 14, color: '#18181b', background: '#f9f9f9', outline: 'none', fontFamily: 'inherit', width: '100%' },

  primaryBtn: { flex: 1, background: '#212121', color: '#fff', border: 'none', borderRadius: 12, padding: '13px', fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  ghostBtn:   { background: 'none', border: '1px solid rgba(0,0,0,0.14)', borderRadius: 12, padding: '13px 20px', fontSize: 14, cursor: 'pointer', color: '#71717a', fontFamily: 'inherit' },
  errorMsg:   { color: '#ff3b30', fontSize: 13, marginTop: 10 },
}

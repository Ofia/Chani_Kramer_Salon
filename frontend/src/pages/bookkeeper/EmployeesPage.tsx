import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { Plus, Pencil, UserX, UserCheck } from 'lucide-react'

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
  const [modalEmp, setModalEmp] = useState<Employee | null | 'new'>(null) // null=closed, 'new'=add, Employee=edit
  const qc = useQueryClient()

  const { data: employees = [], isLoading } = useQuery<Employee[]>({
    queryKey: ['employees-page', showInactive],
    queryFn: () => api.get(`/employees/?active_only=${!showInactive}`).then(r => r.data),
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
            <Cell w={80} right>Actions</Cell>
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
              <Cell w={80} right>
                <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
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

      {/* ── Modal ── */}
      {modalEmp !== null && (
        <EmployeeModal
          employee={modalEmp === 'new' ? null : modalEmp}
          onClose={() => setModalEmp(null)}
          onSaved={() => { invalidateAll(); setModalEmp(null) }}
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

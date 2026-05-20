import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { Plus, Search, X, Pencil, Phone, Smartphone, MapPin, StickyNote } from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────

type Customer = {
  id: string
  first_name: string
  last_name: string
  phone?: string
  cell?: string
  address?: string
  daysmart_client_id?: string
  access_id?: number
  notes?: string
  created_at: string
}

// ── Helpers ───────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function cityFromAddress(address?: string): string {
  if (!address) return '—'
  const parts = address.split(',')
  return parts.length >= 2 ? parts[parts.length - 2].trim() : parts[0].trim()
}

const EMPTY_FORM = {
  first_name: '', last_name: '', phone: '', cell: '', address: '', notes: '',
}

// ── Component ─────────────────────────────────────────────────

export default function CustomersPage() {
  const [search, setSearch]         = useState('')
  const [selected, setSelected]     = useState<Customer | null>(null)
  const [modalMode, setModalMode]   = useState<'new' | Customer | null>(null)
  const [editingNotes, setEditingNotes] = useState(false)
  const [draftNotes, setDraftNotes] = useState('')
  const qc = useQueryClient()

  const { data: customers = [], isLoading } = useQuery<Customer[]>({
    queryKey: ['customers', search],
    queryFn: () => api.get(`/customers/${search ? `?search=${encodeURIComponent(search)}` : ''}`).then(r => Array.isArray(r.data) ? r.data : []).catch(() => []),
  })

  const notesMutation = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes: string }) =>
      api.patch(`/customers/${id}`, { notes }).then(r => r.data),
    onSuccess: (updated: Customer) => {
      qc.invalidateQueries({ queryKey: ['customers'] })
      setSelected(updated)
      setEditingNotes(false)
    },
  })

  function openDrawer(c: Customer) {
    setSelected(c)
    setEditingNotes(false)
    setDraftNotes(c.notes ?? '')
  }

  function startEditNotes() {
    setDraftNotes(selected?.notes ?? '')
    setEditingNotes(true)
  }

  return (
    <div style={s.page}>
      {/* ── Header ── */}
      <header style={s.header}>
        <div>
          <h1 style={s.title}>Customers</h1>
          <p style={s.subtitle}>{customers.length.toLocaleString()} customers</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={s.searchWrap}>
            <Search size={13} color="#a1a1aa" style={{ flexShrink: 0 }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search name or phone…"
              style={s.searchInput}
            />
            {search && (
              <button onClick={() => setSearch('')} style={s.clearBtn}>
                <X size={12} />
              </button>
            )}
          </div>
          <button onClick={() => setModalMode('new')} style={s.addBtn}>
            <Plus size={14} />
            Add Customer
          </button>
        </div>
      </header>

      {/* ── Layout: table + optional drawer ── */}
      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>

        {/* ── Table ── */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {isLoading ? (
            <p style={s.muted}>Loading…</p>
          ) : customers.length === 0 ? (
            <div style={s.empty}>
              <p style={s.muted}>{search ? 'No customers match that search.' : 'No customers yet.'}</p>
            </div>
          ) : (
            <div style={s.table}>
              <div style={s.tableHead}>
                <Cell w={220}>Name</Cell>
                <Cell w={140}>Phone</Cell>
                <Cell w={140}>City</Cell>
                <Cell w={120}>Since</Cell>
              </div>
              {customers.map((c, i) => (
                <div
                  key={c.id}
                  onClick={() => openDrawer(c)}
                  style={{
                    ...s.tableRow,
                    borderBottom: i < customers.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none',
                    background: selected?.id === c.id ? 'rgba(214,210,203,0.35)' : '#fff',
                    cursor: 'pointer',
                  }}
                >
                  <Cell w={220}>
                    <span style={s.custName}>{c.first_name} {c.last_name}</span>
                  </Cell>
                  <Cell w={140}>
                    <span style={s.muted}>{c.phone || c.cell || '—'}</span>
                  </Cell>
                  <Cell w={140}>
                    <span style={s.muted}>{cityFromAddress(c.address)}</span>
                  </Cell>
                  <Cell w={120}>
                    <span style={s.muted}>{fmtDate(c.created_at)}</span>
                  </Cell>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── CRM Drawer ── */}
        {selected && (
          <div style={s.drawer}>
            {/* Drawer header */}
            <div style={s.drawerHeader}>
              <div style={s.drawerAvatar}>
                {selected.first_name.charAt(0)}{selected.last_name.charAt(0)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={s.drawerName}>{selected.first_name} {selected.last_name}</p>
                <p style={s.drawerSince}>Customer since {fmtDate(selected.created_at)}</p>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => setModalMode(selected)} style={s.iconBtn} title="Edit">
                  <Pencil size={13} />
                </button>
                <button onClick={() => setSelected(null)} style={s.iconBtn} title="Close">
                  <X size={13} />
                </button>
              </div>
            </div>

            {/* Contact info */}
            <div style={s.drawerSection}>
              <p style={s.drawerSectionTitle}>Contact</p>
              <div style={s.contactGrid}>
                {selected.phone && (
                  <ContactRow icon={<Phone size={12} />} label="Phone" value={selected.phone} />
                )}
                {selected.cell && (
                  <ContactRow icon={<Smartphone size={12} />} label="Cell" value={selected.cell} />
                )}
                {selected.address && (
                  <ContactRow icon={<MapPin size={12} />} label="Address" value={selected.address} />
                )}
                {!selected.phone && !selected.cell && !selected.address && (
                  <p style={s.muted}>No contact info on file.</p>
                )}
              </div>
            </div>

            {/* Notes */}
            <div style={s.drawerSection}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <p style={s.drawerSectionTitle}>Notes</p>
                {!editingNotes && (
                  <button onClick={startEditNotes} style={s.textBtn}>
                    <StickyNote size={11} /> Edit
                  </button>
                )}
              </div>
              {editingNotes ? (
                <>
                  <textarea
                    value={draftNotes}
                    onChange={e => setDraftNotes(e.target.value)}
                    style={s.notesInput}
                    placeholder="Add a note about this customer…"
                    rows={4}
                    autoFocus
                  />
                  <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                    <button
                      onClick={() => notesMutation.mutate({ id: selected.id, notes: draftNotes })}
                      disabled={notesMutation.isPending}
                      style={s.primaryBtnSm}
                    >
                      {notesMutation.isPending ? 'Saving…' : 'Save'}
                    </button>
                    <button onClick={() => setEditingNotes(false)} style={s.ghostBtnSm}>Cancel</button>
                  </div>
                </>
              ) : (
                <p style={selected.notes ? s.notesText : s.muted}>
                  {selected.notes || 'No notes yet. Click Edit to add one.'}
                </p>
              )}
            </div>

            {/* IDs / source */}
            {(selected.daysmart_client_id || selected.access_id) && (
              <div style={s.drawerSection}>
                <p style={s.drawerSectionTitle}>System IDs</p>
                {selected.daysmart_client_id && (
                  <p style={s.idBadge}>DaySmart: {selected.daysmart_client_id}</p>
                )}
                {selected.access_id && (
                  <p style={s.idBadge}>Access: #{selected.access_id}</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Modal ── */}
      {modalMode !== null && (
        <CustomerModal
          customer={modalMode === 'new' ? null : modalMode}
          onClose={() => setModalMode(null)}
          onSaved={(saved) => {
            qc.invalidateQueries({ queryKey: ['customers'] })
            setSelected(saved)
            setModalMode(null)
          }}
        />
      )}
    </div>
  )
}

// ── Customer Form Modal ───────────────────────────────────────

function CustomerModal({
  customer,
  onClose,
  onSaved,
}: {
  customer: Customer | null
  onClose: () => void
  onSaved: (c: Customer) => void
}) {
  const isEdit = customer !== null
  const [form, setForm] = useState(
    customer
      ? { first_name: customer.first_name, last_name: customer.last_name,
          phone: customer.phone ?? '', cell: customer.cell ?? '',
          address: customer.address ?? '', notes: customer.notes ?? '' }
      : EMPTY_FORM
  )
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: (data: object) =>
      isEdit
        ? api.patch(`/customers/${customer!.id}`, data).then(r => r.data)
        : api.post('/customers/', data).then(r => r.data),
    onSuccess: onSaved,
    onError: () => setError('Failed to save. Please try again.'),
  })

  function set(field: string, value: string) {
    setForm(p => ({ ...p, [field]: value }))
  }

  function handleSave() {
    if (!form.first_name || !form.last_name) {
      setError('First and last name are required.')
      return
    }
    setError('')
    mutation.mutate({
      first_name: form.first_name,
      last_name:  form.last_name,
      phone:      form.phone   || null,
      cell:       form.cell    || null,
      address:    form.address || null,
      notes:      form.notes   || null,
    })
  }

  return (
    <div style={s.overlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={s.modalBox}>
        <div style={s.modalHeader}>
          <p style={s.modalTitle}>{isEdit ? 'Edit Customer' : 'New Customer'}</p>
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
          <div style={s.grid2}>
            <Field label="Phone">
              <input value={form.phone} onChange={e => set('phone', e.target.value)} style={s.input} placeholder="(718) 555-0100" />
            </Field>
            <Field label="Cell">
              <input value={form.cell} onChange={e => set('cell', e.target.value)} style={s.input} placeholder="(718) 555-0101" />
            </Field>
          </div>
          <Field label="Address">
            <input value={form.address} onChange={e => set('address', e.target.value)} style={s.input} placeholder="123 Main St, Brooklyn, NY 11201" />
          </Field>
          <Field label="Notes">
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)} style={{ ...s.input, resize: 'vertical', minHeight: 72 }} placeholder="Optional" />
          </Field>
        </div>

        {error && <p style={s.errorMsg}>{error}</p>}

        <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
          <button onClick={handleSave} disabled={mutation.isPending} style={s.primaryBtn}>
            {mutation.isPending ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Customer'}
          </button>
          <button onClick={onClose} style={s.ghostBtn}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────

function Cell({ children, w }: { children: React.ReactNode; w: number }) {
  return (
    <div style={{ width: w, flexShrink: 0, display: 'flex', alignItems: 'center' }}>
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

function ContactRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 8 }}>
      <span style={{ color: '#a1a1aa', marginTop: 1, flexShrink: 0 }}>{icon}</span>
      <div>
        <p style={{ margin: 0, fontSize: 10, color: '#a1a1aa', fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{label}</p>
        <p style={{ margin: 0, fontSize: 13, color: '#18181b' }}>{value}</p>
      </div>
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  page:      { display: 'flex', flexDirection: 'column', gap: 24 },
  header:    { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
  title:     { fontSize: 26, fontWeight: 700, color: '#18181b', margin: '0 0 4px', letterSpacing: '-0.03em' },
  subtitle:  { fontSize: 13, color: '#71717a', margin: 0 },

  searchWrap:  { display: 'flex', alignItems: 'center', gap: 7, background: '#fff', border: '1px solid rgba(0,0,0,0.12)', borderRadius: 10, padding: '7px 12px', width: 220 },
  searchInput: { border: 'none', outline: 'none', fontSize: 13, color: '#18181b', background: 'transparent', flex: 1, fontFamily: 'inherit' },
  clearBtn:    { background: 'none', border: 'none', cursor: 'pointer', color: '#a1a1aa', display: 'flex', alignItems: 'center', padding: 0 },
  addBtn:      { display: 'flex', alignItems: 'center', gap: 6, background: '#212121', color: '#fff', border: 'none', borderRadius: 10, padding: '9px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },

  table:     { border: '1px solid rgba(0,0,0,0.07)', borderRadius: 14, overflow: 'hidden' },
  tableHead: { display: 'flex', gap: 12, padding: '10px 16px', background: '#fafaf9', borderBottom: '1px solid rgba(0,0,0,0.07)' },
  tableRow:  { display: 'flex', gap: 12, padding: '12px 16px', transition: 'background 0.1s' },

  custName:  { fontSize: 13, fontWeight: 600, color: '#18181b' },
  muted:     { fontSize: 12, color: '#71717a', margin: 0 },

  empty:     { padding: '60px 0', textAlign: 'center' },

  // Drawer
  drawer:        { width: 300, flexShrink: 0, border: '1px solid rgba(0,0,0,0.07)', borderRadius: 16, background: '#fff', overflow: 'hidden' },
  drawerHeader:  { display: 'flex', alignItems: 'center', gap: 10, padding: '16px 16px 12px', borderBottom: '1px solid rgba(0,0,0,0.06)' },
  drawerAvatar:  { width: 38, height: 38, background: '#212121', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#fff', flexShrink: 0, letterSpacing: '-0.02em' },
  drawerName:    { margin: '0 0 2px', fontSize: 14, fontWeight: 700, color: '#18181b', letterSpacing: '-0.02em' },
  drawerSince:   { margin: 0, fontSize: 11, color: '#a1a1aa' },
  drawerSection: { padding: '14px 16px', borderBottom: '1px solid rgba(0,0,0,0.05)' },
  drawerSectionTitle: { margin: '0 0 8px', fontSize: 10, fontWeight: 600, color: '#a1a1aa', letterSpacing: '0.07em', textTransform: 'uppercase' },
  contactGrid:   { display: 'flex', flexDirection: 'column' },
  notesText:     { margin: 0, fontSize: 13, color: '#18181b', lineHeight: 1.5, whiteSpace: 'pre-wrap' },
  notesInput:    { border: '1px solid rgba(0,0,0,0.12)', borderRadius: 8, padding: '8px 10px', fontSize: 13, color: '#18181b', background: '#f9f9f9', outline: 'none', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box', resize: 'vertical' },
  idBadge:       { margin: '0 0 4px', fontSize: 11, color: '#a1a1aa', fontFamily: 'monospace' },

  iconBtn:    { background: 'none', border: 'none', cursor: 'pointer', color: '#a1a1aa', padding: 4, borderRadius: 6, display: 'flex', alignItems: 'center' },
  textBtn:    { background: 'none', border: 'none', cursor: 'pointer', color: '#a1a1aa', fontSize: 11, display: 'flex', alignItems: 'center', gap: 3, padding: 0, fontFamily: 'inherit' },

  primaryBtnSm: { background: '#212121', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  ghostBtnSm:   { background: 'none', border: '1px solid rgba(0,0,0,0.14)', borderRadius: 8, padding: '7px 12px', fontSize: 13, cursor: 'pointer', color: '#71717a', fontFamily: 'inherit' },

  overlay:   { position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modalBox:  { background: '#fff', borderRadius: 18, padding: 24, width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto' as const, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' },
  modalHeader:  { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  modalTitle:   { margin: 0, fontSize: 15, fontWeight: 700, color: '#18181b' },
  closeBtn:     { background: 'none', border: 'none', cursor: 'pointer', color: '#71717a', fontSize: 20, lineHeight: 1, padding: 0 },

  grid2:      { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
  fieldLabel: { fontSize: 12, fontWeight: 500, color: '#71717a' },
  input:      { border: '1px solid rgba(0,0,0,0.12)', borderRadius: 10, padding: '10px 12px', fontSize: 14, color: '#18181b', background: '#f9f9f9', outline: 'none', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' as const },

  primaryBtn: { flex: 1, background: '#212121', color: '#fff', border: 'none', borderRadius: 12, padding: '13px', fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  ghostBtn:   { background: 'none', border: '1px solid rgba(0,0,0,0.14)', borderRadius: 12, padding: '13px 20px', fontSize: 14, cursor: 'pointer', color: '#71717a', fontFamily: 'inherit' },
  errorMsg:   { color: '#ff3b30', fontSize: 13, marginTop: 10 },
}

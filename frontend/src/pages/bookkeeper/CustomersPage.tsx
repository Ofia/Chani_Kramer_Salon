import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { Plus, Search, X, Pencil, Phone, Smartphone, MapPin, StickyNote, History, Trash2 } from 'lucide-react'

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
  const [historyOpen, setHistoryOpen] = useState(false)
  const qc = useQueryClient()

  const { data: customers = [], isLoading } = useQuery<Customer[]>({
    queryKey: ['customers', search],
    queryFn: () => api.get(`/customers/${search ? `?search=${encodeURIComponent(search)}` : ''}`).then(r => Array.isArray(r.data) ? r.data : []).catch(() => []),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/customers/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customers'] })
      setSelected(null)
    },
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
                <Cell w={36} />
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
                  <Cell w={36}>
                    <button
                      onClick={e => {
                        e.stopPropagation()
                        if (!confirm(`Delete ${c.first_name} ${c.last_name}? This cannot be undone.`)) return
                        deleteMutation.mutate(c.id)
                      }}
                      style={s.deleteRowBtn}
                      title="Delete customer"
                    >
                      <Trash2 size={13} />
                    </button>
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

            {/* Purchase History */}
            <div style={{ padding: '14px 16px' }}>
              <button onClick={() => setHistoryOpen(true)} style={s.historyBtn}>
                <History size={13} />
                See Purchase History
              </button>
            </div>
          </div>
        )}

        {/* History Modal */}
        {historyOpen && selected && (
          <PurchaseHistoryModal
            customer={selected}
            onClose={() => setHistoryOpen(false)}
          />
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

function Cell({ children, w }: { children?: React.ReactNode; w: number }) {
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

// ── Purchase History Modal ────────────────────────────────────

type PosSalePayment = { id: string; payment_method: string; amount: number }
type PosSaleItem    = { id: string; item_type: string; description: string; quantity: number; unit_price: number; subtotal: number; wig_brand?: string; wig_serial?: string }
type PosSale        = { id: string; sale_date: string; total_amount: number; amount_paid: number; balance_due: number; notes?: string; items: PosSaleItem[]; payments: PosSalePayment[] }
type WigPayment     = { id: string; payment_date: string; amount: number; payment_method: string; payment_type: string }
type WigOrder       = { id: string; order_date?: string | null; daysmart_serial?: string; brand?: string; length?: string; color?: string; size?: string; notes?: string; total_price: number; amount_paid: number; balance_due: number; sale_status: string; payments: WigPayment[] }
type CustomerHistory = { pos_sales: PosSale[]; wig_sales: WigOrder[] }

const METHOD_LABEL: Record<string, string> = {
  cash: 'Cash', credit_card: 'CC', quickpay: 'QuickPay', check: 'Check', zelle: 'Zelle',
}
const ITEM_COLOR: Record<string, string> = {
  wash_set: '#DF5198', repair: '#E3CD94', inventory: '#97BBE9', wig: '#5581B1',
}
const ITEM_LABEL: Record<string, string> = {
  wash_set: 'Wash & Set', repair: 'Repair', inventory: 'Product', wig: 'Wig',
}
const STATUS_COLOR: Record<string, string> = {
  ordered: '#E3CD94', ready: '#97BBE9', paid_in_full: '#10b981',
}

function safeFmtDate(dateStr: string | null | undefined) {
  if (!dateStr) return '—'
  const [y, m, d] = dateStr.split('T')[0].split('-')
  return `${m}/${d}/${y.slice(2)}`
}

function PurchaseHistoryModal({ customer, onClose }: { customer: Customer; onClose: () => void }) {
  const { profile } = useAuth()
  const canEdit = profile?.role === 'bookkeeper' || profile?.role === 'owner'
  const qc = useQueryClient()
  const [editingWig, setEditingWig] = useState<WigOrder | null>(null)

  const { data, isLoading } = useQuery<CustomerHistory>({
    queryKey: ['customer-history', customer.id],
    queryFn: () => api.get(`/customers/${customer.id}/history`).then(r => r.data).catch(() => ({ pos_sales: [], wig_sales: [] })),
  })

  const totalSpent = (data?.pos_sales.reduce((s, p) => s + Number(p.amount_paid), 0) ?? 0)
    + (data?.wig_sales.reduce((s, w) => s + Number(w.amount_paid), 0) ?? 0)

  const totalVisits = (data?.pos_sales.length ?? 0) + (data?.wig_sales.length ?? 0)

  return (
    <div style={sh.overlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={sh.modal}>

        {/* Header */}
        <div style={sh.header}>
          <div>
            <p style={sh.title}>Purchase History</p>
            <p style={sh.sub}>{customer.first_name} {customer.last_name}</p>
          </div>
          <button onClick={onClose} style={sh.closeBtn}>×</button>
        </div>

        {/* Stats strip */}
        {!isLoading && data && (
          <div style={sh.statsStrip}>
            <StatPill label="Total visits" value={String(totalVisits)} />
            <StatPill label="POS sales" value={String(data.pos_sales.length)} />
            <StatPill label="Wig sales" value={String(data.wig_sales.length)} />
            <StatPill label="Total paid" value={`$${totalSpent.toFixed(2)}`} accent />
          </div>
        )}

        {/* Body */}
        <div style={sh.body}>
          {isLoading && <p style={sh.muted}>Loading…</p>}

          {!isLoading && totalVisits === 0 && (
            <p style={sh.muted}>No purchases on file for this customer.</p>
          )}

          {/* POS Sales */}
          {data?.pos_sales.map(sale => (
            <div key={sale.id} style={sh.card}>
              <div style={sh.cardTop}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={sh.dateLabel}>{safeFmtDate(sale.sale_date)}</span>
                  <span style={sh.badge}>POS Sale</span>
                </div>
                <span style={sh.amount}>${Number(sale.total_amount).toFixed(2)}</span>
              </div>

              {/* Line items */}
              <div style={sh.itemList}>
                {sale.items.map(item => (
                  <div key={item.id} style={sh.itemRow}>
                    <span style={{ ...sh.typeDot, background: ITEM_COLOR[item.item_type] ?? '#ccc' }} />
                    <span style={sh.itemLabel}>{ITEM_LABEL[item.item_type] ?? item.item_type}</span>
                    <span style={sh.itemDesc}>{item.description}{item.wig_serial ? ` · ${item.wig_serial}` : ''}{item.quantity > 1 ? ` ×${item.quantity}` : ''}</span>
                    <span style={sh.itemAmt}>${Number(item.subtotal).toFixed(2)}</span>
                  </div>
                ))}
              </div>

              {/* Payments */}
              <div style={sh.payRow}>
                {sale.payments.map(p => (
                  <span key={p.id} style={sh.payChip}>
                    {METHOD_LABEL[p.payment_method] ?? p.payment_method} ${Number(p.amount).toFixed(2)}
                  </span>
                ))}
                {sale.balance_due > 0 && (
                  <span style={{ ...sh.payChip, background: '#fef2f2', color: '#ef4444' }}>
                    Due ${Number(sale.balance_due).toFixed(2)}
                  </span>
                )}
                {sale.notes && <span style={sh.noteChip}>📝 {sale.notes}</span>}
              </div>
            </div>
          ))}

          {/* Wig Sales */}
          {data?.wig_sales.map(wig => (
            <div key={wig.id} style={sh.card}>
              <div style={sh.cardTop}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={sh.dateLabel}>{safeFmtDate(wig.order_date)}</span>
                  <span style={{ ...sh.badge, background: '#5581B1' + '22', color: '#5581B1' }}>Wig Order</span>
                  <span style={{ ...sh.badge, background: STATUS_COLOR[wig.sale_status] + '22', color: STATUS_COLOR[wig.sale_status] }}>
                    {wig.sale_status.replace('_', ' ')}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={sh.amount}>${Number(wig.total_price).toFixed(2)}</span>
                  {canEdit && (
                    <>
                      <button
                        style={sh.editBtn}
                        onClick={() => setEditingWig(wig)}
                        title="Edit wig details"
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        style={{ ...sh.editBtn, color: '#ef4444', borderColor: 'rgba(239,68,68,0.25)' }}
                        title="Delete wig from history"
                        onClick={async () => {
                          const label = wig.daysmart_serial || wig.brand || 'this wig'
                          if (!window.confirm(`Delete "${label}" from ${customer.first_name}'s history? This cannot be undone.`)) return
                          await api.delete(`/inventory/${wig.id}`)
                          qc.invalidateQueries({ queryKey: ['customer-history', customer.id] })
                          qc.invalidateQueries({ queryKey: ['inventory'] })
                        }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Wig specs */}
              <p style={sh.wigSpecs}>
                {[wig.brand, wig.daysmart_serial, wig.length, wig.color, wig.size]
                  .filter(Boolean).join(' · ') || 'No specs recorded'}
              </p>

              {/* Payment history */}
              <div style={sh.payRow}>
                {wig.payments.map(p => (
                  <span key={p.id} style={sh.payChip}>
                    {METHOD_LABEL[p.payment_method] ?? p.payment_method} ${Number(p.amount).toFixed(2)}
                    {' '}·{' '}{safeFmtDate(p.payment_date)}
                  </span>
                ))}
                {Number(wig.balance_due) > 0 && (
                  <span style={{ ...sh.payChip, background: '#fef2f2', color: '#ef4444' }}>
                    Due ${Number(wig.balance_due).toFixed(2)}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {editingWig && (
        <WigEditModal
          wig={editingWig}
          onClose={() => setEditingWig(null)}
          onSaved={() => {
            setEditingWig(null)
            qc.invalidateQueries({ queryKey: ['customer-history', customer.id] })
            qc.invalidateQueries({ queryKey: ['inventory'] })
          }}
        />
      )}
    </div>
  )
}

// ── Wig Edit Modal ────────────────────────────────────────────

function WigEditModal({ wig, onClose, onSaved }: { wig: WigOrder; onClose: () => void; onSaved: () => void }) {
  const [serial,    setSerial]    = useState(wig.daysmart_serial ?? '')
  const [brand,     setBrand]     = useState(wig.brand     ?? '')
  const [color,     setColor]     = useState(wig.color     ?? '')
  const [length,    setLength]    = useState(wig.length    ?? '')
  const [size,      setSize]      = useState(wig.size      ?? '')
  const [orderDate, setOrderDate] = useState(wig.order_date ? wig.order_date.split('T')[0] : '')
  const [notes,     setNotes]     = useState(wig.notes     ?? '')
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState<string | null>(null)

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      await api.patch(`/inventory/${wig.id}`, {
        daysmart_serial: serial.trim()    || null,
        brand:           brand.trim()     || null,
        color:           color.trim()     || null,
        length:          length.trim()    || null,
        size:            size.trim()      || null,
        order_date:      orderDate        || null,
        notes:           notes.trim()     || null,
      })
      onSaved()
    } catch {
      setError('Failed to save. Please try again.')
      setSaving(false)
    }
  }

  return (
    <div style={{ ...s.overlay, zIndex: 1001 }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ ...s.modalBox, maxWidth: 420 }}>
        <div style={s.modalHeader}>
          <p style={s.modalTitle}>Edit Wig Details</p>
          <button onClick={onClose} style={s.closeBtn}>×</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={s.fieldLabel}>Serial Number</label>
            <input style={s.input} value={serial} onChange={e => setSerial(e.target.value)} placeholder="e.g. RINA55361" />
          </div>
          <div style={s.grid2}>
            <div>
              <label style={s.fieldLabel}>Brand</label>
              <input style={s.input} value={brand} onChange={e => setBrand(e.target.value)} placeholder="Brand" />
            </div>
            <div>
              <label style={s.fieldLabel}>Color</label>
              <input style={s.input} value={color} onChange={e => setColor(e.target.value)} placeholder="Color" />
            </div>
          </div>
          <div style={s.grid2}>
            <div>
              <label style={s.fieldLabel}>Length</label>
              <input style={s.input} value={length} onChange={e => setLength(e.target.value)} placeholder="Length" />
            </div>
            <div>
              <label style={s.fieldLabel}>Size</label>
              <input style={s.input} value={size} onChange={e => setSize(e.target.value)} placeholder="Size" />
            </div>
          </div>
          <div>
            <label style={s.fieldLabel}>Order Date</label>
            <input style={s.input} type="date" value={orderDate} onChange={e => setOrderDate(e.target.value)} />
          </div>
          <div>
            <label style={s.fieldLabel}>Notes</label>
            <textarea
              style={{ ...s.input, resize: 'vertical', minHeight: 70, fontFamily: 'inherit' }}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Any notes about this wig…"
            />
          </div>
          {error && <p style={s.errorMsg}>{error}</p>}
          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button style={s.ghostBtn} onClick={onClose}>Cancel</button>
            <button style={s.primaryBtn} onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function StatPill({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: accent ? '#DF5198' : '#18181b' }}>{value}</p>
      <p style={{ margin: 0, fontSize: 11, color: '#a1a1aa' }}>{label}</p>
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
  deleteRowBtn: { background: 'none', border: 'none', cursor: 'pointer', color: '#a1a1aa', padding: 4, borderRadius: 6, display: 'flex', alignItems: 'center' },
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
  historyBtn: { display: 'flex', alignItems: 'center', gap: 7, width: '100%', padding: '9px 14px', background: '#f7f7f5', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 10, fontSize: 13, fontWeight: 600, color: '#18181b', cursor: 'pointer', fontFamily: 'inherit' },
}

// History modal styles
const sh: Record<string, React.CSSProperties> = {
  overlay:    { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal:      { background: '#fff', borderRadius: 18, width: '90%', maxWidth: 660, maxHeight: '88vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.2)' },
  header:     { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '20px 24px 16px', borderBottom: '1px solid rgba(0,0,0,0.07)' },
  title:      { margin: 0, fontSize: 16, fontWeight: 700, color: '#18181b', letterSpacing: '-0.02em' },
  sub:        { margin: '2px 0 0', fontSize: 13, color: '#71717a' },
  closeBtn:   { background: 'none', border: 'none', cursor: 'pointer', color: '#71717a', fontSize: 22, lineHeight: 1, padding: 0, flexShrink: 0 },
  statsStrip: { display: 'flex', justifyContent: 'space-around', padding: '14px 24px', borderBottom: '1px solid rgba(0,0,0,0.06)', background: '#fafaf9' },
  body:       { flex: 1, overflowY: 'auto', padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 12 },
  muted:      { fontSize: 13, color: '#a1a1aa', textAlign: 'center', padding: '32px 0', margin: 0 },

  card:       { border: '1px solid rgba(0,0,0,0.08)', borderRadius: 12, overflow: 'hidden' },
  cardTop:    { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: '#fafaf9', borderBottom: '1px solid rgba(0,0,0,0.05)' },
  dateLabel:  { fontSize: 12, fontWeight: 600, color: '#18181b' },
  badge:      { fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 5, background: 'rgba(0,0,0,0.06)', color: '#71717a', letterSpacing: '0.02em' },
  amount:     { fontSize: 15, fontWeight: 700, color: '#18181b' },

  itemList:   { padding: '8px 14px', display: 'flex', flexDirection: 'column', gap: 5 },
  itemRow:    { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 },
  typeDot:    { width: 8, height: 8, borderRadius: '50%', flexShrink: 0 },
  itemLabel:  { fontWeight: 600, color: '#18181b', minWidth: 70, flexShrink: 0 },
  itemDesc:   { color: '#71717a', flex: 1 },
  itemAmt:    { fontWeight: 600, color: '#18181b', flexShrink: 0 },

  wigSpecs:   { margin: 0, padding: '8px 14px', fontSize: 13, color: '#71717a' },

  payRow:     { display: 'flex', flexWrap: 'wrap', gap: 6, padding: '8px 14px 12px', borderTop: '1px solid rgba(0,0,0,0.05)' },
  payChip:    { fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 6, background: '#f0fdf4', color: '#15803d' },
  noteChip:   { fontSize: 11, padding: '3px 8px', borderRadius: 6, background: '#fefce8', color: '#713f12' },
  editBtn:    { background: 'none', border: '1px solid rgba(0,0,0,0.12)', borderRadius: 6, cursor: 'pointer', color: '#71717a', display: 'flex', alignItems: 'center', padding: '4px 6px' },
}

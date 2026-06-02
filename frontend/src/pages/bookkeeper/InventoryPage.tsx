/**
 * InventoryPage — unified wig + product stock management.
 *
 * Tabs:
 *   Wigs    — one row per physical wig, status badge, history drawer on click
 *   Products — non-wig items (care products, accessories, etc.)
 *
 * Gear icon opens Brand Markup settings modal.
 */

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Package, Plus, X, ChevronRight, Tag } from 'lucide-react'
import { api } from '../../lib/api'

// ── Types ──────────────────────────────────────────────────────────────────

type ItemType = 'wig' | 'product'

type WigStatus =
  | 'in_stock' | 'sold' | 'on_service'
  | 'damaged' | 'returned_to_supplier' | 'transferred'

type EventType =
  | 'arrived' | 'sold' | 'service' | 'payment_received'
  | 'damaged' | 'returned' | 'transferred' | 'note'

interface InventoryItem {
  id: string
  item_type: ItemType
  name: string
  notes: string | null
  created_at: string
  updated_at: string
  // product
  category: string | null
  quantity: number
  unit_price: number
  // wig
  daysmart_serial: string | null
  brand: string | null
  color: string | null
  length: string | null
  size: string | null
  front: string | null
  cost_price: number | null
  retail_price: number | null
  wig_status: WigStatus | null
  supplier: string | null
  arrival_date: string | null
}

interface InventoryEvent {
  id: string
  inventory_item_id: string
  event_type: EventType
  customer_id: string | null
  amount: number | null
  description: string | null
  event_date: string
  created_by: string | null
  created_at: string
}

interface BrandMarkup {
  id: string
  brand: string
  markup_pct: number
  updated_at: string
}

// ── Constants ──────────────────────────────────────────────────────────────

const WIG_STATUS_LABEL: Record<WigStatus, string> = {
  in_stock: 'In Stock',
  sold: 'Sold',
  on_service: 'On Service',
  damaged: 'Damaged',
  returned_to_supplier: 'Returned',
  transferred: 'Transferred',
}

const WIG_STATUS_COLOR: Record<WigStatus, { bg: string; color: string }> = {
  in_stock:             { bg: '#dcfce7', color: '#166534' },
  sold:                 { bg: '#dbeafe', color: '#1e3a8a' },
  on_service:           { bg: '#fef3c7', color: '#92400e' },
  damaged:              { bg: '#fee2e2', color: '#991b1b' },
  returned_to_supplier: { bg: '#f3f4f6', color: '#374151' },
  transferred:          { bg: '#ede9fe', color: '#5b21b6' },
}

const EVENT_LABEL: Record<EventType, string> = {
  arrived: 'Arrived',
  sold: 'Sold',
  service: 'Service',
  payment_received: 'Payment',
  damaged: 'Damaged',
  returned: 'Returned',
  transferred: 'Transferred',
  note: 'Note',
}

const EVENT_COLOR: Record<EventType, string> = {
  arrived: '#5581B1',
  sold: '#DF5198',
  service: '#E3CD94',
  payment_received: '#22c55e',
  damaged: '#ef4444',
  returned: '#6b7280',
  transferred: '#8b5cf6',
  note: '#9ca3af',
}

const WIG_STATUSES: WigStatus[] = [
  'in_stock', 'sold', 'on_service', 'damaged', 'returned_to_supplier', 'transferred',
]

// ── Helpers ────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined) {
  if (n == null) return '—'
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function wigLabel(w: InventoryItem) {
  const parts = [w.brand, w.length, w.color, w.size].filter(Boolean)
  return parts.join(' · ') || w.name
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function InventoryPage() {
  const qc = useQueryClient()

  const [tab, setTab] = useState<ItemType>('wig')
  const [statusFilter, setStatusFilter] = useState<WigStatus | ''>('')
  const [brandFilter, setBrandFilter] = useState('')

  // Drawer — wig history
  const [drawerWig, setDrawerWig] = useState<InventoryItem | null>(null)

  // Modal states
  const [showAddWig, setShowAddWig] = useState(false)
  const [showAddProduct, setShowAddProduct] = useState(false)
  const [showMarkups, setShowMarkups] = useState(false)
  const [editItem, setEditItem] = useState<InventoryItem | null>(null)

  // ── Queries ──────────────────────────────────────────────────────────────

  const { data: items = [], isLoading } = useQuery<InventoryItem[]>({
    queryKey: ['inventory', tab, statusFilter, brandFilter],
    queryFn: () => {
      const params = new URLSearchParams({ item_type: tab })
      if (statusFilter) params.set('wig_status', statusFilter)
      if (brandFilter) params.set('brand', brandFilter)
      return api.get(`/inventory/?${params}`).then(r => Array.isArray(r.data) ? r.data : [])
    },
  })

  const { data: markups = [] } = useQuery<BrandMarkup[]>({
    queryKey: ['brand-markups'],
    queryFn: () => api.get('/inventory/brand-markups').then(r => Array.isArray(r.data) ? r.data : []),
  })

  const { data: drawerEvents = [] } = useQuery<InventoryEvent[]>({
    queryKey: ['inventory-events', drawerWig?.id],
    enabled: !!drawerWig,
    queryFn: () => api.get(`/inventory/${drawerWig!.id}/events`).then(r => Array.isArray(r.data) ? r.data : []),
  })

  // ── Mutations ─────────────────────────────────────────────────────────────

  const deleteItem = useMutation({
    mutationFn: (id: string) => api.delete(`/inventory/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inventory'] }),
  })

  const updateStatus = useMutation({
    mutationFn: ({ id, wig_status }: { id: string; wig_status: WigStatus }) =>
      api.patch(`/inventory/${id}`, { wig_status }).then(r => r.data),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ['inventory'] })
      qc.invalidateQueries({ queryKey: ['inventory-events', updated.id] })
      if (drawerWig?.id === updated.id) setDrawerWig(updated)
    },
  })

  // ── Render ────────────────────────────────────────────────────────────────

  const wigs = items.filter(i => i.item_type === 'wig')
  const products = items.filter(i => i.item_type === 'product')

  return (
    <div style={s.page}>

      {/* Header */}
      <div style={s.header}>
        <div style={s.headerLeft}>
          <Package size={20} strokeWidth={1.6} color="#212121" />
          <h1 style={s.title}>Inventory</h1>
        </div>
        <div style={s.headerRight}>
          <button style={s.iconBtn} onClick={() => setShowMarkups(true)} title="Brand Markups">
            <Tag size={15} />
            <span>Brand Markups</span>
          </button>
          <button style={s.primaryBtn} onClick={() => tab === 'wig' ? setShowAddWig(true) : setShowAddProduct(true)}>
            <Plus size={14} />
            {tab === 'wig' ? 'Add Wig' : 'Add Product'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={s.tabBar}>
        {(['wig', 'product'] as ItemType[]).map(t => (
          <button key={t} style={{ ...s.tab, ...(tab === t ? s.tabActive : {}) }} onClick={() => setTab(t)}>
            {t === 'wig' ? 'Wigs' : 'Products'}
          </button>
        ))}
      </div>

      {/* Wig Filters */}
      {tab === 'wig' && (
        <div style={s.filterBar}>
          <select
            style={s.select}
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as WigStatus | '')}
          >
            <option value="">All Statuses</option>
            {WIG_STATUSES.map(st => (
              <option key={st} value={st}>{WIG_STATUS_LABEL[st]}</option>
            ))}
          </select>
          <input
            style={s.input}
            placeholder="Filter by brand…"
            value={brandFilter}
            onChange={e => setBrandFilter(e.target.value)}
          />
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div style={s.empty}>Loading…</div>
      ) : tab === 'wig' ? (
        <WigTable
          wigs={wigs}
          onRowClick={setDrawerWig}
          onDelete={id => deleteItem.mutate(id)}
        />
      ) : (
        <ProductTable
          products={products}
          onEdit={setEditItem}
          onDelete={id => deleteItem.mutate(id)}
        />
      )}

      {/* ── History Drawer ── */}
      {drawerWig && (
        <div style={s.drawerOverlay} onClick={() => setDrawerWig(null)}>
          <div style={s.drawer} onClick={e => e.stopPropagation()}>
            <div style={s.drawerHeader}>
              <div>
                <div style={s.drawerTitle}>{drawerWig.daysmart_serial ?? 'No Serial'}</div>
                <div style={s.drawerSub}>{wigLabel(drawerWig)}</div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {drawerWig.wig_status && (
                  <span style={{ ...s.badge, ...WIG_STATUS_COLOR[drawerWig.wig_status] }}>
                    {WIG_STATUS_LABEL[drawerWig.wig_status]}
                  </span>
                )}
                <button style={s.iconBtnSm} onClick={() => setDrawerWig(null)}><X size={16} /></button>
              </div>
            </div>

            {/* Wig details */}
            <div style={s.detailGrid}>
              {[
                ['Supplier', drawerWig.supplier],
                ['Arrived', drawerWig.arrival_date],
                ['Cost', fmt(drawerWig.cost_price)],
                ['Retail', fmt(drawerWig.retail_price)],
                ['Front', drawerWig.front],
                ['Size', drawerWig.size],
              ].map(([label, val]) => val ? (
                <div key={label as string} style={s.detailRow}>
                  <span style={s.detailLabel}>{label}</span>
                  <span style={s.detailVal}>{val}</span>
                </div>
              ) : null)}
            </div>

            {/* Status changer */}
            <div style={s.drawerSection}>
              <div style={s.drawerSectionLabel}>Change Status</div>
              <div style={s.statusGrid}>
                {WIG_STATUSES.map(st => (
                  <button
                    key={st}
                    style={{
                      ...s.statusBtn,
                      ...(drawerWig.wig_status === st ? { ...WIG_STATUS_COLOR[st], borderColor: 'transparent' } : {}),
                    }}
                    onClick={() => updateStatus.mutate({ id: drawerWig.id, wig_status: st })}
                  >
                    {WIG_STATUS_LABEL[st]}
                  </button>
                ))}
              </div>
            </div>

            {/* History events */}
            <div style={s.drawerSection}>
              <div style={s.drawerSectionLabel}>History</div>
              {drawerEvents.length === 0 ? (
                <div style={s.emptySmall}>No events yet.</div>
              ) : (
                <div style={s.timeline}>
                  {drawerEvents.map(ev => (
                    <div key={ev.id} style={s.timelineRow}>
                      <div style={{ ...s.timelineDot, background: EVENT_COLOR[ev.event_type] }} />
                      <div style={s.timelineBody}>
                        <div style={s.timelineTop}>
                          <span style={{ ...s.eventBadge, color: EVENT_COLOR[ev.event_type] }}>
                            {EVENT_LABEL[ev.event_type]}
                          </span>
                          <span style={s.timelineDate}>{ev.event_date}</span>
                        </div>
                        {ev.description && <div style={s.timelineDesc}>{ev.description}</div>}
                        {ev.amount != null && <div style={s.timelineAmount}>{fmt(ev.amount)}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {drawerWig.notes && (
              <div style={s.drawerSection}>
                <div style={s.drawerSectionLabel}>Notes</div>
                <div style={s.notesBox}>{drawerWig.notes}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Modals ── */}
      {showAddWig && (
        <AddWigModal
          markups={markups}
          onClose={() => setShowAddWig(false)}
          onSaved={() => { setShowAddWig(false); qc.invalidateQueries({ queryKey: ['inventory'] }) }}
        />
      )}

      {showAddProduct && (
        <AddProductModal
          item={editItem}
          onClose={() => { setShowAddProduct(false); setEditItem(null) }}
          onSaved={() => { setShowAddProduct(false); setEditItem(null); qc.invalidateQueries({ queryKey: ['inventory'] }) }}
        />
      )}

      {editItem && !showAddProduct && (
        <AddProductModal
          item={editItem}
          onClose={() => setEditItem(null)}
          onSaved={() => { setEditItem(null); qc.invalidateQueries({ queryKey: ['inventory'] }) }}
        />
      )}

      {showMarkups && (
        <BrandMarkupsModal
          markups={markups}
          onClose={() => setShowMarkups(false)}
          onSaved={() => qc.invalidateQueries({ queryKey: ['brand-markups'] })}
        />
      )}
    </div>
  )
}

// ── Wig Table ──────────────────────────────────────────────────────────────

function WigTable({ wigs, onRowClick, onDelete }: {
  wigs: InventoryItem[]
  onRowClick: (w: InventoryItem) => void
  onDelete: (id: string) => void
}) {
  if (wigs.length === 0) return <div style={s.empty}>No wigs found.</div>

  return (
    <div style={s.tableWrap}>
      <table style={s.table}>
        <thead>
          <tr>
            {['Serial', 'Brand', 'Specs', 'Supplier', 'Cost', 'Retail', 'Status', ''].map(h => (
              <th key={h} style={s.th}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {wigs.map(w => (
            <tr key={w.id} style={s.tr} onClick={() => onRowClick(w)}>
              <td style={s.td}><span style={s.serial}>{w.daysmart_serial ?? '—'}</span></td>
              <td style={s.td}>{w.brand ?? '—'}</td>
              <td style={s.td}>
                <span style={s.specs}>
                  {[w.length, w.color, w.size, w.front].filter(Boolean).join(' · ') || '—'}
                </span>
              </td>
              <td style={s.td}>{w.supplier ?? '—'}</td>
              <td style={s.td}>{fmt(w.cost_price)}</td>
              <td style={s.td}>{fmt(w.retail_price)}</td>
              <td style={s.td}>
                {w.wig_status && (
                  <span style={{ ...s.badge, ...WIG_STATUS_COLOR[w.wig_status] }}>
                    {WIG_STATUS_LABEL[w.wig_status]}
                  </span>
                )}
              </td>
              <td style={s.td} onClick={e => e.stopPropagation()}>
                <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                  <button style={s.rowBtn} onClick={() => onRowClick(w)}>
                    <ChevronRight size={14} />
                  </button>
                  <button style={{ ...s.rowBtn, color: '#ef4444' }} onClick={() => {
                    if (confirm('Delete this wig from inventory?')) onDelete(w.id)
                  }}>
                    <X size={14} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Product Table ──────────────────────────────────────────────────────────

function ProductTable({ products, onEdit, onDelete }: {
  products: InventoryItem[]
  onEdit: (p: InventoryItem) => void
  onDelete: (id: string) => void
}) {
  if (products.length === 0) return <div style={s.empty}>No products found.</div>

  return (
    <div style={s.tableWrap}>
      <table style={s.table}>
        <thead>
          <tr>
            {['Name', 'Category', 'Qty', 'Unit Price', ''].map(h => (
              <th key={h} style={s.th}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {products.map(p => (
            <tr key={p.id} style={s.tr}>
              <td style={s.td}>{p.name}</td>
              <td style={s.td}>{p.category ?? '—'}</td>
              <td style={s.td}>{p.quantity}</td>
              <td style={s.td}>{fmt(p.unit_price)}</td>
              <td style={s.td}>
                <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                  <button style={s.rowBtn} onClick={() => onEdit(p)}>Edit</button>
                  <button style={{ ...s.rowBtn, color: '#ef4444' }} onClick={() => {
                    if (confirm('Delete this product?')) onDelete(p.id)
                  }}>
                    <X size={14} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Add Wig Modal ──────────────────────────────────────────────────────────

function AddWigModal({ markups, onClose, onSaved }: {
  markups: BrandMarkup[]
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState({
    daysmart_serial: '', brand: '', color: '', length: '', size: '', front: '',
    cost_price: '', retail_price: '', supplier: '', arrival_date: '', notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  function set(k: string, v: string) {
    setForm(f => {
      const next = { ...f, [k]: v }
      // Auto-calculate retail price when brand + cost change
      if ((k === 'brand' || k === 'cost_price') && next.cost_price) {
        const markup = markups.find(m => m.brand.toLowerCase() === next.brand.toLowerCase())
        if (markup) {
          const cost = parseFloat(next.cost_price)
          if (!isNaN(cost)) {
            next.retail_price = (cost * (1 + markup.markup_pct / 100)).toFixed(2)
          }
        }
      }
      return next
    })
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setErr('')
    try {
      await api.post('/inventory/', {
        item_type: 'wig',
        name: [form.brand, form.length, form.color].filter(Boolean).join(' ') || 'Wig',
        daysmart_serial: form.daysmart_serial || null,
        brand: form.brand || null,
        color: form.color || null,
        length: form.length || null,
        size: form.size || null,
        front: form.front || null,
        cost_price: form.cost_price ? parseFloat(form.cost_price) : null,
        retail_price: form.retail_price ? parseFloat(form.retail_price) : null,
        supplier: form.supplier || null,
        arrival_date: form.arrival_date || null,
        notes: form.notes || null,
        wig_status: 'in_stock',
      })
      onSaved()
    } catch (e: any) {
      setErr(e.response?.data?.detail ?? e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={s.modalOverlay} onClick={onClose}>
      <div style={s.modal} onClick={e => e.stopPropagation()}>
        <div style={s.modalHeader}>
          <span style={s.modalTitle}>Add Wig to Inventory</span>
          <button style={s.iconBtnSm} onClick={onClose}><X size={16} /></button>
        </div>
        <form onSubmit={submit} style={s.form}>
          <div style={s.row2}>
            <Field label="Serial # (DaySmart)"><input style={s.fi} value={form.daysmart_serial} onChange={e => set('daysmart_serial', e.target.value)} /></Field>
            <Field label="Brand"><input style={s.fi} value={form.brand} onChange={e => set('brand', e.target.value)} /></Field>
          </div>
          <div style={s.row3}>
            <Field label="Color"><input style={s.fi} value={form.color} onChange={e => set('color', e.target.value)} /></Field>
            <Field label="Length"><input style={s.fi} value={form.length} onChange={e => set('length', e.target.value)} /></Field>
            <Field label="Size"><input style={s.fi} value={form.size} onChange={e => set('size', e.target.value)} /></Field>
          </div>
          <Field label="Front"><input style={s.fi} value={form.front} onChange={e => set('front', e.target.value)} /></Field>
          <div style={s.row2}>
            <Field label="Supplier"><input style={s.fi} value={form.supplier} onChange={e => set('supplier', e.target.value)} /></Field>
            <Field label="Arrival Date"><input type="date" style={s.fi} value={form.arrival_date} onChange={e => set('arrival_date', e.target.value)} /></Field>
          </div>
          <div style={s.row2}>
            <Field label="Cost Price ($)"><input type="number" step="0.01" style={s.fi} value={form.cost_price} onChange={e => set('cost_price', e.target.value)} /></Field>
            <Field label="Retail Price ($)">
              <input type="number" step="0.01" style={s.fi} value={form.retail_price} onChange={e => set('retail_price', e.target.value)} />
              {form.brand && markups.find(m => m.brand.toLowerCase() === form.brand.toLowerCase()) && (
                <span style={s.hint}>Auto from {markups.find(m => m.brand.toLowerCase() === form.brand.toLowerCase())!.markup_pct}% markup</span>
              )}
            </Field>
          </div>
          <Field label="Notes"><textarea style={{ ...s.fi, minHeight: 60 }} value={form.notes} onChange={e => set('notes', e.target.value)} /></Field>
          {err && <div style={s.errMsg}>{err}</div>}
          <div style={s.modalFooter}>
            <button type="button" style={s.cancelBtn} onClick={onClose}>Cancel</button>
            <button type="submit" style={s.primaryBtn} disabled={saving}>{saving ? 'Saving…' : 'Add Wig'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Add / Edit Product Modal ───────────────────────────────────────────────

function AddProductModal({ item, onClose, onSaved }: {
  item: InventoryItem | null
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState({
    name: item?.name ?? '',
    category: item?.category ?? '',
    quantity: String(item?.quantity ?? 0),
    unit_price: String(item?.unit_price ?? ''),
    notes: item?.notes ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setErr('')
    try {
      const body = {
        item_type: 'product',
        name: form.name,
        category: form.category || null,
        quantity: parseInt(form.quantity) || 0,
        unit_price: parseFloat(form.unit_price) || 0,
        notes: form.notes || null,
      }
      if (item) {
        await api.patch(`/inventory/${item.id}`, body)
      } else {
        await api.post('/inventory/', body)
      }
      onSaved()
    } catch (e: any) {
      setErr(e.response?.data?.detail ?? e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={s.modalOverlay} onClick={onClose}>
      <div style={{ ...s.modal, maxWidth: 420 }} onClick={e => e.stopPropagation()}>
        <div style={s.modalHeader}>
          <span style={s.modalTitle}>{item ? 'Edit Product' : 'Add Product'}</span>
          <button style={s.iconBtnSm} onClick={onClose}><X size={16} /></button>
        </div>
        <form onSubmit={submit} style={s.form}>
          <Field label="Name *"><input required style={s.fi} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></Field>
          <Field label="Category"><input style={s.fi} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} /></Field>
          <div style={s.row2}>
            <Field label="Quantity"><input type="number" style={s.fi} value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} /></Field>
            <Field label="Unit Price ($)"><input type="number" step="0.01" style={s.fi} value={form.unit_price} onChange={e => setForm(f => ({ ...f, unit_price: e.target.value }))} /></Field>
          </div>
          <Field label="Notes"><textarea style={{ ...s.fi, minHeight: 60 }} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></Field>
          {err && <div style={s.errMsg}>{err}</div>}
          <div style={s.modalFooter}>
            <button type="button" style={s.cancelBtn} onClick={onClose}>Cancel</button>
            <button type="submit" style={s.primaryBtn} disabled={saving}>{saving ? 'Saving…' : item ? 'Save' : 'Add Product'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Brand Markups Modal ────────────────────────────────────────────────────

function BrandMarkupsModal({ markups, onClose, onSaved }: {
  markups: BrandMarkup[]
  onClose: () => void
  onSaved: () => void
}) {
  const [brand, setBrand] = useState('')
  const [pct, setPct] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!brand || !pct) return
    setSaving(true); setErr('')
    try {
      await api.post('/inventory/brand-markups', { brand, markup_pct: parseFloat(pct) })
      setBrand(''); setPct('')
      onSaved()
    } catch (e: any) {
      setErr(e.response?.data?.detail ?? e.message)
    } finally {
      setSaving(false)
    }
  }

  async function deleteMarkup(id: string) {
    await api.delete(`/inventory/brand-markups/${id}`)
    onSaved()
  }

  return (
    <div style={s.modalOverlay} onClick={onClose}>
      <div style={{ ...s.modal, maxWidth: 440 }} onClick={e => e.stopPropagation()}>
        <div style={s.modalHeader}>
          <span style={s.modalTitle}>Brand Markups</span>
          <button style={s.iconBtnSm} onClick={onClose}><X size={16} /></button>
        </div>
        <div style={{ padding: '0 24px 8px' }}>
          <p style={s.hint}>Set markup % per brand. Retail price auto-fills when you add a wig.</p>
          <div style={s.markupList}>
            {markups.length === 0 && <div style={s.emptySmall}>No markups yet.</div>}
            {markups.map(m => (
              <div key={m.id} style={s.markupRow}>
                <span style={s.markupBrand}>{m.brand}</span>
                <span style={s.markupPct}>{m.markup_pct}%</span>
                <button style={{ ...s.rowBtn, color: '#ef4444' }} onClick={() => deleteMarkup(m.id)}><X size={12} /></button>
              </div>
            ))}
          </div>
          <form onSubmit={submit} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginTop: 16 }}>
            <Field label="Brand">
              <input style={{ ...s.fi, width: 140 }} value={brand} onChange={e => setBrand(e.target.value)} placeholder="e.g. Jon Renau" />
            </Field>
            <Field label="Markup %">
              <input type="number" step="0.1" style={{ ...s.fi, width: 80 }} value={pct} onChange={e => setPct(e.target.value)} placeholder="40" />
            </Field>
            <button type="submit" style={{ ...s.primaryBtn, alignSelf: 'flex-end' }} disabled={saving}>
              {saving ? '…' : 'Add'}
            </button>
          </form>
          {err && <div style={s.errMsg}>{err}</div>}
        </div>
        <div style={{ height: 16 }} />
      </div>
    </div>
  )
}

// ── Field wrapper ──────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={s.label}>{label}</label>
      {children}
    </div>
  )
}

// ── Styles ─────────────────────────────────────────────────────────────────

const BORDER = '1px solid rgba(13,13,13,0.08)'

const s: Record<string, React.CSSProperties> = {
  page:       { fontFamily: "'Inter', -apple-system, sans-serif", color: '#0d0d0d' },
  header:     { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 10 },
  headerRight:{ display: 'flex', alignItems: 'center', gap: 10 },
  title:      { fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em', margin: 0 },

  // Tabs
  tabBar:     { display: 'flex', gap: 0, borderBottom: BORDER, marginBottom: 20 },
  tab:        { background: 'none', border: 'none', borderBottom: '2px solid transparent', padding: '8px 18px', fontSize: 13, fontWeight: 500, color: 'rgba(13,13,13,0.45)', cursor: 'pointer', transition: 'all 0.15s' },
  tabActive:  { borderBottomColor: '#212121', color: '#212121' },

  // Filter bar
  filterBar:  { display: 'flex', gap: 10, marginBottom: 16 },
  select:     { padding: '7px 10px', border: BORDER, borderRadius: 8, fontSize: 13, background: '#fff', cursor: 'pointer', color: '#0d0d0d' },
  input:      { padding: '7px 10px', border: BORDER, borderRadius: 8, fontSize: 13, background: '#fff', flex: 1, maxWidth: 200 },

  // Table
  tableWrap:  { overflowX: 'auto' },
  table:      { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th:         { textAlign: 'left', padding: '10px 12px', borderBottom: BORDER, fontWeight: 500, fontSize: 11, color: 'rgba(13,13,13,0.45)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' },
  tr:         { borderBottom: BORDER, cursor: 'pointer', transition: 'background 0.1s' },
  td:         { padding: '11px 12px', verticalAlign: 'middle' },
  serial:     { fontFamily: 'monospace', fontSize: 12, background: '#f5f5f4', padding: '2px 7px', borderRadius: 5, color: '#374151' },
  specs:      { color: 'rgba(13,13,13,0.55)', fontSize: 12 },

  // Badges
  badge:      { display: 'inline-block', padding: '2px 9px', borderRadius: 20, fontSize: 11, fontWeight: 600, letterSpacing: '0.02em' },

  // Buttons
  primaryBtn: { display: 'flex', alignItems: 'center', gap: 6, background: '#212121', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 500, cursor: 'pointer' },
  cancelBtn:  { background: 'none', border: BORDER, borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer', color: '#0d0d0d' },
  iconBtn:    { display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: BORDER, borderRadius: 8, padding: '7px 12px', fontSize: 13, cursor: 'pointer', color: 'rgba(13,13,13,0.6)' },
  iconBtnSm:  { background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 4, borderRadius: 6, color: 'rgba(13,13,13,0.45)' },
  rowBtn:     { background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, padding: '4px 6px', borderRadius: 6, fontSize: 12, color: 'rgba(13,13,13,0.55)' },

  // Drawer
  drawerOverlay:  { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.25)', zIndex: 200, display: 'flex', justifyContent: 'flex-end' },
  drawer:         { width: 420, background: '#fff', height: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column', boxShadow: '-4px 0 24px rgba(0,0,0,0.1)' },
  drawerHeader:   { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '20px 20px 16px', borderBottom: BORDER },
  drawerTitle:    { fontFamily: 'monospace', fontSize: 16, fontWeight: 700, color: '#212121' },
  drawerSub:      { fontSize: 12, color: 'rgba(13,13,13,0.55)', marginTop: 2 },
  drawerSection:  { padding: '16px 20px', borderBottom: BORDER },
  drawerSectionLabel: { fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'rgba(13,13,13,0.4)', marginBottom: 10 },

  detailGrid:   { padding: '12px 20px', borderBottom: BORDER, display: 'flex', flexDirection: 'column', gap: 6 },
  detailRow:    { display: 'flex', justifyContent: 'space-between', fontSize: 13 },
  detailLabel:  { color: 'rgba(13,13,13,0.5)' },
  detailVal:    { fontWeight: 500 },

  statusGrid:   { display: 'flex', flexWrap: 'wrap', gap: 6 },
  statusBtn:    { border: BORDER, background: '#fff', borderRadius: 20, padding: '4px 12px', fontSize: 12, fontWeight: 500, cursor: 'pointer' },

  // Timeline
  timeline:     { display: 'flex', flexDirection: 'column', gap: 12 },
  timelineRow:  { display: 'flex', gap: 10, alignItems: 'flex-start' },
  timelineDot:  { width: 8, height: 8, borderRadius: '50%', marginTop: 5, flexShrink: 0 },
  timelineBody: { flex: 1 },
  timelineTop:  { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  timelineDate: { fontSize: 11, color: 'rgba(13,13,13,0.4)' },
  timelineDesc: { fontSize: 12, color: 'rgba(13,13,13,0.6)', marginTop: 2 },
  timelineAmount: { fontSize: 12, fontWeight: 600, color: '#22c55e', marginTop: 2 },
  eventBadge:   { fontSize: 12, fontWeight: 600 },

  notesBox:   { fontSize: 13, color: 'rgba(13,13,13,0.6)', lineHeight: 1.5, background: '#f9f9f8', borderRadius: 8, padding: '10px 12px' },

  // Modal
  modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.25)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  modal:        { background: '#fff', borderRadius: 14, width: '100%', maxWidth: 560, boxShadow: '0 8px 32px rgba(0,0,0,0.14)', overflow: 'hidden' },
  modalHeader:  { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 24px 14px', borderBottom: BORDER },
  modalTitle:   { fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em' },
  modalFooter:  { display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 8 },

  // Form
  form:   { display: 'flex', flexDirection: 'column', gap: 14, padding: '20px 24px 24px' },
  row2:   { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  row3:   { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 },
  label:  { fontSize: 11, fontWeight: 600, color: 'rgba(13,13,13,0.5)', textTransform: 'uppercase', letterSpacing: '0.05em' },
  fi:     { padding: '8px 10px', border: BORDER, borderRadius: 8, fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box' as const, fontFamily: 'inherit' },
  hint:   { fontSize: 11, color: 'rgba(13,13,13,0.45)', marginTop: 3 },
  errMsg: { background: '#fee2e2', color: '#991b1b', borderRadius: 8, padding: '8px 12px', fontSize: 12 },

  // Markup modal
  markupList:   { display: 'flex', flexDirection: 'column', gap: 6, marginTop: 12 },
  markupRow:    { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: '#f9f9f8', borderRadius: 8 },
  markupBrand:  { flex: 1, fontSize: 13, fontWeight: 500 },
  markupPct:    { fontSize: 13, fontWeight: 600, color: '#5581B1' },

  // Empty states
  empty:      { textAlign: 'center', padding: '60px 20px', color: 'rgba(13,13,13,0.35)', fontSize: 14 },
  emptySmall: { color: 'rgba(13,13,13,0.35)', fontSize: 13, padding: '8px 0' },
}

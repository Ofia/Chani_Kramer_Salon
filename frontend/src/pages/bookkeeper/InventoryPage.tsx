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
import { Package, Plus, X, ChevronRight, ChevronDown, Upload, Pencil, Trash2 } from 'lucide-react'
import { api } from '../../lib/api'

// ── Types ──────────────────────────────────────────────────────────────────

type ItemType = 'wig' | 'product'
type Tab      = 'wig' | 'product' | 'sold' | 'deleted_sales'

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
  // sale fields (populated when wig is sold)
  customer_name: string | null
  customer_phone: string | null
  total_price: number | null
  amount_paid: number | null
  sale_status: string | null   // 'ordered' | 'ready' | 'paid_in_full'
  order_date: string | null
  pickup_date: string | null
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

  const [tab, setTab] = useState<Tab>('wig')
  const [statusFilter, setStatusFilter] = useState<WigStatus | ''>('')
  const [brandFilter, setBrandFilter] = useState('')

  // Drawer — wig history
  const [drawerWig, setDrawerWig] = useState<InventoryItem | null>(null)

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false)
  const [showFileImport, setShowFileImport] = useState(false)
  const [editItem, setEditItem] = useState<InventoryItem | null>(null)
  const [editWig, setEditWig]   = useState<InventoryItem | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; label: string } | null>(null)

  // ── Queries ──────────────────────────────────────────────────────────────

  const { data: items = [], isLoading } = useQuery<InventoryItem[]>({
    queryKey: ['inventory', tab, statusFilter, brandFilter],
    enabled: tab !== 'deleted_sales',
    queryFn: () => {
      const params = new URLSearchParams({ item_type: tab === 'sold' ? 'wig' : tab })
      if (tab === 'sold') {
        params.set('wig_status', 'sold')
      } else {
        if (statusFilter) params.set('wig_status', statusFilter)
      }
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

  // Wigs tab excludes sold items (they live in the Sold Items tab)
  const wigs = items.filter(i => i.item_type === 'wig' && (statusFilter !== '' || i.wig_status !== 'sold'))
  const products = items.filter(i => i.item_type === 'product')

  return (
    <div style={s.page}>

      {/* Header */}
      <div style={s.header}>
        <div style={s.headerLeft}>
          <Package size={20} strokeWidth={1.6} color="#212121" />
          <h1 style={s.title}>Product Management</h1>
        </div>
        <div style={s.headerRight}>
          <button style={s.iconBtn} onClick={() => setShowFileImport(true)} title="Add from file">
            <Upload size={15} />
            <span>Add from file</span>
          </button>
          <button style={s.primaryBtn} onClick={() => setShowAddModal(true)}>
            <Plus size={14} />
            Add Product
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={s.tabBar}>
        {(['wig', 'product', 'sold', 'deleted_sales'] as Tab[]).map(t => (
          <button key={t} style={{ ...s.tab, ...(tab === t ? s.tabActive : {}) }} onClick={() => setTab(t)}>
            {t === 'wig' ? 'Wigs' : t === 'product' ? 'Products' : t === 'sold' ? 'Sold Items' : 'Deleted Sales'}
          </button>
        ))}
      </div>

      {/* Wig Filters (not shown on Sold tab — always filtered to sold) */}
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

      {/* Brand filter on Sold tab */}
      {tab === 'sold' && (
        <div style={s.filterBar}>
          <input
            style={s.input}
            placeholder="Filter by brand…"
            value={brandFilter}
            onChange={e => setBrandFilter(e.target.value)}
          />
        </div>
      )}

      {/* Table */}
      {tab === 'deleted_sales' ? (
        <DeletedSalesTab />
      ) : isLoading ? (
        <div style={s.empty}>Loading…</div>
      ) : tab === 'wig' ? (
        <WigTable
          wigs={wigs}
          onRowClick={setDrawerWig}
          onEdit={setEditWig}
          onDelete={(id, label) => setConfirmDelete({ id, label })}
        />
      ) : tab === 'sold' ? (
        <SoldWigTable
          wigs={items}
          onRowClick={setDrawerWig}
        />
      ) : (
        <ProductTable
          products={products}
          onEdit={setEditItem}
          onDelete={(id, label) => setConfirmDelete({ id, label })}
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
      {editWig && (
        <WigEditModal
          wig={editWig}
          markups={markups}
          onClose={() => setEditWig(null)}
          onSaved={() => { setEditWig(null); qc.invalidateQueries({ queryKey: ['inventory'] }) }}
        />
      )}

      {(showAddModal || !!editItem) && (
        <AddModal
          initialTab={editItem ? 'product' : tab === 'sold' ? 'wig' : tab}
          editProduct={editItem}
          markups={markups}
          onClose={() => { setShowAddModal(false); setEditItem(null) }}
          onSaved={() => { setShowAddModal(false); setEditItem(null); qc.invalidateQueries({ queryKey: ['inventory'] }) }}
        />
      )}

      {showFileImport && (
        <FileImportModal
          onClose={() => setShowFileImport(false)}
          onSaved={() => { setShowFileImport(false); qc.invalidateQueries({ queryKey: ['inventory'] }) }}
        />
      )}

      {confirmDelete && (
        <DeleteConfirmModal
          label={confirmDelete.label}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => { deleteItem.mutate(confirmDelete.id); setConfirmDelete(null) }}
        />
      )}
    </div>
  )
}

// ── Wig Table ──────────────────────────────────────────────────────────────

function WigTable({ wigs, onRowClick, onEdit, onDelete }: {
  wigs: InventoryItem[]
  onRowClick: (w: InventoryItem) => void
  onEdit: (w: InventoryItem) => void
  onDelete: (id: string, label: string) => void
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
                  <button style={s.rowBtn} title="Edit" onClick={() => onEdit(w)}>
                    <Pencil size={13} />
                  </button>
                  <button style={s.rowBtn} onClick={() => onRowClick(w)}>
                    <ChevronRight size={14} />
                  </button>
                  <button style={{ ...s.rowBtn, color: '#ef4444' }} onClick={() => onDelete(w.id, w.daysmart_serial ?? wigLabel(w))}>
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

// ── Sold Wig Table ─────────────────────────────────────────────────────────

const SALE_STATUS_LABEL: Record<string, string> = {
  ordered:      'Deposit',
  ready:        'Ready',
  paid_in_full: 'Paid in Full',
}
const SALE_STATUS_COLOR: Record<string, { bg: string; color: string }> = {
  ordered:      { bg: '#fef3c7', color: '#92400e' },
  ready:        { bg: '#dbeafe', color: '#1e3a8a' },
  paid_in_full: { bg: '#dcfce7', color: '#166534' },
}

function SoldWigTable({ wigs, onRowClick }: {
  wigs: InventoryItem[]
  onRowClick: (w: InventoryItem) => void
}) {
  if (wigs.length === 0) return <div style={s.empty}>No sold wigs.</div>

  return (
    <div style={s.tableWrap}>
      <table style={s.table}>
        <thead>
          <tr>
            {['Serial', 'Brand', 'Specs', 'Customer', 'Sale Price', 'Paid', 'Balance', 'Status', ''].map(h => (
              <th key={h} style={s.th}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {wigs.map(w => {
            const balance = (w.total_price ?? 0) - (w.amount_paid ?? 0)
            const saleStatus = w.sale_status ?? 'ordered'
            const statusStyle = SALE_STATUS_COLOR[saleStatus] ?? { bg: '#f3f4f6', color: '#374151' }
            return (
              <tr key={w.id} style={s.tr} onClick={() => onRowClick(w)}>
                <td style={s.td}><span style={s.serial}>{w.daysmart_serial ?? '—'}</span></td>
                <td style={s.td}>{w.brand ?? '—'}</td>
                <td style={s.td}>
                  <span style={s.specs}>
                    {[w.length, w.color, w.size, w.front].filter(Boolean).join(' · ') || '—'}
                  </span>
                </td>
                <td style={s.td}>
                  <div style={{ fontWeight: 500 }}>{w.customer_name ?? '—'}</div>
                  {w.customer_phone && <div style={{ fontSize: 11, color: 'rgba(13,13,13,0.4)' }}>{w.customer_phone}</div>}
                </td>
                <td style={s.td}>{fmt(w.total_price)}</td>
                <td style={s.td}>{fmt(w.amount_paid)}</td>
                <td style={{ ...s.td, fontWeight: balance > 0 ? 600 : 400, color: balance > 0 ? '#c0392b' : 'rgba(13,13,13,0.4)' }}>
                  {balance > 0 ? fmt(balance) : '—'}
                </td>
                <td style={s.td}>
                  {w.sale_status && (
                    <span style={{ ...s.badge, ...statusStyle }}>
                      {SALE_STATUS_LABEL[saleStatus] ?? saleStatus}
                    </span>
                  )}
                </td>
                <td style={s.td}>
                  <button style={s.rowBtn} onClick={() => onRowClick(w)}>
                    <ChevronRight size={14} />
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Product Table ──────────────────────────────────────────────────────────

function ProductTable({ products, onEdit, onDelete }: {
  products: InventoryItem[]
  onEdit: (p: InventoryItem) => void
  onDelete: (id: string, label: string) => void
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
                  <button style={{ ...s.rowBtn, color: '#ef4444' }} onClick={() => onDelete(p.id, p.name)}>
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

// ── Add Modal (unified Wig + Product) ─────────────────────────────────────

function AddModal({ initialTab, editProduct, markups, onClose, onSaved }: {
  initialTab: ItemType
  editProduct: InventoryItem | null
  markups: BrandMarkup[]
  onClose: () => void
  onSaved: () => void
}) {
  const [modalTab, setModalTab] = useState<ItemType>(initialTab)

  return (
    <div style={s.modalOverlay} onClick={onClose}>
      <div style={s.modal} onClick={e => e.stopPropagation()}>
        <div style={s.modalHeader}>
          <span style={s.modalTitle}>{editProduct ? 'Edit Product' : 'Add to Inventory'}</span>
          <button style={s.iconBtnSm} onClick={onClose}><X size={16} /></button>
        </div>

        {/* Tab switcher — only when adding new (not editing) */}
        {!editProduct && (
          <div style={s.modalTabBar}>
            {(['wig', 'product'] as ItemType[]).map(t => (
              <button
                key={t}
                style={{ ...s.modalTab, ...(modalTab === t ? s.modalTabActive : {}) }}
                onClick={() => setModalTab(t)}
              >
                {t === 'wig' ? 'Wig' : 'Other Product'}
              </button>
            ))}
          </div>
        )}

        {modalTab === 'wig' ? (
          <WigForm markups={markups} onClose={onClose} onSaved={onSaved} />
        ) : (
          <ProductForm item={editProduct} onClose={onClose} onSaved={onSaved} />
        )}
      </div>
    </div>
  )
}

// ── Wig Form ───────────────────────────────────────────────────────────────

function WigForm({ markups, onClose, onSaved }: {
  markups: BrandMarkup[]
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setFormState] = useState({
    daysmart_serial: '', brand: '', color: '', length: '', size: '', front: '',
    provider: '', arrival_date: '', cost_price: '', markup_pct: '', retail_price: '', notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const { data: providers = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ['providers'],
    queryFn: () => api.get('/providers/?active_only=true').then(r => Array.isArray(r.data) ? r.data : []),
  })

  function set(k: string, v: string) {
    setFormState(f => {
      const next = { ...f, [k]: v }
      // Auto-fill markup % when brand matches a known markup
      if (k === 'brand') {
        const m = markups.find(m => m.brand.toLowerCase() === v.toLowerCase())
        if (m) next.markup_pct = String(m.markup_pct)
      }
      // Auto-calc retail from cost + markup
      if (k === 'cost_price' || k === 'markup_pct' || k === 'brand') {
        const cost = parseFloat(next.cost_price)
        const pct  = parseFloat(next.markup_pct)
        if (!isNaN(cost) && !isNaN(pct)) {
          next.retail_price = (cost * (1 + pct / 100)).toFixed(2)
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
        brand:           form.brand           || null,
        color:           form.color           || null,
        length:          form.length          || null,
        size:            form.size            || null,
        front:           form.front           || null,
        cost_price:      form.cost_price      ? parseFloat(form.cost_price)   : null,
        retail_price:    form.retail_price    ? parseFloat(form.retail_price) : null,
        supplier:        form.provider        || null,
        arrival_date:    form.arrival_date    || null,
        notes:           form.notes           || null,
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
    <form onSubmit={submit} style={s.form}>
      <div style={s.row2}>
        <Field label="Serial #"><input style={s.fi} value={form.daysmart_serial} onChange={e => set('daysmart_serial', e.target.value)} /></Field>
        <Field label="Brand">
          <input style={s.fi} value={form.brand} onChange={e => set('brand', e.target.value)} placeholder="e.g. RINA" list="brand-suggestions" />
          <datalist id="brand-suggestions">{markups.map(m => <option key={m.id} value={m.brand} />)}</datalist>
        </Field>
      </div>
      <div style={s.row3}>
        <Field label="Color"><input style={s.fi} value={form.color} onChange={e => set('color', e.target.value)} /></Field>
        <Field label="Length"><input style={s.fi} value={form.length} onChange={e => set('length', e.target.value)} /></Field>
        <Field label="Size"><input style={s.fi} value={form.size} onChange={e => set('size', e.target.value)} /></Field>
      </div>
      <Field label="Front"><input style={s.fi} value={form.front} onChange={e => set('front', e.target.value)} /></Field>
      <div style={s.row2}>
        <Field label="Provider">
          <select style={s.fi} value={form.provider} onChange={e => set('provider', e.target.value)}>
            <option value="">— Select provider —</option>
            {providers.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
          </select>
        </Field>
        <Field label="Arrival Date"><input type="date" style={s.fi} value={form.arrival_date} onChange={e => set('arrival_date', e.target.value)} /></Field>
      </div>
      <div style={s.row3}>
        <Field label="Cost Price ($)">
          <input type="number" step="0.01" style={s.fi} value={form.cost_price} onChange={e => set('cost_price', e.target.value)} />
        </Field>
        <Field label="Markup %">
          <input type="number" step="0.1" style={s.fi} value={form.markup_pct} onChange={e => set('markup_pct', e.target.value)} placeholder="e.g. 40" />
        </Field>
        <Field label="Retail Price ($)">
          <input type="number" step="0.01" style={s.fi} value={form.retail_price} onChange={e => set('retail_price', e.target.value)} />
        </Field>
      </div>
      <Field label="Notes"><textarea style={{ ...s.fi, minHeight: 60 }} value={form.notes} onChange={e => set('notes', e.target.value)} /></Field>
      {err && <div style={s.errMsg}>{err}</div>}
      <div style={s.modalFooter}>
        <button type="button" style={s.cancelBtn} onClick={onClose}>Cancel</button>
        <button type="submit" style={s.primaryBtn} disabled={saving}>{saving ? 'Saving…' : 'Add Wig'}</button>
      </div>
    </form>
  )
}

// ── Wig Edit Modal ─────────────────────────────────────────────────────────

function WigEditModal({ wig, markups, onClose, onSaved }: {
  wig: InventoryItem
  markups: BrandMarkup[]
  onClose: () => void
  onSaved: () => void
}) {
  return (
    <div style={s.modalOverlay} onClick={onClose}>
      <div style={s.modal} onClick={e => e.stopPropagation()}>
        <div style={s.modalHeader}>
          <span style={s.modalTitle}>Edit Wig — {wig.daysmart_serial ?? wigLabel(wig)}</span>
          <button style={s.iconBtnSm} onClick={onClose}><X size={16} /></button>
        </div>
        <WigEditForm wig={wig} markups={markups} onClose={onClose} onSaved={onSaved} />
      </div>
    </div>
  )
}

function WigEditForm({ wig, markups, onClose, onSaved }: {
  wig: InventoryItem
  markups: BrandMarkup[]
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setFormState] = useState({
    daysmart_serial: wig.daysmart_serial ?? '',
    brand:           wig.brand           ?? '',
    color:           wig.color           ?? '',
    length:          wig.length          ?? '',
    size:            wig.size            ?? '',
    front:           wig.front           ?? '',
    supplier:        wig.supplier        ?? '',
    arrival_date:    wig.arrival_date    ?? '',
    cost_price:      wig.cost_price  != null ? String(wig.cost_price)   : '',
    retail_price:    wig.retail_price != null ? String(wig.retail_price) : '',
    notes:           wig.notes           ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr]       = useState('')

  const { data: providers = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ['providers'],
    queryFn: () => api.get('/providers/?active_only=true').then(r => Array.isArray(r.data) ? r.data : []),
  })

  function set(k: string, v: string) {
    setFormState(f => ({ ...f, [k]: v }))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setErr('')
    try {
      await api.patch(`/inventory/${wig.id}`, {
        name:            [form.brand, form.length, form.color].filter(Boolean).join(' ') || wig.name,
        daysmart_serial: form.daysmart_serial || null,
        brand:           form.brand           || null,
        color:           form.color           || null,
        length:          form.length          || null,
        size:            form.size            || null,
        front:           form.front           || null,
        supplier:        form.supplier        || null,
        arrival_date:    form.arrival_date    || null,
        cost_price:      form.cost_price      ? parseFloat(form.cost_price)   : null,
        retail_price:    form.retail_price    ? parseFloat(form.retail_price) : null,
        notes:           form.notes           || null,
      })
      onSaved()
    } catch (e: any) {
      setErr(e.response?.data?.detail ?? e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} style={s.form}>
      <div style={s.row2}>
        <Field label="Serial #"><input style={s.fi} value={form.daysmart_serial} onChange={e => set('daysmart_serial', e.target.value)} /></Field>
        <Field label="Brand">
          <input style={s.fi} value={form.brand} onChange={e => set('brand', e.target.value)} list="edit-brand-suggestions" />
          <datalist id="edit-brand-suggestions">{markups.map(m => <option key={m.id} value={m.brand} />)}</datalist>
        </Field>
      </div>
      <div style={s.row3}>
        <Field label="Color"><input style={s.fi} value={form.color} onChange={e => set('color', e.target.value)} /></Field>
        <Field label="Length"><input style={s.fi} value={form.length} onChange={e => set('length', e.target.value)} /></Field>
        <Field label="Size"><input style={s.fi} value={form.size} onChange={e => set('size', e.target.value)} /></Field>
      </div>
      <Field label="Front"><input style={s.fi} value={form.front} onChange={e => set('front', e.target.value)} /></Field>
      <div style={s.row2}>
        <Field label="Provider / Supplier">
          <select style={s.fi} value={form.supplier} onChange={e => set('supplier', e.target.value)}>
            <option value="">— Select provider —</option>
            {providers.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
          </select>
        </Field>
        <Field label="Arrival Date"><input type="date" style={s.fi} value={form.arrival_date} onChange={e => set('arrival_date', e.target.value)} /></Field>
      </div>
      <div style={s.row2}>
        <Field label="Cost Price ($)">
          <input type="number" step="0.01" style={s.fi} value={form.cost_price} onChange={e => set('cost_price', e.target.value)} />
        </Field>
        <Field label="Retail Price ($)">
          <input type="number" step="0.01" style={s.fi} value={form.retail_price} onChange={e => set('retail_price', e.target.value)} />
        </Field>
      </div>
      <Field label="Notes"><textarea style={{ ...s.fi, minHeight: 60 }} value={form.notes} onChange={e => set('notes', e.target.value)} /></Field>
      {err && <div style={s.errMsg}>{err}</div>}
      <div style={s.modalFooter}>
        <button type="button" style={s.cancelBtn} onClick={onClose}>Cancel</button>
        <button type="submit" style={s.primaryBtn} disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</button>
      </div>
    </form>
  )
}

// ── Product Form ───────────────────────────────────────────────────────────

function ProductForm({ item, onClose, onSaved }: {
  item: InventoryItem | null
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setFormState] = useState({
    name:       item?.name       ?? '',
    category:   item?.category   ?? '',
    quantity:   String(item?.quantity  ?? 0),
    cost_price: String(item?.cost_price  ?? ''),
    markup_pct: '',
    unit_price: String(item?.unit_price ?? ''),
    notes:      item?.notes      ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  function set(k: string, v: string) {
    setFormState(f => {
      const next = { ...f, [k]: v }
      if (k === 'cost_price' || k === 'markup_pct') {
        const cost = parseFloat(next.cost_price)
        const pct  = parseFloat(next.markup_pct)
        if (!isNaN(cost) && !isNaN(pct)) {
          next.unit_price = (cost * (1 + pct / 100)).toFixed(2)
        }
      }
      return next
    })
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setErr('')
    try {
      const body = {
        item_type:  'product',
        name:       form.name,
        category:   form.category  || null,
        quantity:   parseInt(form.quantity)      || 0,
        cost_price: form.cost_price ? parseFloat(form.cost_price) : null,
        unit_price: parseFloat(form.unit_price)  || 0,
        notes:      form.notes     || null,
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
    <form onSubmit={submit} style={s.form}>
      <Field label="Name *"><input required style={s.fi} value={form.name} onChange={e => set('name', e.target.value)} /></Field>
      <Field label="Category"><input style={s.fi} value={form.category} onChange={e => set('category', e.target.value)} /></Field>
      <Field label="Quantity"><input type="number" style={s.fi} value={form.quantity} onChange={e => set('quantity', e.target.value)} /></Field>
      <div style={s.row3}>
        <Field label="Cost Price ($)">
          <input type="number" step="0.01" style={s.fi} value={form.cost_price} onChange={e => set('cost_price', e.target.value)} />
        </Field>
        <Field label="Markup %">
          <input type="number" step="0.1" style={s.fi} value={form.markup_pct} onChange={e => set('markup_pct', e.target.value)} placeholder="e.g. 40" />
        </Field>
        <Field label="Retail Price ($)">
          <input type="number" step="0.01" style={s.fi} value={form.unit_price} onChange={e => set('unit_price', e.target.value)} />
        </Field>
      </div>
      <Field label="Notes"><textarea style={{ ...s.fi, minHeight: 60 }} value={form.notes} onChange={e => set('notes', e.target.value)} /></Field>
      {err && <div style={s.errMsg}>{err}</div>}
      <div style={s.modalFooter}>
        <button type="button" style={s.cancelBtn} onClick={onClose}>Cancel</button>
        <button type="submit" style={s.primaryBtn} disabled={saving}>{saving ? 'Saving…' : item ? 'Save' : 'Add Product'}</button>
      </div>
    </form>
  )
}

// ── Invoice Import Modal ───────────────────────────────────────────────────

type PreviewRow = {
  serial: string
  provider_name: string | null
  provider_id: string | null
  model_type: string
  length: string | null
  color: string
  description: string
  cost: number
  markup_usd: number | null
  retail: number | null
  already_exists: boolean
}

type EditableRow = PreviewRow & {
  markup_edit: string
  retail_edit: string
  selected: boolean
}

function FileImportModal({ onClose, onSaved }: {
  onClose: () => void
  onSaved: () => void
}) {
  const [step, setStep] = useState<'upload' | 'preview' | 'done'>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [rows, setRows] = useState<EditableRow[]>([])
  const [parseError, setParseError] = useState('')
  const [loading, setLoading] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [result, setResult] = useState<{ created: number; skipped: number; errors: string[] } | null>(null)

  function handleFile(f: File) {
    if (!f.name.toLowerCase().endsWith('.pdf')) {
      setParseError('Only PDF invoices are supported. Please upload the delivery invoice PDF.')
      return
    }
    setFile(f)
    setParseError('')

    // actual parsing happens server-side; this just stores the file
  }

  async function parseInvoice() {
    if (!file) return
    setLoading(true)
    setParseError('')
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await api.post('/inventory/invoice-preview', formData)
      const preview: PreviewRow[] = res.data
      setRows(preview.map(row => ({
        ...row,
        markup_edit: row.markup_usd != null ? String(row.markup_usd) : '',
        retail_edit: row.retail != null ? String(row.retail) : '',
        selected: !row.already_exists,
      })))
      setStep('preview')
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } }
      setParseError(e.response?.data?.detail || 'Failed to parse the invoice. Please check the file.')
    } finally {
      setLoading(false)
    }
  }

  function updateMarkup(i: number, val: string) {
    setRows(rs => rs.map((r, idx) => {
      if (idx !== i) return r
      const markup = parseFloat(val)
      const retail = !isNaN(markup) ? (r.cost + markup).toFixed(2) : r.retail_edit
      return { ...r, markup_edit: val, retail_edit: retail }
    }))
  }

  function updateRetail(i: number, val: string) {
    setRows(rs => rs.map((r, idx) => {
      if (idx !== i) return r
      const retail = parseFloat(val)
      const markup = !isNaN(retail) ? (retail - r.cost).toFixed(2) : r.markup_edit
      return { ...r, retail_edit: val, markup_edit: markup }
    }))
  }

  function toggleRow(i: number) {
    setRows(rs => rs.map((r, idx) => idx === i ? { ...r, selected: !r.selected } : r))
  }

  async function confirm() {
    const toCreate = rows.filter(r => r.selected && !r.already_exists)
    if (toCreate.length === 0) return
    setLoading(true)
    try {
      const payload = toCreate.map(r => ({
        serial: r.serial,
        provider_id: r.provider_id,
        provider_name: r.provider_name,
        model_type: r.model_type,
        length: r.length,
        color: r.color,
        cost: r.cost,
        retail: parseFloat(r.retail_edit) || r.cost,
      }))
      const res = await api.post('/inventory/invoice-confirm', payload)
      setResult(res.data)
      setStep('done')
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } }
      setParseError(e.response?.data?.detail || 'Failed to create items.')
    } finally {
      setLoading(false)
    }
  }

  const selectedCount = rows.filter(r => r.selected && !r.already_exists).length
  const existingCount = rows.filter(r => r.already_exists).length

  return (
    <div style={s.modalOverlay} onClick={onClose}>
      <div
        style={{
          ...s.modal,
          maxWidth: step === 'preview' ? '90vw' : 500,
          width: step === 'preview' ? '90vw' : '100%',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={s.modalHeader}>
          <span style={s.modalTitle}>Import Invoice</span>
          <button style={s.iconBtnSm} onClick={onClose}><X size={16} /></button>
        </div>

        <div style={{ padding: '20px 24px 24px', display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto', flex: 1 }}>

          {/* ── Upload step ── */}
          {step === 'upload' && (
            <>
              <div
                style={{
                  border: `2px dashed ${dragging ? '#212121' : 'rgba(13,13,13,0.15)'}`,
                  borderRadius: 12,
                  padding: '36px 24px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'border-color 0.15s',
                  background: dragging ? '#f9f9f8' : '#fff',
                }}
                onDragOver={e => { e.preventDefault(); setDragging(true) }}
                onDragLeave={() => setDragging(false)}
                onDrop={e => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]) }}
                onClick={() => document.getElementById('invoice-file-input')?.click()}
              >
                <Upload size={24} color="rgba(13,13,13,0.35)" style={{ marginBottom: 8 }} />
                <p style={{ fontSize: 13, color: 'rgba(13,13,13,0.6)', margin: 0 }}>
                  Drop a delivery invoice PDF here or click to browse
                </p>
                <p style={{ fontSize: 11, color: 'rgba(13,13,13,0.4)', marginTop: 4, marginBottom: 0 }}>
                  PDF only — Sary/Rina combined invoices supported
                </p>
                <input
                  id="invoice-file-input"
                  type="file"
                  accept=".pdf"
                  style={{ display: 'none' }}
                  onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]) }}
                />
              </div>
              {file && <p style={{ fontSize: 12, color: 'rgba(13,13,13,0.5)', margin: 0 }}>{file.name}</p>}
              {parseError && <div style={s.errMsg}>{parseError}</div>}
              <div style={s.modalFooter}>
                <button style={s.cancelBtn} onClick={onClose}>Cancel</button>
                <button style={s.primaryBtn} onClick={parseInvoice} disabled={!file || loading}>
                  {loading ? 'Parsing…' : 'Parse Invoice'}
                </button>
              </div>
            </>
          )}

          {/* ── Preview step ── */}
          {step === 'preview' && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <p style={{ fontSize: 13, color: 'rgba(13,13,13,0.6)', margin: 0 }}>
                  {rows.length} item{rows.length !== 1 ? 's' : ''} found
                  {existingCount > 0 && ` · ${existingCount} already in inventory`}
                </p>
                <span style={{ fontSize: 11, color: 'rgba(13,13,13,0.4)' }}>
                  Edit markup or retail inline. Retail = Cost + Markup.
                </span>
              </div>

              <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 'calc(92vh - 230px)' }}>
                <table style={{ ...s.table, fontSize: 12 }}>
                  <thead>
                    <tr>
                      <th style={s.th}></th>
                      <th style={s.th}>Serial</th>
                      <th style={s.th}>Provider</th>
                      <th style={s.th}>Model</th>
                      <th style={s.th}>Length</th>
                      <th style={s.th}>Color</th>
                      <th style={{ ...s.th, textAlign: 'right' }}>Cost</th>
                      <th style={{ ...s.th, textAlign: 'right' }}>Markup</th>
                      <th style={{ ...s.th, textAlign: 'right' }}>Retail</th>
                      <th style={s.th}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => (
                      <tr key={row.serial} style={{ ...s.tr, opacity: row.already_exists ? 0.45 : 1 }}>
                        <td style={s.td}>
                          <input
                            type="checkbox"
                            checked={row.selected}
                            disabled={row.already_exists}
                            onChange={() => toggleRow(i)}
                          />
                        </td>
                        <td style={s.td}><span style={s.serial}>{row.serial}</span></td>
                        <td style={s.td}>
                          {row.provider_name
                            ?? <span style={{ color: '#f59e0b', fontWeight: 600 }}>Unknown</span>}
                        </td>
                        <td style={s.td}>{row.model_type}</td>
                        <td style={s.td}>{row.length ?? '—'}</td>
                        <td style={s.td}>{row.color || '—'}</td>
                        <td style={{ ...s.td, textAlign: 'right' }}>${row.cost.toLocaleString()}</td>
                        <td style={{ ...s.td, textAlign: 'right' }}>
                          {row.already_exists ? '—' : (
                            <input
                              style={{ ...s.fi, padding: '3px 6px', fontSize: 12, width: 70, textAlign: 'right' }}
                              value={row.markup_edit}
                              onChange={e => updateMarkup(i, e.target.value)}
                            />
                          )}
                        </td>
                        <td style={{ ...s.td, textAlign: 'right' }}>
                          {row.already_exists ? '—' : (
                            <input
                              style={{ ...s.fi, padding: '3px 6px', fontSize: 12, width: 80, textAlign: 'right', color: '#22c55e', fontWeight: 600 }}
                              value={row.retail_edit}
                              onChange={e => updateRetail(i, e.target.value)}
                            />
                          )}
                        </td>
                        <td style={s.td}>
                          {row.already_exists
                            ? <span style={{ ...s.badge, background: '#f3f4f6', color: '#6b7280' }}>In inventory</span>
                            : row.markup_usd == null
                              ? <span style={{ ...s.badge, background: '#fef3c7', color: '#92400e' }}>No rule</span>
                              : <span style={{ ...s.badge, background: '#dcfce7', color: '#166534' }}>Ready</span>
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {parseError && <div style={s.errMsg}>{parseError}</div>}
              <div style={s.modalFooter}>
                <button style={s.cancelBtn} onClick={() => { setStep('upload'); setRows([]); setFile(null) }}>Back</button>
                <button style={s.primaryBtn} onClick={confirm} disabled={selectedCount === 0 || loading}>
                  {loading ? 'Adding…' : `Add ${selectedCount} Wig${selectedCount !== 1 ? 's' : ''} to Inventory`}
                </button>
              </div>
            </>
          )}

          {/* ── Done step ── */}
          {step === 'done' && result && (
            <>
              <p style={{ fontSize: 14, fontWeight: 500, margin: 0 }}>Import complete</p>
              <p style={{ fontSize: 13, color: 'rgba(13,13,13,0.6)', marginTop: 6 }}>
                {result.created} wig{result.created !== 1 ? 's' : ''} added to inventory
                {result.skipped > 0 ? ` · ${result.skipped} skipped (already exist)` : ''}
                {result.errors.length > 0 ? ` · ${result.errors.length} error${result.errors.length !== 1 ? 's' : ''}` : ''}.
              </p>
              {result.errors.length > 0 && (
                <div style={s.errMsg}>{result.errors.map((e, i) => <div key={i}>{e}</div>)}</div>
              )}
              <div style={s.modalFooter}>
                <button style={s.primaryBtn} onClick={onSaved}>Done</button>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  )
}

// ── Delete Confirm Modal ───────────────────────────────────────────────────

function DeleteConfirmModal({ label, onCancel, onConfirm }: {
  label: string
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <div style={s.modalOverlay} onClick={onCancel}>
      <div style={{ ...s.modal, maxWidth: 400 }} onClick={e => e.stopPropagation()}>
        <div style={s.modalHeader}>
          <span style={s.modalTitle}>Delete item?</span>
          <button style={s.iconBtnSm} onClick={onCancel}><X size={16} /></button>
        </div>
        <div style={{ padding: '20px 24px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <p style={{ fontSize: 13, color: 'rgba(13,13,13,0.65)', margin: 0, lineHeight: 1.5 }}>
            Are you sure you want to delete <strong style={{ color: '#0d0d0d' }}>{label}</strong> from inventory?
            This cannot be undone.
          </p>
          <div style={{ ...s.modalFooter, paddingTop: 0 }}>
            <button style={s.cancelBtn} onClick={onCancel}>Cancel</button>
            <button style={{ ...s.primaryBtn, background: '#ef4444' }} onClick={onConfirm}>Delete</button>
          </div>
        </div>
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

// ── Deleted Sales Tab ───────────────────────────────────────────────────────

type DeletedSaleItem = { item_type: string; description: string; wig_serial?: string; quantity: number; subtotal: number; tax_amount: number }
type DeletedSalePayment = { payment_method: string; amount: number }
type DeletedSale = {
  id: string
  original_sale_id?: string
  sale_date: string
  customer_name?: string
  total_amount: number
  tax_amount: number
  discount_amount: number
  deletion_reason: string
  deleted_by_name?: string
  deleted_at: string
  items_snapshot: DeletedSaleItem[]
  payments_snapshot: DeletedSalePayment[]
}

const PAYMENT_LABEL: Record<string, string> = {
  cash: 'Cash', credit_card: 'CC', check: 'Check', zelle: 'Zelle',
}
const ITEM_TYPE_LABEL: Record<string, string> = {
  wash_set: 'Wash & Set', repair: 'Repair', inventory: 'Product', wig: 'Wig', wig_balance: 'Wig Balance',
}

function DeletedSalesTab() {
  const [expanded, setExpanded] = useState<string | null>(null)

  const { data: sales = [], isLoading } = useQuery<DeletedSale[]>({
    queryKey: ['deleted-sales'],
    queryFn: () => api.get('/pos-sales/deleted').then(r => r.data),
    staleTime: 0,
  })

  if (isLoading) return <div style={s.empty}>Loading…</div>
  if (sales.length === 0) return <div style={s.empty}>No deleted sales on record.</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {sales.map(sale => {
        const isOpen = expanded === sale.id
        const deletedDate = new Date(sale.deleted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        const saleDate    = new Date(sale.sale_date  + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

        return (
          <div key={sale.id} style={ds.card}>
            {/* Row header */}
            <button
              style={ds.row}
              onClick={() => setExpanded(isOpen ? null : sale.id)}
            >
              <div style={ds.rowLeft}>
                <span style={ds.deletedDate}>{deletedDate}</span>
                <span style={ds.divider}>·</span>
                <span style={ds.saleDate}>Sale {saleDate}</span>
                {sale.customer_name && (
                  <>
                    <span style={ds.divider}>·</span>
                    <span style={ds.customer}>{sale.customer_name}</span>
                  </>
                )}
              </div>
              <div style={ds.rowRight}>
                <span style={ds.total}>${Number(sale.total_amount).toFixed(2)}</span>
                <span style={ds.reasonChip}>{sale.deletion_reason}</span>
                {isOpen
                  ? <ChevronDown size={14} color="rgba(13,13,13,0.35)" />
                  : <ChevronRight size={14} color="rgba(13,13,13,0.35)" />
                }
              </div>
            </button>

            {/* Expanded detail */}
            {isOpen && (
              <div style={ds.detail}>
                {/* Line items */}
                <p style={ds.sectionLabel}>Sale Items</p>
                {sale.items_snapshot.length === 0 ? (
                  <p style={ds.muted}>No items recorded.</p>
                ) : (
                  <div style={ds.itemList}>
                    {sale.items_snapshot.map((item, i) => (
                      <div key={i} style={ds.itemRow}>
                        <span style={ds.itemType}>{ITEM_TYPE_LABEL[item.item_type] ?? item.item_type}</span>
                        <span style={ds.itemDesc}>
                          {item.description}
                          {item.wig_serial ? ` · ${item.wig_serial}` : ''}
                          {item.quantity > 1 ? ` ×${item.quantity}` : ''}
                        </span>
                        <span style={ds.itemAmt}>${Number(item.subtotal).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Payments */}
                <p style={{ ...ds.sectionLabel, marginTop: 12 }}>Payments</p>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {sale.payments_snapshot.map((p, i) => (
                    <span key={i} style={ds.payChip}>
                      {PAYMENT_LABEL[p.payment_method] ?? p.payment_method} ${Number(p.amount).toFixed(2)}
                    </span>
                  ))}
                  {sale.payments_snapshot.length === 0 && <span style={ds.muted}>No payments recorded.</span>}
                </div>

                {/* Footer meta */}
                <div style={ds.meta}>
                  {sale.deleted_by_name && <span>Deleted by {sale.deleted_by_name}</span>}
                  {sale.discount_amount > 0 && <span>Discount: ${Number(sale.discount_amount).toFixed(2)}</span>}
                  {sale.tax_amount > 0 && <span>Tax: ${Number(sale.tax_amount).toFixed(2)}</span>}
                </div>

                {/* Reason highlighted */}
                <div style={ds.reasonBox}>
                  <Trash2 size={12} color="#ef4444" style={{ flexShrink: 0, marginTop: 1 }} />
                  <span style={ds.reasonText}><strong>Reason:</strong> {sale.deletion_reason}</span>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

const ds: Record<string, React.CSSProperties> = {
  card:         { border: '1px solid rgba(13,13,13,0.08)', borderRadius: 10, background: '#fff', overflow: 'hidden' },
  row:          { display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', gap: 12 },
  rowLeft:      { display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0, flexWrap: 'wrap' },
  rowRight:     { display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 },
  deletedDate:  { fontSize: 12, fontWeight: 600, color: '#0d0d0d' },
  saleDate:     { fontSize: 12, color: 'rgba(13,13,13,0.55)' },
  divider:      { fontSize: 12, color: 'rgba(13,13,13,0.25)' },
  customer:     { fontSize: 12, color: 'rgba(13,13,13,0.55)', fontStyle: 'italic' },
  total:        { fontSize: 13, fontWeight: 700, color: '#0d0d0d' },
  reasonChip:   { fontSize: 11, padding: '2px 8px', borderRadius: 6, background: 'rgba(239,68,68,0.08)', color: '#ef4444', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  detail:       { borderTop: '1px solid rgba(13,13,13,0.06)', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 4, background: '#fafaf9' },
  sectionLabel: { margin: '0 0 6px', fontSize: 11, fontWeight: 600, color: 'rgba(13,13,13,0.45)', textTransform: 'uppercase', letterSpacing: '0.06em' },
  itemList:     { display: 'flex', flexDirection: 'column', gap: 4 },
  itemRow:      { display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 },
  itemType:     { fontSize: 11, fontWeight: 600, color: '#0d0d0d', minWidth: 80, flexShrink: 0 },
  itemDesc:     { color: 'rgba(13,13,13,0.55)', flex: 1 },
  itemAmt:      { fontWeight: 600, color: '#0d0d0d', flexShrink: 0 },
  payChip:      { fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 6, background: '#f0fdf4', color: '#15803d' },
  meta:         { display: 'flex', gap: 14, marginTop: 10, fontSize: 11, color: 'rgba(13,13,13,0.4)' },
  reasonBox:    { display: 'flex', alignItems: 'flex-start', gap: 7, marginTop: 10, padding: '9px 12px', background: 'rgba(239,68,68,0.05)', borderRadius: 8, border: '1px solid rgba(239,68,68,0.12)' },
  reasonText:   { fontSize: 12, color: '#0d0d0d', lineHeight: 1.5 },
  muted:        { fontSize: 12, color: 'rgba(13,13,13,0.35)', margin: 0 },
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
  modalOverlay:  { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.25)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  modal:         { background: '#fff', borderRadius: 14, width: '100%', maxWidth: 560, boxShadow: '0 8px 32px rgba(0,0,0,0.14)', overflow: 'hidden' },
  modalHeader:   { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 24px 14px', borderBottom: BORDER },
  modalTitle:    { fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em' },
  modalFooter:   { display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 8 },
  modalTabBar:   { display: 'flex', borderBottom: BORDER, padding: '0 24px' },
  modalTab:      { background: 'none', border: 'none', borderBottom: '2px solid transparent', padding: '10px 16px', fontSize: 13, fontWeight: 500, color: 'rgba(13,13,13,0.45)', cursor: 'pointer', transition: 'all 0.15s' },
  modalTabActive:{ borderBottomColor: '#212121', color: '#212121' },

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

/**
 * Repairs Department Page — /bookkeeper/repairs
 *
 * Tab 1: Repair Orders — create and manage repair jobs
 * Tab 2: Active Carts  — customers with pending repair services waiting at POS
 *
 * Flow: repairs staff creates an order (customer + wig + metadata), adds
 * one or more services, optionally assigns to external provider → status
 * moves through pending → in_progress → with_external → ready.
 * Front desk checks out the cart at POS.
 */

import { useState, useMemo, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Wrench, Plus, Search, X, ChevronRight, Trash2, ExternalLink,
  User, Package, ClipboardList, Video, Building2, Check,
} from 'lucide-react'
import { api } from '../../lib/api'

// ── Types ────────────────────────────────────────────────────

type RepairOrderStatus = 'pending' | 'in_progress' | 'with_external' | 'ready' | 'completed'

type RepairOrder = {
  id: string
  customer_id?: string
  customer_name?: string
  customer_phone?: string
  customer_full_name?: string
  inventory_item_id?: string
  wig_serial?: string
  wig_description?: string
  notes?: string
  video_url?: string
  external_provider_id?: string
  external_provider_name?: string
  status: RepairOrderStatus
  cart_item_count: number
  created_at: string
  updated_at: string
}

type Customer = {
  id: string
  first_name: string
  last_name: string
  phone?: string
  cell?: string
}

type InventoryItem = {
  id: string
  item_type: 'wig' | 'product'
  name: string
  brand?: string
  color?: string
  length?: string
  daysmart_serial?: string
  wig_status?: string
  customer_id?: string | null
}

type Provider = {
  id: string
  name: string
  provider_type: string
}

type RepairService = {
  id: string
  name: string
  default_price: number | null
  category: string | null
  is_active: boolean
}

type CartItem = {
  id: string
  customer_id: string
  customer_name?: string
  item_type: string
  description: string
  price: number
  tax_rate: number
  notes?: string
  department: string
  status: string
  repair_order_id?: string
  created_at: string
}

type ServiceRow = {
  key: string
  service_id: string
  service_name: string
  price: string       // string for controlled input
  tax_rate: number
  notes: string
}

// ── Constants ────────────────────────────────────────────────

const STATUS_LABEL: Record<RepairOrderStatus, string> = {
  pending:       'Pending',
  in_progress:   'In Progress',
  with_external: 'With External',
  ready:         'Ready',
  completed:     'Completed',
}

const STATUS_COLOR: Record<RepairOrderStatus, { bg: string; color: string }> = {
  pending:       { bg: 'rgba(13,13,13,0.07)',  color: 'rgba(13,13,13,0.5)' },
  in_progress:   { bg: 'rgba(151,187,233,0.25)', color: '#3d6fa0' },
  with_external: { bg: 'rgba(227,205,148,0.35)', color: '#8a6500' },
  ready:         { bg: 'rgba(80,180,120,0.18)', color: '#1f7a4a' },
  completed:     { bg: 'rgba(13,13,13,0.12)',  color: '#212121' },
}

const TAX_RATE_SERVICE = 0.045

// ── Page ─────────────────────────────────────────────────────

export default function RepairsPage() {
  const [tab, setTab] = useState<'orders' | 'carts'>('orders')

  return (
    <div>
      <header style={s.header}>
        <div>
          <h1 style={s.title}>Repairs</h1>
          <p style={s.subtitle}>Create repair orders and add services to a customer's cart</p>
        </div>
      </header>

      <div style={s.tabRow}>
        <TabBtn active={tab === 'orders'} onClick={() => setTab('orders')}>Repair Orders</TabBtn>
        <TabBtn active={tab === 'carts'}  onClick={() => setTab('carts')}>Active Carts</TabBtn>
      </div>

      {tab === 'orders' && <RepairOrdersTab />}
      {tab === 'carts'  && <ActiveCartsTab />}
    </div>
  )
}

// ── Repair Orders Tab ─────────────────────────────────────────

function RepairOrdersTab() {
  const qc = useQueryClient()
  const [statusFilter, setStatusFilter] = useState<RepairOrderStatus | 'all'>('all')
  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<RepairOrder | null>(null)

  const { data: orders = [], isLoading } = useQuery<RepairOrder[]>({
    queryKey: ['repair-orders'],
    queryFn: () => api.get('/repair-orders/').then(r => r.data),
    staleTime: 0,
  })

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return orders.filter(o => {
      if (statusFilter !== 'all' && o.status !== statusFilter) return false
      const text = [o.customer_full_name, o.customer_name, o.wig_serial, o.wig_description].join(' ').toLowerCase()
      return text.includes(q)
    })
  }, [orders, statusFilter, search])

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/repair-orders/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['repair-orders'] }),
  })

  if (isLoading) return <div style={s.empty}>Loading repair orders…</div>

  return (
    <>
      <div style={s.toolbar}>
        <div style={s.searchWrap}>
          <Search size={14} color="rgba(13,13,13,0.35)" />
          <input
            style={s.searchInput}
            placeholder="Search by customer, wig serial…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Status filters */}
        <div style={s.filterGroup}>
          {(['all', 'pending', 'in_progress', 'with_external', 'ready'] as const).map(st => (
            <button
              key={st}
              style={{ ...s.filterBtn, ...(statusFilter === st ? s.filterBtnActive : {}) }}
              onClick={() => setStatusFilter(st)}
            >
              {st === 'all' ? 'All' : STATUS_LABEL[st as RepairOrderStatus]}
            </button>
          ))}
        </div>

        <button style={s.addBtn} onClick={() => setCreating(true)}>
          <Plus size={14} strokeWidth={2} />
          New Order
        </button>
      </div>

      {filtered.length === 0 ? (
        <div style={s.empty}>
          {orders.length === 0
            ? 'No repair orders yet. Click "New Order" to get started.'
            : 'No orders match your filters.'}
        </div>
      ) : (
        <div style={s.orderList}>
          {filtered.map(order => (
            <OrderRow
              key={order.id}
              order={order}
              onOpen={() => setSelectedOrder(order)}
              onDelete={() => {
                if (window.confirm('Delete this repair order?')) deleteMutation.mutate(order.id)
              }}
            />
          ))}
        </div>
      )}

      {/* Create panel */}
      {creating && (
        <CreateRepairPanel
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false)
            qc.invalidateQueries({ queryKey: ['repair-orders'] })
            qc.invalidateQueries({ queryKey: ['cart-active'] })
          }}
        />
      )}

      {/* Detail / edit panel */}
      {selectedOrder && (
        <RepairDetailPanel
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onUpdated={() => {
            setSelectedOrder(null)
            qc.invalidateQueries({ queryKey: ['repair-orders'] })
            qc.invalidateQueries({ queryKey: ['cart-active'] })
          }}
        />
      )}
    </>
  )
}

// ── Order Row ─────────────────────────────────────────────────

function OrderRow({
  order,
  onOpen,
  onDelete,
}: {
  order: RepairOrder
  onOpen: () => void
  onDelete: () => void
}) {
  const sc = STATUS_COLOR[order.status]
  const name = order.customer_full_name || order.customer_name || 'Walk-in'
  const wig  = order.wig_serial || order.wig_description || '—'
  const date = new Date(order.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  return (
    <div style={s.orderRow}>
      <div style={{ ...s.statusChip, background: sc.bg, color: sc.color }}>
        {STATUS_LABEL[order.status]}
      </div>

      <div style={s.orderMeta}>
        <span style={s.orderCustomer}>{name}</span>
        {order.customer_phone && (
          <span style={s.orderPhone}>{order.customer_phone}</span>
        )}
      </div>

      <div style={s.orderWig}>
        <Package size={12} color="rgba(13,13,13,0.3)" />
        <span style={s.orderWigLabel}>{wig}</span>
      </div>

      <div style={s.orderServices}>
        <span style={s.orderServiceCount}>{order.cart_item_count} service{order.cart_item_count !== 1 ? 's' : ''}</span>
      </div>

      {order.external_provider_name && (
        <div style={s.orderProvider}>
          <ExternalLink size={11} color="rgba(13,13,13,0.3)" />
          <span style={s.orderProviderName}>{order.external_provider_name}</span>
        </div>
      )}

      <div style={{ flex: 1 }} />
      <span style={s.orderDate}>{date}</span>

      <button style={s.iconBtn} onClick={onDelete} title="Delete">
        <Trash2 size={14} color="rgba(13,13,13,0.3)" />
      </button>
      <button style={s.openBtn} onClick={onOpen}>
        <ChevronRight size={15} />
      </button>
    </div>
  )
}

// ── Create Repair Panel ───────────────────────────────────────

function CreateRepairPanel({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: () => void
}) {
  const qc = useQueryClient()

  // Customer
  const [customerMode, setCustomerMode] = useState<'existing' | 'walkin'>('existing')
  const [custSearch, setCustSearch]     = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [walkinName, setWalkinName]     = useState('')
  const [walkinPhone, setWalkinPhone]   = useState('')

  // Wig
  const [wigMode, setWigMode]         = useState<'customer' | 'external'>('customer')
  const [wigSearch, setWigSearch]     = useState('')
  const [selectedWig, setSelectedWig] = useState<InventoryItem | null>(null)
  // External wig structured fields
  const [extSerial, setExtSerial] = useState('')
  const [extBrand,  setExtBrand]  = useState('')
  const [extColor,  setExtColor]  = useState('')
  const [extLength, setExtLength] = useState('')

  // Services
  const [services, setServices] = useState<ServiceRow[]>([])

  // Metadata
  const [notes, setNotes]             = useState('')
  const [videoUrl, setVideoUrl]       = useState('')
  const [providerId, setProviderId]   = useState('')

  const [step, setStep]   = useState<'form' | 'submitting'>('form')
  const [error, setError] = useState<string | null>(null)

  // Data
  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ['customers'],
    queryFn: () => api.get('/customers/').then(r => r.data),
  })

  const { data: inventory = [] } = useQuery<InventoryItem[]>({
    queryKey: ['inventory'],
    queryFn: () => api.get('/inventory/').then(r => r.data),
  })

  const { data: repairServices = [] } = useQuery<RepairService[]>({
    queryKey: ['repair-services'],
    queryFn: () => api.get('/repair-services/').then(r => r.data),
  })

  const { data: providers = [] } = useQuery<Provider[]>({
    queryKey: ['providers'],
    queryFn: () => api.get('/providers/').then(r => r.data),
  })

  // Filtered customer search
  const filteredCustomers = useMemo(() => {
    if (!custSearch) return []
    const q = custSearch.toLowerCase()
    return customers.filter(c =>
      `${c.first_name} ${c.last_name} ${c.phone ?? ''} ${c.cell ?? ''}`.toLowerCase().includes(q)
    ).slice(0, 8)
  }, [customers, custSearch])

  // Filtered wig search — only this customer's wigs
  const filteredWigs = useMemo(() => {
    if (!selectedCustomer) return []
    const customerWigs = inventory.filter(i =>
      i.item_type === 'wig' && i.customer_id === selectedCustomer.id
    )
    if (!wigSearch) return customerWigs.slice(0, 8)
    const q = wigSearch.toLowerCase()
    return customerWigs.filter(i =>
      [i.daysmart_serial, i.brand, i.color, i.length, i.name].join(' ').toLowerCase().includes(q)
    ).slice(0, 8)
  }, [inventory, wigSearch, selectedCustomer])

  function addService() {
    setServices(prev => [...prev, {
      key: crypto.randomUUID(),
      service_id: '',
      service_name: '',
      price: '',
      tax_rate: TAX_RATE_SERVICE,
      notes: '',
    }])
  }

  function removeService(key: string) {
    setServices(prev => prev.filter(s => s.key !== key))
  }

  function updateService(key: string, patch: Partial<ServiceRow>) {
    setServices(prev => prev.map(s => s.key === key ? { ...s, ...patch } : s))
  }

  async function handleSubmit() {
    setError(null)
    setStep('submitting')

    try {
      // 1. Determine customer payload
      const orderPayload: Record<string, unknown> = {
        notes,
        video_url: videoUrl || null,
        external_provider_id: providerId || null,
      }

      if (customerMode === 'existing' && selectedCustomer) {
        orderPayload.customer_id   = selectedCustomer.id
        orderPayload.customer_name = `${selectedCustomer.first_name} ${selectedCustomer.last_name}`
        orderPayload.customer_phone = selectedCustomer.phone || selectedCustomer.cell || null
      } else {
        orderPayload.customer_name  = walkinName || null
        orderPayload.customer_phone = walkinPhone || null
      }

      if (wigMode === 'customer' && selectedWig) {
        orderPayload.inventory_item_id = selectedWig.id
      } else if (wigMode === 'external') {
        const serial = extSerial.trim()
        if (customerMode === 'existing' && selectedCustomer && serial) {
          // Create a new InventoryItem for this customer's wig — adds it to their history
          const { data: newWig } = await api.post('/inventory/', {
            item_type:       'wig',
            name:            serial,
            daysmart_serial: serial,
            brand:           extBrand.trim()  || null,
            color:           extColor.trim()  || null,
            length:          extLength.trim() || null,
            customer_id:     selectedCustomer.id,
            sale_status:     'paid_in_full',
          })
          orderPayload.inventory_item_id = newWig.id
          qc.invalidateQueries({ queryKey: ['inventory'] })
        } else {
          // Walk-in or no serial → free-text description only
          const parts = [extSerial, extBrand, extColor, extLength].map(s => s.trim()).filter(Boolean)
          orderPayload.wig_description = parts.join(' · ') || null
        }
      }

      // 2. Create repair order
      const { data: order } = await api.post('/repair-orders/', orderPayload)

      // 3. Add services to cart
      const custId = orderPayload.customer_id as string | undefined
      if (custId || orderPayload.customer_name) {
        // We need a customer_id for cart items — if walk-in, use a placeholder approach.
        // Cart items require customer_id FK — only add services if we have an existing customer.
        if (custId) {
          for (const svc of services) {
            if (!svc.service_id) continue
            await api.post('/cart/', {
              customer_id:     custId,
              item_type:       'service',
              description:     svc.service_name,
              price:           parseFloat(svc.price) || 0,
              tax_rate:        svc.tax_rate,
              notes:           svc.notes || null,
              department:      'repairs',
              repair_order_id: order.id,
            })
          }
        }
      }

      onCreated()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An error occurred'
      setError(msg)
      setStep('form')
    }
  }

  const wigReady =
    wigMode === 'customer'
      ? !!selectedWig
      : !!(extSerial.trim() || extBrand.trim() || extColor.trim())  // at least something entered

  const canSubmit =
    (customerMode === 'existing' ? !!selectedCustomer : !!walkinName) &&
    wigReady &&
    step === 'form'

  return (
    <>
      <div style={s.overlay} onClick={onClose} />
      <div style={s.panel}>
        <div style={s.panelHeader}>
          <div>
            <div style={s.panelTitle}>New Repair Order</div>
            <div style={s.panelSubtitle}>Fill in the details and add services</div>
          </div>
          <button style={s.closeBtn} onClick={onClose}><X size={16} /></button>
        </div>

        <div style={s.panelBody}>

          {/* ── Customer ── */}
          <Section icon={<User size={13} />} label="Customer">
            <div style={s.modeToggle}>
              <ModeBtn active={customerMode === 'existing'} onClick={() => { setCustomerMode('existing'); setSelectedCustomer(null); setCustSearch('') }}>Existing Customer</ModeBtn>
              <ModeBtn active={customerMode === 'walkin'}   onClick={() => { setCustomerMode('walkin'); setSelectedCustomer(null); setWigMode('external'); setSelectedWig(null); setWigSearch('') }}>Walk-in</ModeBtn>
            </div>

            {customerMode === 'existing' ? (
              selectedCustomer ? (
                <SelectedPill
                  label={`${selectedCustomer.first_name} ${selectedCustomer.last_name}`}
                  sub={selectedCustomer.phone || selectedCustomer.cell}
                  onClear={() => setSelectedCustomer(null)}
                />
              ) : (
                <SearchDropdown
                  placeholder="Search by name or phone…"
                  value={custSearch}
                  onChange={setCustSearch}
                  results={filteredCustomers}
                  renderItem={c => `${c.first_name} ${c.last_name}${c.phone ? ` · ${c.phone}` : ''}`}
                  onSelect={c => { setSelectedCustomer(c); setCustSearch('') }}
                />
              )
            ) : (
              <div style={s.fieldRow}>
                <input
                  style={s.input}
                  placeholder="Customer name"
                  value={walkinName}
                  onChange={e => setWalkinName(e.target.value)}
                />
                <input
                  style={s.input}
                  placeholder="Phone (optional)"
                  value={walkinPhone}
                  onChange={e => setWalkinPhone(e.target.value)}
                />
              </div>
            )}
          </Section>

          {/* ── Wig ── */}
          <Section icon={<Package size={13} />} label="Wig">
            <div style={s.modeToggle}>
              <ModeBtn
                active={wigMode === 'customer'}
                onClick={() => { setWigMode('customer'); setSelectedWig(null); setWigSearch('') }}
                disabled={customerMode === 'walkin'}
              >
                Customer's Wigs
              </ModeBtn>
              <ModeBtn active={wigMode === 'external'} onClick={() => { setWigMode('external'); setSelectedWig(null) }}>External Wig</ModeBtn>
            </div>

            {wigMode === 'customer' ? (
              selectedWig ? (
                <SelectedPill
                  label={selectedWig.daysmart_serial ?? selectedWig.name}
                  sub={[selectedWig.brand, selectedWig.color, selectedWig.length].filter(Boolean).join(' · ')}
                  onClear={() => setSelectedWig(null)}
                />
              ) : (
                <>
                  {!selectedCustomer && (
                    <p style={s.emptyNote}>Select a customer above to see their wigs.</p>
                  )}
                  {selectedCustomer && (
                    <SearchDropdown
                      placeholder="Search by serial, brand, color…"
                      value={wigSearch}
                      onChange={setWigSearch}
                      results={filteredWigs}
                      renderItem={w => [w.daysmart_serial, w.brand, w.color, w.length].filter(Boolean).join(' · ')}
                      onSelect={w => { setSelectedWig(w); setWigSearch('') }}
                    />
                  )}
                  {selectedCustomer && filteredWigs.length === 0 && !wigSearch && (
                    <p style={s.emptyNote}>No wigs on file for this customer. Use "External Wig" to enter details manually.</p>
                  )}
                </>
              )
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <input
                  style={{ ...s.input, marginBottom: 0 }}
                  placeholder="Serial number"
                  value={extSerial}
                  onChange={e => setExtSerial(e.target.value)}
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    style={{ ...s.input, flex: 1, marginBottom: 0 }}
                    placeholder="Brand"
                    value={extBrand}
                    onChange={e => setExtBrand(e.target.value)}
                  />
                  <input
                    style={{ ...s.input, flex: 1, marginBottom: 0 }}
                    placeholder="Color"
                    value={extColor}
                    onChange={e => setExtColor(e.target.value)}
                  />
                </div>
                <input
                  style={{ ...s.input, marginBottom: 0 }}
                  placeholder="Length (optional)"
                  value={extLength}
                  onChange={e => setExtLength(e.target.value)}
                />
                {customerMode === 'existing' && selectedCustomer && (
                  <p style={{ fontSize: 11, color: '#71717a', margin: 0 }}>
                    This wig will be added to {selectedCustomer.first_name}'s history automatically.
                  </p>
                )}
              </div>
            )}
          </Section>

          {/* ── Services ── */}
          <Section icon={<ClipboardList size={13} />} label="Services">
            {services.map(svc => (
              <ServiceRowEditor
                key={svc.key}
                row={svc}
                repairServices={repairServices}
                onChange={patch => updateService(svc.key, patch)}
                onRemove={() => removeService(svc.key)}
              />
            ))}
            {customerMode === 'walkin' && services.length > 0 && (
              <p style={s.warningNote}>Walk-in orders: services can't be added to cart (no customer account). They'll be recorded on the repair order only.</p>
            )}
            <button style={s.addServiceBtn} onClick={addService}>
              <Plus size={13} />
              Add Service
            </button>
          </Section>

          {/* ── Notes ── */}
          <Section icon={<ClipboardList size={13} />} label="Notes">
            <textarea
              style={s.textarea}
              placeholder="Repair notes, special instructions…"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
            />
          </Section>

          {/* ── Video ── */}
          <Section icon={<Video size={13} />} label="Video Link">
            <input
              style={s.input}
              placeholder="WhatsApp / Drive video URL (optional)"
              value={videoUrl}
              onChange={e => setVideoUrl(e.target.value)}
            />
          </Section>

          {/* ── External Provider ── */}
          <Section icon={<Building2 size={13} />} label="External Provider (optional)">
            <select
              style={s.select}
              value={providerId}
              onChange={e => setProviderId(e.target.value)}
            >
              <option value="">None — handled in-house</option>
              {providers.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </Section>

          {error && <p style={s.errorMsg}>{error}</p>}
        </div>

        <div style={s.panelFooter}>
          <button style={s.cancelBtn} onClick={onClose}>Cancel</button>
          <button
            style={{ ...s.submitBtn, ...(canSubmit ? {} : s.submitBtnDisabled) }}
            onClick={handleSubmit}
            disabled={!canSubmit}
          >
            {step === 'submitting' ? 'Creating…' : 'Create Repair Order'}
          </button>
        </div>
      </div>
    </>
  )
}

// ── Service Row Editor ────────────────────────────────────────

function ServiceRowEditor({
  row,
  repairServices,
  onChange,
  onRemove,
}: {
  row: ServiceRow
  repairServices: RepairService[]
  onChange: (patch: Partial<ServiceRow>) => void
  onRemove: () => void
}) {
  function handleServiceSelect(id: string) {
    const svc = repairServices.find(s => s.id === id)
    if (!svc) return
    onChange({
      service_id:   svc.id,
      service_name: svc.name,
      price:        svc.default_price != null ? String(svc.default_price) : '',
    })
  }

  return (
    <div style={s.serviceRowEditor}>
      <select
        style={{ ...s.select, flex: 1 }}
        value={row.service_id}
        onChange={e => handleServiceSelect(e.target.value)}
      >
        <option value="">Select service…</option>
        {repairServices.filter(s => s.is_active).map(svc => (
          <option key={svc.id} value={svc.id}>{svc.name}</option>
        ))}
      </select>

      <div style={s.priceWrap}>
        <span style={s.priceDollar}>$</span>
        <input
          style={s.priceInput}
          placeholder="0.00"
          value={row.price}
          onChange={e => onChange({ price: e.target.value })}
        />
      </div>

      <button
        style={{ ...s.taxToggle, ...(row.tax_rate > 0 ? s.taxToggleOn : {}) }}
        onClick={() => onChange({ tax_rate: row.tax_rate > 0 ? 0 : TAX_RATE_SERVICE })}
        title="Toggle tax"
      >
        {row.tax_rate > 0 ? `${(row.tax_rate * 100).toFixed(1)}%` : 'No tax'}
      </button>

      <input
        style={{ ...s.input, flex: 1, marginBottom: 0 }}
        placeholder="Notes (optional)"
        value={row.notes}
        onChange={e => onChange({ notes: e.target.value })}
      />

      <button style={s.iconBtn} onClick={onRemove} title="Remove">
        <Trash2 size={13} color="rgba(13,13,13,0.3)" />
      </button>
    </div>
  )
}

// ── Repair Detail Panel ───────────────────────────────────────

function RepairDetailPanel({
  order,
  onClose,
  onUpdated,
}: {
  order: RepairOrder
  onClose: () => void
  onUpdated: () => void
}) {
  const qc = useQueryClient()
  const [status, setStatus]       = useState<RepairOrderStatus>(order.status)
  const [notes, setNotes]         = useState(order.notes ?? '')
  const [videoUrl, setVideoUrl]   = useState(order.video_url ?? '')
  const [providerId, setProviderId] = useState(order.external_provider_id ?? '')
  const [saving, setSaving]       = useState(false)

  const { data: providers = [] } = useQuery<Provider[]>({
    queryKey: ['providers'],
    queryFn: () => api.get('/providers/').then(r => r.data),
  })

  // Cart items linked to this repair order
  const { data: allCart = [] } = useQuery<CartItem[]>({
    queryKey: ['cart-active'],
    queryFn: () => api.get('/cart/active').then(r => r.data),
    staleTime: 0,
  })

  const linkedItems = useMemo(
    () => allCart.filter(i => i.repair_order_id === order.id),
    [allCart, order.id]
  )

  const removeCartItem = useMutation({
    mutationFn: (id: string) => api.delete(`/cart/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cart-active'] })
      qc.invalidateQueries({ queryKey: ['repair-orders'] })
    },
  })

  async function handleSave() {
    setSaving(true)
    try {
      await api.patch(`/repair-orders/${order.id}`, {
        status,
        notes:                notes || null,
        video_url:            videoUrl || null,
        external_provider_id: providerId || null,
      })
      onUpdated()
    } finally {
      setSaving(false)
    }
  }

  const name = order.customer_full_name || order.customer_name || 'Walk-in'
  const wig  = order.wig_serial || order.wig_description || '—'

  return (
    <>
      <div style={s.overlay} onClick={onClose} />
      <div style={s.panel}>
        <div style={s.panelHeader}>
          <div>
            <div style={s.panelTitle}>{name}</div>
            <div style={s.panelSubtitle}>{wig}</div>
          </div>
          <button style={s.closeBtn} onClick={onClose}><X size={16} /></button>
        </div>

        <div style={s.panelBody}>

          {/* Status */}
          <Section icon={<Wrench size={13} />} label="Status">
            <div style={s.statusGrid}>
              {(Object.keys(STATUS_LABEL) as RepairOrderStatus[]).filter(st => st !== 'completed').map(st => {
                const sc = STATUS_COLOR[st]
                return (
                  <button
                    key={st}
                    style={{
                      ...s.statusBtn,
                      background: status === st ? sc.bg : 'transparent',
                      color: status === st ? sc.color : 'rgba(13,13,13,0.45)',
                      border: status === st ? `1px solid ${sc.color}33` : '1px solid rgba(13,13,13,0.1)',
                    }}
                    onClick={() => setStatus(st)}
                  >
                    {status === st && <Check size={11} />}
                    {STATUS_LABEL[st]}
                  </button>
                )
              })}
            </div>
          </Section>

          {/* Services in cart */}
          <Section icon={<ClipboardList size={13} />} label={`Services in Cart (${linkedItems.length})`}>
            {linkedItems.length === 0 ? (
              <p style={s.emptyNote}>No services added yet.</p>
            ) : (
              <div style={s.cartItemList}>
                {linkedItems.map(item => (
                  <div key={item.id} style={s.cartItemRow}>
                    <div style={s.cartItemInfo}>
                      <span style={s.cartItemName}>{item.description}</span>
                      <span style={s.cartItemPrice}>${Number(item.price).toFixed(2)}</span>
                    </div>
                    <button
                      style={s.iconBtn}
                      onClick={() => removeCartItem.mutate(item.id)}
                      title="Remove"
                    >
                      <Trash2 size={13} color="rgba(13,13,13,0.3)" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* Notes */}
          <Section icon={<ClipboardList size={13} />} label="Notes">
            <textarea
              style={s.textarea}
              placeholder="Repair notes…"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
            />
          </Section>

          {/* Video */}
          <Section icon={<Video size={13} />} label="Video Link">
            <input
              style={s.input}
              placeholder="WhatsApp / Drive video URL"
              value={videoUrl}
              onChange={e => setVideoUrl(e.target.value)}
            />
          </Section>

          {/* External provider */}
          <Section icon={<Building2 size={13} />} label="External Provider">
            <select
              style={s.select}
              value={providerId}
              onChange={e => setProviderId(e.target.value)}
            >
              <option value="">None — handled in-house</option>
              {providers.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </Section>

        </div>

        <div style={s.panelFooter}>
          <button style={s.cancelBtn} onClick={onClose}>Cancel</button>
          <button style={s.submitBtn} onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </>
  )
}

// ── Active Carts Tab ──────────────────────────────────────────
// Shows customers who have repair services pending at POS

function ActiveCartsTab() {
  const [expandedCustomer, setExpandedCustomer] = useState<string | null>(null)

  const { data: allCart = [], isLoading } = useQuery<CartItem[]>({
    queryKey: ['cart-active'],
    queryFn: () => api.get('/cart/active').then(r => r.data),
    staleTime: 0,
  })

  // Only repairs department items
  const repairItems = useMemo(
    () => allCart.filter(i => i.department === 'repairs'),
    [allCart]
  )

  // Group by customer
  const grouped = useMemo(() => {
    const map = new Map<string, CartItem[]>()
    for (const item of repairItems) {
      const existing = map.get(item.customer_id) ?? []
      map.set(item.customer_id, [...existing, item])
    }
    return Array.from(map.entries())
  }, [repairItems])

  if (isLoading) return <div style={s.empty}>Loading carts…</div>

  if (grouped.length === 0) {
    return <div style={s.empty}>No customers with pending repair services.</div>
  }

  return (
    <div style={s.orderList}>
      {grouped.map(([custId, items]) => {
        const customerName = items[0].customer_name ?? 'Unknown Customer'
        const total = items.reduce((sum, i) => sum + Number(i.price), 0)
        const isExpanded = expandedCustomer === custId

        return (
          <div key={custId} style={s.cartGroup}>
            <button
              style={s.cartGroupHeader}
              onClick={() => setExpandedCustomer(isExpanded ? null : custId)}
            >
              <User size={14} color="rgba(13,13,13,0.35)" />
              <span style={s.cartCustomerName}>{customerName}</span>
              <span style={s.cartItemCountBadge}>{items.length} item{items.length !== 1 ? 's' : ''}</span>
              <span style={s.cartTotal}>${total.toFixed(2)}</span>
              <ChevronRight
                size={14}
                color="rgba(13,13,13,0.35)"
                style={{ transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}
              />
            </button>

            {isExpanded && (
              <div style={s.cartGroupBody}>
                {items.map(item => (
                  <div key={item.id} style={s.cartItemRow}>
                    <div style={s.cartItemInfo}>
                      <span style={s.cartItemName}>{item.description}</span>
                      {item.notes && <span style={s.cartItemNotes}>{item.notes}</span>}
                    </div>
                    <span style={s.cartItemPrice}>${Number(item.price).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Small helper components ───────────────────────────────────

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        ...s.tabBtn,
        ...(active ? s.tabBtnActive : {}),
      }}
    >
      {children}
    </button>
  )
}

function ModeBtn({ active, onClick, disabled, children }: { active: boolean; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{ ...s.modeBtn, ...(active ? s.modeBtnActive : {}), ...(disabled ? { opacity: 0.4, cursor: 'not-allowed' } : {}) }}
    >
      {children}
    </button>
  )
}

function Section({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode
  label: string
  children: React.ReactNode
}) {
  return (
    <div style={s.section}>
      <div style={s.sectionHeader}>
        {icon}
        <span style={s.sectionLabel}>{label}</span>
      </div>
      <div>{children}</div>
    </div>
  )
}

function SelectedPill({ label, sub, onClear }: { label: string; sub?: string; onClear: () => void }) {
  return (
    <div style={s.selectedPill}>
      <div style={s.pillContent}>
        <span style={s.pillLabel}>{label}</span>
        {sub && <span style={s.pillSub}>{sub}</span>}
      </div>
      <button style={s.pillClear} onClick={onClear}><X size={12} /></button>
    </div>
  )
}

function SearchDropdown<T>({
  placeholder,
  value,
  onChange,
  results,
  renderItem,
  onSelect,
}: {
  placeholder: string
  value: string
  onChange: (v: string) => void
  results: T[]
  renderItem: (item: T) => string
  onSelect: (item: T) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)

  return (
    <div style={{ position: 'relative' }} ref={containerRef}>
      <div style={s.searchWrap}>
        <Search size={13} color="rgba(13,13,13,0.35)" />
        <input
          style={s.searchInput}
          placeholder={placeholder}
          value={value}
          onChange={e => onChange(e.target.value)}
          autoComplete="off"
        />
        {value && (
          <button style={s.clearBtn} onClick={() => onChange('')}>
            <X size={12} />
          </button>
        )}
      </div>
      {results.length > 0 && (
        <div style={s.dropdown}>
          {results.map((item, i) => (
            <button
              key={i}
              style={s.dropdownItem}
              onMouseDown={e => { e.preventDefault(); onSelect(item) }}
            >
              {renderItem(item)}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────

const BORDER = '1px solid rgba(13,13,13,0.08)'

const s: Record<string, React.CSSProperties> = {
  header:       { marginBottom: 24 },
  title:        { fontSize: 22, fontWeight: 600, color: '#0d0d0d', letterSpacing: '-0.03em', margin: 0 },
  subtitle:     { fontSize: 13, color: 'rgba(13,13,13,0.45)', marginTop: 4 },

  tabRow:       { display: 'flex', gap: 4, marginBottom: 24, borderBottom: BORDER, paddingBottom: 0 },
  tabBtn:       { background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500, color: 'rgba(13,13,13,0.45)', padding: '8px 14px', borderBottom: '2px solid transparent', marginBottom: -1, borderRadius: 0 },
  tabBtnActive: { color: '#0d0d0d', borderBottomColor: '#0d0d0d' },

  toolbar:      { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, flexWrap: 'wrap' as const },
  searchWrap:   { display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: BORDER, borderRadius: 8, padding: '7px 12px', flex: '1 1 200px', minWidth: 200 },
  searchInput:  { border: 'none', outline: 'none', fontSize: 13, color: '#0d0d0d', background: 'transparent', flex: 1, width: '100%' },
  clearBtn:     { background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(13,13,13,0.35)', display: 'flex', alignItems: 'center', padding: 2 },
  filterGroup:  { display: 'flex', gap: 4 },
  filterBtn:    { background: '#fff', border: BORDER, borderRadius: 7, padding: '6px 12px', fontSize: 12, fontWeight: 500, cursor: 'pointer', color: 'rgba(13,13,13,0.55)' },
  filterBtnActive: { background: '#0d0d0d', color: '#fff', borderColor: '#0d0d0d' },
  addBtn:       { display: 'flex', alignItems: 'center', gap: 6, background: '#0d0d0d', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 500, cursor: 'pointer' },

  empty:        { textAlign: 'center' as const, color: 'rgba(13,13,13,0.35)', fontSize: 13, padding: '48px 0' },
  emptyNote:    { fontSize: 12, color: 'rgba(13,13,13,0.35)', margin: '0 0 8px' },

  orderList:    { display: 'flex', flexDirection: 'column', gap: 8 },
  orderRow:     { display: 'flex', alignItems: 'center', gap: 12, background: '#fff', border: BORDER, borderRadius: 10, padding: '12px 16px', transition: 'box-shadow 0.1s' },
  statusChip:   { fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 20, flexShrink: 0, letterSpacing: '0.01em' },
  orderMeta:    { display: 'flex', flexDirection: 'column', minWidth: 140 },
  orderCustomer:{ fontSize: 13, fontWeight: 600, color: '#0d0d0d', letterSpacing: '-0.01em' },
  orderPhone:   { fontSize: 11, color: 'rgba(13,13,13,0.4)', marginTop: 2 },
  orderWig:     { display: 'flex', alignItems: 'center', gap: 5, minWidth: 120 },
  orderWigLabel:{ fontSize: 12, color: 'rgba(13,13,13,0.55)' },
  orderServices:{ minWidth: 80 },
  orderServiceCount: { fontSize: 12, color: 'rgba(13,13,13,0.45)' },
  orderProvider: { display: 'flex', alignItems: 'center', gap: 4 },
  orderProviderName: { fontSize: 12, color: 'rgba(13,13,13,0.45)' },
  orderDate:    { fontSize: 11, color: 'rgba(13,13,13,0.35)', flexShrink: 0 },
  iconBtn:      { background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 6, borderRadius: 6 },
  openBtn:      { background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 6, color: 'rgba(13,13,13,0.35)' },

  // Panel
  overlay:      { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 200 },
  panel:        { position: 'fixed', top: 0, right: 0, bottom: 0, width: 'clamp(400px,38vw,560px)', background: '#fafaf9', zIndex: 201, display: 'flex', flexDirection: 'column', boxShadow: '-8px 0 32px rgba(0,0,0,0.08)' },
  panelHeader:  { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '20px 24px 16px', borderBottom: BORDER },
  panelTitle:   { fontSize: 16, fontWeight: 600, color: '#0d0d0d', letterSpacing: '-0.02em' },
  panelSubtitle:{ fontSize: 12, color: 'rgba(13,13,13,0.45)', marginTop: 3 },
  closeBtn:     { background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(13,13,13,0.4)', padding: 4, display: 'flex' },
  panelBody:    { flex: 1, overflowY: 'auto' as const, padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 20 },
  panelFooter:  { padding: '16px 24px', borderTop: BORDER, display: 'flex', gap: 10, justifyContent: 'flex-end' },
  cancelBtn:    { background: '#fff', border: BORDER, borderRadius: 8, padding: '9px 18px', fontSize: 13, cursor: 'pointer', color: 'rgba(13,13,13,0.55)' },
  submitBtn:    { background: '#0d0d0d', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 13, fontWeight: 500, cursor: 'pointer' },
  submitBtnDisabled: { background: 'rgba(13,13,13,0.15)', cursor: 'not-allowed' },

  // Sections in panel
  section:      { display: 'flex', flexDirection: 'column', gap: 10 },
  sectionHeader:{ display: 'flex', alignItems: 'center', gap: 7 },
  sectionLabel: { fontSize: 12, fontWeight: 600, color: 'rgba(13,13,13,0.55)', textTransform: 'uppercase' as const, letterSpacing: '0.06em' },

  modeToggle:   { display: 'flex', gap: 6, marginBottom: 4 },
  modeBtn:      { background: '#fff', border: BORDER, borderRadius: 7, padding: '5px 12px', fontSize: 12, cursor: 'pointer', color: 'rgba(13,13,13,0.55)', fontWeight: 500 },
  modeBtnActive:{ background: '#0d0d0d', color: '#fff', borderColor: '#0d0d0d' },

  input:        { width: '100%', border: BORDER, borderRadius: 8, padding: '9px 12px', fontSize: 13, outline: 'none', background: '#fff', boxSizing: 'border-box' as const, marginBottom: 8 },
  textarea:     { width: '100%', border: BORDER, borderRadius: 8, padding: '9px 12px', fontSize: 13, outline: 'none', background: '#fff', resize: 'vertical' as const, fontFamily: 'inherit', boxSizing: 'border-box' as const },
  select:       { width: '100%', border: BORDER, borderRadius: 8, padding: '9px 12px', fontSize: 13, outline: 'none', background: '#fff', boxSizing: 'border-box' as const, appearance: 'auto' as const },
  fieldRow:     { display: 'flex', gap: 8 },

  selectedPill: { display: 'flex', alignItems: 'center', background: 'rgba(13,13,13,0.05)', border: BORDER, borderRadius: 8, padding: '8px 12px', gap: 10 },
  pillContent:  { flex: 1, display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pillLabel:    { fontSize: 13, fontWeight: 500, color: '#0d0d0d' },
  pillSub:      { fontSize: 11, color: 'rgba(13,13,13,0.4)' },
  pillClear:    { background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(13,13,13,0.4)', display: 'flex', padding: 2 },

  dropdown:     { position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: BORDER, borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.08)', zIndex: 10, maxHeight: 220, overflowY: 'auto' as const, marginTop: 4 },
  dropdownItem: { display: 'block', width: '100%', textAlign: 'left' as const, padding: '9px 14px', fontSize: 13, background: 'none', border: 'none', cursor: 'pointer', color: '#0d0d0d' },

  serviceRowEditor: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, background: '#fff', border: BORDER, borderRadius: 8, padding: '10px 12px' },
  priceWrap:    { display: 'flex', alignItems: 'center', border: BORDER, borderRadius: 7, background: '#fff', overflow: 'hidden', flexShrink: 0 },
  priceDollar:  { padding: '0 6px', fontSize: 12, color: 'rgba(13,13,13,0.4)', background: 'rgba(13,13,13,0.04)', borderRight: BORDER },
  priceInput:   { border: 'none', outline: 'none', padding: '7px 10px', fontSize: 13, width: 70, background: 'transparent' },
  taxToggle:    { background: 'rgba(13,13,13,0.06)', border: BORDER, borderRadius: 6, padding: '5px 8px', fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap' as const, flexShrink: 0 },
  taxToggleOn:  { background: 'rgba(80,180,120,0.15)', borderColor: 'rgba(80,180,120,0.4)', color: '#1f7a4a' },

  addServiceBtn:{ display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', border: `1px dashed rgba(13,13,13,0.2)`, borderRadius: 8, padding: '8px 14px', fontSize: 13, cursor: 'pointer', color: 'rgba(13,13,13,0.55)', width: '100%', justifyContent: 'center' },
  warningNote:  { fontSize: 11, color: '#b36b00', background: 'rgba(227,205,148,0.3)', borderRadius: 6, padding: '6px 10px', margin: '0 0 8px' },

  errorMsg:     { fontSize: 12, color: '#c0392b', background: 'rgba(192,57,43,0.06)', borderRadius: 6, padding: '8px 12px', marginTop: 4 },

  statusGrid:   { display: 'flex', flexWrap: 'wrap' as const, gap: 8 },
  statusBtn:    { display: 'flex', alignItems: 'center', gap: 6, borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 500, cursor: 'pointer' },

  cartItemList: { display: 'flex', flexDirection: 'column', gap: 6 },
  cartItemRow:  { display: 'flex', alignItems: 'center', gap: 10, background: '#fff', border: BORDER, borderRadius: 8, padding: '9px 12px' },
  cartItemInfo: { flex: 1, display: 'flex', flexDirection: 'column' },
  cartItemName: { fontSize: 13, color: '#0d0d0d', fontWeight: 500 },
  cartItemNotes:{ fontSize: 11, color: 'rgba(13,13,13,0.45)', marginTop: 2 },
  cartItemPrice:{ fontSize: 13, fontWeight: 600, color: '#0d0d0d', flexShrink: 0 },

  // Active Carts tab
  cartGroup:        { border: BORDER, borderRadius: 10, background: '#fff', overflow: 'hidden' },
  cartGroupHeader:  { display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', width: '100%', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' as const },
  cartCustomerName: { fontSize: 13, fontWeight: 600, color: '#0d0d0d', flex: 1 },
  cartItemCountBadge: { fontSize: 11, background: 'rgba(13,13,13,0.07)', borderRadius: 20, padding: '2px 8px', color: 'rgba(13,13,13,0.55)' },
  cartTotal:        { fontSize: 13, fontWeight: 600, color: '#0d0d0d' },
  cartGroupBody:    { borderTop: BORDER, padding: '8px 16px', display: 'flex', flexDirection: 'column', gap: 6 },
}

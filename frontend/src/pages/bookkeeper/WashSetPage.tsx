/**
 * Wash & Set Page — /bookkeeper/wash-set
 *
 * Tab 1: Add Service — pick a customer, the stylist doing the work, a
 *   service, then send it to the cart. Form fully resets after each add.
 * Tab 2: Active Carts — every customer with Wash & Set items waiting at POS.
 *
 * Items land in pending_cart_items (department: 'wash_set') exactly like
 * Sales Management / Repairs already do, and get picked up from the pending
 * banner at POS checkout.
 */

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, X, User, ChevronDown, ChevronRight } from 'lucide-react'
import { api } from '../../lib/api'

const BORDER = '1px solid rgba(13,13,13,0.08)'
const TAX_RATE_SERVICE = 0.045
const TAX_RATE_NONE = 0

// ── Types ────────────────────────────────────────────────────

type Customer = {
  id: string
  first_name: string
  last_name: string
  phone?: string
  cell?: string
}

type Employee = {
  id: string
  first_name: string
  last_name: string
  job_title: string
  is_active: boolean
}

type WashSetService = {
  id: string
  name: string
  default_price: number | null
  is_active: boolean
}

type CartItem = {
  id: string
  customer_id: string
  customer_name?: string
  description: string
  price: number
  department: string
}

export default function WashSetPage() {
  const [tab, setTab] = useState<'add' | 'carts'>('add')

  return (
    <div>
      <header style={s.header}>
        <div>
          <h1 style={s.title}>Wash & Set</h1>
          <p style={s.subtitle}>Add a Wash & Set service to a customer's cart</p>
        </div>
      </header>

      <div style={s.tabRow}>
        <TabBtn active={tab === 'add'}   onClick={() => setTab('add')}>Add Service</TabBtn>
        <TabBtn active={tab === 'carts'} onClick={() => setTab('carts')}>Active Carts</TabBtn>
      </div>

      {tab === 'add'   && <AddServiceTab />}
      {tab === 'carts' && <ActiveCartsTab />}
    </div>
  )
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button style={{ ...s.tabBtn, ...(active ? s.tabBtnActive : {}) }} onClick={onClick}>
      {children}
    </button>
  )
}

// ── Add Service Tab ──────────────────────────────────────────

function AddServiceTab() {
  const qc = useQueryClient()

  const [customerSearch, setCustomerSearch] = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [showDropdown, setShowDropdown] = useState(false)
  const [stylistId, setStylistId] = useState('')
  const [serviceId, setServiceId] = useState('')
  const [priceStr, setPriceStr] = useState('')
  const [taxRate, setTaxRate] = useState(TAX_RATE_SERVICE)

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ['customers'],
    queryFn: () => api.get('/customers/').then(r => r.data),
    staleTime: 1000 * 60 * 5,
  })
  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ['employees'],
    queryFn: () => api.get('/employees/').then(r => r.data),
    staleTime: 1000 * 60 * 5,
  })
  const { data: services = [] } = useQuery<WashSetService[]>({
    queryKey: ['wash-set-services'],
    queryFn: () => api.get('/wash-set-services/').then(r => r.data),
    staleTime: 1000 * 60 * 5,
  })

  const activeEmployees = employees.filter(e => e.is_active)
  const activeServices = services.filter(sv => sv.is_active)

  const matchedCustomers = useMemo(() => {
    if (!customerSearch.trim()) return []
    const q = customerSearch.toLowerCase()
    return customers
      .filter(c => `${c.first_name} ${c.last_name} ${c.phone ?? ''} ${c.cell ?? ''}`.toLowerCase().includes(q))
      .slice(0, 8)
  }, [customers, customerSearch])

  const selectedService = activeServices.find(sv => sv.id === serviceId) ?? null
  const price = parseFloat(priceStr) || 0

  function resetForm() {
    setCustomerSearch('')
    setSelectedCustomer(null)
    setShowDropdown(false)
    setStylistId('')
    setServiceId('')
    setPriceStr('')
    setTaxRate(TAX_RATE_SERVICE)
  }

  const addMutation = useMutation({
    mutationFn: () => api.post('/cart/', {
      customer_id: selectedCustomer!.id,
      item_type: 'service',
      inventory_item_id: null,
      description: selectedService!.name,
      price,
      tax_rate: taxRate,
      discount_amount: 0,
      notes: null,
      department: 'wash_set',
      sales_rep_id: stylistId || null,
    }),
    onSuccess: () => {
      resetForm()
      qc.invalidateQueries({ queryKey: ['cart-active'] })
    },
  })

  function handleAdd() {
    if (!selectedCustomer || !selectedService) return
    addMutation.mutate()
  }

  return (
    <div style={s.card}>
      {/* Customer */}
      <div style={s.field}>
        <label style={s.fieldLabel}>Customer</label>
        {selectedCustomer ? (
          <div style={s.pill}>
            <span style={s.pillLabel}>{selectedCustomer.first_name} {selectedCustomer.last_name}</span>
            {(selectedCustomer.phone || selectedCustomer.cell) && (
              <span style={s.pillSub}>{selectedCustomer.phone || selectedCustomer.cell}</span>
            )}
            <button style={s.clearBtn} onClick={() => { setSelectedCustomer(null); setCustomerSearch('') }}><X size={12} /></button>
          </div>
        ) : (
          <div style={{ position: 'relative' }}>
            <input
              style={s.input}
              placeholder="Search customer by name or phone…"
              value={customerSearch}
              onChange={e => { setCustomerSearch(e.target.value); setShowDropdown(true) }}
              onFocus={() => setShowDropdown(true)}
            />
            {showDropdown && matchedCustomers.length > 0 && (
              <div style={s.dropdown}>
                {matchedCustomers.map(c => (
                  <button key={c.id} style={s.dropdownItem}
                    onClick={() => { setSelectedCustomer(c); setShowDropdown(false); setCustomerSearch('') }}>
                    {c.first_name} {c.last_name}
                    {(c.phone || c.cell) && <span style={s.dropdownPhone}>{c.phone || c.cell}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Stylist */}
      <div style={s.field}>
        <label style={s.fieldLabel}>Stylist <span style={s.optional}>(for commission)</span></label>
        <select style={s.input} value={stylistId} onChange={e => setStylistId(e.target.value)}>
          <option value="">— None —</option>
          {activeEmployees.map(e => (
            <option key={e.id} value={e.id}>{e.first_name} {e.last_name} · {e.job_title}</option>
          ))}
        </select>
      </div>

      {/* Service + price */}
      <div style={s.inlineRow}>
        <div style={{ ...s.field, flex: 2 }}>
          <label style={s.fieldLabel}>Service</label>
          <select style={s.input} value={serviceId} onChange={e => {
            const svc = activeServices.find(sv => sv.id === e.target.value) ?? null
            setServiceId(e.target.value)
            setPriceStr(svc?.default_price != null ? String(svc.default_price) : '')
          }}>
            <option value="">— Select service —</option>
            {activeServices.map(sv => (
              <option key={sv.id} value={sv.id}>
                {sv.name}{sv.default_price != null ? ` — $${sv.default_price.toFixed(2)}` : ''}
              </option>
            ))}
          </select>
        </div>
        <div style={s.field}>
          <label style={s.fieldLabel}>Price</label>
          <div style={s.inputPrefix}>
            <span style={s.prefix}>$</span>
            <input
              style={{ ...s.input, paddingLeft: 22 }}
              type="number" min={0} step={0.01}
              placeholder="0.00"
              value={priceStr}
              onChange={e => setPriceStr(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Tax rate */}
      <div style={s.field}>
        <label style={s.fieldLabel}>Tax Rate</label>
        <div style={s.taxBtns}>
          {[
            { label: 'None (0%)',      value: TAX_RATE_NONE    },
            { label: 'Service (4.5%)', value: TAX_RATE_SERVICE },
          ].map(opt => (
            <button key={opt.label}
              style={{ ...s.taxBtn, ...(taxRate === opt.value ? s.taxBtnActive : {}) }}
              onClick={() => setTaxRate(opt.value)}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <button
        style={{ ...s.addBtn, opacity: (!selectedCustomer || !selectedService || addMutation.isPending) ? 0.5 : 1 }}
        disabled={!selectedCustomer || !selectedService || addMutation.isPending}
        onClick={handleAdd}
      >
        <Plus size={14} /> {addMutation.isPending ? 'Adding…' : 'Add to Cart'}
      </button>
    </div>
  )
}

// ── Active Carts Tab ─────────────────────────────────────────

function ActiveCartsTab() {
  const qc = useQueryClient()
  const [expanded, setExpanded] = useState<string | null>(null)

  const { data: allCart = [], isLoading } = useQuery<CartItem[]>({
    queryKey: ['cart-active'],
    queryFn: () => api.get('/cart/active').then(r => r.data),
    staleTime: 0,
  })

  const removeMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/cart/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cart-active'] }),
  })

  const grouped = useMemo(() => {
    const washSetItems = allCart.filter(i => i.department === 'wash_set')
    const map = new Map<string, CartItem[]>()
    for (const item of washSetItems) {
      map.set(item.customer_id, [...(map.get(item.customer_id) ?? []), item])
    }
    return Array.from(map.entries())
  }, [allCart])

  if (isLoading) return <div style={s.empty}>Loading…</div>
  if (grouped.length === 0) return <div style={s.empty}>No pending Wash & Set carts.</div>

  return (
    <div style={s.list}>
      {grouped.map(([custId, items]) => {
        const name  = items[0].customer_name ?? 'Unknown'
        const total = items.reduce((sum, i) => sum + Number(i.price), 0)
        const open  = expanded === custId

        return (
          <div key={custId} style={s.cartGroup}>
            <button style={s.cartHeader} onClick={() => setExpanded(open ? null : custId)}>
              <User size={13} color="rgba(13,13,13,0.35)" />
              <span style={s.cartName}>{name}</span>
              <span style={s.cartBadge}>{items.length} item{items.length !== 1 ? 's' : ''}</span>
              <span style={{ flex: 1 }} />
              <span style={s.cartTotal}>${total.toFixed(2)}</span>
              {open ? <ChevronDown size={14} color="rgba(13,13,13,0.35)" /> : <ChevronRight size={14} color="rgba(13,13,13,0.35)" />}
            </button>

            {open && (
              <div style={s.cartBody}>
                {items.map(item => (
                  <div key={item.id} style={s.cartItemRow}>
                    <span style={s.cartItemName}>{item.description}</span>
                    <span style={s.cartItemPrice}>${Number(item.price).toFixed(2)}</span>
                    <button style={s.clearBtn} onClick={() => removeMutation.mutate(item.id)}><X size={13} /></button>
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

const s: Record<string, React.CSSProperties> = {
  header:   { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
  title:    { fontSize: 22, fontWeight: 600, color: '#0d0d0d', letterSpacing: '-0.03em', margin: 0 },
  subtitle: { fontSize: 13, color: 'rgba(13,13,13,0.45)', marginTop: 4 },

  tabRow:       { display: 'flex', gap: 4, marginBottom: 24, borderBottom: BORDER },
  tabBtn:       { background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500, color: 'rgba(13,13,13,0.45)', padding: '8px 14px', borderBottom: '2px solid transparent', marginBottom: -1, borderRadius: 0 },
  tabBtnActive: { color: '#0d0d0d', borderBottomColor: '#0d0d0d' },

  card:      { background: '#fff', border: BORDER, borderRadius: 12, padding: 20, display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 560 },
  field:     { display: 'flex', flexDirection: 'column', gap: 6, flex: 1 },
  fieldLabel:{ fontSize: 11, fontWeight: 600, color: 'rgba(13,13,13,0.5)', textTransform: 'uppercase' as const, letterSpacing: '0.07em' },
  optional:  { textTransform: 'none' as const, fontWeight: 400, color: 'rgba(13,13,13,0.35)' },
  inlineRow: { display: 'flex', gap: 12 },

  input:       { border: BORDER, borderRadius: 8, padding: '8px 12px', fontSize: 13, outline: 'none', background: '#fff', width: '100%', boxSizing: 'border-box' as const },
  inputPrefix: { position: 'relative' as const, display: 'flex', alignItems: 'center' },
  prefix:      { position: 'absolute' as const, left: 10, fontSize: 13, color: 'rgba(13,13,13,0.4)' },

  dropdown:     { position: 'absolute' as const, top: '100%', left: 0, right: 0, background: '#fff', border: BORDER, borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.08)', zIndex: 10, maxHeight: 210, overflowY: 'auto' as const, marginTop: 4 },
  dropdownItem: { display: 'block', width: '100%', textAlign: 'left' as const, padding: '9px 14px', fontSize: 13, background: 'none', border: 'none', cursor: 'pointer', color: '#0d0d0d' },
  dropdownPhone:{ display: 'block', fontSize: 11, color: 'rgba(13,13,13,0.4)', marginTop: 2 },

  pill:      { display: 'flex', alignItems: 'center', background: 'rgba(13,13,13,0.04)', border: BORDER, borderRadius: 8, padding: '8px 12px', gap: 10 },
  pillLabel: { fontSize: 13, fontWeight: 500, color: '#0d0d0d' },
  pillSub:   { fontSize: 12, color: 'rgba(13,13,13,0.4)' },
  clearBtn:  { background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(13,13,13,0.35)', display: 'flex', alignItems: 'center', padding: 2, marginLeft: 'auto' },

  taxBtns:      { display: 'flex', gap: 6 },
  taxBtn:       { background: '#fff', border: BORDER, borderRadius: 7, padding: '6px 12px', fontSize: 12, cursor: 'pointer', color: 'rgba(13,13,13,0.55)', fontWeight: 500 },
  taxBtnActive: { background: '#0d0d0d', color: '#fff', borderColor: '#0d0d0d' },

  addBtn: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: '#0d0d0d', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 16px', fontSize: 13, fontWeight: 500, cursor: 'pointer' },

  empty: { textAlign: 'center' as const, color: 'rgba(13,13,13,0.35)', fontSize: 13, padding: '48px 0' },
  list:  { display: 'flex', flexDirection: 'column', gap: 8 },

  cartGroup:    { background: '#fff', border: BORDER, borderRadius: 10, overflow: 'hidden' },
  cartHeader:   { display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', width: '100%', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' as const },
  cartName:     { fontSize: 13, fontWeight: 600, color: '#0d0d0d', flex: 1 },
  cartBadge:    { fontSize: 11, background: 'rgba(13,13,13,0.07)', borderRadius: 20, padding: '2px 8px', color: 'rgba(13,13,13,0.5)' },
  cartTotal:    { fontSize: 13, fontWeight: 600, color: '#0d0d0d', marginRight: 4 },
  cartBody:     { borderTop: BORDER, padding: '8px 16px', display: 'flex', flexDirection: 'column', gap: 6 },
  cartItemRow:  { display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0' },
  cartItemName: { fontSize: 13, color: '#0d0d0d', fontWeight: 500, flex: 1 },
  cartItemPrice:{ fontSize: 13, fontWeight: 600, color: '#0d0d0d', flexShrink: 0 },
}

/**
 * Wash & Set Page — /bookkeeper/wash-set
 *
 * Pick a customer, pick the stylist doing the work, then add one or more
 * Wash & Set services to the cart. Items land in pending_cart_items
 * (department: 'wash_set') exactly like Sales Management / Repairs already
 * do, and get picked up from the pending banner at POS checkout.
 */

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, X } from 'lucide-react'
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

type PendingItem = {
  id: string
  description: string
  price: number
  department: string
}

export default function WashSetPage() {
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
  const { data: pendingItems = [] } = useQuery<PendingItem[]>({
    queryKey: ['customer-cart', selectedCustomer?.id],
    queryFn: () => api.get(`/cart/${selectedCustomer!.id}`).then(r => r.data),
    enabled: !!selectedCustomer,
    staleTime: 0,
  })

  const activeEmployees = employees.filter(e => e.is_active)
  const activeServices = services.filter(sv => sv.is_active)
  const visitItems = pendingItems.filter(p => p.department === 'wash_set')

  const matchedCustomers = useMemo(() => {
    if (!customerSearch.trim()) return []
    const q = customerSearch.toLowerCase()
    return customers
      .filter(c => `${c.first_name} ${c.last_name} ${c.phone ?? ''} ${c.cell ?? ''}`.toLowerCase().includes(q))
      .slice(0, 8)
  }, [customers, customerSearch])

  const selectedService = activeServices.find(sv => sv.id === serviceId) ?? null
  const price = parseFloat(priceStr) || 0

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
      setServiceId('')
      setPriceStr('')
      qc.invalidateQueries({ queryKey: ['customer-cart', selectedCustomer?.id] })
      qc.invalidateQueries({ queryKey: ['cart-active'] })
    },
  })

  const removeMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/cart/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customer-cart', selectedCustomer?.id] })
      qc.invalidateQueries({ queryKey: ['cart-active'] })
    },
  })

  function handleAdd() {
    if (!selectedCustomer || !selectedService) return
    addMutation.mutate()
  }

  return (
    <div>
      <header style={s.header}>
        <div>
          <h1 style={s.title}>Wash & Set</h1>
          <p style={s.subtitle}>Add a Wash & Set service to a customer's cart</p>
        </div>
      </header>

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

      {selectedCustomer && (
        <div style={s.visitSection}>
          <h2 style={s.visitTitle}>This visit</h2>
          {visitItems.length === 0 ? (
            <p style={s.empty}>No Wash & Set items added yet.</p>
          ) : (
            <div style={s.list}>
              {visitItems.map(item => (
                <div key={item.id} style={s.visitRow}>
                  <span style={s.visitDesc}>{item.description}</span>
                  <span style={s.visitPrice}>${item.price.toFixed(2)}</span>
                  <button style={s.clearBtn} onClick={() => removeMutation.mutate(item.id)}><X size={13} /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  header:   { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
  title:    { fontSize: 22, fontWeight: 600, color: '#0d0d0d', letterSpacing: '-0.03em', margin: 0 },
  subtitle: { fontSize: 13, color: 'rgba(13,13,13,0.45)', marginTop: 4 },

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

  visitSection: { marginTop: 28, maxWidth: 560 },
  visitTitle:   { fontSize: 14, fontWeight: 600, color: '#0d0d0d', margin: '0 0 12px' },
  empty:        { fontSize: 13, color: 'rgba(13,13,13,0.35)' },
  list:         { display: 'flex', flexDirection: 'column', gap: 8 },
  visitRow:     { display: 'flex', alignItems: 'center', gap: 10, background: '#fff', border: BORDER, borderRadius: 8, padding: '10px 14px' },
  visitDesc:    { fontSize: 13, color: '#0d0d0d', fontWeight: 500, flex: 1 },
  visitPrice:   { fontSize: 13, fontWeight: 600, color: '#0d0d0d' },
}

/**
 * Sales Department Page — /bookkeeper/sales
 *
 * Tab 1: Inventory — browse in-stock wigs and products, add to a customer's cart
 * Tab 2: Active Carts — see every customer who has items waiting at the POS
 */

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ShoppingCart, Search, X, Package, Sparkles, ChevronRight, Trash2 } from 'lucide-react'
import { api } from '../../lib/api'

// ── Types ────────────────────────────────────────────────────

type InventoryItem = {
  id: string
  item_type: 'wig' | 'product'
  name: string
  brand?: string
  color?: string
  length?: string
  size?: string
  front?: string
  daysmart_serial?: string
  wig_status?: string
  retail_price?: number
  unit_price?: number
  quantity?: number
  category?: string
}

type Customer = {
  id: string
  first_name: string
  last_name: string
  phone?: string
  cell?: string
}

type CartItem = {
  id: string
  customer_id: string
  customer_name?: string
  item_type: 'wig' | 'product' | 'service'
  inventory_item_id?: string
  inventory_item_name?: string
  description: string
  price: number
  tax_rate: number
  discount_amount: number
  notes?: string
  department: string
  status: string
  created_at: string
}

// ── Constants ────────────────────────────────────────────────

const TAX_RATE_WIG     = 0.08875
const TAX_RATE_SERVICE = 0.045
const TAX_RATE_NONE    = 0

// ── Page ─────────────────────────────────────────────────────

export default function SalesManagementPage() {
  const [tab, setTab] = useState<'inventory' | 'carts'>('inventory')

  return (
    <div>
      <header style={s.header}>
        <div>
          <h1 style={s.title}>Sales</h1>
          <p style={s.subtitle}>Add items to a customer's cart — they pay at the front desk</p>
        </div>
      </header>

      <div style={s.tabRow}>
        <TabBtn active={tab === 'inventory'} onClick={() => setTab('inventory')}>Inventory</TabBtn>
        <TabBtn active={tab === 'carts'} onClick={() => setTab('carts')}>Active Carts</TabBtn>
      </div>

      {tab === 'inventory' && <InventoryTab />}
      {tab === 'carts'     && <ActiveCartsTab />}
    </div>
  )
}

// ── Inventory Tab ─────────────────────────────────────────────

function InventoryTab() {
  const [search, setSearch]             = useState('')
  const [typeFilter, setTypeFilter]     = useState<'all' | 'wig' | 'product'>('all')
  const [addingItem, setAddingItem]     = useState<InventoryItem | null>(null)

  const { data: items = [], isLoading } = useQuery<InventoryItem[]>({
    queryKey: ['inventory'],
    queryFn: () => api.get('/inventory/').then(r => r.data),
    staleTime: 0,
  })

  // Only show in-stock wigs and products with quantity > 0
  const available = useMemo(() => {
    return items.filter(item => {
      if (item.item_type === 'wig')     return item.wig_status === 'in_stock'
      if (item.item_type === 'product') return (item.quantity ?? 0) > 0
      return false
    })
  }, [items])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return available.filter(item => {
      if (typeFilter !== 'all' && item.item_type !== typeFilter) return false
      const label = item.item_type === 'wig'
        ? [item.brand, item.color, item.length, item.daysmart_serial, item.name].join(' ').toLowerCase()
        : [item.name, item.category].join(' ').toLowerCase()
      return label.includes(q)
    })
  }, [available, search, typeFilter])

  if (isLoading) return <div style={s.empty}>Loading inventory…</div>

  return (
    <>
      {/* Search + filter bar */}
      <div style={s.toolbar}>
        <div style={s.searchWrap}>
          <Search size={14} color="rgba(13,13,13,0.35)" />
          <input
            style={s.searchInput}
            placeholder="Search by brand, color, serial, name…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div style={s.filterGroup}>
          {(['all', 'wig', 'product'] as const).map(f => (
            <button
              key={f}
              style={{ ...s.filterBtn, ...(typeFilter === f ? s.filterBtnActive : {}) }}
              onClick={() => setTypeFilter(f)}
            >
              {f === 'all' ? 'All' : f === 'wig' ? 'Wigs' : 'Products'}
            </button>
          ))}
        </div>
        <span style={s.countBadge}>{filtered.length} items</span>
      </div>

      {filtered.length === 0 ? (
        <div style={s.empty}>No in-stock items match your search.</div>
      ) : (
        <div style={s.grid}>
          {filtered.map(item => (
            <InventoryCard
              key={item.id}
              item={item}
              onAddToCart={() => setAddingItem(item)}
            />
          ))}
        </div>
      )}

      {/* Add to cart panel */}
      {addingItem && (
        <AddToCartPanel
          item={addingItem}
          onClose={() => setAddingItem(null)}
        />
      )}
    </>
  )
}

// ── Inventory Card ────────────────────────────────────────────

function InventoryCard({ item, onAddToCart }: { item: InventoryItem; onAddToCart: () => void }) {
  const isWig   = item.item_type === 'wig'
  const price   = isWig ? (item.retail_price ?? 0) : (item.unit_price ?? 0)
  const label   = isWig
    ? [item.brand, item.color, item.length].filter(Boolean).join(' · ')
    : item.category ?? ''

  return (
    <div style={s.card}>
      <div style={s.cardBadge}>
        {isWig
          ? <Sparkles size={11} color="#DF5198" />
          : <Package   size={11} color="#5581B1" />
        }
        <span style={{ ...s.cardBadgeText, color: isWig ? '#DF5198' : '#5581B1' }}>
          {isWig ? 'Wig' : 'Product'}
        </span>
      </div>

      <div style={s.cardName}>{item.name}</div>
      {label && <div style={s.cardMeta}>{label}</div>}
      {isWig && item.daysmart_serial && (
        <div style={s.cardSerial}>#{item.daysmart_serial}</div>
      )}
      {!isWig && (
        <div style={s.cardMeta}>Qty: {item.quantity}</div>
      )}

      <div style={s.cardFooter}>
        <span style={s.cardPrice}>${price.toFixed(2)}</span>
        <button style={s.addBtn} onClick={onAddToCart}>
          <ShoppingCart size={13} />
          Add to Cart
        </button>
      </div>
    </div>
  )
}

// ── Add to Cart Panel ─────────────────────────────────────────

function AddToCartPanel({ item, onClose }: { item: InventoryItem; onClose: () => void }) {
  const qc = useQueryClient()

  const isWig         = item.item_type === 'wig'
  const defaultPrice  = isWig ? (item.retail_price ?? 0) : (item.unit_price ?? 0)
  const defaultTax    = isWig ? TAX_RATE_WIG : TAX_RATE_NONE

  const [customerSearch, setCustomerSearch] = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [price, setPrice]                   = useState(defaultPrice.toString())
  const [taxRate, setTaxRate]               = useState(defaultTax)
  const [notes, setNotes]                   = useState('')
  const [showDropdown, setShowDropdown]     = useState(false)

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ['customers'],
    queryFn: () => api.get('/customers/').then(r => r.data),
    staleTime: 1000 * 60 * 5,
  })

  const matchedCustomers = useMemo(() => {
    if (!customerSearch.trim()) return []
    const q = customerSearch.toLowerCase()
    return customers
      .filter(c => `${c.first_name} ${c.last_name} ${c.phone ?? ''} ${c.cell ?? ''}`.toLowerCase().includes(q))
      .slice(0, 8)
  }, [customers, customerSearch])

  const addMutation = useMutation({
    mutationFn: (data: object) => api.post('/cart/', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cart-active'] })
      onClose()
    },
    onError: () => alert('Failed to add item to cart. Please try again.'),
  })

  function handleSubmit() {
    if (!selectedCustomer) { alert('Please select a customer.'); return }
    const parsedPrice = parseFloat(price)
    if (isNaN(parsedPrice) || parsedPrice < 0) { alert('Please enter a valid price.'); return }

    addMutation.mutate({
      customer_id:       selectedCustomer.id,
      item_type:         item.item_type,
      inventory_item_id: item.id,
      description:       item.name,
      price:             parsedPrice,
      tax_rate:          taxRate,
      discount_amount:   0,
      notes:             notes || null,
      department:        'sales',
    })
  }

  return (
    <>
      {/* Backdrop */}
      <div style={s.backdrop} onClick={onClose} />

      {/* Panel */}
      <div style={s.panel}>
        <div style={s.panelHeader}>
          <span style={s.panelTitle}>Add to Cart</span>
          <button style={s.panelClose} onClick={onClose}><X size={16} /></button>
        </div>

        {/* Item summary */}
        <div style={s.panelItem}>
          <div style={s.panelItemName}>{item.name}</div>
          {isWig && (
            <div style={s.panelItemMeta}>
              {[item.brand, item.color, item.length, item.daysmart_serial ? `#${item.daysmart_serial}` : ''].filter(Boolean).join(' · ')}
            </div>
          )}
        </div>

        {/* Customer select */}
        <div style={s.field}>
          <label style={s.label}>Customer</label>
          {selectedCustomer ? (
            <div style={s.selectedCustomer}>
              <span>{selectedCustomer.first_name} {selectedCustomer.last_name}</span>
              <button style={s.clearBtn} onClick={() => { setSelectedCustomer(null); setCustomerSearch('') }}>
                <X size={12} />
              </button>
            </div>
          ) : (
            <div style={{ position: 'relative' }}>
              <input
                style={s.input}
                placeholder="Search customer…"
                value={customerSearch}
                onChange={e => { setCustomerSearch(e.target.value); setShowDropdown(true) }}
                onFocus={() => setShowDropdown(true)}
              />
              {showDropdown && matchedCustomers.length > 0 && (
                <div style={s.dropdown}>
                  {matchedCustomers.map(c => (
                    <button
                      key={c.id}
                      style={s.dropdownItem}
                      onClick={() => { setSelectedCustomer(c); setShowDropdown(false); setCustomerSearch('') }}
                    >
                      {c.first_name} {c.last_name}
                      {(c.phone || c.cell) && (
                        <span style={s.dropdownPhone}>{c.phone || c.cell}</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Price */}
        <div style={s.field}>
          <label style={s.label}>Price</label>
          <div style={s.inputPrefix}>
            <span style={s.prefix}>$</span>
            <input
              style={{ ...s.input, paddingLeft: 28 }}
              type="number"
              min="0"
              step="0.01"
              value={price}
              onChange={e => setPrice(e.target.value)}
            />
          </div>
        </div>

        {/* Tax rate */}
        <div style={s.field}>
          <label style={s.label}>Tax Rate</label>
          <div style={s.taxBtns}>
            {[
              { label: 'None (0%)',   value: TAX_RATE_NONE    },
              { label: 'Service (4.5%)', value: TAX_RATE_SERVICE },
              { label: 'Product (8.875%)', value: TAX_RATE_WIG  },
            ].map(opt => (
              <button
                key={opt.label}
                style={{ ...s.taxBtn, ...(taxRate === opt.value ? s.taxBtnActive : {}) }}
                onClick={() => setTaxRate(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div style={s.field}>
          <label style={s.label}>Notes <span style={s.optional}>(optional)</span></label>
          <textarea
            style={s.textarea}
            placeholder="Anything the front desk should know…"
            rows={3}
            value={notes}
            onChange={e => setNotes(e.target.value)}
          />
        </div>

        {/* Summary line */}
        <div style={s.panelSummary}>
          <span>Subtotal</span>
          <span>${parseFloat(price || '0').toFixed(2)}</span>
        </div>
        <div style={s.panelSummary}>
          <span>Tax ({(taxRate * 100).toFixed(3).replace(/\.?0+$/, '')}%)</span>
          <span>${(parseFloat(price || '0') * taxRate).toFixed(2)}</span>
        </div>
        <div style={{ ...s.panelSummary, fontWeight: 600, borderTop: '1px solid rgba(13,13,13,0.08)', paddingTop: 10 }}>
          <span>Total</span>
          <span>${(parseFloat(price || '0') * (1 + taxRate)).toFixed(2)}</span>
        </div>

        <button
          style={{ ...s.submitBtn, opacity: addMutation.isPending ? 0.6 : 1 }}
          onClick={handleSubmit}
          disabled={addMutation.isPending}
        >
          {addMutation.isPending ? 'Adding…' : 'Add to Cart'}
          {!addMutation.isPending && <ChevronRight size={15} />}
        </button>
      </div>
    </>
  )
}

// ── Active Carts Tab ──────────────────────────────────────────

function ActiveCartsTab() {
  const qc = useQueryClient()

  const { data: items = [], isLoading } = useQuery<CartItem[]>({
    queryKey: ['cart-active'],
    queryFn: () => api.get('/cart/active').then(r => r.data),
    staleTime: 0,
  })

  const removeMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/cart/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cart-active'] }),
    onError: () => alert('Failed to remove item. Please try again.'),
  })

  // Group items by customer
  const grouped = useMemo(() => {
    const map = new Map<string, { customer_name: string; items: CartItem[] }>()
    for (const item of items) {
      const name = item.customer_name ?? 'Unknown Customer'
      if (!map.has(item.customer_id)) {
        map.set(item.customer_id, { customer_name: name, items: [] })
      }
      map.get(item.customer_id)!.items.push(item)
    }
    return Array.from(map.entries()).map(([customerId, val]) => ({ customerId, ...val }))
  }, [items])

  if (isLoading) return <div style={s.empty}>Loading carts…</div>

  if (grouped.length === 0) {
    return (
      <div style={s.emptyState}>
        <ShoppingCart size={36} color="rgba(13,13,13,0.15)" />
        <p style={s.emptyStateText}>No active carts right now.</p>
        <p style={s.emptyStateSub}>When a salesperson adds items to a customer's cart, they'll appear here.</p>
      </div>
    )
  }

  return (
    <div style={s.cartList}>
      {grouped.map(({ customerId, customer_name, items: cartItems }) => {
        const total = cartItems.reduce((sum, i) => sum + i.price * (1 + i.tax_rate) - i.discount_amount, 0)
        return (
          <div key={customerId} style={s.cartCard}>
            <div style={s.cartCardHeader}>
              <div>
                <div style={s.cartCustomerName}>{customer_name}</div>
                <div style={s.cartMeta}>{cartItems.length} item{cartItems.length !== 1 ? 's' : ''}</div>
              </div>
              <div style={s.cartTotal}>${total.toFixed(2)}</div>
            </div>

            <div style={s.cartItems}>
              {cartItems.map(item => (
                <div key={item.id} style={s.cartItemRow}>
                  <div style={s.cartItemLeft}>
                    <div style={s.cartItemName}>{item.description}</div>
                    {item.notes && <div style={s.cartItemNotes}>{item.notes}</div>}
                    <div style={s.cartItemMeta}>
                      {item.department} · {item.tax_rate > 0 ? `${(item.tax_rate * 100).toFixed(3).replace(/\.?0+$/, '')}% tax` : 'Tax exempt'}
                    </div>
                  </div>
                  <div style={s.cartItemRight}>
                    <span style={s.cartItemPrice}>${item.price.toFixed(2)}</span>
                    <button
                      style={s.removeBtn}
                      onClick={() => removeMutation.mutate(item.id)}
                      title="Remove from cart"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div style={s.cartCardFooter}>
              Customer checks out at the <strong>Front Desk → Point of Sale</strong>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Shared UI ─────────────────────────────────────────────────

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        ...s.tab,
        ...(active ? s.tabActive : {}),
      }}
    >
      {children}
    </button>
  )
}

// ── Styles ────────────────────────────────────────────────────

const BORDER = '1px solid rgba(13,13,13,0.08)'

const s: Record<string, React.CSSProperties> = {
  // Page
  header:     { marginBottom: 24 },
  title:      { fontSize: 22, fontWeight: 600, color: '#0d0d0d', letterSpacing: '-0.03em', margin: 0 },
  subtitle:   { fontSize: 13, color: 'rgba(13,13,13,0.45)', margin: '4px 0 0', fontWeight: 400 },
  tabRow:     { display: 'flex', gap: 2, marginBottom: 28, borderBottom: BORDER, paddingBottom: 0 },
  tab:        { background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500, color: 'rgba(13,13,13,0.45)', padding: '8px 14px', borderBottom: '2px solid transparent', marginBottom: -1, transition: 'all 0.15s' },
  tabActive:  { color: '#0d0d0d', borderBottomColor: '#0d0d0d' },

  // Toolbar
  toolbar:    { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 },
  searchWrap: { display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: BORDER, borderRadius: 8, padding: '8px 12px', flex: 1, maxWidth: 400 },
  searchInput:{ border: 'none', outline: 'none', fontSize: 13, color: '#0d0d0d', width: '100%', background: 'transparent' },
  filterGroup:{ display: 'flex', gap: 4 },
  filterBtn:  { background: '#fff', border: BORDER, borderRadius: 6, padding: '6px 12px', fontSize: 12, fontWeight: 500, color: 'rgba(13,13,13,0.55)', cursor: 'pointer' },
  filterBtnActive: { background: '#212121', color: '#fff', borderColor: '#212121' },
  countBadge: { fontSize: 12, color: 'rgba(13,13,13,0.4)', marginLeft: 'auto' },
  empty:      { padding: '60px 0', textAlign: 'center', color: 'rgba(13,13,13,0.35)', fontSize: 14 },

  // Inventory grid
  grid:       { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 },
  card:       { background: '#fff', border: BORDER, borderRadius: 12, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 6 },
  cardBadge:  { display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 },
  cardBadgeText: { fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' as const },
  cardName:   { fontSize: 14, fontWeight: 600, color: '#0d0d0d', letterSpacing: '-0.01em', lineHeight: 1.3 },
  cardMeta:   { fontSize: 12, color: 'rgba(13,13,13,0.45)' },
  cardSerial: { fontSize: 11, color: 'rgba(13,13,13,0.35)', fontFamily: 'monospace' },
  cardFooter: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, paddingTop: 12, borderTop: BORDER },
  cardPrice:  { fontSize: 16, fontWeight: 700, color: '#0d0d0d', letterSpacing: '-0.02em' },
  addBtn:     { display: 'flex', alignItems: 'center', gap: 6, background: '#212121', color: '#fff', border: 'none', borderRadius: 7, padding: '7px 12px', fontSize: 12, fontWeight: 500, cursor: 'pointer' },

  // Panel
  backdrop:   { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.18)', zIndex: 200 },
  panel:      { position: 'fixed', top: 44, right: 0, bottom: 0, width: 420, background: '#fff', borderLeft: BORDER, zIndex: 201, overflowY: 'auto', padding: '28px 28px 40px', display: 'flex', flexDirection: 'column', gap: 18 },
  panelHeader:{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  panelTitle: { fontSize: 16, fontWeight: 600, color: '#0d0d0d', letterSpacing: '-0.02em' },
  panelClose: { background: 'none', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 6, color: 'rgba(13,13,13,0.4)', display: 'flex', alignItems: 'center' },
  panelItem:  { background: '#fafaf9', border: BORDER, borderRadius: 10, padding: '14px 16px' },
  panelItemName: { fontSize: 14, fontWeight: 600, color: '#0d0d0d', letterSpacing: '-0.01em' },
  panelItemMeta: { fontSize: 12, color: 'rgba(13,13,13,0.45)', marginTop: 4 },
  panelSummary:  { display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'rgba(13,13,13,0.6)', paddingTop: 6 },
  submitBtn:  { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: '#212121', color: '#fff', border: 'none', borderRadius: 9, padding: '13px 0', fontSize: 14, fontWeight: 600, cursor: 'pointer', marginTop: 4, letterSpacing: '-0.01em' },

  // Form fields
  field:      { display: 'flex', flexDirection: 'column', gap: 7 },
  label:      { fontSize: 12, fontWeight: 500, color: 'rgba(13,13,13,0.6)', letterSpacing: '0.01em' },
  optional:   { fontWeight: 400, color: 'rgba(13,13,13,0.35)' },
  input:      { background: '#fff', border: BORDER, borderRadius: 8, padding: '9px 12px', fontSize: 13, color: '#0d0d0d', outline: 'none', width: '100%', boxSizing: 'border-box' as const },
  inputPrefix:{ position: 'relative' },
  prefix:     { position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: 'rgba(13,13,13,0.4)' },
  textarea:   { background: '#fff', border: BORDER, borderRadius: 8, padding: '9px 12px', fontSize: 13, color: '#0d0d0d', outline: 'none', resize: 'vertical' as const, fontFamily: 'inherit', boxSizing: 'border-box' as const, width: '100%' },
  taxBtns:    { display: 'flex', gap: 6, flexWrap: 'wrap' as const },
  taxBtn:     { background: '#fff', border: BORDER, borderRadius: 6, padding: '6px 11px', fontSize: 12, fontWeight: 500, color: 'rgba(13,13,13,0.55)', cursor: 'pointer', whiteSpace: 'nowrap' as const },
  taxBtnActive: { background: '#212121', color: '#fff', borderColor: '#212121' },

  // Customer dropdown
  selectedCustomer: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fafaf9', border: BORDER, borderRadius: 8, padding: '9px 12px', fontSize: 13, color: '#0d0d0d' },
  clearBtn:   { background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(13,13,13,0.4)', display: 'flex', padding: 0 },
  dropdown:   { position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: BORDER, borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.08)', zIndex: 10, overflow: 'hidden', marginTop: 4 },
  dropdownItem: { width: '100%', background: 'none', border: 'none', padding: '10px 12px', fontSize: 13, color: '#0d0d0d', cursor: 'pointer', textAlign: 'left' as const, display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  dropdownPhone: { fontSize: 11, color: 'rgba(13,13,13,0.4)' },

  // Active Carts
  cartList:   { display: 'flex', flexDirection: 'column', gap: 16 },
  cartCard:   { background: '#fff', border: BORDER, borderRadius: 12, overflow: 'hidden' },
  cartCardHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px', borderBottom: BORDER },
  cartCustomerName: { fontSize: 15, fontWeight: 600, color: '#0d0d0d', letterSpacing: '-0.02em' },
  cartMeta:   { fontSize: 12, color: 'rgba(13,13,13,0.4)', marginTop: 3 },
  cartTotal:  { fontSize: 18, fontWeight: 700, color: '#0d0d0d', letterSpacing: '-0.03em' },
  cartItems:  { display: 'flex', flexDirection: 'column' },
  cartItemRow:{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 20px', borderBottom: BORDER },
  cartItemLeft:{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1, minWidth: 0 },
  cartItemName:{ fontSize: 13, fontWeight: 500, color: '#0d0d0d' },
  cartItemNotes: { fontSize: 12, color: 'rgba(13,13,13,0.45)', fontStyle: 'italic' },
  cartItemMeta:{ fontSize: 11, color: 'rgba(13,13,13,0.35)', textTransform: 'capitalize' as const },
  cartItemRight: { display: 'flex', alignItems: 'center', gap: 12, marginLeft: 16, flexShrink: 0 },
  cartItemPrice: { fontSize: 14, fontWeight: 600, color: '#0d0d0d' },
  removeBtn:  { background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(13,13,13,0.3)', display: 'flex', padding: 4, borderRadius: 5 },
  cartCardFooter: { padding: '12px 20px', fontSize: 12, color: 'rgba(13,13,13,0.4)', background: '#fafaf9' },

  // Empty state
  emptyState: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '80px 0', textAlign: 'center' as const },
  emptyStateText: { fontSize: 15, fontWeight: 500, color: 'rgba(13,13,13,0.45)', margin: 0 },
  emptyStateSub: { fontSize: 13, color: 'rgba(13,13,13,0.3)', margin: 0, maxWidth: 340 },
}

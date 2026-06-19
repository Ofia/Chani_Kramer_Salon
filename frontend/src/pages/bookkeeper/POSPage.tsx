/**
 * POS Page — Point of Sale
 *
 * Multi-item cart per customer visit.
 * Item types: Wash & Set · Repair · Inventory product · Wig
 * Supports split payments (multiple methods).
 * One receipt per visit — covers all line items.
 *
 * On save → creates a pos_sale record, inventory decrements,
 * wig_orders created for wig items.
 * Daily Entry auto-fills from these records.
 */

import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../lib/auth'
import {
  Search, Plus, X, Printer, ChevronDown, ChevronUp,
  Trash2, CreditCard,
} from 'lucide-react'
import { api } from '../../lib/api'

// ── Types ────────────────────────────────────────────────────

type Customer = {
  id: string
  first_name: string
  last_name: string
  phone?: string
  cell?: string
  address?: string
}


type CartItemType = 'wash_set' | 'repair' | 'inventory' | 'wig' | 'wig_balance' | 'pos_balance'

// Default tax rate per item type
const DEFAULT_TAX_RATE: Record<CartItemType, number> = {
  wash_set:    0.045,    // services: 4.5%
  repair:      0.045,    // services: 4.5%
  inventory:   0.08875,  // products: 8.875%
  wig:         0.08875,  // products: 8.875%
  wig_balance: 0,        // no tax on balance payments
  pos_balance: 0,        // no tax on POS sale balance payments
}

type CartItem = {
  _key: string          // local-only key for React list
  item_type: CartItemType
  description: string
  quantity: number
  unit_price: string    // string so input stays controlled
  tax_rate: number      // per-item tax rate (0 | 0.045 | 0.08875)
  notes?: string        // repair notes / annotation
  // inventory
  inventory_item_id?: string
  // wig specs (when item_type = 'wig')
  wig_serial?: string
  wig_brand?: string
  wig_length?: string
  wig_color?: string
  wig_size?: string
  wig_front?: string
  showWigSpecs?: boolean
  // wig_balance: original balance before this payment (for receipt display)
  wig_balance_due?: number
}

type Payment = {
  _key: string
  payment_method: string
  amount: string
}

type WigPaymentRecord = {
  id: string
  payment_date: string
  amount: number
  payment_method: string
  payment_type: string
}

type WigOrder = {
  id: string
  customer_name: string
  customer_phone?: string
  customer_id?: string
  daysmart_serial?: string
  daysmart_receipt_no?: string
  brand?: string
  length?: string
  color?: string
  size?: string
  front?: string
  total_price: number
  amount_paid: number
  balance_due: number
  sale_status: string
  order_date: string
  pickup_date?: string
  payments: WigPaymentRecord[]
}

type PosSaleItem = {
  id: string
  item_type: CartItemType
  description: string
  quantity: number
  unit_price: number
  subtotal: number
  notes?: string
  inventory_item_id?: string
  wig_serial?: string
  wig_brand?: string
  wig_length?: string
  wig_color?: string
  wig_size?: string
  wig_front?: string
}

type PosSalePayment = {
  id: string
  payment_method: string
  amount: number
}

type PosSale = {
  id: string
  customer_name: string
  customer_phone?: string
  sale_date: string
  total_amount: number
  amount_paid: number
  balance_due: number
  notes?: string
  tax_rate: number
  tax_amount: number
  discount_amount: number
  shipping_amount: number
  shipping_address?: string
  items: PosSaleItem[]
  payments: PosSalePayment[]
}

// PosOpenBalance = a PosSale with balance_due > 0 (product/service deposit)
type PosOpenBalance = PosSale

// ── Constants ────────────────────────────────────────────────

const METHODS = ['cash', 'credit_card', 'check', 'zelle']
const METHOD_LABEL: Record<string, string> = {
  cash: 'Cash', credit_card: 'Credit Card', quickpay: 'QuickPay', check: 'Check', zelle: 'Zelle',
}
const ITEM_TYPE_LABEL: Record<CartItemType, string> = {
  wash_set: 'Wash & Set', repair: 'Repair', inventory: 'Product', wig: 'Wig', wig_balance: 'Wig Balance', pos_balance: 'Balance Payment',
}
const ITEM_TYPE_COLOR: Record<CartItemType, string> = {
  wash_set: '#DF5198', repair: '#E3CD94', inventory: '#97BBE9', wig: '#5581B1', wig_balance: '#5581B1', pos_balance: '#97BBE9',
}

let keyCounter = 0
function nextKey() { return String(++keyCounter) }

// Safe date formatter — avoids the UTC-midnight off-by-one bug.
// new Date("2026-05-26") is parsed as UTC midnight, which is the previous
// day in US timezones. Splitting the string skips timezone conversion.
function fmtDate(dateStr: string) {
  const [y, m, d] = dateStr.split('-')
  return `${m}/${d}/${y.slice(2)}`
}

function emptyCustomer() {
  return { id: '', name: '', phone: '' }
}

// ── Page ─────────────────────────────────────────────────────

export default function POSPage() {
  const { profile } = useAuth()
  const canDelete = profile?.role === 'bookkeeper' || profile?.role === 'owner'

  const [customer, setCustomer] = useState(emptyCustomer())
  const [cart, setCart] = useState<CartItem[]>([])
  const [payments, setPayments] = useState<Payment[]>([
    { _key: nextKey(), payment_method: 'cash', amount: '' },
  ])
  const [saleDate, setSaleDate] = useState(new Date().toISOString().split('T')[0])
  const [shipping, setShipping] = useState({ enabled: false, amount: '', address: '' })
  const [receiptSale, setReceiptSale] = useState<PosSale | null>(null)
  const [receiptBalanceItems, setReceiptBalanceItems] = useState<CartItem[]>([])
  const [loadedPendingIds, setLoadedPendingIds] = useState<string[]>([])
  const [discount, setDiscount] = useState('')

  const qc = useQueryClient()

  const { data: todaySales = [] } = useQuery<PosSale[]>({
    queryKey: ['pos-sales-today', saleDate],
    queryFn: () => api.get(`/pos-sales/date/${saleDate}`).then(r => r.data).catch(() => []),
  })

  // Pending cart items for the selected customer (added by Sales dept)
  type PendingCartItem = {
    id: string; item_type: 'wig' | 'product' | 'service'
    inventory_item_id?: string; description: string
    price: number; tax_rate: number; discount_amount: number; notes?: string
    wig_serial?: string; wig_brand?: string; wig_length?: string
    wig_color?: string; wig_size?: string; wig_front?: string
  }
  const { data: pendingCartItems = [] } = useQuery<PendingCartItem[]>({
    queryKey: ['customer-cart', customer.id],
    queryFn: () => api.get(`/cart/${customer.id}`).then(r => r.data).catch(() => []),
    enabled: !!customer.id,
    staleTime: 0,
  })
  const unloadedPending = pendingCartItems.filter(p => !loadedPendingIds.includes(p.id))


  const saveMutation = useMutation({
    mutationFn: (payload: object) => api.post('/pos-sales/', payload),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['pos-sales-today'] })
      qc.invalidateQueries({ queryKey: ['wig-orders-all'] })
      qc.invalidateQueries({ queryKey: ['inventory'] })
      qc.invalidateQueries({ queryKey: ['pending-wigs'] })
      qc.invalidateQueries({ queryKey: ['pos-open-balances'] })
      qc.invalidateQueries({ queryKey: ['operation-overview'] })
      qc.invalidateQueries({ queryKey: ['cart-active'] })
      // Mark loaded pending cart items as checked_out
      loadedPendingIds.forEach(id =>
        api.patch(`/cart/${id}`, { status: 'checked_out' }).catch(() => {})
      )
      // Capture balance items before reset so receipt can display them
      setReceiptBalanceItems(cart.filter(i => i.item_type === 'wig_balance' || i.item_type === 'pos_balance'))
      // Auto-open receipt
      setReceiptSale(res.data)
      // Reset form — keep saleDate so the right panel stays on the same date
      setCustomer(emptyCustomer())
      setCart([])
      setPayments([{ _key: nextKey(), payment_method: 'cash', amount: '' }])
      setShipping({ enabled: false, amount: '', address: '' })
      setDiscount('')
      setLoadedPendingIds([])
    },
  })

  // ── Cart helpers ──────────────────────────────────────────

  function addPosBalanceToCart(sale: PosOpenBalance) {
    const balanceDue = Number(sale.balance_due)
    const label = sale.items.map((i: { description: string }) => i.description).join(', ') || `Sale ${sale.sale_date}`
    setCart(c => [...c, {
      _key: nextKey(),
      item_type: 'pos_balance' as CartItemType,
      description: `Balance — ${label}`,
      quantity: 1,
      unit_price: balanceDue.toFixed(2),
      tax_rate: 0,
      inventory_item_id: sale.id,   // stores the original pos_sale_id
      wig_balance_due: balanceDue,
    }])
  }

  function addWigBalanceToCart(wig: WigOrder) {
    const balanceDue = Number(wig.balance_due)
    const label = [wig.brand, wig.daysmart_serial, wig.length, wig.color].filter(Boolean).join(' · ') || 'Wig'
    setCart(c => [...c, {
      _key: nextKey(),
      item_type: 'wig_balance',
      description: `Balance — ${label}`,
      quantity: 1,
      unit_price: balanceDue.toFixed(2),
      tax_rate: 0,
      inventory_item_id: wig.id,
      wig_balance_due: balanceDue,
    }])
  }

  function loadPendingCart() {
    const TYPE_MAP: Record<string, CartItemType> = { wig: 'wig', product: 'inventory', service: 'repair' }
    const newItems: CartItem[] = unloadedPending.map(p => ({
      _key: nextKey(),
      item_type: TYPE_MAP[p.item_type] ?? 'repair',
      description: p.description,
      quantity: 1,
      unit_price: p.price.toFixed(2),
      tax_rate: p.tax_rate,
      notes: p.notes,
      inventory_item_id: p.inventory_item_id,
      ...(p.item_type === 'wig' ? {
        showWigSpecs: true,
        wig_serial: p.wig_serial,
        wig_brand:  p.wig_brand,
        wig_length: p.wig_length,
        wig_color:  p.wig_color,
        wig_size:   p.wig_size,
        wig_front:  p.wig_front,
      } : {}),
    }))
    setCart(c => [...c, ...newItems])
    setLoadedPendingIds(ids => [...ids, ...unloadedPending.map(p => p.id)])
  }

  function updateItem(key: string, patch: Partial<CartItem>) {
    setCart(c => c.map(i => i._key === key ? { ...i, ...patch } : i))
  }

  function removeItem(key: string) {
    setCart(c => c.filter(i => i._key !== key))
  }

  // ── Payment helpers ───────────────────────────────────────

  function addPaymentRow() {
    setPayments(p => [...p, { _key: nextKey(), payment_method: 'cash', amount: '' }])
  }

  function updatePayment(key: string, patch: Partial<Payment>) {
    setPayments(p => p.map(r => r._key === key ? { ...r, ...patch } : r))
  }

  function removePayment(key: string) {
    setPayments(p => p.filter(r => r._key !== key))
  }

  // ── Totals ────────────────────────────────────────────────

  const cartTotal = cart.reduce((s, i) => {
    const price = parseFloat(i.unit_price) || 0
    return s + price * i.quantity
  }, 0)

  const shippingAmount   = shipping.enabled ? (parseFloat(shipping.amount) || 0) : 0
  const discountAmount   = parseFloat(discount) || 0

  // Tax is per-item; discount reduces the taxable base proportionally across items
  const taxableCartTotal = Math.max(0, cartTotal - discountAmount)
  const discountRatio    = cartTotal > 0 ? taxableCartTotal / cartTotal : 1
  const taxAmount = cart.reduce((s, i) => {
    const price = parseFloat(i.unit_price) || 0
    const taxablePrice = price * i.quantity * discountRatio
    return s + Math.round(taxablePrice * (i.tax_rate || 0) * 100) / 100
  }, 0)
  const grandTotal       = Math.max(0, cartTotal - discountAmount + taxAmount + shippingAmount)

  const paymentsTotal    = payments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0)
  const effectivePaid    = paymentsTotal
  const balanceDue       = grandTotal - effectivePaid

  // Auto-fill the single payment row from the grand total.
  // This eliminates the double-entry perception: Tzipora sets the amount in
  // the cart (or edits the wig_balance item), and the Payment field syncs.
  // She only needs to pick the payment method.
  // Split payments (multiple rows) are left alone — user controls each.
  useEffect(() => {
    if (payments.length !== 1) return
    const filled = grandTotal > 0 ? grandTotal.toFixed(2) : ''
    setPayments(prev => [{ ...prev[0], amount: filled }])
  }, [grandTotal]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Save ──────────────────────────────────────────────────

  function handleSave() {
    if (!customer.name.trim()) return
    if (cart.length === 0) return

    const regularItems  = cart.filter(i => i.item_type !== 'wig_balance' && i.item_type !== 'pos_balance')
    const balanceItems  = cart.filter(i => i.item_type === 'wig_balance')
    const posBalItems   = cart.filter(i => i.item_type === 'pos_balance')

    const pmts = payments
      .filter(p => parseFloat(p.amount) > 0)
      .map(p => ({ payment_method: p.payment_method, amount: parseFloat(p.amount) }))

    const primaryMethod = pmts[0]?.payment_method || 'cash'

    // Derive wig deposit from the Payment section:
    // total collected - non-wig subtotal = amount going toward wig(s)
    const nonWigSubtotal = regularItems
      .filter(i => i.item_type !== 'wig')
      .reduce((s, i) => s + (parseFloat(i.unit_price) || 0) * i.quantity, 0)
    const totalCollected = pmts.reduce((s, p) => s + p.amount, 0)
    const wigDepositPool = Math.max(0, totalCollected - nonWigSubtotal)

    const wigItems = regularItems.filter(i => i.item_type === 'wig')
    const totalWigSubtotal = wigItems.reduce((s, i) => s + (parseFloat(i.unit_price) || 0) * i.quantity, 0)

    const items = regularItems.map(i => {
      const subtotal = (parseFloat(i.unit_price) || 0) * i.quantity
      // Allocate deposit proportionally across wigs
      const wigDeposit = i.item_type === 'wig' && totalWigSubtotal > 0
        ? wigDepositPool * (subtotal / totalWigSubtotal)
        : undefined

      return {
        item_type: i.item_type,
        description: i.description,
        quantity: i.quantity,
        unit_price: parseFloat(i.unit_price) || 0,
        subtotal,
        tax_rate: i.tax_rate || 0,
        notes: i.notes || undefined,
        inventory_item_id: i.inventory_item_id || undefined,
        wig_serial: i.wig_serial || undefined,
        wig_brand: i.wig_brand || undefined,
        wig_length: i.wig_length || undefined,
        wig_color: i.wig_color || undefined,
        wig_size: i.wig_size || undefined,
        wig_front: i.wig_front || undefined,
        wig_deposit_amount: wigDeposit,
        wig_deposit_method: i.item_type === 'wig' ? primaryMethod : undefined,
      }
    })

    saveMutation.mutate({
      customer_id: customer.id || undefined,
      customer_name: customer.name.trim(),
      customer_phone: customer.phone || undefined,
      sale_date: saleDate,
      tax_rate: 0,
      tax_amount_override: taxAmount || undefined,
      discount_amount: discountAmount || undefined,
      shipping_amount: shippingAmount,
      shipping_address: shipping.enabled && shipping.address ? shipping.address : undefined,
      items,
      payments: pmts,
      wig_balance_payments: balanceItems.map(i => ({
        inventory_item_id: i.inventory_item_id,
        amount: parseFloat(i.unit_price) || 0,
        payment_method: primaryMethod,
      })),
      pos_balance_payments: posBalItems.map(i => ({
        pos_sale_id: i.inventory_item_id,
        amount: parseFloat(i.unit_price) || 0,
        payment_method: primaryMethod,
      })),
    })
  }

  const canSave = customer.name.trim() && cart.length > 0 && !saveMutation.isPending

  return (
    <div style={s.pageLayout}>

      {/* ── Left: Form ── */}
      <div style={s.leftPanel}>
        <h1 style={s.title}>Point of Sale</h1>
        <p style={s.subtitle}>Build the cart, record payment, generate receipt</p>

        {/* Date */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <label style={s.fieldLabel}>Sale Date</label>
          <input type="date" value={saleDate} onChange={e => setSaleDate(e.target.value)}
            style={{ ...s.input, width: 160 }} />
        </div>

        {/* ── Customer ── */}
        <Section title="Customer">
          <CustomerSearchField
            customer={customer}
            onSelect={c => setCustomer({ id: c.id, name: `${c.last_name}, ${c.first_name}`, phone: c.cell || c.phone || '' })}
            onClear={() => setCustomer(emptyCustomer())}
            onType={v => setCustomer(p => ({ ...p, name: v, id: '' }))}
          />
          {customer.name && (
            <input value={customer.phone} onChange={e => setCustomer(p => ({ ...p, phone: e.target.value }))}
              style={{ ...s.input, marginTop: 8 }} placeholder="Phone / cell" />
          )}
        </Section>

        {/* ── Pending cart from Sales dept ── */}
        {unloadedPending.length > 0 && (
          <div style={s.pendingBanner}>
            <div style={s.pendingBannerLeft}>
              <CreditCard size={14} color="#5581B1" />
              <span style={s.pendingBannerText}>
                <strong>{unloadedPending.length} item{unloadedPending.length !== 1 ? 's' : ''}</strong> waiting from Sales
              </span>
              <span style={s.pendingBannerItems}>
                {unloadedPending.map(p => p.description).join(' · ')}
              </span>
            </div>
            <button style={s.pendingBannerBtn} onClick={loadPendingCart}>
              Load to Cart
            </button>
          </div>
        )}

        {/* ── Open wig balances for this customer ── */}
        {customer.id && (
          <OpenBalancePanel
            customerId={customer.id}
            cart={cart}
            onAdd={addWigBalanceToCart}
          />
        )}

        {/* ── Open product/service balances for this customer ── */}
        {customer.id && (
          <OpenPosSaleBalancePanel
            customerId={customer.id}
            cart={cart}
            onAdd={addPosBalanceToCart}
          />
        )}

        {/* ── Cart ── */}
        <Section title="Cart">
          {cart.length === 0 ? (
            <div style={s.emptyCart}>
              {customer.id
                ? 'No items yet — add items from the Sales page'
                : 'Select a customer to begin'}
            </div>
          ) : (
            <div style={s.cartList}>
              {cart.map(item => (
                <CartRow
                  key={item._key}
                  item={item}
                  onChange={patch => updateItem(item._key, patch)}
                  onRemove={() => removeItem(item._key)}
                />
              ))}
              <div style={s.cartTotal}>
                <span style={{ color: '#71717a' }}>Subtotal</span>
                <span style={{ fontWeight: 700, fontSize: 18 }}>${cartTotal.toFixed(2)}</span>
              </div>
            </div>
          )}

          {/* Discount */}
          {cart.length > 0 && (
            <div style={s.discountRow}>
              <span style={s.discountLabel}>Discount</span>
              <div style={{ ...s.moneyRow, width: 140 }}>
                <span style={s.moneySym}>-$</span>
                <input
                  type="number" min="0" step="0.01"
                  value={discount}
                  onChange={e => setDiscount(e.target.value)}
                  style={s.moneyInput}
                  placeholder="0.00"
                />
              </div>
            </div>
          )}
        </Section>

        {/* ── Shipping ── */}
        <Section title="Shipping">
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
            <input
              type="checkbox"
              checked={shipping.enabled}
              onChange={e => setShipping(s => ({ ...s, enabled: e.target.checked }))}
            />
            Ship this order
          </label>
          {shipping.enabled && (
            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input
                value={shipping.address}
                onChange={e => setShipping(s => ({ ...s, address: e.target.value }))}
                style={s.input}
                placeholder="Shipping address"
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <label style={s.fieldLabel}>Shipping cost</label>
                <div style={{ ...s.moneyRow, width: 130 }}>
                  <span style={s.moneySym}>$</span>
                  <input
                    type="number" min="0" step="0.01"
                    value={shipping.amount}
                    onChange={e => setShipping(s => ({ ...s, amount: e.target.value }))}
                    style={s.moneyInput} placeholder="0.00"
                  />
                </div>
              </div>
            </div>
          )}
        </Section>

        {/* ── Payments ── */}
        <Section title="Payment">
          {payments.map((p) => (
            <div key={p._key} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
              <select value={p.payment_method} onChange={e => updatePayment(p._key, { payment_method: e.target.value })}
                style={{ ...s.select, flex: '0 0 160px' }}>
                {METHODS.map(m => <option key={m} value={m}>{METHOD_LABEL[m]}</option>)}
              </select>
              <div style={{ ...s.moneyRow, flex: 1 }}>
                <span style={s.moneySym}>$</span>
                <input type="number" min="0" step="0.01" value={p.amount}
                  onChange={e => updatePayment(p._key, { amount: e.target.value })}
                  style={s.moneyInput} placeholder="0.00" />
              </div>
              {payments.length > 1 && (
                <button onClick={() => removePayment(p._key)} style={s.iconBtn}><X size={13} /></button>
              )}
            </div>
          ))}
          <button onClick={addPaymentRow} style={s.addSplitBtn}>
            <Plus size={12} /> Split payment
          </button>

          {/* Tax is set per-item in the cart */}
          {taxAmount > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, fontSize: 13, color: '#71717a' }}>
              <span>Sales Tax (per item)</span>
              <span style={{ fontWeight: 600, color: '#18181b' }}>+${taxAmount.toFixed(2)}</span>
            </div>
          )}

          {/* Balance indicator */}
          {grandTotal > 0 && (
            <div style={s.balanceRow}>
              <span style={{ color: '#71717a', fontSize: 13 }}>Paid</span>
              <span style={{ fontWeight: 600 }}>${effectivePaid.toFixed(2)}</span>
              <span style={{ color: '#71717a', fontSize: 13, marginLeft: 16 }}>
                {balanceDue > 0 ? 'Balance due' : balanceDue < 0 ? 'Overpaid' : 'Paid in full ✓'}
              </span>
              {balanceDue !== 0 && (
                <span style={{ fontWeight: 700, color: balanceDue > 0 ? '#DF5198' : '#10b981' }}>
                  ${Math.abs(balanceDue).toFixed(2)}
                </span>
              )}
            </div>
          )}
        </Section>

        {/* Total */}
        {grandTotal > 0 && (
          <Section title="Total (incl. tax)">
            <div style={s.totalBox}>
              <div style={s.totalRow}>
                <span>Subtotal</span>
                <span>${cartTotal.toFixed(2)}</span>
              </div>
              {taxAmount > 0 && (
                <div style={s.totalRow}>
                  <span>Tax</span>
                  <span>${taxAmount.toFixed(2)}</span>
                </div>
              )}
              {shippingAmount > 0 && (
                <div style={s.totalRow}>
                  <span>Shipping</span>
                  <span>${shippingAmount.toFixed(2)}</span>
                </div>
              )}
              {discountAmount > 0 && (
                <div style={{ ...s.totalRow, color: '#10b981' }}>
                  <span>Discount</span>
                  <span>-${discountAmount.toFixed(2)}</span>
                </div>
              )}
              <div style={{ ...s.totalRow, ...s.totalGrand }}>
                <span>Grand Total</span>
                <span>${grandTotal.toFixed(2)}</span>
              </div>
            </div>
          </Section>
        )}

        <button onClick={handleSave} disabled={!canSave} style={s.saveBtn}>
          {saveMutation.isPending ? 'Saving…' : 'Save Sale'}
        </button>
        {!customer.name.trim() && cart.length === 0 && (
          <p style={s.saveHint}>Add a customer and at least one item to save</p>
        )}
        {saveMutation.isError && (
          <p style={{ color: '#ef4444', fontSize: 12, marginTop: 6 }}>Save failed — please try again.</p>
        )}
      </div>

      {/* ── Right: Today's Sales ── */}
      <div style={s.rightPanel}>
        <h2 style={s.sidePanelTitle}>Sales — {fmtDate(saleDate)}</h2>
        <p style={s.sidePanelSub}>
          {new Date(saleDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
        </p>

        {todaySales.length === 0 ? (
          <p style={s.emptyText}>No sales recorded today yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {todaySales.map(sale => (
              <TodaySaleCard
                key={sale.id}
                sale={sale}
                onReceipt={() => setReceiptSale(sale)}
                canDelete={canDelete}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Receipt Modal ── */}
      {receiptSale && (
        <ReceiptModal sale={receiptSale} balanceItems={receiptBalanceItems} onClose={() => setReceiptSale(null)} />
      )}
    </div>
  )
}

// ── Cart Row ──────────────────────────────────────────────────
// Checkout-only: items come pre-filled from the Sales / Repairs dept.
// Price is locked (read-only). Tax can be toggled exempt. Amount editable for wig_balance only.

function CartRow({ item, onChange, onRemove }: {
  item: CartItem
  onChange: (patch: Partial<CartItem>) => void
  onRemove: () => void
}) {
  const price    = parseFloat(item.unit_price) || 0
  const subtotal = price * item.quantity
  const taxAmt   = Math.round(subtotal * (item.tax_rate || 0) * 100) / 100
  const isBalance = item.item_type === 'wig_balance'
  const color    = ITEM_TYPE_COLOR[item.item_type]

  return (
    <div style={s.cartRow}>
      <div style={s.cartRowMain}>
        {/* Left: badge + description + notes */}
        <div style={s.cartRowLeft}>
          <span style={{ ...s.typeBadge, background: color + '22', color }}>
            {ITEM_TYPE_LABEL[item.item_type]}
          </span>
          <div>
            <div style={s.cartRowName}>{item.description}</div>
            {item.notes && <div style={s.cartRowNotes}>{item.notes}</div>}
          </div>
        </div>

        {/* Right: price + tax badge + remove */}
        <div style={s.cartRowRight}>
          {isBalance ? (
            <div style={{ ...s.moneyRow, width: 110 }}>
              <span style={s.moneySym}>$</span>
              <input
                type="number" min="0" step="0.01"
                value={item.unit_price}
                onChange={e => onChange({ unit_price: e.target.value })}
                style={s.moneyInput} placeholder="0.00"
              />
            </div>
          ) : (
            <span style={s.cartRowPrice}>${subtotal.toFixed(2)}</span>
          )}

          {!isBalance && (
            <button
              onClick={() => onChange({ tax_rate: item.tax_rate > 0 ? 0 : DEFAULT_TAX_RATE[item.item_type] })}
              style={item.tax_rate > 0 ? s.taxBadgeActive : s.taxBadgeExempt}
              title={item.tax_rate > 0 ? 'Click to exempt' : 'Click to apply tax'}
            >
              {item.tax_rate > 0
                ? `${(item.tax_rate * 100).toFixed(3).replace(/\.?0+$/, '')}%`
                : 'Exempt'}
            </button>
          )}

          <button onClick={onRemove} style={s.iconBtn}><Trash2 size={13} /></button>
        </div>
      </div>

      {/* Tax line */}
      {!isBalance && item.tax_rate > 0 && taxAmt > 0 && (
        <div style={s.cartRowTax}>Tax: +${taxAmt.toFixed(2)}</div>
      )}

      {/* Partial balance note */}
      {isBalance && item.wig_balance_due && price < item.wig_balance_due && price > 0 && (
        <div style={s.cartRowTax}>
          Partial — ${(item.wig_balance_due - price).toFixed(2)} remains open
        </div>
      )}
    </div>
  )
}

// ── Customer Search ───────────────────────────────────────────

function CustomerSearchField({ customer, onSelect, onClear, onType }: {
  customer: { id: string; name: string; phone: string }
  onSelect: (c: Customer) => void
  onClear: () => void
  onType: (v: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [showNew, setShowNew] = useState(false)
  const showNewRef = useRef(false)
  const [newFirst, setNewFirst] = useState('')
  const [newLast, setNewLast] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const qc = useQueryClient()

  function openNewForm() { showNewRef.current = true; setShowNew(true) }
  function closeNewForm() { showNewRef.current = false; setShowNew(false) }

  const { data: results = [] } = useQuery<Customer[]>({
    queryKey: ['customer-search-pos', query],
    queryFn: () => query.length >= 2
      ? api.get('/customers/', { params: { search: query, limit: 8 } }).then(r => r.data).catch(() => [])
      : Promise.resolve([]),
    enabled: query.length >= 2,
  })

  const createCustomerMutation = useMutation({
    mutationFn: (data: object) => api.post('/customers/', data),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['customer-search-pos'] })
      qc.invalidateQueries({ queryKey: ['customers'] })
      onSelect(res.data)
      closeNewForm(); setNewFirst(''); setNewLast(''); setNewPhone('')
      setOpen(false); setQuery('')
    },
  })

  if (customer.id) {
    return (
      <div style={s.customerLocked}>
        <div>
          <span style={{ fontWeight: 600, fontSize: 13 }}>{customer.name}</span>
          <span style={{ fontSize: 11, color: '#10b981', marginLeft: 8 }}>Linked</span>
        </div>
        <button onClick={onClear} style={s.iconBtn}><X size={13} /></button>
      </div>
    )
  }

  return (
    <div style={{ position: 'relative' }}>
      <div style={s.searchRow}>
        <Search size={14} color="#a1a1aa" style={{ flexShrink: 0 }} />
        <input
          value={open ? query : customer.name}
          onChange={e => { setQuery(e.target.value); onType(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => { if (!showNewRef.current) setOpen(false) }, 180)}
          style={{ ...s.input, border: 'none', flex: 1, padding: '0 4px' }}
          placeholder="Search by name, or type a new name…"
        />
      </div>

      {open && query.length >= 2 && (
        <div style={s.dropdown}>
          {results.map(c => (
            <button key={c.id} onMouseDown={() => { onSelect(c); setOpen(false); setQuery('') }} style={s.dropdownItem}>
              <span style={{ fontWeight: 600 }}>{c.last_name}, {c.first_name}</span>
              {(c.cell || c.phone) && <span style={{ color: '#71717a', fontSize: 11 }}>{c.cell || c.phone}</span>}
            </button>
          ))}
          {!showNew && (
            <button onMouseDown={() => openNewForm()} style={{ ...s.dropdownItem, color: '#5581B1', fontWeight: 600 }}>
              <Plus size={13} /> Add "{query}" as new customer
            </button>
          )}
          {showNew && (
            <div style={{ padding: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                <input value={newFirst} onChange={e => setNewFirst(e.target.value)}
                  style={s.input} placeholder="First name" />
                <input value={newLast} onChange={e => setNewLast(e.target.value)}
                  style={s.input} placeholder="Last name *" />
              </div>
              <input value={newPhone} onChange={e => setNewPhone(e.target.value)}
                style={{ ...s.input, marginBottom: 8, width: '100%', boxSizing: 'border-box' }}
                placeholder="Phone / cell" />
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onMouseDown={() => {
                    if (!newLast.trim()) return
                    createCustomerMutation.mutate({
                      first_name: newFirst.trim() || query,
                      last_name: newLast.trim(),
                      phone: newPhone || undefined,
                    })
                  }}
                  disabled={createCustomerMutation.isPending || !newLast.trim()}
                  style={{ ...s.primaryBtn, fontSize: 12, padding: '6px 12px' }}
                >
                  {createCustomerMutation.isPending ? 'Saving…' : 'Save Customer'}
                </button>
                <button onMouseDown={() => { closeNewForm(); setOpen(false) }} style={{ ...s.ghostBtn, fontSize: 12, padding: '6px 12px' }}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}


// ── Today Sale Card ───────────────────────────────────────────

function TodaySaleCard({ sale, onReceipt, canDelete }: { sale: PosSale; onReceipt: () => void; canDelete: boolean }) {
  const [expanded, setExpanded] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deleteReason, setDeleteReason] = useState('')
  const hasPayment = sale.amount_paid > 0
  const qc = useQueryClient()

  const deleteMutation = useMutation({
    mutationFn: (reason: string) => api.delete(`/pos-sales/${sale.id}`, { data: { reason } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pos-sales-today'] })
      qc.invalidateQueries({ queryKey: ['wig-orders-all'] })
      qc.invalidateQueries({ queryKey: ['inventory'] })
      qc.invalidateQueries({ queryKey: ['operation-overview'] })
      setShowDeleteDialog(false)
      setDeleteReason('')
    },
  })

  return (
    <div style={s.saleCard}>
      <div style={s.saleCardTop} onClick={() => setExpanded(v => !v)}>
        <div style={{ flex: 1 }}>
          <span style={s.saleCardName}>{sale.customer_name}</span>
          <span style={s.saleCardMeta}>
            {sale.items.map(i => ITEM_TYPE_LABEL[i.item_type]).join(' · ')}
          </span>
        </div>
        <div style={{ textAlign: 'right', marginRight: 8 }}>
          <span style={s.saleCardPrice}>${Number(sale.total_amount).toFixed(2)}</span>
          {sale.balance_due > 0 && (
            <span style={s.saleCardBalance}>Due ${Number(sale.balance_due).toFixed(2)}</span>
          )}
        </div>
        {expanded ? <ChevronUp size={14} color="#a1a1aa" /> : <ChevronDown size={14} color="#a1a1aa" />}
      </div>

      {expanded && (
        <div style={s.saleCardExpanded}>
          {sale.items.map(item => (
            <div key={item.id} style={s.miniRow}>
              <span style={{ ...s.typeBadge, ...{ fontSize: 10 }, background: ITEM_TYPE_COLOR[item.item_type] + '22', color: ITEM_TYPE_COLOR[item.item_type] }}>
                {ITEM_TYPE_LABEL[item.item_type]}
              </span>
              <span style={{ fontSize: 12, flex: 1 }}>{item.description}</span>
              <span style={{ fontSize: 12, fontWeight: 600 }}>${item.subtotal.toFixed(2)}</span>
            </div>
          ))}
          <div style={{ borderTop: '1px solid rgba(0,0,0,0.05)', paddingTop: 6, marginTop: 4 }}>
            {sale.payments.map(p => (
              <div key={p.id} style={s.miniRow}>
                <span style={{ fontSize: 11, color: '#71717a', flex: 1 }}>{METHOD_LABEL[p.payment_method] || p.payment_method}</span>
                <span style={{ fontSize: 12, fontWeight: 600 }}>${p.amount.toFixed(2)}</span>
              </div>
            ))}
          </div>

          {/* Delete — bookkeeper + owner only */}
          {canDelete && (
            <button onClick={() => setShowDeleteDialog(true)} style={s.deleteBtn}>
              <Trash2 size={12} /> Delete Sale
            </button>
          )}

          {/* Delete dialog */}
          {showDeleteDialog && (
            <div style={s.deleteDialog} onClick={e => e.stopPropagation()}>
              <div style={s.deleteDialogInner}>
                <div style={s.deleteDialogTitle}>
                  <Trash2 size={14} color="#ef4444" />
                  Delete this sale?
                </div>
                <p style={s.deleteDialogWarn}>
                  This will permanently remove the sale and restore any wigs to inventory. This cannot be undone.
                </p>
                <label style={s.deleteDialogLabel}>Reason for deletion *</label>
                <textarea
                  style={s.deleteDialogTextarea}
                  placeholder="e.g. Entered in error, duplicate entry…"
                  rows={3}
                  value={deleteReason}
                  onChange={e => setDeleteReason(e.target.value)}
                  autoFocus
                />
                <div style={s.deleteDialogActions}>
                  <button
                    style={s.ghostBtn}
                    onClick={() => { setShowDeleteDialog(false); setDeleteReason('') }}
                  >
                    Cancel
                  </button>
                  <button
                    style={{ ...s.deleteConfirmBtn, opacity: (!deleteReason.trim() || deleteMutation.isPending) ? 0.5 : 1 }}
                    disabled={!deleteReason.trim() || deleteMutation.isPending}
                    onClick={() => deleteMutation.mutate(deleteReason.trim())}
                  >
                    {deleteMutation.isPending ? 'Deleting…' : 'Delete Sale'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {hasPayment && (
        <div style={s.saleCardFooter}>
          <button onClick={onReceipt} style={s.receiptBtn}>
            <Printer size={13} /> Receipt
          </button>
        </div>
      )}
    </div>
  )
}

// ── Open Balance Panel ────────────────────────────────────────
// Shows a customer's open wig balances. Clicking "Add to Cart"
// adds a wig_balance cart item — amount editable, no tax, logs payment on save.

function OpenBalancePanel({ customerId, cart, onAdd }: {
  customerId: string
  cart: CartItem[]
  onAdd: (wig: WigOrder) => void
}) {
  const { data: openWigs = [], isLoading } = useQuery<WigOrder[]>({
    queryKey: ['pending-wigs', customerId],
    queryFn: () =>
      api.get('/wig-orders/', { params: { customer_id: customerId } })
        .then(r => (Array.isArray(r.data) ? r.data : []).filter((w: WigOrder) => w.sale_status !== 'paid_in_full'))
        .catch(() => []),
    enabled: !!customerId,
  })

  if (isLoading || openWigs.length === 0) return null

  return (
    <div style={s.pendingPanel}>
      <p style={s.pendingTitle}>
        <CreditCard size={13} style={{ marginRight: 6 }} />
        Open Wig Balances — {openWigs.length}
      </p>
      {openWigs.map(wig => {
        const balance = Number(wig.balance_due)
        const wigName = [wig.brand, wig.daysmart_serial, wig.length, wig.color].filter(Boolean).join(' · ') || 'Wig order'
        const inCart  = cart.some(i => i.item_type === 'wig_balance' && i.inventory_item_id === wig.id)

        return (
          <div key={wig.id} style={s.pendingRow}>
            <div style={{ flex: 1 }}>
              <div style={s.pendingWigName}>{wigName}</div>
              <div style={s.pendingWigMeta}>
                Total ${Number(wig.total_price).toFixed(2)} · Paid ${Number(wig.amount_paid).toFixed(2)}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={s.pendingBalance}>Due ${balance.toFixed(2)}</span>
              {inCart ? (
                <span style={{ fontSize: 11, color: '#10b981', fontWeight: 600 }}>In cart ✓</span>
              ) : (
                <button onClick={() => onAdd(wig)} style={s.payBalanceBtn}>Add to Cart</button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Open POS Sale Balance Panel ───────────────────────────────
// Shows open balances on product/service sales (balance_due > 0).
// Same UX as OpenBalancePanel but for regular POS sales.

function OpenPosSaleBalancePanel({ customerId, cart, onAdd }: {
  customerId: string
  cart: CartItem[]
  onAdd: (sale: PosOpenBalance) => void
}) {
  const { data: openSales = [], isLoading } = useQuery<PosOpenBalance[]>({
    queryKey: ['pos-open-balances', customerId],
    queryFn: () =>
      api.get(`/pos-sales/open-balances/customer/${customerId}`)
        .then(r => Array.isArray(r.data) ? r.data : [])
        .catch(() => []),
    enabled: !!customerId,
    staleTime: 0,
  })

  if (isLoading || openSales.length === 0) return null

  return (
    <div style={s.pendingPanel}>
      <p style={s.pendingTitle}>
        <CreditCard size={13} style={{ marginRight: 6 }} />
        Open Sale Balances — {openSales.length}
      </p>
      {openSales.map(sale => {
        const balance  = Number(sale.balance_due)
        const label    = sale.items.map(i => i.description).join(', ') || `Sale ${sale.sale_date}`
        const inCart   = cart.some(i => i.item_type === 'pos_balance' && i.inventory_item_id === sale.id)

        return (
          <div key={sale.id} style={s.pendingRow}>
            <div style={{ flex: 1 }}>
              <div style={s.pendingWigName}>{label}</div>
              <div style={s.pendingWigMeta}>
                {sale.sale_date} · Total ${Number(sale.total_amount).toFixed(2)} · Paid ${Number(sale.amount_paid).toFixed(2)}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={s.pendingBalance}>Due ${balance.toFixed(2)}</span>
              {inCart ? (
                <span style={{ fontSize: 11, color: '#10b981', fontWeight: 600 }}>In cart ✓</span>
              ) : (
                <button onClick={() => onAdd(sale)} style={s.payBalanceBtn}>Add to Cart</button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}


// ── Receipt Modal ─────────────────────────────────────────────

function ReceiptModal({ sale, balanceItems = [], onClose }: { sale: PosSale; balanceItems?: CartItem[]; onClose: () => void }) {
  const printRef = useRef<HTMLDivElement>(null)

  function handlePrint() {
    if (!printRef.current) return
    const origin = window.location.origin
    // Fix relative image URLs so they resolve in the detached print window
    const content = printRef.current.innerHTML
      .replace(/src="\/([^"]+)"/g, `src="${origin}/$1"`)

    const hasWigDeposit = sale.items.some(i => i.item_type === 'wig')
    const page2 = hasWigDeposit ? `
      <div style="page-break-before:always;font-family:Arial,sans-serif;padding:32px;color:#000;font-size:13px;">
        <div style="text-align:center;font-weight:bold;margin-bottom:14px;">
          Chani Kramer Wigs Salon &nbsp;&#42;&nbsp; 1474 60<sup>th</sup> Street Brooklyn, NY 11219 &nbsp;&#42;&nbsp; 718.676.6003
        </div>
        <p style="font-style:italic;font-size:12px;margin-bottom:20px;">
          'By giving a deposit and signing this agreement, you are acknowledging and agreeing to Chani Kramer's Salon Policies.
        </p>
        <h1 style="text-decoration:underline;font-size:26px;font-weight:900;margin-bottom:18px;">
          ALL DEPOSITS ARE NON-REFUNDABLE!
        </h1>
        <p style="font-size:12px;margin-bottom:14px;">
          Each wig purchase includes 1 cut and 1 fix-cut within 6 months of the first cut. The fix cut does not include a wash and set. COLOR IS NEVER INCLUDED!
        </p>
        <ul style="margin:0 0 14px 0;padding:0;list-style:none;font-size:12px;">
          <li style="margin-bottom:8px;">&#10022; <strong>Rochi Lipsker</strong> is covered under warranty for one year, but color is only covered for 6 months.</li>
          <li style="margin-bottom:8px;">&#10022; <strong>Bk Wigs</strong> are under warranty for one year, but only 3 months on the lace.</li>
          <li style="margin-bottom:8px;">&#10022; <strong>Rina, Rina Elite, and Sary Wigs</strong> are covered for 6 months for manufacturing defects only. YOU HAVE 3 MONTHS TO BRING THE WIG IN SO WE CAN SEND IT TO THE FACTORY!</li>
          <li style="margin-bottom:8px;">&#10022; <strong>Rina Feather wigs are not covered by any warranty! All rips and tears are normal wear and tear!</strong></li>
          <li style="margin-bottom:8px;">&#10022; <strong>Rina, Rina Elite, and Sary Wigs</strong> are covered for 2 months under the salon warranty for any lace repairs. <em>(Brides have 2 months from their wedding date.)</em></li>
          <li style="margin-bottom:8px;">&#10022; <strong>Zchava Wigs</strong> are covered for 6 months.</li>
        </ul>
        <p style="font-size:12px;margin-bottom:10px;">All warranties go into effect from the date of full payment.</p>
        <p style="font-size:12px;margin-bottom:36px;">If you purchase a wig at Chani Kramer, and have it cut elsewhere, we are no longer responsible for anything that happens to the wig, regardless of when it was purchased.</p>
        <table style="width:100%;border-collapse:collapse;margin-bottom:32px;">
          <tr><td style="padding:10px 0;border-bottom:1px solid #000;font-weight:bold;width:120px;">Last Name:</td><td style="border-bottom:1px solid #000;"></td></tr>
          <tr><td style="height:12px;"></td></tr>
          <tr><td style="padding:10px 0;border-bottom:1px solid #000;font-weight:bold;">First Name:</td><td style="border-bottom:1px solid #000;"></td></tr>
          <tr><td style="height:12px;"></td></tr>
          <tr><td style="padding:10px 0;border-bottom:1px solid #000;font-weight:bold;">Signature:</td><td style="border-bottom:1px solid #000;min-height:36px;"></td></tr>
          <tr><td style="height:12px;"></td></tr>
          <tr><td style="padding:10px 0;border-bottom:1px solid #000;font-weight:bold;">Date:</td><td style="border-bottom:1px solid #000;"></td></tr>
        </table>
        <p style="font-size:11px;font-style:italic;margin-bottom:24px;">
          This is a legally binding contract. Chani Kramer Wigs Salon reserves the right to make adjustments to this contract at any time. PRICES ARE SUBJECT TO CHANGE AT ANY POINT, REGARDLESS OF THE PRICE THAT WAS QUOTED. All rights reserved.
        </p>
        <div style="text-align:center;font-weight:bold;border-top:1px solid #000;padding-top:12px;">
          Chani Kramer Wigs Salon &nbsp;&#42;&nbsp; 1474 60<sup>th</sup> Street Brooklyn, NY 11219 &nbsp;&#42;&nbsp; 718.676.6003
        </div>
      </div>` : ''

    const win = window.open('', '_blank', 'width=700,height=960')
    if (!win) return
    win.document.write(`
      <html>
        <head>
          <title>Receipt — ${sale.customer_name}</title>
          <style>
            * { margin:0; padding:0; box-sizing:border-box; }
            body { font-family: Arial, sans-serif; font-size: 13px; color: #000; padding: 32px; }
            table { width: 100%; border-collapse: collapse; }
            th { background: #222; color: #fff; padding: 5px 8px; text-align: left; font-size: 11px; }
            td { padding: 5px 8px; border-bottom: 1px solid #eee; font-size: 12px; }
            .balance-box { background: #222; color: #fff; padding: 4px 10px; font-weight: 700; font-size: 14px; display:inline-block; }
            .paid-box { background: #10b981; color: #fff; padding: 4px 10px; font-weight: 700; font-size: 14px; display:inline-block; }
            img { max-height: 60px; width: auto; }
          </style>
        </head>
        <body>${content}${page2}</body>
      </html>
    `)
    win.document.close()
    win.focus()
    setTimeout(() => { win.print(); win.close() }, 400)
  }

  const total          = Number(sale.total_amount)
  const paid           = Number(sale.amount_paid)
  const balance        = Number(sale.balance_due)
  const wigStillOwed   = balanceItems.reduce((sum, i) => {
    const paid = parseFloat(i.unit_price) || 0
    const due  = i.wig_balance_due ?? paid
    return sum + Math.max(0, due - paid)
  }, 0)

  return (
    <div style={s.modalOverlay} onClick={onClose}>
      <div style={s.modalBox} onClick={e => e.stopPropagation()}>

        <div style={s.modalHeader}>
          <span style={s.modalTitle}>Receipt — {sale.customer_name}</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handlePrint} style={s.printBtn}><Printer size={14} /> Print</button>
            <button onClick={onClose} style={s.iconBtn}><X size={16} /></button>
          </div>
        </div>

        <div ref={printRef} style={s.receiptBody}>

          {/* Salon header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <img src="/logo-mark.jpeg" alt="Chani Kramer Wigs Salon" style={{ height: 64, width: 'auto' }} />
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={r.receiptNum}>Receipt #: {sale.id.slice(0, 8).toUpperCase()}</div>
            </div>
          </div>

          {/* Date */}
          <div style={{ textAlign: 'right', marginBottom: 18, fontSize: 12 }}>
            Date: {fmtDate(sale.sale_date)}
          </div>

          {/* Customer */}
          <div style={{ marginBottom: 20 }}>
            <InfoRow label="Name"    value={sale.customer_name} />
            <InfoRow label="Address" value="" />
            <div style={{ height: 6 }} />
            <InfoRow label="Phone"   value={sale.customer_phone || ''} />
            <InfoRow label="Cell"    value="" />
          </div>

          {/* Wig items — dedicated spec table */}
          {sale.items.filter(i => i.item_type === 'wig').length > 0 && (
            <table style={{ marginBottom: 20 }}>
              <thead>
                <tr>
                  {['Wig', 'Brand', 'Length', 'Color', 'Size', 'Front', 'Total'].map(h => (
                    <th key={h} style={r.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sale.items.filter(i => i.item_type === 'wig').map(item => (
                  <tr key={item.id}>
                    <td style={r.td}>{item.wig_serial || item.description || '—'}</td>
                    <td style={r.td}>{item.wig_brand || '—'}</td>
                    <td style={r.td}>{item.wig_length || '—'}</td>
                    <td style={r.td}>{item.wig_color || '—'}</td>
                    <td style={r.td}>{item.wig_size || '—'}</td>
                    <td style={r.td}>{item.wig_front || '—'}</td>
                    <td style={{ ...r.td, textAlign: 'right', fontWeight: 700 }}>${item.subtotal.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Non-wig items table */}
          {sale.items.filter(i => i.item_type !== 'wig').length > 0 && (
            <table style={{ marginBottom: 16 }}>
              <thead>
                <tr>
                  <th style={r.th}>Type</th>
                  <th style={r.th}>Description</th>
                  <th style={{ ...r.th, textAlign: 'center' }}>Qty</th>
                  <th style={{ ...r.th, textAlign: 'right' }}>Price</th>
                  <th style={{ ...r.th, textAlign: 'right' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {sale.items.filter(i => i.item_type !== 'wig').map(item => (
                  <tr key={item.id}>
                    <td style={r.td}>{ITEM_TYPE_LABEL[item.item_type]}</td>
                    <td style={r.td}>{item.description}</td>
                    <td style={{ ...r.td, textAlign: 'center' }}>{item.quantity}</td>
                    <td style={{ ...r.td, textAlign: 'right' }}>${item.unit_price.toFixed(2)}</td>
                    <td style={{ ...r.td, textAlign: 'right', fontWeight: 700 }}>${item.subtotal.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Wig balance payments on this receipt */}
          {balanceItems.length > 0 && (
            <table style={{ marginBottom: 16 }}>
              <thead>
                <tr>
                  {['Wig Balance Payment', 'Paid', 'Still Owed'].map(h => (
                    <th key={h} style={r.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {balanceItems.map(i => {
                  const amtPaid   = parseFloat(i.unit_price) || 0
                  const due       = i.wig_balance_due ?? amtPaid
                  const stillOwed = Math.max(0, due - amtPaid)
                  return (
                    <tr key={i._key}>
                      <td style={r.td}>{i.description}</td>
                      <td style={{ ...r.td, fontWeight: 700, textAlign: 'right' }}>${amtPaid.toFixed(2)}</td>
                      <td style={{ ...r.td, fontWeight: 700, textAlign: 'right', color: stillOwed > 0 ? '#c0392b' : '#10b981' }}>
                        {stillOwed > 0 ? `$${stillOwed.toFixed(2)}` : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}

          {/* Payments + Summary */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 24 }}>
            {/* Payments table */}
            <div style={{ flex: 1 }}>
              {sale.payments.length > 0 && (
                <>
                  <div style={r.paymentsLabel}>Payments</div>
                  <table>
                    <thead>
                      <tr>
                        {['Method', 'Date', 'Amount'].map(h => (
                          <th key={h} style={{ ...r.th, fontSize: 10 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sale.payments.map(p => (
                        <tr key={p.id}>
                          <td style={r.td}>{METHOD_LABEL[p.payment_method] || p.payment_method}</td>
                          <td style={r.td}>{fmtDate(sale.sale_date)}</td>
                          <td style={r.td}>${Number(p.amount).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
              {sale.notes && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#555', marginBottom: 4 }}>Notes</div>
                  <div style={{ border: '1px solid #ccc', padding: '6px 8px', fontSize: 12 }}>{sale.notes}</div>
                </div>
              )}
            </div>

            {/* Totals */}
            <div style={{ minWidth: 170, textAlign: 'right' }}>
              {(sale.tax_amount > 0 || sale.shipping_amount > 0 || sale.discount_amount > 0) && (
                <>
                  <SummaryLine label="Subtotal:" value={`$${(total - sale.tax_amount - sale.shipping_amount + sale.discount_amount).toFixed(2)}`} />
                  <div style={{ height: 4 }} />
                </>
              )}
              {sale.discount_amount > 0 && (
                <>
                  <SummaryLine label="Discount:" value={`-$${sale.discount_amount.toFixed(2)}`} />
                  <div style={{ height: 4 }} />
                </>
              )}
              {sale.tax_amount > 0 && (
                <>
                  <SummaryLine label="NY Tax (4.5% svcs / 8.875% goods):" value={`$${sale.tax_amount.toFixed(2)}`} />
                  <div style={{ height: 4 }} />
                </>
              )}
              {sale.shipping_amount > 0 && (
                <>
                  <SummaryLine label="Shipping:" value={`$${sale.shipping_amount.toFixed(2)}`} />
                  <div style={{ height: 4 }} />
                </>
              )}
              <SummaryLine label="Total:" value={`$${total.toFixed(2)}`} />
              <div style={{ height: 8 }} />
              <SummaryLine label="Paid:" value={`$${paid.toFixed(2)}`} />
              <div style={{ height: 8 }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                <span style={{ fontWeight: 600, fontSize: 13 }}>Balance Due:</span>
                <span style={{ ...r.balanceBox, background: balance > 0 ? '#222' : '#10b981' }}>
                  ${balance > 0 ? balance.toFixed(2) : '0.00'}
                </span>
              </div>
              {wigStillOwed > 0 && (
                <>
                  <div style={{ height: 8 }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontWeight: 600, fontSize: 13, color: '#c0392b' }}>Wig Balance Remaining:</span>
                    <span style={{ ...r.balanceBox, background: '#c0392b' }}>
                      ${wigStillOwed.toFixed(2)}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Shipping address on receipt */}
          {sale.shipping_address && (
            <div style={{ marginTop: 12, padding: '8px 10px', border: '1px solid #eee', fontSize: 12 }}>
              <span style={{ fontWeight: 600 }}>Ship to: </span>{sale.shipping_address}
            </div>
          )}

          {/* Footer */}
          <div style={r.footer}>1474 60th st Brooklyn NY 11219&nbsp;&nbsp;(718) 676-6003</div>
        </div>
      </div>
    </div>
  )
}

// ── Tiny helpers ──────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={s.section}>
      <p style={s.sectionTitle}>{title}</p>
      {children}
    </div>
  )
}



function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 4, fontSize: 13 }}>
      <span style={{ fontWeight: 600, minWidth: 60 }}>{label}:</span>
      <span style={{ borderBottom: '1px solid #ccc', flex: 1, minWidth: 140 }}>{value}</span>
    </div>
  )
}

function SummaryLine({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
      <span style={{ fontWeight: 600, fontSize: 13 }}>{label}</span>
      <span style={{ fontSize: 14 }}>{value}</span>
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  pageLayout:    { display: 'grid', gridTemplateColumns: '1fr 360px', gap: 32, alignItems: 'flex-start' },
  leftPanel:     {},
  rightPanel:    { position: 'sticky', top: 24, background: '#fafaf9', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 16, padding: 20 },

  title:         { fontSize: 26, fontWeight: 700, color: '#18181b', margin: '0 0 4px', letterSpacing: '-0.03em' },
  subtitle:      { fontSize: 13, color: '#71717a', margin: '0 0 20px' },
  sidePanelTitle:{ fontSize: 16, fontWeight: 700, color: '#18181b', margin: '0 0 2px' },
  sidePanelSub:  { fontSize: 12, color: '#a1a1aa', margin: '0 0 14px' },

  section:       { marginBottom: 22 },
  sectionTitle:  { fontSize: 11, fontWeight: 700, color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 10px' },
  fieldLabel:    { fontSize: 11, fontWeight: 600, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 4 },

  input:         { padding: '8px 10px', border: '1px solid rgba(0,0,0,0.12)', borderRadius: 7, fontSize: 13, fontFamily: 'inherit', background: '#fff', outline: 'none', width: '100%', boxSizing: 'border-box' as const },
  select:        { padding: '8px 10px', border: '1px solid rgba(0,0,0,0.12)', borderRadius: 7, fontSize: 13, fontFamily: 'inherit', background: '#fff', outline: 'none', width: '100%', boxSizing: 'border-box' as const },
  moneyRow:      { display: 'flex', alignItems: 'center', border: '1px solid rgba(0,0,0,0.12)', borderRadius: 7, background: '#fff', overflow: 'hidden' },
  moneySym:      { padding: '0 8px', fontSize: 13, color: '#71717a', borderRight: '1px solid rgba(0,0,0,0.08)' },
  moneyInput:    { flex: 1, padding: '8px 10px', border: 'none', fontSize: 13, fontFamily: 'inherit', background: 'transparent', outline: 'none' },

  searchRow:     { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', border: '1px solid rgba(0,0,0,0.12)', borderRadius: 7, background: '#fff' },
  dropdown:      { position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, background: '#fff', border: '1px solid rgba(0,0,0,0.12)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.1)', marginTop: 4, overflow: 'hidden' },
  dropdownItem:  { display: 'flex', flexDirection: 'column', gap: 2, width: '100%', padding: '8px 12px', border: 'none', background: 'transparent', textAlign: 'left' as const, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, borderBottom: '1px solid rgba(0,0,0,0.05)' },
  customerLocked:{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 7 },

  addBtns:       { display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 },
  addTypeBtn:    { display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', border: '1.5px solid', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: '#fff', fontFamily: 'inherit' },

  cartList:       { display: 'flex', flexDirection: 'column', gap: 0, border: '1px solid rgba(0,0,0,0.08)', borderRadius: 10, overflow: 'hidden' },
  cartRow:        { padding: '12px 14px', borderBottom: '1px solid rgba(0,0,0,0.06)', background: '#fff', display: 'flex', flexDirection: 'column', gap: 4 },
  cartRowMain:    { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  cartRowLeft:    { display: 'flex', alignItems: 'flex-start', gap: 10, flex: 1, minWidth: 0 },
  cartRowRight:   { display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 },
  cartRowName:    { fontSize: 13, fontWeight: 600, color: '#18181b', lineHeight: 1.3 },
  cartRowNotes:   { fontSize: 11, color: '#71717a', marginTop: 2, fontStyle: 'italic' },
  cartRowPrice:   { fontSize: 14, fontWeight: 700, color: '#18181b', minWidth: 64, textAlign: 'right' as const },
  cartRowTax:     { fontSize: 11, color: '#71717a', paddingLeft: 2 },
  taxBadgeActive: { fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 5, border: '1px solid #bae6fd', background: '#f0f9ff', color: '#0369a1', cursor: 'pointer', fontFamily: 'inherit' },
  taxBadgeExempt: { fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 5, border: '1px solid #e4e4e7', background: '#f4f4f5', color: '#a1a1aa', cursor: 'pointer', fontFamily: 'inherit' },
  cartTotal:      { display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: '#f7f7f5' },
  discountRow:    { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, padding: '8px 14px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8 },
  discountLabel:  { fontSize: 13, fontWeight: 500, color: '#14532d' },
  emptyCart:      { padding: '28px 0', textAlign: 'center', fontSize: 13, color: '#a1a1aa' },
  pendingBanner: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, background: '#EFF4FB', border: '1px solid #97BBE9', borderRadius: 10, padding: '12px 16px', marginBottom: 16 },
  pendingBannerLeft: { display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 },
  pendingBannerText: { fontSize: 13, color: '#0d0d0d', whiteSpace: 'nowrap' as const },
  pendingBannerItems: { fontSize: 12, color: 'rgba(13,13,13,0.45)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const },
  pendingBannerBtn: { background: '#5581B1', color: '#fff', border: 'none', borderRadius: 7, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' as const, flexShrink: 0 },
  typeBadge:     { fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 5, flexShrink: 0, letterSpacing: '0.02em' },
  subtotalCell:  { fontSize: 13, fontWeight: 700, color: '#18181b', minWidth: 60, textAlign: 'right' as const },

  wigToggle:     { display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#5581B1', fontFamily: 'inherit', padding: '2px 0', fontWeight: 600 },
  wigSpecsGrid:  { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 8, padding: '10px 12px', background: '#f7f7f5', borderRadius: 8 },

  balanceRow:    { display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, padding: '8px 12px', background: '#f7f7f5', borderRadius: 8, fontSize: 13 },
  addSplitBtn:   { display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', background: 'transparent', border: '1px dashed rgba(0,0,0,0.2)', borderRadius: 6, fontSize: 11, fontWeight: 600, color: '#71717a', cursor: 'pointer', fontFamily: 'inherit', marginTop: 4 },

  saveBtn:       { width: '100%', padding: 12, background: '#212121', color: '#fff', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', marginTop: 8 },
  saveHint:      { fontSize: 11, color: '#a1a1aa', marginTop: 6, textAlign: 'center' as const },
  primaryBtn:    { padding: '8px 18px', background: '#212121', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  ghostBtn:      { padding: '8px 18px', background: 'transparent', color: '#71717a', border: '1px solid rgba(0,0,0,0.12)', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' },
  iconBtn:       { background: 'none', border: '1px solid rgba(0,0,0,0.1)', cursor: 'pointer', color: '#a1a1aa', padding: 5, borderRadius: 6, display: 'flex', alignItems: 'center' },

  saleCard:      { background: '#fff', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 10, overflow: 'hidden' },
  saleCardTop:   { display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px', cursor: 'pointer' },
  saleCardName:  { fontSize: 13, fontWeight: 600, color: '#18181b', display: 'block' },
  saleCardMeta:  { fontSize: 11, color: '#a1a1aa', display: 'block', marginTop: 2 },
  saleCardPrice: { fontSize: 14, fontWeight: 700, color: '#18181b', display: 'block' },
  saleCardBalance:{ fontSize: 11, color: '#DF5198', display: 'block' },
  saleCardExpanded:{ padding: '8px 14px', background: '#fafaf9', borderTop: '1px solid rgba(0,0,0,0.05)' },
  saleCardFooter:{ padding: '8px 14px', borderTop: '1px solid rgba(0,0,0,0.06)' },
  miniRow:       { display: 'flex', gap: 8, padding: '4px 0', alignItems: 'center' },
  receiptBtn:    { display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: '#212121', color: '#fff', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  deleteBtn:            { display: 'flex', alignItems: 'center', gap: 5, marginTop: 10, padding: '5px 10px', background: 'transparent', border: '1px solid #fca5a5', borderRadius: 6, fontSize: 11, fontWeight: 600, color: '#ef4444', cursor: 'pointer', fontFamily: 'inherit' },
  deleteConfirmBtn:     { padding: '7px 16px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  deleteDialog:         { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  deleteDialogInner:    { background: '#fff', borderRadius: 14, padding: '24px 28px', width: 420, maxWidth: '90vw', display: 'flex', flexDirection: 'column' as const, gap: 14, boxShadow: '0 12px 40px rgba(0,0,0,0.18)' },
  deleteDialogTitle:    { display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 700, color: '#18181b' },
  deleteDialogWarn:     { fontSize: 13, color: 'rgba(13,13,13,0.6)', margin: 0, lineHeight: 1.5 },
  deleteDialogLabel:    { fontSize: 12, fontWeight: 600, color: 'rgba(13,13,13,0.55)', letterSpacing: '0.01em' },
  deleteDialogTextarea: { border: '1px solid rgba(13,13,13,0.15)', borderRadius: 8, padding: '9px 12px', fontSize: 13, fontFamily: 'inherit', resize: 'vertical' as const, outline: 'none', color: '#18181b' },
  deleteDialogActions:  { display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 },

  emptyText:     { fontSize: 13, color: '#a1a1aa', textAlign: 'center' as const, padding: '20px 0' },

  // Wig linker
  wigLinkedChip:     { display: 'flex', alignItems: 'center', gap: 8, width: '100%', marginTop: 6, padding: '6px 10px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 7 },
  wigLinkerLabel:    { fontSize: 10, fontWeight: 700, color: '#a1a1aa', textTransform: 'uppercase' as const, letterSpacing: '0.05em' },
  wigSuggestionChip: { padding: '4px 10px', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 6, fontSize: 11, fontWeight: 600, color: '#0369a1', cursor: 'pointer', fontFamily: 'inherit' },
  wigSearchRow:      { display: 'flex', gap: 6, alignItems: 'center' },

  // Total box
  totalBox:          { border: '1px solid rgba(0,0,0,0.08)', borderRadius: 10, overflow: 'hidden' },
  totalRow:          { display: 'flex', justifyContent: 'space-between', padding: '8px 14px', fontSize: 13, color: '#52525b', borderBottom: '1px solid rgba(0,0,0,0.05)' },
  totalGrand:        { fontWeight: 700, fontSize: 15, color: '#18181b', background: '#f7f7f5', borderBottom: 'none' },

  // Staged wig balance payments summary
  stagedSection:  { marginBottom: 16, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: 12 },
  stagedTitle:    { display: 'flex', alignItems: 'center', fontSize: 11, fontWeight: 700, color: '#14532d', textTransform: 'uppercase' as const, letterSpacing: '0.05em', margin: '0 0 8px' },
  stagedRow:      { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, background: '#fff', borderRadius: 7, padding: '7px 10px', border: '1px solid rgba(0,0,0,0.07)' },
  stagedName:     { fontSize: 12, fontWeight: 600, color: '#18181b', display: 'block' },
  stagedMeta:     { fontSize: 11, color: '#71717a', display: 'block' },
  stagedAmt:      { fontSize: 13, fontWeight: 700, color: '#15803d', flexShrink: 0 },

  // Pending orders panel
  pendingPanel:  { marginBottom: 22, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: 14 },
  pendingTitle:  { display: 'flex', alignItems: 'center', fontSize: 12, fontWeight: 700, color: '#92400e', textTransform: 'uppercase' as const, letterSpacing: '0.05em', margin: '0 0 10px' },
  pendingRow:    { background: '#fff', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 8, padding: '10px 12px', marginBottom: 8, display: 'flex', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' as const },
  pendingWigName:{ fontSize: 13, fontWeight: 600, color: '#18181b' },
  pendingWigMeta:{ fontSize: 11, color: '#71717a', marginTop: 2 },
  pendingBalance:{ fontSize: 13, fontWeight: 700, color: '#DF5198', flexShrink: 0 },
  payBalanceBtn: { padding: '6px 12px', background: '#5581B1', color: '#fff', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 },
  pendingPayForm:{ width: '100%', marginTop: 10, padding: '10px 12px', background: '#f7f7f5', borderRadius: 8 },

  modalOverlay:  { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  modalBox:      { background: '#fff', borderRadius: 16, width: '90%', maxWidth: 700, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  modalHeader:   { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid rgba(0,0,0,0.08)' },
  modalTitle:    { fontSize: 14, fontWeight: 700, color: '#18181b' },
  printBtn:      { display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', background: '#212121', color: '#fff', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  receiptBody:   { padding: '28px 32px', overflow: 'auto', flex: 1, fontFamily: 'Arial, sans-serif', color: '#000', fontSize: 13 },
}

const r: Record<string, React.CSSProperties> = {
  logoBox:      { width: 52, height: 52, borderRadius: '50%', border: '2px solid #222', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  logoCircle:   { width: 32, height: 32, borderRadius: '50%', background: '#222' },
  salonName:    { fontSize: 20, fontWeight: 900, letterSpacing: '0.02em', lineHeight: 1.1 },
  salonSub:     { fontSize: 10, letterSpacing: '0.15em', marginTop: 2, color: '#555' },
  receiptNum:   { fontSize: 13, fontWeight: 700 },
  th:           { background: '#222', color: '#fff', padding: '5px 8px', textAlign: 'left' as const, fontSize: 11 },
  td:           { padding: '5px 8px', borderBottom: '1px solid #eee', fontSize: 12 },
  paymentsLabel:{ fontSize: 11, fontWeight: 700, marginBottom: 4, textTransform: 'uppercase' as const, letterSpacing: '0.05em' },
  balanceBox:   { padding: '4px 10px', fontWeight: 700, fontSize: 14, color: '#fff' },
  footer:       { textAlign: 'center' as const, marginTop: 32, fontSize: 12, color: '#333', paddingTop: 16, borderTop: '1px solid #eee' },
}

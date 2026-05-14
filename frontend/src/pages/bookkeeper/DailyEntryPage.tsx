import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'

// ── Types ────────────────────────────────────────────────────

type PaymentMethod = 'cash' | 'credit_card' | 'quickpay' | 'check' | 'zelle'
type WigStatus = 'ordered' | 'ready' | 'paid_in_full'

type WigPayment = {
  id: string
  payment_date: string
  amount: number
  payment_method: PaymentMethod
  payment_type: 'deposit' | 'partial' | 'final'
}

type WigOrder = {
  id: string
  daysmart_serial?: string
  customer_name: string
  customer_phone?: string
  brand?: string
  length?: string
  color?: string
  size?: string
  front?: string
  total_price: number
  amount_paid: number
  balance_due: number
  status: WigStatus
  order_date: string
  payments: WigPayment[]
}

type DailySummaryData = {
  total_wash_set: number; total_wig_sales: number; total_repairs: number; total_other: number
  cash_collected: number; quickpay_collected: number; cc_collected: number
  check_collected: number; zelle_collected: number
  new_wigs_sold: number; wigs_paid_full: number; chani_cuts: number
  wig_deposits_total: number; notes: string; is_locked: boolean; total_revenue: number
}

type NewWigForm = {
  daysmart_serial: string; customer_name: string; customer_phone: string
  brand: string; length: string; color: string; size: string; front: string
  base_price: string; fill_lace_price: string
  deposit_amount: string; deposit_method: PaymentMethod
}

type NewExpenseForm = {
  category: string; amount: string; vendor: string; notes: string
}

const EMPTY_WIG: NewWigForm = {
  daysmart_serial: '', customer_name: '', customer_phone: '',
  brand: '', length: '', color: '', size: '', front: '',
  base_price: '', fill_lace_price: '',
  deposit_amount: '', deposit_method: 'cash',
}

const EMPTY_EXPENSE: NewExpenseForm = {
  category: 'misc', amount: '', vendor: '', notes: '',
}

const PAYMENT_METHODS: PaymentMethod[] = ['cash', 'credit_card', 'quickpay', 'check', 'zelle']
const METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Cash', credit_card: 'Credit Card', quickpay: 'QuickPay', check: 'Check', zelle: 'Zelle',
}

const EXPENSE_CATEGORIES = [
  { value: 'misc', label: 'Misc' },
  { value: 'hair_supplies', label: 'Hair Supplies' },
  { value: 'grossman', label: 'Grossman' },
  { value: 'itzik', label: 'Itzik' },
  { value: 'monsey_driver', label: 'Monsey Driver' },
  { value: 'rent', label: 'Rent' },
  { value: 'phone_internet', label: 'Phone & Internet' },
  { value: 'shipping', label: 'Shipping' },
  { value: 'dalia_instagram', label: 'Dalia Instagram' },
  { value: 'work_purchases', label: 'Work Purchases' },
  { value: 'food', label: 'Food' },
  { value: 'sales_tax', label: 'Sales Tax' },
  { value: 'reconciliation', label: 'Reconciliation' },
  { value: 'other', label: 'Other' },
]

const BRANDS = ['RINA', 'RINA ELITE', 'BK', 'ROCHI LIPSKER', 'SARY', 'ZEHAVA', 'ELITE']
const TABS = ['Activity', 'Payments', 'Expenses', 'Revenue', 'Review']

// ── Main Component ───────────────────────────────────────────

export default function DailyEntryPage() {
  const [step, setStep] = useState(0)
  const [summaryDate, setSummaryDate] = useState(new Date().toISOString().split('T')[0])
  const [saved, setSaved] = useState(false)
  const [showWigForm, setShowWigForm] = useState(false)
  const [newWig, setNewWig] = useState<NewWigForm>(EMPTY_WIG)
  const [showExpenseForm, setShowExpenseForm] = useState(false)
  const [newExpense, setNewExpense] = useState<NewExpenseForm>(EMPTY_EXPENSE)
  const [pickupSearch, setPickupSearch] = useState('')
  const [pickupAmount, setPickupAmount] = useState('')
  const [pickupMethod, setPickupMethod] = useState<PaymentMethod>('cash')
  const [selectedPickupWig, setSelectedPickupWig] = useState<WigOrder | null>(null)

  // Payments fields
  const [payments, setPayments] = useState({
    cash_collected: '', quickpay_collected: '', cc_collected: '',
    check_collected: '', zelle_collected: '', wig_deposits_total: '',
  })
  // Activity counts
  const [activity, setActivity] = useState({
    chani_cuts: '', notes: '',
  })

  const qc = useQueryClient()

  // Load existing daily summary
  const { data: existing, isLoading } = useQuery({
    queryKey: ['daily-summary', summaryDate],
    queryFn: () => api.get(`/daily-summary/${summaryDate}`).then(r => r.data).catch(() => null),
  })

  // Load today's wig orders
  const { data: todayWigs = [] } = useQuery<WigOrder[]>({
    queryKey: ['wig-orders-date', summaryDate],
    queryFn: () => api.get(`/wig-orders/date/${summaryDate}`).then(r => r.data).catch(() => []),
  })

  // Search wigs for pickup
  const { data: searchResults = [] } = useQuery<WigOrder[]>({
    queryKey: ['wig-search', pickupSearch],
    queryFn: () => pickupSearch.length >= 2
      ? api.get(`/wig-orders/search?customer=${pickupSearch}`).then(r => r.data)
      : Promise.resolve([]),
    enabled: pickupSearch.length >= 2,
  })

  // Load today's expenses
  const { data: todayExpenses = [] } = useQuery({
    queryKey: ['expenses-date', summaryDate],
    queryFn: () => api.get(`/expenses/?start_date=${summaryDate}&end_date=${summaryDate}`).then(r => r.data).catch(() => []),
  })

  useEffect(() => {
    if (existing) {
      setPayments({
        cash_collected: String(existing.cash_collected),
        quickpay_collected: String(existing.quickpay_collected),
        cc_collected: String(existing.cc_collected),
        check_collected: String(existing.check_collected),
        zelle_collected: String(existing.zelle_collected),
        wig_deposits_total: String(existing.wig_deposits_total),
      })
      setActivity({ chani_cuts: String(existing.chani_cuts), notes: existing.notes || '' })
    }
  }, [existing])

  // Save/update daily summary
  const summaryMutation = useMutation({
    mutationFn: (data: object) =>
      existing
        ? api.patch(`/daily-summary/${summaryDate}`, data)
        : api.post('/daily-summary', data),
    onSuccess: () => {
      setSaved(true)
      qc.invalidateQueries({ queryKey: ['daily-summary'] })
      setTimeout(() => setSaved(false), 3000)
    },
  })

  const lockMutation = useMutation({
    mutationFn: () => api.post(`/daily-summary/${summaryDate}/lock`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['daily-summary'] }),
  })

  // Create wig order
  const wigMutation = useMutation({
    mutationFn: (data: object) => api.post('/wig-orders/', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wig-orders-date', summaryDate] })
      setNewWig(EMPTY_WIG)
      setShowWigForm(false)
    },
  })

  // Add payment to wig (pickup/final payment)
  const paymentMutation = useMutation({
    mutationFn: ({ wigId, data }: { wigId: string; data: object }) =>
      api.post(`/wig-orders/${wigId}/payments`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wig-orders-date'] })
      qc.invalidateQueries({ queryKey: ['wig-search'] })
      setSelectedPickupWig(null)
      setPickupSearch('')
      setPickupAmount('')
    },
  })

  // Create expense
  const expenseMutation = useMutation({
    mutationFn: (data: object) => api.post('/expenses/', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses-date'] })
      setNewExpense(EMPTY_EXPENSE)
      setShowExpenseForm(false)
    },
  })

  function handleSaveSummary() {
    const totalWigSales = todayWigs
      .filter(w => w.status === 'paid_in_full')
      .reduce((sum, w) => sum + w.total_price, 0)

    const totalWashSet = parseFloat((existing?.total_wash_set ?? 0).toString()) || 0
    const totalRepairs = parseFloat((existing?.total_repairs ?? 0).toString()) || 0

    summaryMutation.mutate({
      summary_date: summaryDate,
      total_wash_set: totalWashSet,
      total_wig_sales: totalWigSales,
      total_repairs: totalRepairs,
      total_other: 0,
      cash_collected: parseFloat(payments.cash_collected) || 0,
      quickpay_collected: parseFloat(payments.quickpay_collected) || 0,
      cc_collected: parseFloat(payments.cc_collected) || 0,
      check_collected: parseFloat(payments.check_collected) || 0,
      zelle_collected: parseFloat(payments.zelle_collected) || 0,
      new_wigs_sold: todayWigs.length,
      wigs_paid_full: todayWigs.filter(w => w.status === 'paid_in_full').length,
      chani_cuts: parseInt(activity.chani_cuts) || 0,
      wig_deposits_total: parseFloat(payments.wig_deposits_total) || 0,
      notes: activity.notes || null,
    })
  }

  function handleAddWig() {
    const totalPrice = (parseFloat(newWig.base_price) || 0) + (parseFloat(newWig.fill_lace_price) || 0)
    const depositAmt = parseFloat(newWig.deposit_amount) || 0
    wigMutation.mutate({
      daysmart_serial: newWig.daysmart_serial || null,
      customer_name: newWig.customer_name,
      customer_phone: newWig.customer_phone || null,
      brand: newWig.brand || null,
      length: newWig.length || null,
      color: newWig.color || null,
      size: newWig.size || null,
      front: newWig.front || null,
      base_price: parseFloat(newWig.base_price) || 0,
      fill_lace_price: parseFloat(newWig.fill_lace_price) || 0,
      total_price: totalPrice,
      order_date: summaryDate,
      initial_payment: depositAmt > 0 ? {
        payment_date: summaryDate,
        amount: depositAmt,
        payment_method: newWig.deposit_method,
        payment_type: 'deposit',
      } : null,
    })
  }

  function handlePickupPayment() {
    if (!selectedPickupWig || !pickupAmount) return
    paymentMutation.mutate({
      wigId: selectedPickupWig.id,
      data: {
        payment_date: summaryDate,
        amount: parseFloat(pickupAmount),
        payment_method: pickupMethod,
        payment_type: parseFloat(pickupAmount) >= selectedPickupWig.balance_due ? 'final' : 'partial',
      },
    })
  }

  function handleAddExpense() {
    expenseMutation.mutate({
      expense_date: summaryDate,
      category: newExpense.category,
      amount: parseFloat(newExpense.amount) || 0,
      vendor: newExpense.vendor || null,
      notes: newExpense.notes || null,
    })
  }

  if (isLoading) return <p style={{ color: '#71717a', fontSize: 14 }}>Loading…</p>

  const isLocked = existing?.is_locked
  const totalWigSales = todayWigs.filter(w => w.status === 'paid_in_full').reduce((s, w) => s + w.total_price, 0)
  const totalRevenue = totalWigSales + (existing?.total_wash_set || 0) + (existing?.total_repairs || 0)
  const totalCollected = ['cash_collected','cc_collected','quickpay_collected','check_collected','zelle_collected']
    .reduce((s, k) => s + (parseFloat(payments[k as keyof typeof payments] as string) || 0), 0)

  return (
    <div style={s.shell}>
      {/* ── Left: form ── */}
      <div style={s.formCol}>
        <header style={s.header}>
          <div>
            <h1 style={s.title}>Daily Entry</h1>
            <input type="date" value={summaryDate}
              onChange={e => { setSummaryDate(e.target.value) }}
              style={s.dateInput} disabled={isLocked} />
          </div>
          {isLocked && <span style={s.lockedBadge}>Locked</span>}
        </header>

        {isLocked ? (
          <div style={s.card}>
            <p style={{ color: '#71717a', fontSize: 14 }}>This day is locked.</p>
          </div>
        ) : (
          <>
            <div style={s.segmented}>
              {TABS.map((label, i) => (
                <button key={label} onClick={() => setStep(i)}
                  style={{ ...s.seg, ...(step === i ? s.segActive : {}) }}>
                  {label}
                </button>
              ))}
            </div>

            <div style={s.card}>
              {step === 0 && (
                <ActivityTab
                  summaryDate={summaryDate}
                  todayWigs={todayWigs}
                  showWigForm={showWigForm}
                  setShowWigForm={setShowWigForm}
                  newWig={newWig}
                  setNewWig={setNewWig}
                  onAddWig={handleAddWig}
                  wigMutation={wigMutation}
                  pickupSearch={pickupSearch}
                  setPickupSearch={setPickupSearch}
                  searchResults={searchResults}
                  selectedPickupWig={selectedPickupWig}
                  setSelectedPickupWig={setSelectedPickupWig}
                  pickupAmount={pickupAmount}
                  setPickupAmount={setPickupAmount}
                  pickupMethod={pickupMethod}
                  setPickupMethod={setPickupMethod}
                  onPickupPayment={handlePickupPayment}
                  paymentMutation={paymentMutation}
                  chaniCuts={activity.chani_cuts}
                  setChaniCuts={(v: string) => setActivity(p => ({ ...p, chani_cuts: v }))}
                  notes={activity.notes}
                  setNotes={(v: string) => setActivity(p => ({ ...p, notes: v }))}
                />
              )}

              {step === 1 && (
                <PaymentsTab
                  payments={payments}
                  setPayments={setPayments}
                  totalCollected={totalCollected}
                  wigDepositsTotal={parseFloat(payments.wig_deposits_total) || 0}
                  wigFullPayments={totalWigSales}
                />
              )}

              {step === 2 && (
                <ExpensesTab
                  summaryDate={summaryDate}
                  todayExpenses={todayExpenses}
                  showForm={showExpenseForm}
                  setShowForm={setShowExpenseForm}
                  newExpense={newExpense}
                  setNewExpense={setNewExpense}
                  onAdd={handleAddExpense}
                  expenseMutation={expenseMutation}
                />
              )}

              {step === 3 && (
                <RevenueTab
                  existing={existing}
                  todayWigs={todayWigs}
                  totalWigSales={totalWigSales}
                />
              )}

              {step === 4 && (
                <ReviewTab
                  summaryDate={summaryDate}
                  existing={existing}
                  payments={payments}
                  activity={activity}
                  todayWigs={todayWigs}
                  totalWigSales={totalWigSales}
                  totalRevenue={totalRevenue}
                  totalCollected={totalCollected}
                  wigDeposits={parseFloat(payments.wig_deposits_total) || 0}
                  todayExpenses={todayExpenses}
                  onSave={handleSaveSummary}
                  onLock={() => lockMutation.mutate()}
                  isSaving={summaryMutation.isPending}
                  isLocking={lockMutation.isPending}
                  saved={saved}
                  isError={summaryMutation.isError}
                />
              )}
            </div>

            <div style={s.navRow}>
              {step > 0 && <button onClick={() => setStep(p => p - 1)} style={s.navBtn}>← Previous</button>}
              {step < TABS.length - 1 && (
                <button onClick={() => setStep(p => p + 1)} style={{ ...s.navBtn, marginLeft: 'auto', color: '#212121' }}>
                  Next →
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── Right: live dashboard ── */}
      <div style={s.dashCol}>
        <div style={s.bigCard}>
          <p style={s.bigCardLabel}>Revenue Today</p>
          <p style={s.bigCardValue}>${totalRevenue.toFixed(2)}</p>
          <p style={s.bigCardSub}>services + full wig payments</p>
        </div>

        <div style={s.breakdownCard}>
          <p style={s.breakTitle}>Revenue Breakdown</p>
          <MiniBar label="Wig Sales (full)" amount={totalWigSales}
            pct={totalRevenue ? (totalWigSales / totalRevenue) * 100 : 0} color="#DF5198" />
          <MiniBar label="Wash & Set" amount={existing?.total_wash_set || 0}
            pct={totalRevenue ? ((existing?.total_wash_set || 0) / totalRevenue) * 100 : 0} color="#97BBE9" />
          <MiniBar label="Repairs" amount={existing?.total_repairs || 0}
            pct={totalRevenue ? ((existing?.total_repairs || 0) / totalRevenue) * 100 : 0} color="#E3CD94" />
        </div>

        <div style={s.breakdownCard}>
          <p style={s.breakTitle}>Collections vs Revenue</p>
          <div style={s.compareRow}>
            <span style={s.compareLabel}>Revenue</span>
            <span style={{ ...s.compareVal }}>${totalRevenue.toFixed(2)}</span>
          </div>
          <div style={s.compareRow}>
            <span style={s.compareLabel}>Collected (all)</span>
            <span style={{ ...s.compareVal, color: totalCollected > 0 ? '#18181b' : '#a1a1aa' }}>
              ${totalCollected.toFixed(2)}
            </span>
          </div>
          <div style={s.compareRow}>
            <span style={s.compareLabel}>Deposits (not revenue)</span>
            <span style={{ ...s.compareVal, color: '#5581B1' }}>
              ${(parseFloat(payments.wig_deposits_total) || 0).toFixed(2)}
            </span>
          </div>
        </div>

        <div style={s.countGrid}>
          <CountCard label="New Wigs" value={todayWigs.length} color="#DF5198" />
          <CountCard label="Picked Up" value={todayWigs.filter(w => w.status === 'paid_in_full').length} color="#10b981" />
          <CountCard label="Chani Cuts" value={parseInt(activity.chani_cuts) || 0} color="#5581B1" />
        </div>
      </div>
    </div>
  )
}

// ── Activity Tab ─────────────────────────────────────────────

function ActivityTab({
  summaryDate, todayWigs, showWigForm, setShowWigForm, newWig, setNewWig,
  onAddWig, wigMutation, pickupSearch, setPickupSearch, searchResults,
  selectedPickupWig, setSelectedPickupWig, pickupAmount, setPickupAmount,
  pickupMethod, setPickupMethod, onPickupPayment, paymentMutation,
  chaniCuts, setChaniCuts, notes, setNotes,
}: any) {
  const pendingWigs = searchResults.filter((w: WigOrder) => w.status !== 'paid_in_full')

  return (
    <div>
      {/* New wigs sold */}
      <SectionTitle>New Wigs Sold Today</SectionTitle>
      {todayWigs.length > 0 && (
        <div style={{ marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {todayWigs.map((w: WigOrder) => (
            <WigCard key={w.id} wig={w} />
          ))}
        </div>
      )}
      {showWigForm ? (
        <NewWigFormPanel
          wig={newWig} setWig={setNewWig}
          onSave={onAddWig} onCancel={() => setShowWigForm(false)}
          isSaving={wigMutation.isPending}
        />
      ) : (
        <button onClick={() => setShowWigForm(true)} style={s.addBtn}>+ Add New Wig</button>
      )}

      <div style={s.divider} />

      {/* Wigs picked up / final payment */}
      <SectionTitle>Wigs Picked Up Today</SectionTitle>
      <div style={{ marginBottom: 10 }}>
        <input
          placeholder="Search client name…"
          value={pickupSearch}
          onChange={e => setPickupSearch(e.target.value)}
          style={s.input}
        />
      </div>
      {pickupSearch.length >= 2 && pendingWigs.length > 0 && !selectedPickupWig && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
          {pendingWigs.map((w: WigOrder) => (
            <button key={w.id} onClick={() => setSelectedPickupWig(w)} style={s.wigSearchResult}>
              <span style={{ fontWeight: 600 }}>{w.customer_name}</span>
              <span style={{ color: '#71717a', fontSize: 12 }}>
                {[w.brand, w.daysmart_serial, w.length, w.color].filter(Boolean).join(' · ')}
              </span>
              <span style={{ color: '#DF5198', fontWeight: 600 }}>Balance: ${w.balance_due.toFixed(2)}</span>
            </button>
          ))}
        </div>
      )}
      {selectedPickupWig && (
        <div style={s.pickupPanel}>
          <p style={{ fontWeight: 600, marginBottom: 4 }}>{selectedPickupWig.customer_name}</p>
          <p style={{ fontSize: 12, color: '#71717a', marginBottom: 12 }}>
            {[selectedPickupWig.brand, selectedPickupWig.daysmart_serial, selectedPickupWig.length, selectedPickupWig.color].filter(Boolean).join(' · ')}
            {' · Balance: $'}{selectedPickupWig.balance_due.toFixed(2)}
          </p>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <div style={s.moneyRow}>
              <span style={s.moneySym}>$</span>
              <input type="number" min="0" step="0.01"
                value={pickupAmount}
                onChange={e => setPickupAmount(e.target.value)}
                placeholder={selectedPickupWig.balance_due.toFixed(2)}
                style={s.moneyInput}
              />
            </div>
            <MethodSelect value={pickupMethod} onChange={setPickupMethod} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onPickupPayment} disabled={paymentMutation.isPending} style={s.primaryBtn}>
              {paymentMutation.isPending ? 'Saving…' : 'Record Payment'}
            </button>
            <button onClick={() => setSelectedPickupWig(null)} style={s.ghostBtn}>Cancel</button>
          </div>
        </div>
      )}

      <div style={s.divider} />

      {/* Other activity */}
      <SectionTitle>Other Activity</SectionTitle>
      <div style={s.field}>
        <label style={s.fieldLabel}>Chani Cuts</label>
        <input type="number" min="0" step="1" value={chaniCuts}
          onChange={e => setChaniCuts(e.target.value)} style={s.input} placeholder="0" />
      </div>
      <div style={{ ...s.field, marginTop: 10 }}>
        <label style={s.fieldLabel}>Notes (optional)</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)}
          style={s.textarea} rows={2} placeholder="Any notes for today…" />
      </div>
    </div>
  )
}

// ── New Wig Form Panel ───────────────────────────────────────

function NewWigFormPanel({ wig, setWig, onSave, onCancel, isSaving }: any) {
  function set(field: keyof NewWigForm, value: string) {
    setWig((p: NewWigForm) => ({ ...p, [field]: value }))
  }
  const totalPrice = (parseFloat(wig.base_price) || 0) + (parseFloat(wig.fill_lace_price) || 0)

  return (
    <div style={s.wigFormPanel}>
      <p style={s.wigFormTitle}>New Wig Details</p>

      <div style={s.wigFormGrid}>
        <div style={s.field}>
          <label style={s.fieldLabel}>Client Name *</label>
          <input value={wig.customer_name} onChange={e => set('customer_name', e.target.value)}
            style={s.input} placeholder="Last, First" />
        </div>
        <div style={s.field}>
          <label style={s.fieldLabel}>Phone</label>
          <input value={wig.customer_phone} onChange={e => set('customer_phone', e.target.value)}
            style={s.input} placeholder="(917) 000-0000" />
        </div>
        <div style={s.field}>
          <label style={s.fieldLabel}>Serial / Model #</label>
          <input value={wig.daysmart_serial} onChange={e => set('daysmart_serial', e.target.value)}
            style={s.input} placeholder="rina44871" />
        </div>
        <div style={s.field}>
          <label style={s.fieldLabel}>Brand</label>
          <select value={wig.brand} onChange={e => set('brand', e.target.value)} style={s.select}>
            <option value="">— select —</option>
            {BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
        <div style={s.field}>
          <label style={s.fieldLabel}>Length</label>
          <input value={wig.length} onChange={e => set('length', e.target.value)}
            style={s.input} placeholder='14"' />
        </div>
        <div style={s.field}>
          <label style={s.fieldLabel}>Color</label>
          <input value={wig.color} onChange={e => set('color', e.target.value)}
            style={s.input} placeholder="2/8" />
        </div>
        <div style={s.field}>
          <label style={s.fieldLabel}>Size</label>
          <input value={wig.size} onChange={e => set('size', e.target.value)}
            style={s.input} placeholder="M" />
        </div>
        <div style={s.field}>
          <label style={s.fieldLabel}>Front</label>
          <input value={wig.front} onChange={e => set('front', e.target.value)}
            style={s.input} placeholder="Top Lace" />
        </div>
      </div>

      <div style={{ ...s.wigFormGrid, marginTop: 12 }}>
        <div style={s.field}>
          <label style={s.fieldLabel}>Wig Price</label>
          <div style={s.moneyRow}>
            <span style={s.moneySym}>$</span>
            <input type="number" min="0" step="0.01" value={wig.base_price}
              onChange={e => set('base_price', e.target.value)} style={s.moneyInput} placeholder="0.00" />
          </div>
        </div>
        <div style={s.field}>
          <label style={s.fieldLabel}>Fill Lace Add-on</label>
          <div style={s.moneyRow}>
            <span style={s.moneySym}>$</span>
            <input type="number" min="0" step="0.01" value={wig.fill_lace_price}
              onChange={e => set('fill_lace_price', e.target.value)} style={s.moneyInput} placeholder="0.00" />
          </div>
        </div>
        <div style={s.field}>
          <label style={s.fieldLabel}>Deposit Paid</label>
          <div style={s.moneyRow}>
            <span style={s.moneySym}>$</span>
            <input type="number" min="0" step="0.01" value={wig.deposit_amount}
              onChange={e => set('deposit_amount', e.target.value)} style={s.moneyInput} placeholder="0.00" />
          </div>
        </div>
        <div style={s.field}>
          <label style={s.fieldLabel}>Deposit Method</label>
          <MethodSelect value={wig.deposit_method} onChange={(v: string) => set('deposit_method', v as PaymentMethod)} />
        </div>
      </div>

      {totalPrice > 0 && (
        <div style={s.subtotal}>
          <span style={{ color: '#71717a', fontSize: 13 }}>Total Price</span>
          <span style={{ fontWeight: 700, fontSize: 17 }}>${totalPrice.toFixed(2)}</span>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        <button onClick={onSave} disabled={isSaving || !wig.customer_name} style={s.primaryBtn}>
          {isSaving ? 'Saving…' : 'Add Wig'}
        </button>
        <button onClick={onCancel} style={s.ghostBtn}>Cancel</button>
      </div>
    </div>
  )
}

// ── Payments Tab ─────────────────────────────────────────────

function PaymentsTab({ payments, setPayments, totalCollected, wigDepositsTotal, wigFullPayments }: any) {
  function set(field: string, value: string) {
    setPayments((p: any) => ({ ...p, [field]: value }))
  }
  const servicesCollected = totalCollected - wigDepositsTotal - wigFullPayments

  return (
    <div>
      <SectionTitle>All Money Received Today</SectionTitle>
      <p style={{ fontSize: 12, color: '#71717a', marginBottom: 14 }}>
        Enter totals by payment method — matches your CC batch + Zelle report + cash in drawer.
      </p>
      <div style={s.fields}>
        {PAYMENT_METHODS.map(method => (
          <MoneyField key={method}
            label={METHOD_LABELS[method]}
            value={payments[method === 'credit_card' ? 'cc_collected' : method === 'quickpay' ? 'quickpay_collected' : method === 'zelle' ? 'zelle_collected' : method === 'check' ? 'check_collected' : 'cash_collected']}
            onChange={v => set(method === 'credit_card' ? 'cc_collected' : method === 'quickpay' ? 'quickpay_collected' : method === 'zelle' ? 'zelle_collected' : method === 'check' ? 'check_collected' : 'cash_collected', v)}
          />
        ))}
      </div>

      <Subtotal label="Total Collected" value={totalCollected} />

      <div style={s.divider} />

      <SectionTitle>Breakdown</SectionTitle>
      <p style={{ fontSize: 12, color: '#71717a', marginBottom: 14 }}>
        Of the total collected, how much is wig deposits? (not counted as revenue)
      </p>
      <MoneyField label="Wig Deposits Today"
        value={payments.wig_deposits_total}
        onChange={v => set('wig_deposits_total', v)} />

      <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <BreakdownRow label="Wig Deposits (not revenue)" value={wigDepositsTotal} color="#5581B1" />
        <BreakdownRow label="Wig Full Payments (revenue)" value={wigFullPayments} color="#DF5198" />
        <BreakdownRow label="Services (estimated)" value={Math.max(0, servicesCollected)} color="#97BBE9" />
      </div>
    </div>
  )
}

// ── Expenses Tab ─────────────────────────────────────────────

function ExpensesTab({ summaryDate, todayExpenses, showForm, setShowForm, newExpense, setNewExpense, onAdd, expenseMutation }: any) {
  function set(field: keyof NewExpenseForm, value: string) {
    setNewExpense((p: NewExpenseForm) => ({ ...p, [field]: value }))
  }
  const totalExpenses = todayExpenses.reduce((s: number, e: any) => s + parseFloat(e.amount), 0)

  return (
    <div>
      <SectionTitle>Expenses for {summaryDate}</SectionTitle>

      {todayExpenses.length > 0 && (
        <div style={{ marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {todayExpenses.map((e: any) => (
            <div key={e.id} style={s.expenseRow}>
              <div>
                <span style={{ fontSize: 13, fontWeight: 500, color: '#18181b', textTransform: 'capitalize' }}>
                  {e.category.replace(/_/g, ' ')}
                </span>
                {e.vendor && <span style={{ fontSize: 12, color: '#71717a' }}> · {e.vendor}</span>}
              </div>
              <span style={{ fontWeight: 700, color: '#18181b' }}>${parseFloat(e.amount).toFixed(2)}</span>
            </div>
          ))}
          <div style={s.subtotal}>
            <span style={{ color: '#71717a', fontSize: 13 }}>Total Expenses</span>
            <span style={{ fontWeight: 700, fontSize: 17 }}>${totalExpenses.toFixed(2)}</span>
          </div>
        </div>
      )}

      {showForm ? (
        <div style={s.wigFormPanel}>
          <p style={s.wigFormTitle}>Add Expense</p>
          <div style={s.fields}>
            <div style={s.field}>
              <label style={s.fieldLabel}>Category</label>
              <select value={newExpense.category} onChange={e => set('category', e.target.value)} style={s.select}>
                {EXPENSE_CATEGORIES.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <MoneyField label="Amount" value={newExpense.amount} onChange={v => set('amount', v)} />
            <div style={s.field}>
              <label style={s.fieldLabel}>Vendor (optional)</label>
              <input value={newExpense.vendor} onChange={e => set('vendor', e.target.value)}
                style={s.input} placeholder="Who was it paid to?" />
            </div>
            <div style={s.field}>
              <label style={s.fieldLabel}>Notes (optional)</label>
              <input value={newExpense.notes} onChange={e => set('notes', e.target.value)}
                style={s.input} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <button onClick={onAdd} disabled={expenseMutation.isPending || !newExpense.amount} style={s.primaryBtn}>
              {expenseMutation.isPending ? 'Saving…' : 'Add Expense'}
            </button>
            <button onClick={() => setShowForm(false)} style={s.ghostBtn}>Cancel</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setShowForm(true)} style={s.addBtn}>+ Add Expense</button>
      )}
    </div>
  )
}

// ── Revenue Tab ──────────────────────────────────────────────

function RevenueTab({ existing, todayWigs, totalWigSales }: any) {
  const washSet = parseFloat(existing?.total_wash_set ?? 0) || 0
  const repairs = parseFloat(existing?.total_repairs ?? 0) || 0
  const totalRevenue = totalWigSales + washSet + repairs
  const pickedUpWigs = todayWigs.filter((w: WigOrder) => w.status === 'paid_in_full')

  return (
    <div>
      <SectionTitle>Revenue Today (Calculated)</SectionTitle>
      <p style={{ fontSize: 12, color: '#71717a', marginBottom: 16 }}>
        Revenue = services + wigs paid in full. Deposits are excluded.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <BreakdownRow label="Wig Full Payments" value={totalWigSales} color="#DF5198" />
        <BreakdownRow label="Wash & Set" value={washSet} color="#97BBE9" />
        <BreakdownRow label="Repairs" value={repairs} color="#E3CD94" />
      </div>

      <div style={{ ...s.subtotal, marginTop: 12 }}>
        <span style={{ color: '#71717a', fontSize: 13 }}>Total Revenue</span>
        <span style={{ fontWeight: 700, fontSize: 20 }}>${totalRevenue.toFixed(2)}</span>
      </div>

      {pickedUpWigs.length > 0 && (
        <>
          <div style={s.divider} />
          <SectionTitle>Wigs Paid in Full Today</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {pickedUpWigs.map((w: WigOrder) => (
              <WigCard key={w.id} wig={w} />
            ))}
          </div>
        </>
      )}

      <div style={s.divider} />
      <p style={{ fontSize: 12, color: '#a1a1aa' }}>
        W&S and Repairs totals come from the previous Revenue entry. Service revenue entry will be added to this tab in a future update.
      </p>
    </div>
  )
}

// ── Review Tab ───────────────────────────────────────────────

function ReviewTab({ summaryDate, payments, activity, todayWigs, totalWigSales, totalRevenue, totalCollected, wigDeposits, todayExpenses, onSave, onLock, isSaving, isLocking, saved, isError, existing }: any) {
  const totalExpenses = todayExpenses.reduce((s: number, e: any) => s + parseFloat(e.amount), 0)

  return (
    <div>
      <SectionTitle>Review & Save</SectionTitle>

      <p style={{ fontSize: 13, fontWeight: 600, color: '#18181b', marginBottom: 8 }}>Activity</p>
      <ReviewRow label="New Wigs Sold" value={String(todayWigs.length)} />
      <ReviewRow label="Wigs Paid in Full" value={String(todayWigs.filter((w: WigOrder) => w.status === 'paid_in_full').length)} />
      <ReviewRow label="Chani Cuts" value={activity.chani_cuts || '0'} />

      <div style={{ height: 12 }} />
      <p style={{ fontSize: 13, fontWeight: 600, color: '#18181b', marginBottom: 8 }}>Payments Collected</p>
      {PAYMENT_METHODS.map(m => {
        const key = m === 'credit_card' ? 'cc_collected' : m === 'quickpay' ? 'quickpay_collected' : m === 'zelle' ? 'zelle_collected' : m === 'check' ? 'check_collected' : 'cash_collected'
        const val = parseFloat(payments[key]) || 0
        if (val === 0) return null
        return <ReviewRow key={m} label={METHOD_LABELS[m]} value={`$${val.toFixed(2)}`} />
      })}
      <ReviewRow label="Wig Deposits (not revenue)" value={`$${wigDeposits.toFixed(2)}`} />
      <ReviewRow label="Total Collected" value={`$${totalCollected.toFixed(2)}`} />

      <div style={{ height: 12 }} />
      <p style={{ fontSize: 13, fontWeight: 600, color: '#18181b', marginBottom: 8 }}>Revenue</p>
      <ReviewRow label="Wig Full Payments" value={`$${totalWigSales.toFixed(2)}`} />
      <ReviewRow label="Total Revenue" value={`$${totalRevenue.toFixed(2)}`} />

      {totalExpenses > 0 && (
        <>
          <div style={{ height: 12 }} />
          <p style={{ fontSize: 13, fontWeight: 600, color: '#18181b', marginBottom: 8 }}>Expenses</p>
          <ReviewRow label="Total Expenses" value={`$${totalExpenses.toFixed(2)}`} last />
        </>
      )}

      <div style={s.actions}>
        <button onClick={onSave} disabled={isSaving} style={s.primaryBtn}>
          {isSaving ? 'Saving…' : existing ? 'Update Day' : 'Save Day'}
        </button>
        {existing && !existing.is_locked && (
          <button onClick={onLock} disabled={isLocking} style={s.ghostBtn}>
            {isLocking ? 'Locking…' : 'Lock Day'}
          </button>
        )}
      </div>
      {saved && <p style={s.success}>Saved successfully.</p>}
      {isError && <p style={s.errorMsg}>Error saving. Try again.</p>}
    </div>
  )
}

// ── Shared Sub-components ────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 style={s.sectionTitle}>{children}</h2>
}

function WigCard({ wig }: { wig: WigOrder }) {
  const isPaid = wig.status === 'paid_in_full'
  return (
    <div style={{ ...s.wigCard, borderLeft: `3px solid ${isPaid ? '#10b981' : '#DF5198'}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <p style={{ margin: 0, fontWeight: 600, fontSize: 13 }}>{wig.customer_name}</p>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: '#71717a' }}>
            {[wig.brand, wig.daysmart_serial, wig.length, wig.color].filter(Boolean).join(' · ')}
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ margin: 0, fontWeight: 700, fontSize: 13 }}>${wig.total_price.toFixed(2)}</p>
          <p style={{ margin: '2px 0 0', fontSize: 11, color: isPaid ? '#10b981' : '#DF5198', fontWeight: 600 }}>
            {isPaid ? 'Paid in Full' : `Balance: $${wig.balance_due.toFixed(2)}`}
          </p>
        </div>
      </div>
    </div>
  )
}

function MoneyField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div style={s.field}>
      <label style={s.fieldLabel}>{label}</label>
      <div style={s.moneyRow}>
        <span style={s.moneySym}>$</span>
        <input type="number" min="0" step="0.01" value={value}
          onChange={e => onChange(e.target.value)} style={s.moneyInput} placeholder="0.00" />
      </div>
    </div>
  )
}

function MethodSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} style={{ ...s.select, minWidth: 120 }}>
      {PAYMENT_METHODS.map(m => <option key={m} value={m}>{METHOD_LABELS[m]}</option>)}
    </select>
  )
}

function Subtotal({ label, value }: { label: string; value: number }) {
  return (
    <div style={s.subtotal}>
      <span style={{ color: '#71717a', fontSize: 13 }}>{label}</span>
      <span style={{ fontWeight: 700, color: '#18181b', fontSize: 17, letterSpacing: '-0.02em' }}>${value.toFixed(2)}</span>
    </div>
  )
}

function BreakdownRow({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
        <span style={{ fontSize: 13, color: '#71717a' }}>{label}</span>
      </div>
      <span style={{ fontSize: 14, fontWeight: 600, color: '#18181b' }}>${value.toFixed(2)}</span>
    </div>
  )
}

function ReviewRow({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: last ? 'none' : '1px solid rgba(0,0,0,0.06)' }}>
      <span style={{ color: '#71717a', fontSize: 14 }}>{label}</span>
      <span style={{ color: '#18181b', fontWeight: 500, fontSize: 14 }}>{value}</span>
    </div>
  )
}

function MiniBar({ label, pct, amount, color }: { label: string; pct: number; amount: number; color: string }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
        <span style={{ fontSize: 12, color: '#71717a' }}>{label}</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#18181b' }}>${amount.toFixed(2)}</span>
      </div>
      <div style={{ height: 6, background: '#f4f4f5', borderRadius: 99 }}>
        <div style={{ height: 6, width: `${Math.min(pct, 100)}%`, background: color, borderRadius: 99, transition: 'width 0.4s ease' }} />
      </div>
    </div>
  )
}

function CountCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ background: '#fff', borderRadius: 14, padding: '14px', boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.05)', flex: 1 }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, marginBottom: 8 }} />
      <p style={{ fontSize: 24, fontWeight: 700, color: '#18181b', margin: '0 0 4px', letterSpacing: '-0.03em' }}>{value}</p>
      <p style={{ fontSize: 10, color: '#a1a1aa', margin: 0, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</p>
    </div>
  )
}

// ── Styles ───────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  shell: { display: 'flex', gap: 28, alignItems: 'flex-start' },
  formCol: { flex: '0 0 520px', minWidth: 0 },
  dashCol: { flex: 1, display: 'flex', flexDirection: 'column', gap: 14, position: 'sticky', top: 36 },

  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, paddingBottom: 20, borderBottom: '1px solid rgba(0,0,0,0.07)' },
  title: { fontSize: 26, fontWeight: 700, color: '#18181b', margin: '0 0 10px', letterSpacing: '-0.03em' },
  dateInput: { border: '1px solid rgba(0,0,0,0.12)', borderRadius: 8, padding: '6px 10px', fontSize: 13, color: '#18181b', background: '#fff', fontFamily: 'inherit', outline: 'none' },
  lockedBadge: { background: '#18181b', color: '#fff', padding: '5px 14px', borderRadius: 20, fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' },

  segmented: { display: 'flex', background: 'rgba(120,120,128,0.12)', borderRadius: 10, padding: 3, marginBottom: 16, gap: 2 },
  seg: { flex: 1, padding: '6px 0', border: 'none', background: 'transparent', borderRadius: 8, fontSize: 12, fontWeight: 500, color: '#71717a', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' },
  segActive: { background: '#fff', color: '#18181b', boxShadow: '0 1px 4px rgba(0,0,0,0.12)' },

  card: { background: '#fff', borderRadius: 16, padding: '22px', boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.05)' },
  sectionTitle: { fontSize: 11, fontWeight: 700, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 12px' },
  fields: { display: 'flex', flexDirection: 'column', gap: 12 },
  divider: { height: 1, background: 'rgba(0,0,0,0.07)', margin: '18px 0' },

  field: { display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0 },
  fieldLabel: { fontSize: 12, fontWeight: 500, color: '#71717a' },
  moneyRow: { display: 'flex', alignItems: 'center', border: '1px solid rgba(0,0,0,0.12)', borderRadius: 10, overflow: 'hidden', background: '#f9f9f9' },
  moneySym: { padding: '10px 10px', color: '#71717a', fontSize: 14, borderRight: '1px solid rgba(0,0,0,0.08)' },
  moneyInput: { flex: 1, border: 'none', padding: '10px 10px', fontSize: 15, color: '#18181b', outline: 'none', background: 'transparent', fontFamily: 'inherit' },
  input: { border: '1px solid rgba(0,0,0,0.12)', borderRadius: 10, padding: '10px 12px', fontSize: 14, color: '#18181b', background: '#f9f9f9', outline: 'none', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' },
  select: { border: '1px solid rgba(0,0,0,0.12)', borderRadius: 10, padding: '10px 12px', fontSize: 14, color: '#18181b', background: '#f9f9f9', outline: 'none', fontFamily: 'inherit', width: '100%' },
  textarea: { border: '1px solid rgba(0,0,0,0.12)', borderRadius: 10, padding: '10px 12px', fontSize: 14, color: '#18181b', background: '#f9f9f9', resize: 'vertical', outline: 'none', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' },

  subtotal: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, padding: '12px 14px', background: '#f4f4f5', borderRadius: 10 },

  addBtn: { width: '100%', padding: '12px', border: '1px dashed rgba(0,0,0,0.2)', borderRadius: 12, background: 'transparent', fontSize: 14, color: '#71717a', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center' },
  primaryBtn: { flex: 1, background: '#212121', color: '#fff', border: 'none', borderRadius: 12, padding: '13px', fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  ghostBtn: { background: 'none', border: '1px solid rgba(0,0,0,0.14)', borderRadius: 12, padding: '13px 20px', fontSize: 14, cursor: 'pointer', color: '#71717a', fontFamily: 'inherit' },
  actions: { display: 'flex', gap: 10, marginTop: 22 },
  success: { color: '#10b981', fontSize: 13, marginTop: 10 },
  errorMsg: { color: '#ff3b30', fontSize: 13, marginTop: 10 },

  navRow: { display: 'flex', justifyContent: 'space-between', marginTop: 12 },
  navBtn: { background: 'none', border: 'none', padding: '8px 0', fontSize: 14, cursor: 'pointer', color: '#71717a', fontFamily: 'inherit' },

  wigFormPanel: { border: '1px solid rgba(0,0,0,0.1)', borderRadius: 14, padding: 18, background: '#fafaf9', marginBottom: 12, overflow: 'hidden' },
  wigFormTitle: { fontSize: 13, fontWeight: 600, color: '#18181b', margin: '0 0 14px' },
  wigFormGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, minWidth: 0 },

  wigCard: { padding: '10px 14px', background: '#f9f9f9', borderRadius: 10, border: '1px solid rgba(0,0,0,0.07)' },
  wigSearchResult: { display: 'flex', flexDirection: 'column', gap: 2, padding: '10px 14px', background: '#f9f9f9', borderRadius: 10, border: '1px solid rgba(0,0,0,0.1)', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' },
  pickupPanel: { border: '1px solid rgba(0,0,0,0.1)', borderRadius: 14, padding: 16, background: '#fff5f9', marginBottom: 12 },

  expenseRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 12px', background: '#f9f9f9', borderRadius: 10 },

  compareRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(0,0,0,0.05)' },
  compareLabel: { fontSize: 13, color: '#71717a' },
  compareVal: { fontSize: 14, fontWeight: 600, color: '#18181b' },

  /* Dashboard column */
  bigCard: { background: '#fff', borderRadius: 12, padding: '20px 22px', border: '1px solid #e4e4e7' },
  bigCardLabel: { fontSize: 11, fontWeight: 500, color: '#71717a', letterSpacing: '0.04em', textTransform: 'uppercase', margin: '0 0 6px' },
  bigCardValue: { fontSize: 32, fontWeight: 700, color: '#18181b', letterSpacing: '-0.03em', margin: '0 0 4px' },
  bigCardSub: { fontSize: 11, color: '#a1a1aa', margin: 0 },

  breakdownCard: { background: '#fff', borderRadius: 16, padding: '18px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.05)' },
  breakTitle: { fontSize: 12, fontWeight: 600, color: '#18181b', margin: '0 0 14px', letterSpacing: '-0.01em' },
  countGrid: { display: 'flex', gap: 8 },
}
